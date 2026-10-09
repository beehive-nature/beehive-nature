//! RB02: the RustCrypto AES-256 software-backend proof of
//! GaloisInc/rustcrypto-verification, reproduced on BNR's coordinated SAW
//! bundle and scoped against the `aes` BNR actually resolves.
//!
//! 1. Prepare a build copy of rustcrypto-verification at the reviewed pin
//!    (cryptol-specs submodule at its recorded commit), fetch its locked
//!    dependencies (the forks it verifies) into a fresh CARGO_HOME.
//! 2. Build the pristine specimen to MIR with `--cfg aes_force_soft`, as
//!    upstream's Makefile does, and run upstream's own driver `aes-run.saw`
//!    unchanged: the reproduction.
//! 3. Add the TEETH specimen (one appended module line) and run
//!    `rb02-aes256.saw`: AES-256 encrypt and decrypt proven on that build,
//!    then two false claims that must be refuted with counterexamples; a
//!    third, with no overrides, runs alone in `rb02-teeth-sbox.saw`. Every
//!    SAW process runs under a time budget and a memory budget.
//! 4. Compare the verified `aes` source with the crates.io `aes 0.8.4` BNR's
//!    Cargo.lock pins, file by file, and read its backend selection.

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::{json, Value};

use crate::digest::{file_tag, sha256_tag};
use crate::host::{git_identity, host, loadavg};
use crate::measure::{self, output, output_env, Obs, Spec};
use crate::receipt::{Class, Outcome as O, Receipt, Row};
use crate::recognize::{saw_refutation, saw_report, saw_segment, SawReport};
use crate::stats::summary;
use crate::upstream::{
    build_copy, find, git_commit, identity_with, pkg_json, read_lock, repo_root, Pin,
};

pub const RCV: Pin = Pin {
    name: "rustcrypto-verification",
    url: "https://github.com/GaloisInc/rustcrypto-verification",
    rev: "52d36ff4562c9b574f49c8b3133ea63f2a9574d5",
};
pub const CRYPTOL_SPECS_REV: &str = "8638495a3ba8c1c0bd031f0c5d7f243b5e8617ff";
/// SAW 1.6's own deps/mir-json submodule commit (wb001-saw.yml, wb002-saw.yml).
pub const MIR_JSON_REV: &str = "8cbf9af1821075ef47cf784fef78d2650827730d";
pub const MIR_JSON_TOOLCHAIN: &str = "nightly-2026-03-21";
/// The SAW 1.6 release asset the WB001/WB002 workflows install.
pub const SAW_TARBALL_SHA256_HEX: &str =
    "0b25c8b32db8b4a7ec32d6700024af60bb2a0398ee350b630dd84ff377c938f7"; // PUBLIC-CONSTANT: upstream SAW 1.6 release asset digest
/// The ghcr.io/galoisinc/saw-suite:nightly image upstream's AES CI job pulled
/// (run 37079254539, job 111076052587), as its log prints it.
pub const SAW_SUITE_IMAGE_SHA256_HEX: &str =
    "75fcd090c433cafcb7d424c320564f73479c89b026b02511bd886e5f7f7d5325"; // PUBLIC-CONSTANT: upstream container image digest
pub const OVERLAYS: &[&str] = &[
    "aes-verif/src/rb02_teeth.rs",
    "aes-verif/rb02-aes256.saw",
    "aes-verif/rb02-teeth-sbox.saw",
];
/// Resident-memory budget for every SAW process (its whole process group):
/// below the 16 GB of a GitHub ubuntu-24.04 runner, so a runaway proof is
/// killed and recorded instead of taking the runner down.
pub const SAW_MEM_GIB: u64 = 12;
pub const PATCHED: &str = "aes-verif/src/lib.rs";
pub const PATCH_TEXT: &str = "\n// RB02 overlay (beehive-nature scripts/btungsten/rb02-aes): TEETH specimen.\n#[path = \"rb02_teeth.rs\"]\npub mod rb02_teeth;\n";
const SRC_DIR: &str = "scripts/btungsten/rb02-aes";
const SIZES: [&str; 3] = ["128", "192", "256"];

struct Tools {
    saw: PathBuf,
    cryptol: PathBuf,
    mirjson_bin: PathBuf,
    rlibs: PathBuf,
    root: PathBuf,
}

impl Tools {
    fn at(root: &Path) -> Result<Tools, String> {
        let t = Tools {
            saw: root.join("saw/bin/saw"),
            cryptol: root.join("saw/bin/cryptol"),
            mirjson_bin: root.join("mirjson-root/bin"),
            rlibs: root.join("mir-json/rlibs"),
            root: root.to_path_buf(),
        };
        for p in [
            &t.saw,
            &t.mirjson_bin.join("cargo-saw-build"),
            &t.rlibs.join("libstd.rlib"),
        ] {
            if !p.exists() {
                return Err(format!("SAW bundle incomplete: {} missing (layout: <tools>/saw/bin/saw, <tools>/mirjson-root/bin/cargo-saw-build, <tools>/mir-json/rlibs)", p.display()));
            }
        }
        Ok(t)
    }

    fn path_env(&self) -> String {
        format!(
            "{}:{}:{}",
            self.mirjson_bin.display(),
            self.saw.parent().unwrap_or(Path::new("")).display(),
            std::env::var("PATH").unwrap_or_default()
        )
    }

    fn identity(&self) -> Value {
        let hex_to_tag = |h: &str| {
            let bytes: Vec<u8> = (0..h.len() / 2)
                .filter_map(|i| u8::from_str_radix(&h[2 * i..2 * i + 2], 16).ok())
                .collect();
            format!("sha256:{}", crate::digest::b64url(&bytes))
        };
        let tarball = self.root.join("saw.tar.gz");
        let tar_tag = file_tag(&tarball).ok().map(|(t, _)| t);
        let expected = hex_to_tag(SAW_TARBALL_SHA256_HEX);
        let path = self.path_env();
        let env = [("PATH", path.as_str())];
        json!({
            "bundle": "SAW 1.6 release (with its bundled solvers) + mir-json at SAW 1.6's own submodule pin + Rust nightly-2026-03-21: the bundle WB001/WB002 run",
            "saw_version": output_env(&[&self.saw.display().to_string(), "--version"], Path::new("."), &env).map(|s| s.trim().to_string()),
            "saw_binary": file_tag(&self.saw).ok().map(|(t, _)| t),
            "cryptol_version": output_env(&[&self.cryptol.display().to_string(), "--version"], Path::new("."), &env).map(|s| s.lines().next().unwrap_or("").to_string()),
            "saw_release_tarball": { "expected": expected, "observed": tar_tag.clone(), "matches": tar_tag.as_deref() == Some(expected.as_str()) },
            "mir_json": {
                "expected_rev": MIR_JSON_REV,
                "source_head": output(&["git", "rev-parse", "HEAD"], &self.root.join("mir-json")).map(|s| s.trim().to_string()),
                "version": output_env(&[&self.mirjson_bin.join("mir-json").display().to_string(), "--version"], Path::new("."), &env).map(|s| s.trim().to_string()),
                "binary": file_tag(&self.mirjson_bin.join("mir-json")).ok().map(|(t, _)| t),
            },
            "toolchain": MIR_JSON_TOOLCHAIN,
        })
    }
}

pub fn run(
    work: &Path,
    out: &Path,
    tools_dir: &Path,
    quick: bool,
) -> Result<(PathBuf, &'static str), String> {
    let root = repo_root();
    std::fs::create_dir_all(work).map_err(|e| format!("work directory {}: {e}", work.display()))?;
    let logs = out.join("logs");
    // a receipt describes one run: earlier evidence in this directory goes
    let _ = std::fs::remove_dir_all(&logs);
    std::fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
    let tools = Tools::at(tools_dir)?;
    let copy = work.join("rustcrypto-verification");
    let cargo_home = work.join("cargo-home-rb02");
    let mut n = 0usize;
    let mut stem = |name: &str| {
        n += 1;
        logs.join(format!("{n:03}-{name}"))
    };
    let rel = |p: &Path| p.strip_prefix(out).unwrap_or(p).display().to_string();

    let mut r = Receipt::new("RB02", "rustcrypto-aes256-soft-backend-proof", out);
    r.section("bnr", json!({ "checkout": git_identity(&root), "provenance_review_commit": "a3419732c0c06d1d24c8bca2d4cb70e5022971cf" }));
    r.section("host", host());
    let load_before = loadavg();
    let tool_id = tools.identity();
    let mir_ok = tool_id["mir_json"]["source_head"] == MIR_JSON_REV
        && tool_id["saw_release_tarball"]["matches"] == true;
    r.row(
        Row::new(
            "toolchain-identity",
            Class::Vector,
            "the SAW bundle is SAW 1.6 with mir-json at SAW 1.6's own pin",
        )
        .expect(json!({ "saw": "1.6", "mir_json": MIR_JSON_REV }))
        .observe(
            if mir_ok
                && tool_id["saw_version"]
                    .as_str()
                    .is_some_and(|s| s.starts_with("1.6 "))
            {
                O::Pass
            } else {
                O::Fail
            },
            tool_id.clone(),
        ),
    );
    r.section("verifier", tool_id);

    // ---- 1. preparation ------------------------------------------------------
    let mut prep = serde_json::Map::new();
    if !copy.join(".git").exists() {
        let s = stem("prep-clone");
        let o = measure::run(&Spec::new(
            &[
                "git",
                "clone",
                "--quiet",
                RCV.url,
                &copy.display().to_string(),
            ],
            work,
            Duration::from_secs(900),
            &s,
        ))
        .map_err(|e| e.to_string())?;
        prep.insert("clone".into(), o.json(out));
    } else {
        prep.insert(
            "clone".into(),
            json!("build copy present before this run; clone not measured"),
        );
    }
    // the specimen starts pristine every run
    output(&["git", "checkout", "--", PATCHED], &copy);
    build_copy(&RCV, &copy, OVERLAYS)?;
    // .gitmodules names an SSH URL; fetch the same commit over HTTPS
    let s = stem("prep-submodule");
    let o = measure::run(&Spec::new(
        &[
            "git",
            "-c",
            "url.https://github.com/.insteadOf=git@github.com:",
            "submodule",
            "update",
            "--init",
        ],
        &copy,
        Duration::from_secs(900),
        &s,
    ))
    .map_err(|e| e.to_string())?;
    prep.insert("submodule".into(), o.json(out));
    let sub_head = output(&["git", "rev-parse", "HEAD"], &copy.join("cryptol-specs"))
        .map(|s| s.trim().to_string());
    if sub_head.as_deref() != Some(CRYPTOL_SPECS_REV) {
        return Err(format!(
            "cryptol-specs is at {sub_head:?}, not {CRYPTOL_SPECS_REV}"
        ));
    }
    for f in OVERLAYS {
        let name = Path::new(f)
            .file_name()
            .and_then(|x| x.to_str())
            .unwrap_or_default();
        std::fs::copy(root.join(SRC_DIR).join(name), copy.join(f))
            .map_err(|e| format!("overlay {f}: {e}"))?;
    }
    build_copy(&RCV, &copy, OVERLAYS)?;
    let _ = std::fs::remove_dir_all(&cargo_home);
    std::fs::create_dir_all(&cargo_home).map_err(|e| e.to_string())?;
    let ch = cargo_home.display().to_string();
    let path_env = tools.path_env();
    let rlibs = tools.rlibs.display().to_string();
    let toolchain_arg = format!("+{MIR_JSON_TOOLCHAIN}");
    let s = stem("prep-fetch-cold");
    let o = measure::run(
        &Spec::new(
            &["cargo", &toolchain_arg, "fetch", "--locked"],
            &copy,
            Duration::from_secs(1800),
            &s,
        )
        .env("CARGO_HOME", &ch),
    )
    .map_err(|e| e.to_string())?;
    if !o.ok() {
        return Err(format!("cargo fetch failed: {}", o.stderr_text()));
    }
    prep.insert("fetch_cold".into(), o.json(out));
    r.measure("prep", Value::Object(prep));

    // process startup of the verifier itself: saw --version, which loads the
    // binary and checks its solvers but runs no script
    let mut st = Vec::new();
    for k in 0..if quick { 3 } else { 10 } {
        let s = stem(&format!("startup-saw-{k}"));
        st.push(
            measure::run(
                &Spec::new(
                    &[&tools.saw.display().to_string(), "--version"],
                    &copy,
                    Duration::from_secs(60),
                    &s,
                )
                .env("PATH", &path_env),
            )
            .map_err(|e| e.to_string())?,
        );
    }
    r.measure("startup_saw_version", obs_set(&st, out));

    // ---- 2. pristine build + upstream driver ----------------------------------
    // cargo-saw-build takes neither --locked nor --offline: offline comes from
    // CARGO_NET_OFFLINE, and the lockfile is required to be byte-identical
    // before and after every build instead
    let lock_before = file_tag(&copy.join("Cargo.lock"))
        .map(|x| x.0)
        .map_err(|e| e.to_string())?;
    let saw_build = |stem: &Path, target: &Path| -> Result<Obs, String> {
        let o = measure::run(
            &Spec::new(
                &["cargo", &toolchain_arg, "saw-build"],
                &copy,
                Duration::from_secs(3600),
                stem,
            )
            .env("CARGO_HOME", &ch)
            .env("CARGO_NET_OFFLINE", "true")
            .env("CARGO_TARGET_DIR", &target.display().to_string())
            .env("RUSTFLAGS", "--cfg aes_force_soft")
            .env("SAW_RUST_LIBRARY_PATH", &rlibs)
            .env("PATH", &path_env),
        )
        .map_err(|e| e.to_string())?;
        if !o.ok() {
            return Err(format!(
                "saw-build failed ({:?}): {}",
                o.exit,
                o.stderr_text()
            ));
        }
        let lock_after = file_tag(&copy.join("Cargo.lock"))
            .map(|x| x.0)
            .map_err(|e| e.to_string())?;
        if lock_after != lock_before {
            return Err("saw-build changed the pinned Cargo.lock".into());
        }
        Ok(o)
    };
    let target_pristine = work.join("rcv-target-pristine");
    let _ = std::fs::remove_dir_all(&target_pristine);
    let mut cold = vec![saw_build(&stem("build-cold-pristine"), &target_pristine)?];
    let mut noop = Vec::new();
    for k in 0..if quick { 1 } else { 3 } {
        noop.push(saw_build(
            &stem(&format!("build-warm-noop-{k}")),
            &target_pristine,
        )?);
    }
    let mir_pristine = linked_mir(&target_pristine, "aes_verif")?;
    std::fs::create_dir_all(copy.join("target")).map_err(|e| e.to_string())?;
    std::fs::copy(&mir_pristine, copy.join("target/aes_verif.linked-mir.json"))
        .map_err(|e| e.to_string())?;

    let saw_run = |stem: &Path, script: &str, budget: u64| -> Result<(Obs, SawReport), String> {
        let o = measure::run(
            &Spec::new(
                &[&tools.saw.display().to_string(), script],
                &copy.join("aes-verif"),
                Duration::from_secs(budget),
                stem,
            )
            .env("CRYPTOLPATH", "../cryptol-specs")
            .env("PATH", &path_env)
            .mem_limit_gib(SAW_MEM_GIB),
        )
        .map_err(|e| e.to_string())?;
        let text = format!("{}\n{}", o.stdout_text(), o.stderr_text());
        Ok((o, saw_report(&text)))
    };
    // budget: upstream CI ran aes-run.saw in 8 min 47 s on a dedicated runner;
    // this host is shared (load 7-13 during the 2026-10-08 runs), so 10x that
    let s = stem("saw-aes-run-upstream");
    let (o_rep, rep) = saw_run(&s, "aes-run.saw", 5400)?;
    r.evidence_file(&rel(&s.with_extension("stdout")), "committed");
    for size in SIZES {
        for dir in ["encrypt", "decrypt"] {
            let f = format!("aes_verif::toplevel_{dir}_block_{size}");
            let ok = o_rep.ok() && rep.proved(&f) && rep.failed.is_empty();
            r.row(Row::new(&format!("reproduce-{dir}-{size}"), Class::Equivalence, &format!("upstream aes-run.saw, unchanged: {f} equals cryptol-specs AES-{size} {dir}ion for every key and block (software fixslice backend)"))
                .expect(json!(format!("Proof succeeded! {f}")))
                .observe(verdict_of(&o_rep, &rep, ok), json!({ "succeeded": rep.proved(&f), "failed": rep.failed, "exit": o_rep.exit.json(), "proof_lines": rep.succeeded.len() }))
                .evidence(&[&rel(&s.with_extension("stdout"))]));
        }
    }
    r.section("reproduction", json!({
        "driver": "aes-verif/aes-run.saw at the pin, unchanged (includes aes-lib.saw)",
        "process": o_rep.json(out),
        "proof_succeeded_lines": rep.succeeded.len(),
        "upstream_ci_reference": format!("GaloisInc/rustcrypto-verification run 37079254539, job 111076052587 (saw-verify (verify-aes)), 2026-10-02: ghcr.io/galoisinc/saw-suite:nightly by digest {}, SAW 1.6.0.99 (master 345296457), mir-json schema 13 on nightly-2026-03-21, 295 'Proof succeeded!' lines, 8 min 47 s", crate::digest::hex_to_tag(SAW_SUITE_IMAGE_SHA256_HEX)),
        "departure": "this lane runs the SAW 1.6 release bundle (the one WB001/WB002 run), not the upstream nightly container: Docker is not usable on this host, and BNR's SAW work keeps one coordinated bundle. Same mir-json schema (13) and the same Rust nightly.",
    }));

    // ---- 3. TEETH build + AES-256 obligations ----------------------------------
    {
        use std::io::Write;
        let mut f = std::fs::OpenOptions::new()
            .append(true)
            .open(copy.join(PATCHED))
            .map_err(|e| e.to_string())?;
        f.write_all(PATCH_TEXT.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    let target_teeth = work.join("rcv-target-teeth");
    let _ = std::fs::remove_dir_all(&target_teeth);
    cold.push(saw_build(&stem("build-cold-teeth"), &target_teeth)?);
    let mir_teeth = linked_mir(&target_teeth, "aes_verif")?;
    std::fs::copy(
        &mir_teeth,
        copy.join("target/aes_verif_rb02.linked-mir.json"),
    )
    .map_err(|e| e.to_string())?;
    let s = stem("saw-rb02-aes256");
    let (o256, rep256) = saw_run(&s, "rb02-aes256.saw", 5400)?;
    r.evidence_file(&rel(&s.with_extension("stdout")), "committed");
    let text256 = format!("{}\n{}", o256.stdout_text(), o256.stderr_text());
    for f in ["toplevel_encrypt_block_256", "toplevel_decrypt_block_256"] {
        let ok = text256.contains(&format!("RB02-SAW PROVEN {f}"));
        r.row(Row::new(&format!("aes256-{f}"), Class::Equivalence, &format!("on the TEETH build (same MIR the teeth run on): aes_verif::{f} equals the cryptol-specs AES-256 spec for every key and block"))
            .expect(json!(format!("RB02-SAW PROVEN {f}")))
            .observe(if ok { O::Pass } else { verdict_of(&o256, &rep256, false) }, json!({ "printed": ok }))
            .evidence(&[&rel(&s.with_extension("stdout"))]));
    }
    // TEETH 3 runs in its own SAW process (rb02-teeth-sbox.saw)
    let s3 = stem("saw-rb02-teeth-sbox");
    let (o3, _) = saw_run(&s3, "rb02-teeth-sbox.saw", 1800)?;
    r.evidence_file(&rel(&s3.with_extension("stdout")), "committed");
    let text3 = format!("{}\n{}", o3.stdout_text(), o3.stderr_text());
    // a script stops at the first false claim it accepts: that obligation is
    // the FAIL, and the ones after it in the same script never ran
    let mut blamed: Vec<String> = Vec::new();
    for (name, trigger, o, text, stem_used) in [
        (
            "teeth_encrypt_block_256",
            "planted fault in the specimen: key[0] = 0xA5 and block[15] = 0x5A flip one ciphertext bit; honest spec, same overrides and solver as the passing proof",
            &o256,
            &text256,
            &s,
        ),
        ("false-spec-flipped-bit", "the honest toplevel_encrypt_block_256 claimed to return its output with bit 0 of byte 0 flipped", &o256, &text256, &s),
        ("sub_bytes-as-shift_rows_2", "the bitsliced sub_bytes claimed to compute shift_rows_2: no overrides, no uninterpreted functions, decided by z3", &o3, &text3, &s3),
    ] {
        let line = format!("RB02-SAW-TEETH REFUTED {name}");
        let segment = saw_segment(text, "RB02-SAW", &line);
        let printed = segment.is_some();
        let cex = segment.as_deref().and_then(saw_refutation);
        let ok = printed && cex.is_some();
        let script = stem_used.display().to_string();
        let accepted = !ok
            && !printed
            && text.contains("Expected failure, but succeeded instead!")
            && !blamed.contains(&script);
        if accepted {
            blamed.push(script);
        }
        r.row(
            Row::new(
                &format!("teeth-{name}"),
                Class::Teeth,
                &format!("SAW refutes a false claim with a counterexample: {trigger}"),
            )
            .expect(json!("refuted with a solver counterexample"))
            .observe(
                if ok {
                    O::Pass
                } else if accepted {
                    O::Fail
                } else {
                    O::Inconclusive
                },
                json!({ "refuted_line": printed, "counterexample": cex, "process_exit": o.exit.json() }),
            )
            .evidence(&[&rel(&stem_used.with_extension("stdout"))]),
        );
    }
    // bind the receipt to what was proven: the MIR, the scripts, the specs
    let tag = |p: &Path| file_tag(p).ok().map(|(t, _)| t);
    let spec_files = |dir: &Path| -> Vec<(String, String)> {
        let mut v = Vec::new();
        let mut stack = vec![dir.to_path_buf()];
        while let Some(d) = stack.pop() {
            for e in std::fs::read_dir(&d).into_iter().flatten().flatten() {
                let p = e.path();
                if p.is_dir() {
                    stack.push(p);
                } else if p.extension().is_some_and(|x| x == "cry") {
                    if let (Ok(rel), Some(t)) = (p.strip_prefix(dir), tag(&p)) {
                        v.push((rel.display().to_string(), t));
                    }
                }
            }
        }
        v
    };
    let aes_spec = copy.join("cryptol-specs/Primitive/Symmetric/Cipher/Block");
    let bridge = copy.join("aes-verif/AesVerif");
    r.section("bound_artifacts", json!({
        "linked_mir_pristine": tag(&mir_pristine),
        "linked_mir_teeth": tag(&mir_teeth),
        "aes_lib_saw": tag(&copy.join("aes-verif/aes-lib.saw")),
        "aes_run_saw": tag(&copy.join("aes-verif/aes-run.saw")),
        "rb02_aes256_saw": tag(&copy.join("aes-verif/rb02-aes256.saw")),
        "rb02_teeth_sbox_saw": tag(&copy.join("aes-verif/rb02-teeth-sbox.saw")),
        "rb02_teeth_rs": tag(&copy.join("aes-verif/src/rb02_teeth.rs")),
        "cryptol_specs_block_cipher_tree": crate::digest::tree_tag(&spec_files(&aes_spec)),
        "cryptol_specs_block_cipher_files": spec_files(&aes_spec).len(),
        "aesverif_bridge_tree": crate::digest::tree_tag(&spec_files(&bridge)),
        "aesverif_bridge_files": spec_files(&bridge).iter().map(|(p, t)| json!({ "path": p, "sha256": t })).collect::<Vec<_>>(),
    }));
    r.section("trial_history", json!([
        "2026-10-08/09: TEETH 3 (bitsliced sub_bytes claimed to be shift_rows_2) first ran inside rb02-aes256.saw on the rme solver. Two GitHub runners were shut down at that step (runs 37887662009 and 37889906328, exit 143), and on the development host the kernel OOM killer took the saw process at 28.8 GB resident ('anon-rss:28818984kB'), taking the shared WSL VM down with it. rme normalizes a goal to algebraic normal form, which is small for a true goal and unbounded for a false one. Repair: TEETH 3 runs alone on z3 (rb02-teeth-sbox.saw), and every SAW process runs under a 12 GiB process-group memory budget.",
        "2026-10-09, CI run 37893420462: with the SBV z3 backend (unint_z3), TEETH 1 and 2 made z3 answer sat, but SBV aborted reading back the model of the uninterpreted `cipher` (a lambda: 'Expected: a function value'). `fails` caught that tool error; the harness did not count it as a refutation, since no counterexample was printed. Repair: rb02-aes256.saw uses the What4 z3 backend (w4_unint_z3) for every obligation, honest and TEETH.",
    ]));
    r.section("teeth_patch", json!({
        "file": PATCHED,
        "appended": PATCH_TEXT,
        "appended_sha256": sha256_tag(PATCH_TEXT.as_bytes()),
        "result_sha256": file_tag(&copy.join(PATCHED)).ok().map(|(t, _)| t),
        "note": "applied only for the TEETH build, after the reproduction ran on the pristine specimen",
    }));
    r.section("source", json!({
        "rustcrypto_verification": identity_with(&RCV, &copy, OVERLAYS, json!([{ "file": PATCHED, "kind": "append", "for": "TEETH build only" }])),
        "cryptol_specs": CRYPTOL_SPECS_REV,
        "overlay_sources": SRC_DIR,
    }));
    r.measure("compile_mir", json!({
        "cold": obs_set(&cold, out),
        "warm_noop": obs_set(&noop, out),
        "command": format!("cargo {toolchain_arg} saw-build with CARGO_NET_OFFLINE=true, the pinned Cargo.lock byte-identical before and after, and RUSTFLAGS=\"--cfg aes_force_soft\" (cold[0] pristine specimen, cold[1] TEETH specimen)"),
    }));
    r.measure("verification", json!({ "aes_run_upstream_all_sizes": o_rep.json(out), "rb02_aes256_plus_teeth_1_2": o256.json(out), "rb02_teeth_sbox": o3.json(out), "memory_budget_gib_per_saw_process": SAW_MEM_GIB }));
    r.measure("network_bytes", json!("not measured: after preparation (clone, submodule, cargo fetch) every step runs offline (CARGO_NET_OFFLINE=true for cargo; SAW uses no network); the crates.io aes-0.8.4.crate download for the compatibility comparison is the one later fetch"));

    // ---- 4. compatibility ------------------------------------------------------
    let compat = compatibility(&root, &copy, &cargo_home, work, &mut r)?;
    r.section("compatibility", compat);
    r.assumptions = vec![
        "The verified code is the aes 0.8.4 source in RyanGlScott/block-ciphers backport-hybrid-arrays-to-aes-0.8.4 at the commit the pinned Cargo.lock records, built with --cfg aes_force_soft, through SAW's MIR semantics (mir-json schema 13, Rust nightly-2026-03-21, unoptimized MIR).".into(),
        "The spec is cryptol-specs at the submodule commit (Primitive/Symmetric/Cipher/Block/AES) plus the proof's own AesVerif/*.cry bridge modules; their faithfulness to FIPS 197 is the cryptol-specs project's claim, not re-checked here.".into(),
        "Domain: every 32-byte key and every 16-byte block, one block per call (toplevel_{encrypt,decrypt}_block_256).".into(),
        "keyExpansion, cipher and invCipher are uninterpreted in the top-level step; their overrides are proven separately in the same run (aes-lib.saw).".into(),
    ];
    r.obligations = vec![
        "AES-NI backend (aes::ni via autodetect): what BNR executes on x86/x86_64 CPUs with AES-NI; not covered.".into(),
        "ARMv8 backend: only compiled with --cfg aes_armv8, which BNR does not set; not covered (BNR's aarch64 builds use the soft backend, see compatibility.backend).".into(),
        "The generic-array fork used by the proof versus crates.io generic-array 0.14.7 that BNR resolves (array plumbing, no cryptographic code; not compared here beyond the version).".into(),
        "Multi-block processing (BlockBackend par-blocks glue used by CTR inside AES-GCM): not covered by the single-block top-level proofs.".into(),
        "AES-GCM: GHASH/POLYVAL (ghash 0.5.1, polyval 0.6.2 incl. CLMUL backends), CTR32 (ctr 0.9.2), tag computation and constant-time tag comparison: not covered.".into(),
        "Nonce management (crates/bsigner/src/bpq.rs nonce(flag, index)), key derivation (HKDF-SHA-256), key handling and zeroization, the sealed-object format (SPEC-BPQ-1) and caller behaviour (gcm_open): not covered.".into(),
        "Side channels: fixslicing is designed to be constant-time; nothing here verifies timing.".into(),
        "SHA-2: rustcrypto-verification's sha2-verif covers SHA-384 and SHA-512 of a sha2 0.10.9 fork; BNR's sha2 uses (mostly SHA-256) are not covered, and no SHA-2 claim is made here.".into(),
    ];
    r.measure(
        "load_average",
        json!({ "before": load_before, "after": loadavg() }),
    );
    r.write().map_err(|e| e.to_string())
}

/// PASS when the obligation's success line was printed; FAIL only when SAW
/// reported a failed proof (`Subgoal failed`) and nothing else stopped it;
/// INCONCLUSIVE for a budget or memory kill, a signal, an error shape this
/// harness does not know, or a run that ended before the obligation.
fn verdict_of(o: &Obs, rep: &SawReport, ok: bool) -> O {
    if ok {
        O::Pass
    } else if matches!(o.exit, measure::Exit::Code(_))
        && !rep.failed.is_empty()
        && rep.unrecognized.is_empty()
    {
        O::Fail
    } else {
        O::Inconclusive
    }
}

fn linked_mir(target: &Path, krate: &str) -> Result<PathBuf, String> {
    let deps = target.join("x86_64-unknown-linux-gnu/debug/deps");
    let mut found: Vec<PathBuf> = std::fs::read_dir(&deps)
        .map_err(|e| format!("{}: {e}", deps.display()))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.file_name().and_then(|n| n.to_str()).is_some_and(|n| {
                n.starts_with(&format!("{krate}-")) && n.ends_with(".linked-mir.json")
            })
        })
        .collect();
    found.sort();
    match found.len() {
        1 => Ok(found.remove(0)),
        k => Err(format!(
            "{k} linked MIR files for {krate} in {}",
            deps.display()
        )),
    }
}

fn obs_set(v: &[Obs], base: &Path) -> Value {
    let pick = |f: &dyn Fn(&Obs) -> Option<u64>| v.iter().filter_map(f).collect::<Vec<u64>>();
    json!({
        "wall_ns": summary(&pick(&|o| Some(o.wall_ns))),
        "user_cpu_us": summary(&pick(&|o| o.user_us)),
        "max_rss_kib": summary(&pick(&|o| o.max_rss_kib)),
        "runs": v.iter().map(|o| o.json(base)).collect::<Vec<_>>(),
    })
}

/// BNR's resolved AES stack against the verified one.
fn compatibility(
    root: &Path,
    copy: &Path,
    cargo_home: &Path,
    work: &Path,
    r: &mut Receipt,
) -> Result<Value, String> {
    let bnr = read_lock(&root.join("Cargo.lock"))?;
    let rcv = read_lock(&copy.join("Cargo.lock"))?;
    // the dependency paths in this checkout, as cargo resolves them
    let mut trees = serde_json::Map::new();
    for (spec, edges) in [
        ("aes@0.8.4", "normal"),
        ("aes-gcm@0.10.3", "normal"),
        ("aes-gcm@0.10.3", "features"),
        ("sha2@0.10.9", "normal"),
        ("sha2@0.11.0", "normal"),
        ("sha2@0.11.0", "all"),
    ] {
        let t = output(
            &[
                "cargo",
                "tree",
                "--locked",
                "--offline",
                "--workspace",
                "-e",
                edges,
                "-i",
                spec,
            ],
            root,
        );
        trees.insert(
            format!("{spec} -e {edges}"),
            t.map_or(json!("cargo tree failed"), |x| {
                json!(x.lines().collect::<Vec<_>>())
            }),
        );
    }
    let names = [
        "aes",
        "aes-gcm",
        "cipher",
        "cpufeatures",
        "generic-array",
        "crypto-common",
        "ghash",
        "polyval",
        "ctr",
        "block-buffer",
        "sha2",
    ];
    let side = |lock: &[crate::upstream::LockPkg]| -> Value {
        names
            .iter()
            .map(|n| {
                (
                    n.to_string(),
                    json!(find(lock, n)
                        .iter()
                        .map(|p| pkg_json(p))
                        .collect::<Vec<_>>()),
                )
            })
            .collect::<serde_json::Map<_, _>>()
            .into()
    };
    let bnr_aes = find(&bnr, "aes")
        .into_iter()
        .find(|p| p.version == "0.8.4")
        .ok_or("BNR Cargo.lock has no aes 0.8.4")?
        .clone();
    let rcv_aes = find(&rcv, "aes")
        .into_iter()
        .next()
        .ok_or("proof Cargo.lock has no aes")?
        .clone();
    let fork_commit = git_commit(&rcv_aes)
        .ok_or("the proof's aes is not a git dependency")?
        .to_string();

    // BNR's resolved crate, by the checksum its Cargo.lock pins
    let crate_file = work.join("aes-0.8.4.crate");
    let url = "https://static.crates.io/crates/aes/aes-0.8.4.crate";
    let _ = output(
        &[
            "curl",
            "--fail",
            "--silent",
            "--location",
            "--retry",
            "3",
            "-o",
            &crate_file.display().to_string(),
            url,
        ],
        work,
    );
    let bytes = std::fs::read(&crate_file).map_err(|e| format!("{url}: {e}"))?;
    let got_hex: String = {
        use sha2::{Digest, Sha256};
        Sha256::digest(&bytes)
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect()
    };
    let checksum_ok = bnr_aes.checksum.as_deref() == Some(got_hex.as_str());
    r.row(Row::new("bnr-aes-source-identity", Class::Vector, "the crates.io aes-0.8.4.crate fetched here has exactly the checksum BNR's Cargo.lock pins")
        .expect(json!("Cargo.lock checksum"))
        .observe(if checksum_ok { O::Pass } else { O::Fail }, json!({ "crate_sha256": sha256_tag(&bytes), "matches_cargo_lock": checksum_ok })));
    let unpack = work.join("aes-0.8.4-crates-io");
    let _ = std::fs::remove_dir_all(&unpack);
    std::fs::create_dir_all(&unpack).map_err(|e| e.to_string())?;
    output(
        &[
            "tar",
            "-xzf",
            &crate_file.display().to_string(),
            "-C",
            &unpack.display().to_string(),
        ],
        work,
    )
    .ok_or("cannot unpack aes-0.8.4.crate")?;
    let registry = unpack.join("aes-0.8.4");
    // the verified fork, as cargo checked it out for the proof build
    let checkouts = cargo_home.join("git/checkouts");
    let fork = find_dir(&checkouts, |p| {
        p.join("aes/src/soft/fixslice64.rs").exists()
            && p.to_string_lossy().contains(&fork_commit[..7])
    })
    .map(|p| p.join("aes"))
    .ok_or_else(|| {
        format!(
            "no checkout of the aes fork at {fork_commit} under {}",
            checkouts.display()
        )
    })?;
    let (same, differ, only_reg, only_fork) =
        compare_trees(&registry.join("src"), &fork.join("src"))?;
    let src_identical = differ.is_empty() && only_reg.is_empty() && only_fork.is_empty();
    r.row(Row::new("verified-source-equals-bnr-source", Class::Vector, "every file under src/ of the verified aes fork is byte-identical to crates.io aes 0.8.4 (BNR's resolved source)")
        .expect(json!("all src/ files identical"))
        .observe(if src_identical { O::Pass } else { O::Fail }, json!({ "identical": same.len(), "differ": differ, "only_in_crates_io": only_reg, "only_in_fork": only_fork })));
    let manifest_diff = {
        let a = std::fs::read_to_string(registry.join("Cargo.toml.orig")).unwrap_or_default();
        let b = std::fs::read_to_string(fork.join("Cargo.toml")).unwrap_or_default();
        let la: Vec<&str> = a.lines().collect();
        let lb: Vec<&str> = b.lines().collect();
        json!({
            "only_in_crates_io_manifest": la.iter().filter(|l| !lb.contains(l)).collect::<Vec<_>>(),
            "only_in_fork_manifest": lb.iter().filter(|l| !la.contains(l)).collect::<Vec<_>>(),
        })
    };
    let lib = std::fs::read_to_string(registry.join("src/lib.rs")).unwrap_or_default();
    let selection: Vec<&str> = lib
        .lines()
        .filter(|l| {
            l.contains("#[cfg(") && (l.contains("aes_force_soft") || l.contains("aes_armv8"))
                || l.contains("target_arch = \"x86\", target_arch = \"x86_64\"")
        })
        .collect();
    let bnr_cargo_config = [".cargo/config.toml", ".cargo/config"]
        .iter()
        .find_map(|p| std::fs::read_to_string(root.join(p)).ok());
    Ok(json!({
        "bnr_resolved": side(&bnr),
        "proof_resolved": side(&rcv),
        "bnr_dependency_path": "aes 0.8.4 <- aes-gcm 0.10.3 (default features aes, alloc, getrandom) <- bsigner (crates/bsigner/src/bpq.rs: Aes256Gcm in gcm_open, and the test-only gcm_seal)",
        "cargo_tree": trees,
        "provenance_reconciliation": "the lockfile at the reviewed a3419732c already held aes 0.8.4, aes-gcm 0.10.3, sha2 0.10.9 and sha2 0.11.0; 2e8d20970 (PQ01) added packages but changed none of these entries",
        "verified_fork": { "commit": fork_commit, "source": rcv_aes.source, "checkout": fork.display().to_string() },
        "src_comparison": { "identical_files": same, "differing_files": differ, "only_in_crates_io": only_reg, "only_in_fork": only_fork },
        "manifest_comparison": manifest_diff,
        "dependency_changes_for_the_proof": [
            "aes: git fork (RyanGlScott/block-ciphers, branch backport-hybrid-arrays-to-aes-0.8.4) whose Rust sources are compared above",
            "generic-array: git fork (RyanGlScott/generic-array, branch backport-hybrid-arrays-to-generic-array-0.14.7) via [patch.crates-io]: avoids unsafe operations crucible-mir cannot simulate (upstream aes-verif/README.md)",
            "block-buffer: git fork (RyanGlScott/utils, branch crucible-mir-patches) via [patch.crates-io] (used by the sha2 specimens)",
            "RUSTFLAGS=--cfg aes_force_soft: selects the software backend; without it x86_64 builds compile autodetect + AES-NI",
        ],
        "backend": {
            "selection_lines_in_aes_0_8_4_lib_rs": selection,
            "bnr_rustflags": bnr_cargo_config.map_or(json!("no .cargo/config in the BNR checkout; no RUSTFLAGS in its workflows"), Value::from),
            "bnr_x86_64": "autodetect: AES-NI (aes::ni) when cpufeatures detects aes, else the soft fixslice64 backend. On this host (AES-NI present) BNR executes AES-NI: NOT the verified code",
            "bnr_aarch64": "without --cfg aes_armv8 (BNR sets none) the crate uses `pub use soft::*`: the soft fixslice64 backend, the verified code path",
            "bnr_other_64bit": "soft fixslice64",
            "verified": "soft fixslice64 (target_pointer_width = 64), full (not aes_compact)",
        },
        "verified_functions": [
            "aes_verif::toplevel_{encrypt,decrypt}_block_{128,192,256} (reproduction) and _256 on the TEETH build",
            "inside them, through aes-lib.saw's proven overrides: aes::soft::fixslice::{aes{128,192,256}_key_schedule, aes{128,192,256}_encrypt, aes{128,192,256}_decrypt, bitslice, inv_bitslice, sub_bytes, sub_bytes_nots, shift_rows_*, add_round_key, mix_columns_*, ...}",
        ],
        "input_domain": "all keys (16/24/32 bytes) x all 16-byte blocks; one block per call",
        "not_this_lane": "AES-GCM construction, accelerated backends, nonce management, key handling, serialized vault formats, caller behaviour (remaining_obligations)",
    }))
}

fn find_dir(root: &Path, pred: impl Fn(&Path) -> bool) -> Option<PathBuf> {
    let mut stack = vec![root.to_path_buf()];
    while let Some(d) = stack.pop() {
        if pred(&d) {
            return Some(d);
        }
        if let Ok(rd) = std::fs::read_dir(&d) {
            for e in rd.flatten() {
                if e.path().is_dir() && e.file_name() != ".git" {
                    stack.push(e.path());
                }
            }
        }
    }
    None
}

type TreeCmp = (Vec<String>, Vec<String>, Vec<String>, Vec<String>);

/// (identical, differing, only in a, only in b) relative paths of two trees.
fn compare_trees(a: &Path, b: &Path) -> Result<TreeCmp, String> {
    fn walk(base: &Path, d: &Path, out: &mut Vec<String>) {
        if let Ok(rd) = std::fs::read_dir(d) {
            for e in rd.flatten() {
                let p = e.path();
                if p.is_dir() {
                    walk(base, &p, out);
                } else if let Ok(rel) = p.strip_prefix(base) {
                    out.push(rel.display().to_string());
                }
            }
        }
    }
    let (mut fa, mut fb) = (Vec::new(), Vec::new());
    walk(a, a, &mut fa);
    walk(b, b, &mut fb);
    if fa.is_empty() || fb.is_empty() {
        return Err(format!(
            "empty tree: {} ({} files) vs {} ({} files)",
            a.display(),
            fa.len(),
            b.display(),
            fb.len()
        ));
    }
    fa.sort();
    fb.sort();
    let (mut same, mut differ, mut only_a) = (Vec::new(), Vec::new(), Vec::new());
    for f in &fa {
        if fb.contains(f) {
            let ta = file_tag(&a.join(f))
                .map(|x| x.0)
                .map_err(|e| e.to_string())?;
            let tb = file_tag(&b.join(f))
                .map(|x| x.0)
                .map_err(|e| e.to_string())?;
            if ta == tb {
                same.push(f.clone());
            } else {
                differ.push(f.clone());
            }
        } else {
            only_a.push(f.clone());
        }
    }
    let only_b = fb.into_iter().filter(|f| !fa.contains(f)).collect();
    Ok((same, differ, only_a, only_b))
}
