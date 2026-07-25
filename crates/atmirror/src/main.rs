//! `atmirror` CLI.
//!
//! ```text
//! atmirror mirror  --actor <did-or-handle> --rail arweave|autonomi
//!                  (--wallet <jwk.json> | --ephemeral-key)   # arweave only
//!                  [--out DIR] [--plc URL] [--appview URL]
//!                  [--bundler URL] [--gateway URL ...] [--ant-bin PATH]
//! atmirror restore --manifest FILE --out DIR
//!                  [--signing-key zMULTIBASE | --plc URL]
//!                  [--gateway URL ...] [--ant-bin PATH]
//! atmirror verify  --manifest FILE [same flags as restore]
//! ```
//!
//! Exit codes: 0 success · 1 verification refusal/failure · 2 usage ·
//! 3 transport/infrastructure.

use std::path::PathBuf;
use std::process::ExitCode;

use atmirror::arweave::{ArweaveRail, DEFAULT_BUNDLER};
use atmirror::autonomi::AntCli;
use atmirror::commit::SigningKey;
use atmirror::did::{identity_from_document, DidDirectory, HttpDirectory};
use atmirror::mirror::{mirror, MirrorError};
use atmirror::rail::Rail;
use atmirror::receipt::Receipt;
use atmirror::restore::{restore, Authorship, RestoreError};
use atmirror::state::State;
use atmirror::xrpc::{resolve_handle, HttpPds, Pds};

const DEFAULT_PLC: &str = "https://plc.directory";
const DEFAULT_APPVIEW: &str = "https://public.api.bsky.app";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some((cmd, rest)) = args.split_first() else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    let flags = match Flags::parse(rest) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("error: {e}\n\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    let result = match cmd.as_str() {
        "check" => cmd_check(&flags),
        "mirror" => cmd_mirror(&flags),
        "restore" => cmd_restore(&flags, true),
        "verify" => cmd_restore(&flags, false),
        other => {
            eprintln!("unknown command {other:?}\n\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(CliError::Usage(e)) => {
            eprintln!("error: {e}\n\n{USAGE}");
            ExitCode::from(2)
        }
        Err(CliError::Refused(e)) => {
            eprintln!("{e}");
            ExitCode::from(1)
        }
        Err(CliError::Infra(e)) => {
            eprintln!("error: {e}");
            ExitCode::from(3)
        }
    }
}

const USAGE: &str =
    "atmirror — mirror an AT Protocol repo to a permanence rail (SPEC_LEXICON-1 adjacent)

USAGE:
  atmirror check   --actor <did-or-handle> [--plc URL] [--appview URL]
                   # fetch + verify only; uploads nothing, writes nothing
  atmirror mirror  --actor <did-or-handle> --rail <arweave|autonomi>
                   (--wallet <jwk.json> | --ephemeral-key)      # arweave signer
                   [--out DIR] [--plc URL] [--appview URL]
                   [--bundler URL] [--gateway URL]... [--ant-bin PATH]
  atmirror restore --manifest FILE --out DIR
                   [--signing-key zMULTIBASE | --resolve-did] [--plc URL]
                   [--gateway URL]... [--ant-bin PATH]
  atmirror verify  --manifest FILE
                   [--signing-key zMULTIBASE | --resolve-did] [--plc URL]
                   [--gateway URL]... [--ant-bin PATH]

Notes:
  --ephemeral-key generates a throwaway RSA-4096 signer in-process (client-side
  signing; no custody anywhere). Fine for free-tier uploads: permanence binds to
  content hashes, not signer identity. Use --wallet for a persistent uploader id.
  restore/verify DEFAULT IS OFFLINE-OR-FAIL: they contact only the rail; s8
  steps 1-5 run, and step 6 (authorship) is reported NOT PERFORMED unless you
  pass --signing-key (offline, proven) or --resolve-did (explicit opt-in to a
  network DID resolver - independence granted by it, not proven). The PDS is
  never contacted on this path in any mode.";

enum CliError {
    Usage(String),
    Refused(String),
    Infra(String),
}

#[derive(Default)]
struct Flags {
    actor: Option<String>,
    rail: Option<String>,
    wallet: Option<String>,
    ephemeral_key: bool,
    out: Option<String>,
    plc: Option<String>,
    appview: Option<String>,
    bundler: Option<String>,
    gateways: Vec<String>,
    ant_bin: Option<String>,
    manifest: Option<String>,
    signing_key: Option<String>,
    /// Explicit opt-in to network DID resolution on the verify/restore
    /// path (CC-1). Named so the user knows what they are permitting.
    resolve_did: bool,
}

impl Flags {
    fn parse(args: &[String]) -> Result<Flags, String> {
        let mut f = Flags::default();
        let mut it = args.iter();
        while let Some(a) = it.next() {
            let mut take = |name: &str| -> Result<String, String> {
                it.next()
                    .cloned()
                    .ok_or_else(|| format!("{name} requires a value"))
            };
            match a.as_str() {
                "--actor" => f.actor = Some(take("--actor")?),
                "--rail" => f.rail = Some(take("--rail")?),
                "--wallet" => f.wallet = Some(take("--wallet")?),
                "--ephemeral-key" => f.ephemeral_key = true,
                "--out" => f.out = Some(take("--out")?),
                "--plc" => f.plc = Some(take("--plc")?),
                "--appview" => f.appview = Some(take("--appview")?),
                "--bundler" => f.bundler = Some(take("--bundler")?),
                "--gateway" => f.gateways.push(take("--gateway")?),
                "--ant-bin" => f.ant_bin = Some(take("--ant-bin")?),
                "--manifest" => f.manifest = Some(take("--manifest")?),
                "--signing-key" => f.signing_key = Some(take("--signing-key")?),
                "--resolve-did" => f.resolve_did = true,
                other => return Err(format!("unknown flag {other:?}")),
            }
        }
        Ok(f)
    }
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn build_rail(flags: &Flags, rail_name: &str, for_upload: bool) -> Result<Box<dyn Rail>, CliError> {
    match rail_name {
        "arweave" | "ar" => {
            if !for_upload {
                return Ok(Box::new(ArweaveRail::read_only(&flags.gateways)));
            }
            let bundler = flags.bundler.as_deref().unwrap_or(DEFAULT_BUNDLER);
            match (&flags.wallet, flags.ephemeral_key) {
                (Some(path), false) => ArweaveRail::from_jwk_file(path, bundler, &flags.gateways)
                    .map(|r| Box::new(r) as Box<dyn Rail>)
                    .map_err(|e| CliError::Infra(e.to_string())),
                (None, true) => {
                    eprintln!(
                        "note: generating a throwaway RSA-4096 signer (client-side; \
                         --wallet for a persistent identity). This can take a while."
                    );
                    ArweaveRail::ephemeral(bundler, &flags.gateways)
                        .map(|r| Box::new(r) as Box<dyn Rail>)
                        .map_err(|e| CliError::Infra(e.to_string()))
                }
                (Some(_), true) => Err(CliError::Usage(
                    "--wallet and --ephemeral-key are mutually exclusive".into(),
                )),
                (None, false) => Err(CliError::Usage(
                    "arweave uploads need a signer: --wallet <jwk.json> or --ephemeral-key".into(),
                )),
            }
        }
        "autonomi" | "ant" => Ok(Box::new(AntCli::new(
            flags.ant_bin.as_deref().unwrap_or("ant"),
        ))),
        other => Err(CliError::Usage(format!(
            "--rail {other:?} (want arweave or autonomi)"
        ))),
    }
}

/// Resolve an actor (handle or DID) to a verified [`AccountIdentity`].
fn resolve_actor(flags: &Flags, actor: &str) -> Result<atmirror::did::AccountIdentity, CliError> {
    let plc = flags.plc.as_deref().unwrap_or(DEFAULT_PLC);
    let appview = flags.appview.as_deref().unwrap_or(DEFAULT_APPVIEW);
    let did = if actor.starts_with("did:") {
        actor.to_string()
    } else {
        let did = resolve_handle(appview, actor).map_err(|e| CliError::Infra(e.to_string()))?;
        println!("resolved handle {actor} -> {did}");
        did
    };
    let directory = HttpDirectory::new(plc);
    let doc = directory
        .did_document(&did)
        .map_err(|e| CliError::Infra(e.to_string()))?;
    let identity =
        identity_from_document(&did, &doc).map_err(|e| CliError::Refused(e.to_string()))?;
    println!(
        "identity: did={} pds={} key={} ({})",
        identity.did,
        identity.pds,
        identity.signing_key_multibase,
        identity.signing_key.curve_name()
    );
    if !actor.starts_with("did:") && !identity.handles.iter().any(|h| h == actor) {
        println!(
            "warning: DID document alsoKnownAs {:?} does not list {actor} — proceeding on the DID",
            identity.handles
        );
    }
    Ok(identity)
}

/// Fetch + verify only. K-4 gates 1–3 against the live PDS; nothing is
/// uploaded, nothing is written.
fn cmd_check(flags: &Flags) -> Result<(), CliError> {
    use atmirror::car::Car;
    use atmirror::cbor;
    use atmirror::commit::SignedCommit;
    use atmirror::mst;

    let actor = flags
        .actor
        .as_deref()
        .ok_or_else(|| CliError::Usage("--actor is required".into()))?;
    let identity = resolve_actor(flags, actor)?;
    let pds = HttpPds::new(&identity.pds);

    let car_bytes = pds
        .get_repo(&identity.did)
        .map_err(|e| CliError::Infra(format!("getRepo: {e}")))?;
    let car = Car::parse_and_verify(&car_bytes)
        .map_err(|e| CliError::Refused(format!("REFUSED: CAR verification: {e}")))?;
    let commit_block = car.get(&car.root).expect("root proven present");
    let commit = SignedCommit::parse(car.root.clone(), commit_block)
        .map_err(|e| CliError::Refused(format!("REFUSED: commit parse: {e}")))?;
    if commit.did != identity.did {
        return Err(CliError::Refused(format!(
            "REFUSED: commit did {} != account {}",
            commit.did, identity.did
        )));
    }
    commit
        .verify_signature(&identity.signing_key)
        .map_err(|e| CliError::Refused(format!("REFUSED: commit signature: {e}")))?;
    let records = mst::walk(&car, &commit.data)
        .map_err(|e| CliError::Refused(format!("REFUSED: MST completeness: {e}")))?;

    let mut refs = Vec::new();
    for rec in &records {
        let value = cbor::decode(car.get(&rec.cid).expect("walk proved presence"))
            .map_err(|e| CliError::Refused(format!("REFUSED: record {}: {e}", rec.path)))?;
        mst::scan_blob_refs(&value, &mut refs);
    }
    let record_derived = mst::dedup_blob_refs(refs).len();
    let listed = pds.list_blobs(&identity.did).unwrap_or_default();
    println!(
        "\nCHECK PASS {}\n  commit {} rev {} ({} signature valid, low-S)\n  car: {} bytes, {} blocks, every block re-hashed to its CID\n  mst: complete, {} records\n  blobs: {} referenced by records, {} listed by PDS",
        identity.did,
        commit.cid.to_string_b32(),
        commit.rev,
        identity.signing_key.curve_name(),
        car_bytes.len(),
        car.block_count(),
        records.len(),
        record_derived,
        listed.len(),
    );
    for r in &records {
        println!("  record: {}", r.path);
    }
    Ok(())
}

fn cmd_mirror(flags: &Flags) -> Result<(), CliError> {
    let actor = flags
        .actor
        .as_deref()
        .ok_or_else(|| CliError::Usage("--actor is required".into()))?;
    let rail_name = flags
        .rail
        .as_deref()
        .ok_or_else(|| CliError::Usage("--rail is required".into()))?;
    let identity = resolve_actor(flags, actor)?;
    let pds = HttpPds::new(&identity.pds);
    let mut rail = build_rail(flags, rail_name, true)?;

    let out_root = PathBuf::from(flags.out.as_deref().unwrap_or("mirror-out"));
    let account_dir = out_root.join(identity.did.replace(':', "_"));
    std::fs::create_dir_all(&account_dir)
        .map_err(|e| CliError::Infra(format!("{}: {e}", account_dir.display())))?;
    let state_path = account_dir.join("state.json");
    let mut state = State::load(&state_path, &identity.did).map_err(CliError::Infra)?;

    let report = mirror(&pds, &identity, rail.as_mut(), &mut state, &now_rfc3339()).map_err(
        |e| match e {
            MirrorError::Refused(_) => CliError::Refused(e.to_string()),
            MirrorError::Fetch(_) | MirrorError::Upload(_) => CliError::Infra(e.to_string()),
            MirrorError::StateIo(m) => CliError::Infra(m),
        },
    )?;

    state.save(&state_path).map_err(CliError::Infra)?;

    for w in &report.warnings {
        println!("warning: {w}");
    }
    let cid8: String = report.commit_cid.chars().rev().take(8).collect::<String>();
    let cid8: String = cid8.chars().rev().collect();
    if let Some(car) = &report.car_bytes {
        let car_path = account_dir.join(format!("repo-{}-{cid8}.car", report.rev));
        std::fs::write(&car_path, car)
            .map_err(|e| CliError::Infra(format!("{}: {e}", car_path.display())))?;
        println!("car: {} ({} bytes)", car_path.display(), car.len());
    }
    let manifest_path = account_dir.join(format!("receipt-{cid8}.json"));
    let manifest_json = serde_json::to_string_pretty(&report.receipt)
        .map_err(|e| CliError::Infra(e.to_string()))?;
    std::fs::write(&manifest_path, manifest_json.as_bytes())
        .map_err(|e| CliError::Infra(format!("{}: {e}", manifest_path.display())))?;

    println!(
        "\nMIRROR {}: commit {} rev {}\n  blocks verified: {}  records: {}\n  \
         blobs: {} uploaded, {} reused, {} missing, {} corrupt-refused, {} upload-refused\n  \
         signing key (pin for offline verify): {}\n  car reused: {}\n  manifest: {}",
        report.did,
        report.commit_cid,
        report.rev,
        report.verified_blocks,
        report.records,
        report.blobs_uploaded,
        report.blobs_reused,
        report.missing_blobs.len(),
        report.corrupt_blobs.len(),
        report.refused_uploads.len(),
        report.signing_key_multibase,
        report.car_reused,
        manifest_path.display(),
    );
    for m in &report.missing_blobs {
        println!("  missing blob: {m}");
    }
    for c in &report.corrupt_blobs {
        println!("  corrupt blob (refused): {c}");
    }
    for r in &report.refused_uploads {
        println!("  upload refused by rail: {r}");
    }
    println!("\n{manifest_json}");
    Ok(())
}

fn load_receipt(path: &str) -> Result<Receipt, CliError> {
    let raw = std::fs::read(path).map_err(|e| CliError::Infra(format!("{path}: {e}")))?;
    serde_json::from_slice(&raw).map_err(|e| CliError::Refused(format!("{path}: {e}")))
}

fn cmd_restore(flags: &Flags, write_out: bool) -> Result<(), CliError> {
    let manifest = flags
        .manifest
        .as_deref()
        .ok_or_else(|| CliError::Usage("--manifest is required".into()))?;
    let receipt = load_receipt(manifest)?;

    // Rail choice follows the receipt's anchor.
    let rail: Box<dyn Rail> = if receipt.arweave.is_some() {
        Box::new(ArweaveRail::read_only(&flags.gateways))
    } else if receipt.autonomi.is_some() {
        Box::new(AntCli::new(flags.ant_bin.as_deref().unwrap_or("ant")))
    } else {
        return Err(CliError::Refused(
            "receipt carries no rail anchor (claim state, §4.1) — nothing to restore from".into(),
        ));
    };

    // §8 step 6 key source — DEFAULT IS OFFLINE-OR-FAIL (CC-1, ratified).
    // Three legible modes, stated in the output so a green result says
    // whether independence was PROVEN or GRANTED:
    //   --signing-key  → offline, pinned key. PROVEN.
    //   --resolve-did  → explicit opt-in to a network DID resolver. GRANTED
    //                    (the resolver is a trusted party in this mode).
    //   neither        → steps 1–5 only; step 6 reported NOT PERFORMED.
    // The resolver is constructed ONLY inside the opt-in branch — grep
    // `HttpDirectory` in this file: on the verify/restore path it appears
    // nowhere else.
    let (key, mode_line) = match (&flags.signing_key, flags.resolve_did) {
        (Some(_), true) => {
            return Err(CliError::Usage(
                "--signing-key and --resolve-did are mutually exclusive: pin the key \
                 (offline, proven) or permit network resolution (granted) — not both"
                    .into(),
            ))
        }
        (Some(mb), false) => {
            let key = SigningKey::from_multibase(mb)
                .map_err(|e| CliError::Refused(format!("--signing-key: {e}")))?;
            (
                Some(key),
                "authorship (§8 step 6): key pinned via --signing-key — OFFLINE mode, \
                 independence PROVEN if it verifies"
                    .to_string(),
            )
        }
        (None, true) => {
            let did = receipt
                .subject
                .uri
                .strip_prefix("at://")
                .unwrap_or_default()
                .to_string();
            let plc = flags.plc.as_deref().unwrap_or(DEFAULT_PLC);
            let directory = HttpDirectory::new(plc);
            let doc = directory
                .did_document(&did)
                .map_err(|e| CliError::Infra(e.to_string()))?;
            let identity =
                identity_from_document(&did, &doc).map_err(|e| CliError::Refused(e.to_string()))?;
            (
                Some(identity.signing_key),
                format!(
                    "authorship (§8 step 6): key NETWORK-RESOLVED from {plc} (--resolve-did) \
                     — independence GRANTED by that resolver, not proven; resolved key {}",
                    identity.signing_key_multibase
                ),
            )
        }
        (None, false) => (
            None,
            "authorship (§8 step 6): NOT PERFORMED — no key supplied and network DID \
             resolution not permitted (default is offline-or-fail). Steps 1–5 ran against \
             the rail alone. To check authorship: --signing-key <zMultibase> (offline, \
             proven) or --resolve-did (network, granted)"
                .to_string(),
        ),
    };

    let outcome = restore(&receipt, rail.as_ref(), key.as_ref()).map_err(|e| match e {
        RestoreError::Rejected(_) => CliError::Refused(e.to_string()),
        RestoreError::Rail(_) => CliError::Infra(e.to_string()),
    })?;

    let step6 = match outcome.authorship {
        Authorship::Verified => "step 6 PASSED (commit signature verified)",
        Authorship::NotPerformed => "step 6 NOT PERFORMED",
    };
    println!(
        "RESTORE-VERIFY {}: commit {} rev {}\n  {mode_line}\n  §8 steps 1–5 PASSED \
         (fetch, re-hash, binding, media) · {step6}\n  blocks: {}  records: {}  \
         blobs verified: {}  blob failures: {}",
        outcome.did,
        outcome.commit_cid,
        outcome.rev,
        outcome.blocks,
        outcome.records,
        outcome.blobs.len(),
        outcome.blob_failures.len(),
    );
    for f in &outcome.blob_failures {
        println!("  blob FAILED: {f}");
    }

    if write_out {
        let out = PathBuf::from(
            flags
                .out
                .as_deref()
                .ok_or_else(|| CliError::Usage("--out is required for restore".into()))?,
        );
        std::fs::create_dir_all(&out)
            .map_err(|e| CliError::Infra(format!("{}: {e}", out.display())))?;
        let car_path = out.join(format!("restored-{}.car", outcome.rev));
        std::fs::write(&car_path, &outcome.car_bytes)
            .map_err(|e| CliError::Infra(format!("{}: {e}", car_path.display())))?;
        println!("  wrote {}", car_path.display());
        if !outcome.blobs.is_empty() {
            let blob_dir = out.join("blobs");
            std::fs::create_dir_all(&blob_dir)
                .map_err(|e| CliError::Infra(format!("{}: {e}", blob_dir.display())))?;
            for (pointer, bytes) in &outcome.blobs {
                let name = pointer
                    .source_blob_cid
                    .clone()
                    .unwrap_or_else(|| pointer.address.replace('/', "_"));
                let p = blob_dir.join(name);
                std::fs::write(&p, bytes)
                    .map_err(|e| CliError::Infra(format!("{}: {e}", p.display())))?;
            }
            println!(
                "  wrote {} blobs to {}",
                outcome.blobs.len(),
                blob_dir.display()
            );
        }
    }

    if !outcome.blob_failures.is_empty() {
        return Err(CliError::Refused(format!(
            "restore is PARTIAL: {} blob(s) failed verification",
            outcome.blob_failures.len()
        )));
    }
    Ok(())
}
