//! Independent offline execution evidence. Acceptance always comes from the
//! actual harness binary; this controller does not sign or manufacture receipts.
mod archive;
mod process;
mod stub;

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

pub type Result<T> = std::result::Result<T, String>;
const SOURCE: &str = "43b906223860ee34b8e05390c1fe23f6694ba446";
const TREE: &str = "8973d724aae232a5e08390e88f8b12f14724501f";
const FIXTURE_SOURCE: &str = "b6b951a3ffbf93946f492e92a48d26c6dcca12ba";
const FIXTURE_PATH: &str = "docs/dispatches/evidence/2026-10-29-spark-h02-b9/manifest.json";
const FIXTURE_SHA256: &str = "acc9cb10289dc7a409be1004aec779ff07bf654b5b3415913373354f7b8c569c"; // PUBLIC-CONSTANT: frozen synthetic fixture
const ORDER: &str = "demo-task";
const PUBLIC: &str =
    "PUBLIC-CONSTANT: offline generated public evidence and source/artifact digests";
const MAX_FILE: usize = 8 * 1024 * 1024;

pub(crate) fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub(crate) fn read_bounded(path: &Path, limit: usize) -> Result<Vec<u8>> {
    let file = fs::File::open(path).map_err(|e| format!("read {}: {e}", path.display()))?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err("expected regular file".into());
    }
    let mut bytes = Vec::new();
    file.take((limit + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > limit {
        return Err(format!("file exceeds byte bound: {}", path.display()));
    }
    Ok(bytes)
}

pub(crate) fn write_record<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    let mut bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    bytes.push(b'\n');
    if bytes.len() > 32 * 1024 * 1024 {
        return Err("evidence record exceeds byte bound".into());
    }
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .map_err(|e| format!("create {}: {e}", path.display()))?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())
}

fn require(condition: bool, explanation: impl Into<String>) -> Result<()> {
    if condition {
        Ok(())
    } else {
        Err(explanation.into())
    }
}

fn read_json(path: &Path) -> Result<Value> {
    serde_json::from_slice(&read_bounded(path, MAX_FILE)?)
        .map_err(|e| format!("{} JSON: {e}", path.display()))
}

fn parse_pairs(args: &[String], names: &[&str]) -> Result<BTreeMap<String, PathBuf>> {
    if args.len() != names.len() * 2 {
        return Err(format!("supply each of {} exactly once", names.join(", ")));
    }
    let mut values = BTreeMap::new();
    for pair in args.chunks_exact(2) {
        require(names.contains(&pair[0].as_str()), "unknown option")?;
        require(
            !pair[1].is_empty() && Path::new(&pair[1]).is_absolute(),
            "all paths must be explicit and absolute",
        )?;
        require(
            values
                .insert(pair[0].clone(), PathBuf::from(&pair[1]))
                .is_none(),
            "duplicate option",
        )?;
    }
    Ok(values)
}

pub fn main_entry(args: Vec<String>) -> Result<()> {
    let (op, rest) = args.split_first().ok_or("usage: run --repo ABS --manifest ABS --out NEW_ABS --toolchain BIN_DIR --cargo-home ABS --target ABS; or restore --archive ABS --dest NEW_ABS")?;
    if op == "restore" {
        let options = parse_pairs(rest, &["--archive", "--dest"])?;
        return archive::restore(&options["--archive"], &options["--dest"]);
    }
    require(op == "run", "unknown operation")?;
    let options = parse_pairs(
        rest,
        &[
            "--repo",
            "--manifest",
            "--out",
            "--toolchain",
            "--cargo-home",
            "--target",
        ],
    )?;
    let out = options["--out"].clone();
    require(
        fs::symlink_metadata(&out).is_err(),
        "qualification output already exists; preserve it and choose a fresh directory",
    )?;
    fs::create_dir(&out).map_err(|e| format!("create evidence output: {e}"))?;
    for child in ["captures", "archives", "pins", "checks"] {
        fs::create_dir(out.join(child)).map_err(|e| e.to_string())?;
    }
    let result = run_suite(options);
    if let Err(error) = &result {
        let _ = write_record(
            &out.join("FAILURE.json"),
            &json!({"classification":PUBLIC,"verdict":"FAIL","error":error,"captured_results_preserved":true}),
        );
    }
    result
}

struct Scratch(PathBuf);
impl Scratch {
    fn new() -> Result<Self> {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos();
        let path = std::env::temp_dir().join(format!("h01-frozen-{}-{nonce}", std::process::id()));
        fs::create_dir(&path).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o700))
                .map_err(|e| e.to_string())?;
        }
        Ok(Self(path))
    }
}
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

struct Suite {
    repo: PathBuf,
    out: PathBuf,
    manifest: PathBuf,
    binary: PathBuf,
    toolchain: PathBuf,
    scratch: Scratch,
    cases: Vec<Value>,
    started: Instant,
}

struct Control {
    workdir: PathBuf,
    session: String,
    pin: PathBuf,
    archive: PathBuf,
}

impl Suite {
    fn command(&self, executable: &Path) -> Command {
        let mut command = Command::new(executable);
        command.current_dir(&self.repo).env_clear();
        command.env(
            "PATH",
            format!("{}:/usr/bin:/bin", self.toolchain.display()),
        );
        command.env("LANG", "C.UTF-8");
        command
    }

    fn execute(
        &mut self,
        tag: &str,
        command: Command,
        environment: &str,
        seconds: u64,
    ) -> Result<process::Receipt> {
        require(
            self.started.elapsed().as_secs() < 900,
            "total qualification time bound exceeded",
        )?;
        process::capture(
            command,
            &self.out.join("captures").join(format!("{tag}.json")),
            environment,
            seconds,
        )
    }

    fn check(
        &mut self,
        tag: &str,
        receipt: &process::Receipt,
        pass: bool,
        fragments: &[&str],
        details: Value,
    ) -> Result<()> {
        let stderr = receipt.stderr_text();
        let matched = if pass {
            receipt.successful()
        } else {
            receipt.exit_code.is_some_and(|code| code != 0)
                && !receipt.timed_out
                && !receipt.output_limited
        } && fragments.iter().all(|fragment| stderr.contains(fragment));
        let record = json!({
            "classification":PUBLIC,"case":tag,"verdict":if matched {"PASS"} else {"FAIL"},
            "expected_exit":if pass {"zero"} else {"nonzero"},"expected_stderr_fragments":fragments,
            "actual_exit_code":receipt.exit_code,"timed_out":receipt.timed_out,"output_limited":receipt.output_limited,
            "capture":format!("captures/{tag}.json"),"details":details
        });
        write_record(
            &self.out.join("checks").join(format!("{tag}.json")),
            &record,
        )?;
        self.cases.push(record);
        require(
            matched,
            format!(
                "case {tag} did not match its required executable result; inspect retained capture"
            ),
        )
    }

    fn run_command(&self, workdir: &Path, session: &str, urls: &[String]) -> Command {
        let mut command = self.command(&self.binary);
        command
            .args(["--workdir"])
            .arg(workdir)
            .args(["--session", session, "--order-id", ORDER, "--manifest"])
            .arg(&self.manifest)
            .args([
                "--max-turns",
                "10",
                "--run-timeout-secs",
                "60",
                "--backend-model",
                "offline-scripted",
                "--backend-key-env",
                "MODEL_API_KEY",
            ]);
        for url in urls {
            command.arg("--backend-url").arg(url);
        }
        // Public BIP-39 all-zero test vector, delivered only to the child. The
        // freshly generated signing/transport keys stay in the private scratch.
        command.env("HARNESS_VAULT_REC", format!("{}art", "abandon ".repeat(23)));
        command.env(
            "MODEL_API_KEY",
            "offline-loopback-not-a-provider-credential",
        );
        command.env("HARNESS_TRANSPORT", "nostr");
        command
    }

    fn verify_command(
        &self,
        workdir: &Path,
        session: &str,
        pin: &Path,
        omit: Option<&str>,
    ) -> Command {
        let mut command = self.command(&self.binary);
        command.arg("--verify-only").arg("--workdir").arg(workdir);
        for (name, value) in [
            ("--session", Path::new(session)),
            ("--order-id", Path::new(ORDER)),
            ("--public-material", pin),
            ("--manifest", self.manifest.as_path()),
        ] {
            if omit != Some(name) {
                command.arg(name).arg(value);
            }
        }
        command
    }

    fn verify(
        &mut self,
        tag: &str,
        control: &Control,
        workdir: &Path,
        pass: bool,
        fragments: &[&str],
        details: Value,
    ) -> Result<()> {
        let command = self.verify_command(workdir, &control.session, &control.pin, None);
        let receipt = self.execute(
            tag,
            command,
            "cleared environment; PATH and LANG only; no vault, keys or provider credentials",
            30,
        )?;
        self.check(tag, &receipt, pass, fragments, details)
    }

    fn fresh(&mut self, tag: &str, session: &str, backends: usize) -> Result<Control> {
        let workdir = self.scratch.0.join(tag);
        let pin = self
            .out
            .join("pins")
            .join(format!("{tag}-public-material.json"));
        let gate = stub::PinGate::new(
            workdir.join(format!("runs/{session}/public-material.json")),
            pin.clone(),
        );
        let tool = format!("Producing the frozen B9 receipt.\n```tool\n{{\"id\":\"b9\",\"name\":\"b9_receipt\",\"args\":{{\"order_id\":\"{ORDER}\"}}}}\n```\n");
        let finisher = stub::Stub::start(
            vec![tool, "Receipt produced. Task complete.".into()],
            gate.clone(),
        )?;
        let middle = if backends == 3 {
            Some(stub::Stub::start(vec!["DROP".into(); 3], gate.clone())?)
        } else {
            None
        };
        let urls = if backends == 1 {
            vec![finisher.url.clone()]
        } else {
            let mut endpoints = vec![stub::closed_url()?];
            if let Some(middle) = &middle {
                endpoints.push(middle.url.clone());
            }
            endpoints.push(finisher.url.clone());
            endpoints
        };
        let command = self.run_command(&workdir, session, &urls);
        let receipt = self.execute(tag, command, "cleared environment; public test vault + dummy loopback key; HARNESS_TRANSPORT=nostr; explicit loopback backend URLs only", 90)?;
        let mut events =
            vec![json!({"role":"finisher","url":finisher.url,"events":finisher.finish()?})];
        if let Some(middle) = middle {
            events.push(json!({"role":"middle","url":middle.url,"events":middle.finish()?}));
        }
        let pin_evidence = gate.evidence()?;
        write_record(
            &self.out.join("checks").join(format!("{tag}-loopback.json")),
            &json!({"classification":PUBLIC,"backend_urls":urls,"scripted_only":true,"pin":pin_evidence,"servers":events}),
        )?;
        require(
            pin_evidence["trigger_request"]
                .as_str()
                .is_some_and(|line| line.contains("/models")),
            "identity must be externally pinned during health before any model request",
        )?;
        for server in &events {
            let requests = server["events"].as_array().ok_or("loopback events")?;
            require(
                requests.iter().all(|event| event.get("error").is_none()),
                "loopback protocol error; inspect server receipt",
            )?;
            if server["role"] == "middle" {
                require(
                    requests
                        .iter()
                        .filter(|event| event["action"] == "drop")
                        .count()
                        == 3,
                    "middle must drop all three transport attempts",
                )?;
            }
        }
        self.check(tag, &receipt, true, &["B9 ACCEPTANCE PASS", "item_count=40"], json!({"backends":backends,"frozen_manifest_sha256":FIXTURE_SHA256,"order_id":ORDER,"external_pin_before_model":true}))?;
        let archive = self.out.join("archives").join(format!("{tag}.json"));
        archive::capture(&workdir, session, &archive)?;
        let control = Control {
            workdir,
            session: session.into(),
            pin,
            archive,
        };
        let count = match backends {
            1 => 0,
            2 => 2,
            3 => 3,
            _ => return Err("unsupported control backend count".into()),
        };
        let expected = format!("checkpoints_verified={count} same_actor={}", backends > 1);
        self.verify(
            &format!("{tag}-verify"),
            &control,
            &control.workdir,
            true,
            &["B9 ACCEPTANCE PASS", "item_count=40", &expected],
            json!({"checkpoint_count":count,"external_pin":control.pin}),
        )?;
        let restored = self.scratch.0.join(format!("{tag}-restored"));
        archive::restore(&control.archive, &restored)?;
        self.verify(&format!("{tag}-restored-verify"), &control, &restored, true, &["B9 ACCEPTANCE PASS", &expected], json!({"archive":control.archive,"archive_sha256":sha256(&read_bounded(&control.archive,16*1024*1024)?),"private_material_present":false}))?;
        let restored_archive = self
            .out
            .join("archives")
            .join(format!("{tag}-restored.json"));
        archive::capture(&restored, session, &restored_archive)?;
        require(
            read_bounded(&control.archive, 16 * 1024 * 1024)?
                == read_bounded(&restored_archive, 16 * 1024 * 1024)?,
            "restored public machine bytes differ from the original archive",
        )?;
        Ok(control)
    }
}

type Snapshot = BTreeMap<String, Option<Vec<u8>>>;
fn snapshot(root: &Path) -> Result<Snapshot> {
    fn visit(root: &Path, at: &Path, output: &mut Snapshot, bytes: &mut usize) -> Result<()> {
        for entry in fs::read_dir(at).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let name = path
                .strip_prefix(root)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            let meta = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
            require(output.len() < 128, "workdir file count exceeds bound")?;
            if meta.is_dir() {
                output.insert(name, None);
                visit(root, &path, output, bytes)?;
            } else if meta.is_file() {
                let contents = read_bounded(&path, MAX_FILE)?;
                *bytes += contents.len();
                require(*bytes <= MAX_FILE, "workdir snapshot byte bound exceeded")?;
                output.insert(name, Some(contents));
            } else {
                return Err("workdir snapshot refuses symlinks/special files".into());
            }
        }
        Ok(())
    }
    let mut result = BTreeMap::new();
    visit(root, root, &mut result, &mut 0)?;
    Ok(result)
}

fn public_snapshot_metadata(snapshot: &Snapshot) -> Value {
    json!(snapshot
        .iter()
        .map(|(path, bytes)| match bytes {
            Some(bytes) =>
                json!({"path":path,"type":"file","bytes":bytes.len(),"sha256":sha256(bytes)}),
            None => json!({"path":path,"type":"directory"}),
        })
        .collect::<Vec<_>>())
}

fn protected_pins(suite: &Suite, pins: &[&Path]) -> Result<Value> {
    let mut rows = Vec::new();
    for path in std::iter::once(suite.manifest.as_path()).chain(pins.iter().copied()) {
        let bytes = read_bounded(path, MAX_FILE)?;
        rows.push(json!({"path":path,"bytes":bytes.len(),"sha256":sha256(&bytes)}));
    }
    Ok(json!(rows))
}

fn run_suite(options: BTreeMap<String, PathBuf>) -> Result<()> {
    let repo = fs::canonicalize(&options["--repo"]).map_err(|e| e.to_string())?;
    let manifest = fs::canonicalize(&options["--manifest"]).map_err(|e| e.to_string())?;
    let toolchain = fs::canonicalize(&options["--toolchain"]).map_err(|e| e.to_string())?;
    let binary = options["--target"].join("debug/harness-sovereign");
    let mut suite = Suite {
        repo,
        out: options["--out"].clone(),
        manifest,
        binary,
        toolchain,
        scratch: Scratch::new()?,
        cases: Vec::new(),
        started: Instant::now(),
    };
    let frozen = read_bounded(&suite.manifest, MAX_FILE)?;
    require(
        frozen.len() == 5037 && sha256(&frozen) == FIXTURE_SHA256,
        "frozen fixture byte/hash pin mismatch",
    )?;
    let fixture: Value = serde_json::from_slice(&frozen).map_err(|e| e.to_string())?;
    let items = fixture["items"]
        .as_array()
        .ok_or("frozen fixture must be a JSON object with items array")?;
    require(
        items.len() == 40 && items[22] == items[6],
        "frozen fixture count/duplicate pin mismatch",
    )?;
    let mut permission = fs::metadata(&suite.manifest)
        .map_err(|e| e.to_string())?
        .permissions();
    permission.set_readonly(true);
    fs::set_permissions(&suite.manifest, permission).map_err(|e| e.to_string())?;

    let mut command = suite.command(Path::new("/usr/bin/git"));
    command.args(["log", "-1", "--format=%H%n%T"]);
    let head = suite.execute(
        "source-head",
        command,
        "cleared environment; PATH and LANG only",
        30,
    )?;
    require(
        head.successful()
            && String::from_utf8_lossy(&head.stdout).trim() == format!("{SOURCE}\n{TREE}"),
        "source HEAD/tree is not the reviewed merge",
    )?;
    let mut command = suite.command(Path::new("/usr/bin/git"));
    command.args([
        "diff",
        "--exit-code",
        "HEAD",
        "--",
        "crates",
        "Cargo.toml",
        "Cargo.lock",
        "rust-toolchain.toml",
        "surfaces/pq-kat.json",
    ]);
    require(
        suite
            .execute(
                "source-clean",
                command,
                "cleared environment; PATH and LANG only",
                30,
            )?
            .successful(),
        "tracked product source differs from reviewed commit",
    )?;
    let mut command = suite.command(Path::new("/usr/bin/git"));
    command.args(["show", &format!("{FIXTURE_SOURCE}:{FIXTURE_PATH}")]);
    let source_fixture = suite.execute(
        "fixture-source",
        command,
        "cleared environment; existing local Git object; no fetch",
        30,
    )?;
    require(
        source_fixture.successful() && source_fixture.stdout == frozen,
        "fixture differs from specified Git object",
    )?;

    let mut command = suite.command(&suite.toolchain.join("rustc"));
    command.args(["--version", "--verbose"]);
    let compiler = suite.execute(
        "rustc-version",
        command,
        "explicit pinned compiler path; cleared environment",
        30,
    )?;
    require(
        compiler.successful()
            && String::from_utf8_lossy(&compiler.stdout).starts_with("rustc 1.98.1 "),
        "actual compiler is not pinned Rust 1.98.1",
    )?;
    let mut command = suite.command(&suite.toolchain.join("cargo"));
    command.arg("--version");
    let cargo_version = suite.execute(
        "cargo-version",
        command,
        "explicit pinned Cargo path; cleared environment",
        30,
    )?;
    require(cargo_version.successful(), "cargo version failed")?;
    let mut command = suite.command(&suite.toolchain.join("cargo"));
    command
        .args(["build", "-p", "harness-sovereign", "--locked", "--offline"])
        .env("CARGO_HOME", &options["--cargo-home"])
        .env("CARGO_TARGET_DIR", &options["--target"])
        .env("OPENSSL_INCLUDE_DIR", "/usr/include")
        .env("OPENSSL_LIB_DIR", "/usr/lib/x86_64-linux-gnu");
    let build = suite.execute("pinned-offline-build",command,"cleared environment; pinned compiler PATH; caller Cargo cache/target; existing system OpenSSL include/lib directories; --locked --offline",300)?;
    require(
        build.successful(),
        "captured pinned offline product build failed",
    )?;
    let binary_before = sha256(&read_bounded(&suite.binary, 512 * 1024 * 1024)?);
    let mut files = Vec::new();
    for path in [
        suite.binary.clone(),
        suite.toolchain.join("rustc"),
        suite.toolchain.join("cargo"),
        suite.repo.join("Cargo.lock"),
        suite.repo.join("rust-toolchain.toml"),
        suite.repo.join("crates/harness-sovereign/src/main.rs"),
        suite.repo.join("crates/harness-sovereign/src/b9.rs"),
        suite.repo.join("crates/harness-sovereign/src/switch.rs"),
        suite.repo.join("crates/harness-sovereign/src/identity.rs"),
    ] {
        let bytes = read_bounded(&path, 512 * 1024 * 1024)?;
        files.push(json!({"path":path,"bytes":bytes.len(),"sha256":sha256(&bytes)}));
    }
    let mut command = suite.command(Path::new("/usr/bin/ldd"));
    command.arg(&suite.binary);
    require(
        suite
            .execute(
                "binary-linkage",
                command,
                "cleared environment; inspect local compiled binary",
                30,
            )?
            .successful(),
        "binary linkage inspection failed",
    )?;
    let driver = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut driver_sources = Vec::new();
    for name in [
        "Cargo.toml",
        "Cargo.lock",
        "src/main.rs",
        "src/lib.rs",
        "src/archive.rs",
        "src/process.rs",
        "src/stub.rs",
    ] {
        let path = suite.repo.join("tools/h01-frozen-qualification").join(name);
        let bytes = read_bounded(&path, MAX_FILE)?;
        driver_sources.push(json!({"path":name,"bytes":bytes.len(),"sha256":sha256(&bytes)}));
    }
    write_record(
        &suite.out.join("PROVENANCE.json"),
        &json!({
            "classification":PUBLIC,"source_commit":SOURCE,"source_tree":TREE,"fixture_source_commit":FIXTURE_SOURCE,"fixture_source_path":FIXTURE_PATH,
            "fixture_sha256":FIXTURE_SHA256,"fixture_bytes":frozen.len(),"item_count":items.len(),"duplicate":"items[22] equals items[6]","order_id":ORDER,
            "compiler_stdout_b64":STANDARD.encode(&compiler.stdout),"cargo_stdout_b64":STANDARD.encode(&cargo_version.stdout),"files":files,
            "driver_binary":{"path":driver,"sha256":sha256(&read_bounded(&driver,512*1024*1024)?)},"driver_sources":driver_sources,
            "archive_format":"h01-public-bundle-v1; exact original bytes in base64 plus lengths/digests; metadata stays outside signed artifacts",
            "archive_allowlist":"archive.rs::paths; excludes keys and nostr-keys before capture",
            "limits":{"run_timeout_seconds":60,"child_timeout_seconds":90,"verify_timeout_seconds":30,"build_timeout_seconds":300,"suite_timeout_seconds":900,"stdout_or_stderr_bytes":8*1024*1024,"public_archive_bytes":8*1024*1024,"http_request_body_bytes":4*1024*1024,"requests_per_stub":64},
            "scope":"offline scripted loopback executable-boundary qualification; no paid models, live provider or payment qualification, settlement claim, host-loss continuity, unique-human proof or millennium durability"
        }),
    )?;

    let a = suite.fresh("valid-a", "frozen-shared", 1)?;
    let pins_before = protected_pins(&suite, &[a.pin.as_path()])?;

    // Occupancy compares every directory/file and exact bytes, including private
    // generated files, in memory. Only their digest metadata is published.
    let before = snapshot(&a.workdir)?;
    let reuse_gate = stub::PinGate::new(
        a.workdir
            .join(format!("runs/{}/public-material.json", a.session)),
        suite.out.join("pins/reuse-must-not-be-created.json"),
    );
    let unused_stub = stub::Stub::start(vec!["must never be requested".into()], reuse_gate)?;
    let command = suite.run_command(&a.workdir, &a.session, &[unused_stub.url.clone()]);
    let reused = suite.execute("occupied-session",command,"same explicit original workdir/session; dummy local environment; second loopback stub records any dispatch",90)?;
    let reuse_events = unused_stub.finish()?;
    let after = snapshot(&a.workdir)?;
    let unchanged = before == after;
    write_record(
        &suite.out.join("checks/occupied-preservation.json"),
        &json!({"classification":PUBLIC,"all_directories_and_file_bytes_equal":unchanged,"before":public_snapshot_metadata(&before),"after":public_snapshot_metadata(&after),"second_backend_requests":reuse_events.len(),"private_bytes_published":false}),
    )?;
    require(
        unchanged && reuse_events.is_empty(),
        "occupied-session changed original bytes or dispatched to a backend",
    )?;
    suite.check(
        "occupied-session",
        &reused,
        false,
        &["already occupied"],
        json!({"original_all_bytes_unchanged":true,"backend_requests":0}),
    )?;
    drop(before);
    drop(after);
    suite.verify(
        "occupied-original-reverify",
        &a,
        &a.workdir,
        true,
        &["B9 ACCEPTANCE PASS"],
        json!({"original_after_refused_reuse":true}),
    )?;

    // A complete valid public bundle remains present during every omission.
    let omitted_copy = suite.scratch.0.join("omission-copy");
    archive::restore(&a.archive, &omitted_copy)?;
    let before_omissions = snapshot(&omitted_copy)?;
    for flag in ["--session", "--order-id", "--public-material", "--manifest"] {
        let tag = format!("omit-{}", flag.trim_start_matches('-'));
        let command = suite.verify_command(&omitted_copy, &a.session, &a.pin, Some(flag));
        let receipt = suite.execute(
            &tag,
            command,
            "cleared environment; one expectation omitted; all artifacts and other pins intact",
            30,
        )?;
        suite.check(
            &tag,
            &receipt,
            false,
            &["stage=expectations", flag],
            json!({"complete_valid_bundle_present":true}),
        )?;
        require(
            snapshot(&omitted_copy)? == before_omissions
                && protected_pins(&suite, &[a.pin.as_path()])? == pins_before,
            "expectation refusal changed bundle or external pins",
        )?;
    }
    suite.verify(
        "omission-control-reverify",
        &a,
        &omitted_copy,
        true,
        &["B9 ACCEPTANCE PASS"],
        json!({"all_four_omissions_preserved_bytes":true}),
    )?;

    let b = suite.fresh("valid-b", "frozen-shared", 1)?;
    let def_a = read_json(
        &a.workdir
            .join(format!("runs/{}/run-definition.json", a.session)),
    )?;
    let def_b = read_json(
        &b.workdir
            .join(format!("runs/{}/run-definition.json", b.session)),
    )?;
    for field in ["session_id", "order_id", "manifest_sha256", "item_count"] {
        require(
            !def_a[field].is_null() && def_a[field] == def_b[field],
            format!("A/B {field} differs"),
        )?;
    }
    let material_a = read_json(&a.pin)?;
    let material_b = read_json(&b.pin)?;
    require(
        def_a["did"] != def_b["did"]
            && material_a["did"] != material_b["did"]
            && material_a["verifying_key_b64u"] != material_b["verifying_key_b64u"],
        "A/B identities did not differ",
    )?;
    let substituted = suite.scratch.0.join("whole-bundle-substitution");
    archive::restore(&a.archive, &substituted)?;
    let pre_substitution = public_snapshot_metadata(&snapshot(&substituted)?);
    fs::remove_dir_all(&substituted).map_err(|e| e.to_string())?;
    archive::restore(&b.archive, &substituted)?;
    write_record(
        &suite.out.join("checks/substitution-provenance.json"),
        &json!({"classification":PUBLIC,"same_session_order_manifest_count":true,"different_actor_dids":true,"actor_a":material_a["did"],"actor_b":material_b["did"],"external_a_pin_preserved":true,"public_tree_before":pre_substitution,"public_tree_after":public_snapshot_metadata(&snapshot(&substituted)?),"replacement_archive":b.archive}),
    )?;
    suite.verify("identity-substitution",&a,&substituted,false,&["archived public material does not match the supplied expectation"],json!({"replacement":b.archive,"expected_pin":a.pin,"same_internal_session_order_manifest":true}))?;
    require(
        protected_pins(&suite, &[a.pin.as_path()])? == pins_before,
        "substitution changed external A pin or manifest",
    )?;
    suite.verify(
        "identity-original-reverify",
        &a,
        &a.workdir,
        true,
        &["B9 ACCEPTANCE PASS"],
        json!({"original_a_untouched":true}),
    )?;

    let failover = suite.fresh("valid-failover", "frozen-failover", 2)?;
    let three = suite.fresh("valid-three", "frozen-three", 3)?;
    let original_outcome = read_bounded(
        &three
            .workdir
            .join(format!("runs/{}/evidence/run-outcome.json", three.session)),
        MAX_FILE,
    )?;
    let exported_relative = format!("runs/{}/evidence/checkpoints.json", three.session);
    let persisted_relative = format!("sessions/{}.checkpoints.jsonl", three.session);
    let initial = read_json(&three.workdir.join(&exported_relative))?;
    require(
        initial.as_array().is_some_and(|v| v.len() == 3),
        "three-checkpoint control inventory length",
    )?;
    let phases: Vec<Value> = initial
        .as_array()
        .ok_or("checkpoint array")?
        .iter()
        .map(|v| v["phase"].clone())
        .collect();
    require(
        phases
            == vec![
                json!("pre-switch"),
                json!("pre-switch"),
                json!("post-switch"),
            ],
        "unexpected three-checkpoint phases",
    )?;
    for tag in [
        "checkpoint-duplicate",
        "checkpoint-metadata",
        "checkpoint-reorder",
        "checkpoint-interior-signature",
    ] {
        let case = suite.scratch.0.join(tag);
        archive::restore(&three.archive, &case)?;
        let mut entries = initial.as_array().ok_or("checkpoints array")?.clone();
        match tag {
            "checkpoint-duplicate" => entries[1] = entries[0].clone(),
            "checkpoint-metadata" => entries[0]["phase"] = json!("deliberately-mutated-phase"),
            "checkpoint-reorder" => entries.reverse(),
            "checkpoint-interior-signature" => {
                let text = entries[1]["bsigner_envelope"]["signature_b64u"]
                    .as_str()
                    .ok_or("interior signature missing")?;
                let mut bytes = text.as_bytes().to_vec();
                require(!bytes.is_empty(), "interior signature empty")?;
                bytes[0] = if bytes[0] == b'A' { b'B' } else { b'A' };
                entries[1]["bsigner_envelope"]["signature_b64u"] =
                    json!(String::from_utf8(bytes).map_err(|e| e.to_string())?);
            }
            _ => return Err("unknown inventory case".into()),
        }
        let exported = serde_json::to_vec_pretty(&entries).map_err(|e| e.to_string())?;
        fs::write(case.join(&exported_relative), exported).map_err(|e| e.to_string())?;
        let mut persisted = Vec::new();
        for entry in &entries {
            serde_json::to_writer(&mut persisted, entry).map_err(|e| e.to_string())?;
            persisted.push(b'\n');
        }
        fs::write(case.join(&persisted_relative), &persisted).map_err(|e| e.to_string())?;
        let from_disk = read_json(&case.join(&exported_relative))?;
        let persisted_disk = read_bounded(&case.join(&persisted_relative), MAX_FILE)?;
        let parsed_rows: Vec<Value> = String::from_utf8(persisted_disk)
            .map_err(|e| e.to_string())?
            .lines()
            .map(serde_json::from_str)
            .collect::<std::result::Result<_, _>>()
            .map_err(|e| e.to_string())?;
        require(
            from_disk == json!(parsed_rows),
            "tampered checkpoint copies disagree",
        )?;
        let outcome = read_bounded(
            &case.join(format!("runs/{}/evidence/run-outcome.json", three.session)),
            MAX_FILE,
        )?;
        require(
            outcome == original_outcome,
            "mutation changed the original signed terminal outcome",
        )?;
        let archive = suite.out.join("archives").join(format!("{tag}.json"));
        archive::capture(&case, &three.session, &archive)?;
        let fragments: &[&str] = match tag {
            "checkpoint-duplicate" | "checkpoint-metadata" => &["stage=inventory-commitment"],
            "checkpoint-reorder" => &["stage=checkpoint-order"],
            _ => &["stage=checkpoint-signature", "checkpoint 1"],
        };
        suite.verify(tag,&three,&case,false,fragments,json!({"checkpoint_count":entries.len(),"export_and_persisted_equal":true,"original_terminal_bytes_retained":true,"terminal_sha256":sha256(&outcome),"archive":archive}))?;
    }
    suite.verify(
        "three-control-final-reverify",
        &three,
        &three.workdir,
        true,
        &[
            "checkpoints_verified=3 same_actor=true",
            "B9 ACCEPTANCE PASS",
        ],
        json!({"original_three_control_untouched":true}),
    )?;
    suite.verify(
        "failover-control-final-reverify",
        &failover,
        &failover.workdir,
        true,
        &[
            "checkpoints_verified=2 same_actor=true",
            "B9 ACCEPTANCE PASS",
        ],
        json!({"original_failover_control_untouched":true}),
    )?;
    require(
        read_bounded(&suite.manifest, MAX_FILE)? == frozen,
        "golden manifest changed",
    )?;
    require(
        protected_pins(&suite, &[a.pin.as_path()])? == pins_before,
        "external A pin changed",
    )?;
    require(
        sha256(&read_bounded(&suite.binary, 512 * 1024 * 1024)?) == binary_before,
        "qualified executable bytes changed during the run",
    )?;
    let mut command = suite.command(Path::new("/usr/bin/git"));
    command.args([
        "diff",
        "--exit-code",
        "HEAD",
        "--",
        "crates",
        "Cargo.toml",
        "Cargo.lock",
        "rust-toolchain.toml",
        "surfaces/pq-kat.json",
    ]);
    require(
        suite
            .execute(
                "source-clean-after",
                command,
                "cleared environment; product sources unchanged after all cases",
                30,
            )?
            .successful(),
        "product source changed during qualification",
    )?;
    let summary = json!({
        "classification":PUBLIC,"verdict":"PASS","source_commit":SOURCE,"source_tree":TREE,"fixture_sha256":FIXTURE_SHA256,"fixture_bytes":5037,"item_count":40,"order_id":ORDER,
        "cases_passed":suite.cases.len(),"cases":suite.cases,"elapsed_ms":suite.started.elapsed().as_millis(),
        "independent_external_pins":protected_pins(&suite,&[a.pin.as_path(),b.pin.as_path(),failover.pin.as_path(),three.pin.as_path()])?,
        "public_archives_restore_byte_exactly":true,"golden_fixture_unchanged":true,"binary_sha256_unchanged":binary_before,"product_sources_unchanged":true,
        "private_runtime_artifacts":"never archived; private scratch removed when this process returns",
        "limitations":["scripted loopback backends only","no live provider, paid call, settlement or host-loss qualification","current binary/platform only; no bit-for-bit rebuild or thousand-year durability claim"]
    });
    write_record(&suite.out.join("SUMMARY.json"), &summary)?;
    println!(
        "H01 FROZEN QUALIFICATION PASS: {} measured cases; {}",
        suite.cases.len(),
        suite.out.display()
    );
    Ok(())
}
