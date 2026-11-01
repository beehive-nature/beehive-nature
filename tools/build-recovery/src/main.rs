#![forbid(unsafe_code)]
//! Linux recovery orchestration. Signer implementation and public fixtures stay unchanged.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    env,
    error::Error,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    os::unix::fs::{symlink, PermissionsExt},
    path::{Component, Path},
    process::{Command, Stdio},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
type Result<T> = std::result::Result<T, Box<dyn Error>>;
const JSON_LIMIT: u64 = 64 * 1024 * 1024;
const MAX_FILES: usize = 150_000;
const MAX_DEPTH: usize = 64;

fn require(ok: bool, reason: &str) -> Result<()> {
    if ok {
        Ok(())
    } else {
        Err(reason.into())
    }
}
fn digest(path: &Path) -> Result<String> {
    let mut f = File::open(path)?;
    let mut hash = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hash.update(&buf[..n]);
    }
    Ok(format!("{:x}", hash.finalize()))
}
fn read_json(path: &Path) -> Result<Value> {
    let f = File::open(path)?;
    require(
        f.metadata()?.len() <= JSON_LIMIT,
        "JSON input exceeds 64 MiB",
    )?;
    Ok(serde_json::from_reader(f.take(JSON_LIMIT))?)
}
fn write_json(path: &Path, value: &impl Serialize) -> Result<()> {
    let mut f = OpenOptions::new().write(true).create_new(true).open(path)?;
    serde_json::to_writer_pretty(&mut f, value)?;
    f.write_all(b"\n")?;
    Ok(())
}
fn text(v: &Value) -> Result<&str> {
    v.as_str().ok_or_else(|| "expected JSON string".into())
}
fn safe_relative(name: &str) -> Result<()> {
    require(
        !name.is_empty() && !name.contains('\\') && !name.contains('\0'),
        "invalid relative path",
    )?;
    require(
        Path::new(name)
            .components()
            .all(|c| matches!(c, Component::Normal(_))),
        "path escapes root or is noncanonical",
    )
}
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
struct Entry {
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sha256: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    link: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    mode: Option<u32>,
}
fn walk(root: &Path, dir: &Path, depth: usize, out: &mut Vec<Entry>, hashes: bool) -> Result<()> {
    require(depth < MAX_DEPTH, "directory depth limit exceeded")?;
    for item in fs::read_dir(dir)? {
        let p = item?.path();
        let name = p
            .strip_prefix(root)?
            .to_str()
            .ok_or("non-UTF8 snapshot path")?
            .to_owned();
        let m = fs::symlink_metadata(&p)?;
        if m.is_dir() {
            walk(root, &p, depth + 1, out, hashes)?;
        } else {
            require(out.len() < MAX_FILES, "snapshot file count exceeds limit")?;
            require(
                m.is_file() || m.is_symlink(),
                "special snapshot input refused",
            )?;
            out.push(Entry {
                path: name,
                bytes: m.is_file().then_some(m.len()),
                sha256: if m.is_file() && hashes {
                    Some(digest(&p)?)
                } else {
                    None
                },
                link: if m.is_symlink() {
                    Some(
                        fs::read_link(&p)?
                            .to_str()
                            .ok_or("non-UTF8 link")?
                            .to_owned(),
                    )
                } else {
                    None
                },
                mode: m.is_file().then_some(m.permissions().mode() & 0o777),
            });
        }
    }
    Ok(())
}
fn inventory(root: &Path, hashes: bool) -> Result<Vec<Entry>> {
    let mut rows = Vec::new();
    walk(root, root, 0, &mut rows, hashes)?;
    rows.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(rows)
}
fn verify_snapshot(root: &Path, expected_manifest: &str) -> Result<()> {
    require(
        digest(&root.join("manifest.json"))? == expected_manifest,
        "independent manifest digest mismatch",
    )?;
    let rows: Vec<Entry> = serde_json::from_value(read_json(&root.join("manifest.json"))?)?;
    require(rows.len() <= MAX_FILES, "snapshot file count exceeds limit")?;
    let mut names = BTreeSet::new();
    for row in &rows {
        safe_relative(&row.path)?;
        require(
            row.path != "manifest.json" && names.insert(row.path.clone()),
            "duplicate or reserved manifest path",
        )?;
        require(
            (row.link.is_some() && row.bytes.is_none() && row.sha256.is_none())
                || (row.link.is_none() && row.bytes.is_some() && row.sha256.is_some()),
            "invalid manifest row",
        )?;
    }
    names.insert("manifest.json".to_owned());
    let actual: BTreeSet<_> = inventory(root, false)?
        .into_iter()
        .map(|r| r.path)
        .collect();
    require(actual == names, "snapshot file inventory changed")?;
    for row in rows {
        let path = root.join(&row.path);
        let m = fs::symlink_metadata(&path)?;
        if let Some(link) = row.link {
            require(
                m.is_symlink() && fs::read_link(&path)? == Path::new(&link),
                "snapshot link changed",
            )?;
        } else {
            require(
                m.is_file() && Some(m.len()) == row.bytes && Some(digest(&path)?) == row.sha256,
                &format!("snapshot bytes changed: {}", row.path),
            )?;
            if let Some(mode) = row.mode {
                require(
                    m.permissions().mode() & 0o777 == mode,
                    "snapshot file mode changed",
                )?;
            }
        }
    }
    Ok(())
}
fn copy_tree(from: &Path, to: &Path, depth: usize) -> Result<()> {
    require(depth < MAX_DEPTH, "copy depth limit exceeded")?;
    fs::create_dir(to)?;
    for e in fs::read_dir(from)? {
        let e = e?;
        let src = e.path();
        let dst = to.join(e.file_name());
        let meta = fs::symlink_metadata(&src)?;
        if meta.is_symlink() {
            symlink(fs::read_link(src)?, dst)?;
        } else if meta.is_dir() {
            copy_tree(&src, &dst, depth + 1)?;
        } else {
            require(meta.is_file(), "special input refused")?;
            fs::copy(src, dst)?;
        }
    }
    Ok(())
}
fn output(argv: &[&str], cwd: &Path) -> Result<Vec<u8>> {
    let result = Command::new(argv[0])
        .args(&argv[1..])
        .current_dir(cwd)
        .env_clear()
        .env("PATH", "/usr/bin:/bin")
        .env("LANG", "C.UTF-8")
        .output()?;
    require(
        result.status.success(),
        &format!("command failed: {}", argv[0]),
    )?;
    require(
        result.stdout.len() as u64 <= JSON_LIMIT,
        "command output too large",
    )?;
    Ok(result.stdout)
}
fn run(argv: &[String], cwd: &Path, logs: &Path, name: &str) -> Result<Value> {
    let out = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(logs.join(format!("{name}.log")))?;
    let start = Instant::now();
    let status = Command::new("/usr/bin/timeout")
        .args(["--signal=TERM", "--kill-after=15s", "30m"])
        .args(argv)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(out.try_clone()?)
        .stderr(out)
        .status()?;
    let row = json!({"command":argv, "exit":status.code().unwrap_or(128), "seconds":start.elapsed().as_secs_f64()});
    write_json(&logs.join(format!("{name}.json")), &row)?;
    println!("{name}: exit {}", row["exit"]);
    require(
        status.success(),
        &format!("{name} failed; see retained log"),
    )?;
    Ok(row)
}
fn strings(a: &[&str]) -> Vec<String> {
    a.iter().map(|s| (*s).to_owned()).collect()
}
fn host_tools() -> Result<Value> {
    let mut map = serde_json::Map::new();
    for name in [
        "cc", "gcc", "ld", "as", "bwrap", "timeout", "prlimit", "nice",
    ] {
        let p = fs::canonicalize(Path::new("/usr/bin").join(name))?;
        map.insert(name.to_owned(), json!({"path":p, "sha256":digest(&p)?}));
    }
    Ok(Value::Object(map))
}
fn prepare(a: &[String]) -> Result<()> {
    require(a.len() == 8, "prepare ARCHIVE ARCHIVE_SHA256 SOURCE_SHA TOOLCHAIN VENDOR FIXTURES NEW_SNAPSHOT EXPECTED_LOCK_SHA256")?;
    let archive = fs::canonicalize(&a[0])?;
    require(
        digest(&archive)? == a[1],
        "independent archive digest mismatch",
    )?;
    require(
        a[2].len() == 40 && a[2].bytes().all(|c| c.is_ascii_hexdigit()),
        "full source commit required",
    )?;
    let commit = Command::new("/usr/bin/git")
        .args(["get-tar-commit-id"])
        .stdin(File::open(&archive)?)
        .output()?;
    require(
        commit.status.success() && String::from_utf8(commit.stdout)?.trim() == a[2],
        "archive commit mismatch",
    )?;
    let root = Path::new(&a[6]);
    fs::create_dir(root)?;
    let root = fs::canonicalize(root)?;
    let source = root.join("source");
    fs::create_dir(&source)?;
    let logs = root.join("preparation");
    fs::create_dir(&logs)?;
    // GNU tar rejects absolute/parent traversal and directory-symlink writes by default.
    // The archive must also match the independently supplied content digest before extraction.
    run(
        &strings(&[
            "/usr/bin/tar",
            "--extract",
            "--file",
            archive.to_str().ok_or("archive path")?,
            "--directory",
            source.to_str().ok_or("source path")?,
            "--no-same-owner",
            "--no-same-permissions",
        ]),
        &root,
        &logs,
        "extract",
    )?;
    require(
        digest(&source.join("Cargo.lock"))? == a[7],
        "source lock digest mismatch",
    )?;
    let config: toml::Value =
        toml::from_str(&fs::read_to_string(source.join("rust-toolchain.toml"))?)?;
    let pin = config["toolchain"]["channel"]
        .as_str()
        .ok_or("missing toolchain pin")?;
    let toolchain = fs::canonicalize(&a[3])?;
    let version = String::from_utf8(output(
        &[
            toolchain
                .join("bin/rustc")
                .to_str()
                .ok_or("toolchain path")?,
            "-Vv",
        ],
        &root,
    )?)?;
    require(
        version.lines().any(|l| l == format!("release: {pin}")),
        "toolchain does not match source pin",
    )?;
    copy_tree(&toolchain, &root.join("toolchain"), 0)?;
    copy_tree(Path::new(&a[4]), &root.join("vendor"), 0)?;
    fs::create_dir(root.join("fixtures"))?;
    let xwing = read_json(&source.join("scripts/btungsten/pq05-xwing-draft.json"))?;
    let bip = read_json(&source.join("scripts/btungsten/pq12-bip341.json"))?;
    let mut fixtures = Vec::new();
    for (name, pin) in [
        ("xwing-draft.txt", &xwing),
        ("bip341.json", &bip),
        ("bip174.mediawiki", &bip["psbt"]["bip174"]),
        ("bip371.mediawiki", &bip["psbt"]["bip371"]),
    ] {
        let src = Path::new(&a[5]).join(name);
        let hash = digest(&src)?;
        require(
            pin["size"].as_u64() == Some(src.metadata()?.len())
                && src.metadata()?.len() < JSON_LIMIT,
            "public fixture size mismatch",
        )?;
        let encoded = URL_SAFE_NO_PAD.encode(Sha256::digest(fs::read(&src)?));
        require(
            pin["size"].as_u64() == Some(src.metadata()?.len()) && text(&pin["sha256"])? == encoded,
            "public fixture pin mismatch",
        )?;
        fs::copy(&src, root.join("fixtures").join(name))?;
        fixtures.push(json!({"file":name,"sha256":hash,"bytes":src.metadata()?.len()}));
    }
    // This retained workspace has crates.io dependencies only. Refuse unsupported source types.
    let lock: toml::Value = toml::from_str(&fs::read_to_string(source.join("Cargo.lock"))?)?;
    for package in lock["package"].as_array().ok_or("lock packages missing")? {
        if let Some(s) = package.get("source") {
            require(
                s.as_str() == Some("registry+https://github.com/rust-lang/crates.io-index"),
                "unsupported lock source; retain its source mapping explicitly",
            )?;
        }
    }
    write_json(&root.join("dependencies.json"), &lock["package"])?;
    fs::write(root.join("cargo-config.toml"), "[source.crates-io]\nreplace-with = 'vendored-sources'\n[source.vendored-sources]\ndirectory = '/snapshot/vendor'\n")?;
    fs::copy(env::current_exe()?, root.join("runner"))?;
    fs::create_dir(root.join("runner-source"))?;
    for (file, content) in [
        ("Cargo.toml", include_str!("../Cargo.toml")),
        ("Cargo.lock", include_str!("../Cargo.lock")),
        ("src/main.rs", include_str!("main.rs")),
    ] {
        let dst = root.join("runner-source").join(file);
        if file.contains('/') {
            fs::create_dir(dst.parent().ok_or("source parent")?)?;
        }
        fs::write(dst, content)?;
    }
    write_json(
        &root.join("provenance.json"),
        &json!({"source_sha":a[2],"archive_sha256":a[1],"archive_bytes":archive.metadata()?.len(),
        "lock_sha256":a[7],"rustc":version,"host_tools":host_tools()?,"fixtures":fixtures,
        "runner_sha256":digest(&root.join("runner"))?,"os_release":fs::read_to_string("/etc/os-release")?,
        "kernel":String::from_utf8(output(&["/usr/bin/uname", "-r"], &root)?)?,
        "host_packages":String::from_utf8(output(&["/usr/bin/dpkg-query", "-W", "gcc", "binutils", "libc6", "libc6-dev", "libgcc-s1", "libstdc++6", "bubblewrap"], &root)?)?}),
    )?;
    write_json(&root.join("manifest.json"), &inventory(&root, true)?)?;
    println!(
        "prepared {}; manifest SHA-256 {}",
        root.display(),
        digest(&root.join("manifest.json"))?
    );
    Ok(())
}
fn offline(a: &[String]) -> Result<()> {
    require(
        a.len() == 4 || (a.len() == 5 && a[4] == "--probe-only"),
        "offline SNAPSHOT MANIFEST_SHA256 NEW_WORK QUIET_WINDOW_NOTE [--probe-only]",
    )?;
    require(!a[3].trim().is_empty(), "SDK idle evidence required")?;
    let snapshot = fs::canonicalize(&a[0])?;
    verify_snapshot(&snapshot, &a[1])?;
    let proposed = Path::new(&a[2]);
    let work = fs::canonicalize(proposed.parent().ok_or("work parent required")?)?
        .join(proposed.file_name().ok_or("work filename required")?);
    require(
        !work.starts_with(&snapshot) && !snapshot.starts_with(&work),
        "snapshot and output must be disjoint",
    )?;
    let provenance = read_json(&snapshot.join("provenance.json"))?;
    for entry in provenance["host_tools"]
        .as_object()
        .ok_or("host tools missing")?
        .values()
    {
        require(
            digest(Path::new(text(&entry["path"])?))? == text(&entry["sha256"])?,
            "retained host tool changed",
        )?;
    }
    require(
        digest(&snapshot.join("runner"))? == text(&provenance["runner_sha256"])?,
        "runner digest changed",
    )?;
    fs::create_dir(&work)?;
    let mut command = strings(&[
        "/usr/bin/timeout",
        "--signal=TERM",
        "--kill-after=15s",
        "30m",
        "/usr/bin/nice",
        "-n",
        "15",
        "/usr/bin/prlimit",
        "--as=8589934592",
        "--cpu=1200",
        "--nofile=1024",
        "--fsize=2147483648",
        "--",
        "/usr/bin/bwrap",
        "--unshare-all",
        "--die-with-parent",
        "--new-session",
        "--cap-drop",
        "ALL",
    ]);
    for p in ["/usr", "/bin", "/lib", "/lib64"] {
        command.extend(strings(&["--ro-bind", p, p]));
    }
    command.extend(strings(&[
        "--dir",
        "/etc",
        "--ro-bind",
        "/etc/ld.so.cache",
        "/etc/ld.so.cache",
        "--ro-bind",
        "/etc/alternatives",
        "/etc/alternatives",
        "--proc",
        "/proc",
        "--dev",
        "/dev",
        "--tmpfs",
        "/tmp",
        "--ro-bind",
        snapshot.to_str().ok_or("snapshot path")?,
        "/snapshot",
        "--ro-bind",
        snapshot.join("source").to_str().ok_or("source path")?,
        "/source",
        "--bind",
        work.to_str().ok_or("work path")?,
        "/work",
        "--chdir",
        "/source",
        "--clearenv",
    ]));
    for (k, v) in [
        ("PATH", "/snapshot/toolchain/bin:/usr/bin:/bin"),
        ("HOME", "/work/home"),
        ("CARGO_HOME", "/work/cargo-home"),
        ("CARGO_TARGET_DIR", "/work/target"),
        ("CARGO_NET_OFFLINE", "true"),
        ("CARGO_BUILD_JOBS", "1"),
        ("RUST_TEST_THREADS", "1"),
        ("LANG", "C.UTF-8"),
        ("TZ", "UTC"),
        ("BPQ_XWING_DRAFT", "/snapshot/fixtures/xwing-draft.txt"),
        ("BPQ_BIP341_VECTORS", "/snapshot/fixtures/bip341.json"),
        ("BPQ_BIP174_TEXT", "/snapshot/fixtures/bip174.mediawiki"),
        ("BPQ_BIP371_TEXT", "/snapshot/fixtures/bip371.mediawiki"),
    ] {
        command.extend(strings(&["--setenv", k, v]));
    }
    // Hide both interpreter families so an accidental transitive call fails closed.
    for p in ["/usr/bin/python3", "/usr/bin/node"] {
        if Path::new(p).exists() {
            let actual = fs::canonicalize(p)?;
            command.extend(strings(&[
                "--ro-bind",
                "/dev/null",
                actual.to_str().ok_or("interpreter path")?,
            ]));
        }
    }
    command.extend(strings(&["/snapshot/runner", "inside"]));
    if a.len() == 5 {
        command.push("--probe-only".to_owned());
    }
    write_json(
        &work.join("launch.json"),
        &json!({"command":command,"quiet_window_note":a[3],"host_netns":fs::read_link("/proc/self/ns/net")?,"snapshot_manifest_sha256":a[1]}),
    )?;
    let out = File::create(work.join("outer.log"))?;
    let start = Instant::now();
    let started = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs_f64();
    let status = Command::new(&command[0])
        .args(&command[1..])
        .env_clear()
        .env("PATH", "/usr/bin:/bin")
        .env("LANG", "C.UTF-8")
        .stdin(Stdio::null())
        .stdout(out.try_clone()?)
        .stderr(out)
        .status()?;
    write_json(
        &work.join("result.json"),
        &json!({"exit":status.code().unwrap_or(128),"seconds":start.elapsed().as_secs_f64(),"started_unix":started}),
    )?;
    require(status.success(), "offline command failed; see outer.log")?;
    println!("offline PASS; receipts {}", work.display());
    Ok(())
}
fn check_verified(value: &Value, pins: &BTreeSet<String>) -> Result<()> {
    require(
        value["verified"] == true
            && value["kind"] == "detached"
            && pins.contains(text(&value["id"])?),
        "signature not verified and pinned",
    )
}
fn laws(binary: &Path, source: &Path) -> Result<()> {
    let law = read_json(&source.join("docs/PQ-LAW.json"))?;
    let signers = read_json(&source.join("docs/PQ-SIGNERS.json"))?;
    let pins: BTreeSet<_> = signers["signers"]
        .as_array()
        .ok_or("missing signers")?
        .iter()
        .map(|s| text(&s["id"]).map(str::to_owned))
        .collect::<Result<_>>()?;
    let files = law["files"].as_array().ok_or("missing law files")?;
    require(
        !files.is_empty() && !pins.is_empty(),
        "empty law or signer set",
    )?;
    let mut unique = BTreeSet::new();
    for f in files {
        let f = text(f)?;
        safe_relative(f)?;
        require(unique.insert(f), "duplicate law file")?;
        let result = output(
            &[
                binary.to_str().ok_or("binary path")?,
                "bpq-verify",
                "--file",
                &format!("{f}.bpqsig.json"),
                "--target",
                f,
            ],
            source,
        )?;
        check_verified(&serde_json::from_slice(&result)?, &pins)?;
        println!("LAW-RUST ok {f}");
    }
    let first = text(&files[0])?;
    let tmp = env::temp_dir().join(format!("bsigner-recovery-tamper-{}", std::process::id()));
    let mut f = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
    std::io::copy(&mut File::open(source.join(first))?, &mut f)?;
    f.write_all(b"\nan edit after signing\n")?;
    drop(f);
    let status = Command::new(binary)
        .args([
            "bpq-verify",
            "--file",
            &format!("{first}.bpqsig.json"),
            "--target",
            tmp.to_str().ok_or("temp path")?,
        ])
        .current_dir(source)
        .env_clear()
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    fs::remove_file(&tmp)?;
    require(
        status?.code() == Some(1),
        "tampered signature must exit 1; crash/tool failure is not refusal",
    )?;
    println!(
        "LAW-RUST TEETH: changed copy refused; {}/{} signatures verified",
        files.len(),
        files.len()
    );
    Ok(())
}
fn inside(probe: bool) -> Result<()> {
    let work = Path::new("/work");
    let logs = work.join("logs");
    fs::create_dir(&logs)?;
    for name in ["home", "cargo-home", "target"] {
        fs::create_dir(work.join(name))?;
    }
    let launch = read_json(&work.join("launch.json"))?;
    let netns = fs::read_link("/proc/self/ns/net")?;
    require(
        netns != Path::new(text(&launch["host_netns"])?),
        "network namespace not isolated",
    )?;
    let routes = fs::read_to_string("/proc/net/route")?;
    require(routes.trim().lines().count() == 1, "unexpected IPv4 route")?;
    let dev = fs::read_to_string("/proc/net/dev")?;
    let interfaces: Vec<_> = dev
        .lines()
        .skip(2)
        .filter_map(|l| l.split(':').next().map(str::trim))
        .collect();
    require(interfaces == ["lo"], "non-loopback interface found")?;
    let mut probes = Vec::new();
    for address in ["1.1.1.1:443", "[2606:4700:4700::1111]:443"] {
        let addr: SocketAddr = address.parse()?;
        let err = TcpStream::connect_timeout(&addr, Duration::from_secs(2))
            .err()
            .and_then(|e| e.raw_os_error());
        require(
            err == Some(101),
            "isolation must yield ENETUNREACH, not a timeout",
        )?;
        probes.push(json!({"address":address,"errno":err}));
    }
    let mut interpreters = Vec::new();
    for bin in ["/usr/bin/python3", "/usr/bin/node"] {
        require(
            Command::new(bin)
                .arg("--version")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .is_err(),
            "interpreter remains executable",
        )?;
        interpreters.push(bin);
    }
    write_json(
        &work.join("isolation.json"),
        &json!({"netns":netns,"routes":routes,"interfaces":interfaces,"probes":probes,"empty_target":true,"interpreters_unavailable":interpreters}),
    )?;
    let cargo = strings(&["cargo", "--config", "/snapshot/cargo-config.toml"]);
    let mut tree = cargo.clone();
    tree.extend(strings(&[
        "tree",
        "--frozen",
        "--offline",
        "-p",
        "bsigner",
        "--edges",
        "normal,build",
    ]));
    run(&tree, Path::new("/source"), &logs, "dependency-tree")?;
    if probe {
        println!("ISOLATION PROBE PASS; no reconstruction attempted");
        return Ok(());
    }
    for (name, args) in [
        (
            "build",
            vec![
                "build",
                "--frozen",
                "--offline",
                "--release",
                "-p",
                "bsigner",
                "-j",
                "1",
            ],
        ),
        (
            "tests",
            vec![
                "test",
                "--frozen",
                "--offline",
                "--release",
                "-p",
                "bsigner",
                "-j",
                "1",
            ],
        ),
        (
            "xwing",
            vec![
                "test",
                "--frozen",
                "--offline",
                "--release",
                "-p",
                "bsigner",
                "-j",
                "1",
                "xwing_matches_the_draft_vectors",
                "--",
                "--ignored",
                "--nocapture",
            ],
        ),
        (
            "bitcoin",
            vec![
                "test",
                "--frozen",
                "--offline",
                "--release",
                "-p",
                "bsigner",
                "-j",
                "1",
                "--",
                "--ignored",
                "--nocapture",
                "bip341_wallet_vectors",
                "bip174_and_bip371_vectors",
            ],
        ),
    ] {
        let mut argv = cargo.clone();
        argv.extend(strings(&args));
        run(&argv, Path::new("/source"), &logs, name)?;
        if name == "build" {
            let artifact = work.join("target/release/bsigner");
            write_json(
                &work.join("artifact.json"),
                &json!({"path":"target/release/bsigner","sha256":digest(&artifact)?,"bytes":artifact.metadata()?.len(),"features":"default","profile":"release"}),
            )?;
        }
    }
    run(
        &strings(&["/work/target/release/bsigner", "selftest"]),
        Path::new("/source"),
        &logs,
        "selftest",
    )?;
    run(
        &strings(&[
            "/snapshot/runner",
            "law",
            "/work/target/release/bsigner",
            "/source",
        ]),
        Path::new("/source"),
        &logs,
        "law",
    )?;
    println!("RECOVERY PASS: named existing checks only; no reproducibility or durability claim");
    Ok(())
}
fn audit(root: &Path, path_list: &Path, destination: &Path) -> Result<()> {
    let data = fs::read_to_string(path_list)?;
    let mut counts = BTreeMap::<String, usize>::new();
    let mut remaining = Vec::new();
    let mut embedded = Vec::new();
    for path in data.lines().filter(|s| !s.is_empty()) {
        safe_relative(path)?;
        if !root.join(path).is_file() {
            continue;
        }
        let ext = Path::new(path)
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("");
        *counts.entry(ext.to_owned()).or_default() += 1;
        if [
            "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "sh", "ps1", "go", "rb", "php", "java",
            "lua",
        ]
        .contains(&ext)
        {
            remaining.push(json!({"path":path,"language":ext,"status":"requires role and owner review; not migrated"}));
        }
        if ext == "html" {
            let p = root.join(path);
            if let Ok(s) = fs::read_to_string(p) {
                if s.contains("<script") || s.contains("onclick=") {
                    embedded.push(path.to_owned());
                }
            }
        }
    }
    write_json(
        destination,
        &json!({"definition":"tracked file-extension census, not a runtime dependency graph or conformance verdict; HTML may execute scripts", "counts":counts,"remaining":remaining,"html_with_script_or_onclick":embedded}),
    )?;
    Ok(())
}
fn language_guard(root: &Path, path_list: &Path) -> Result<()> {
    let data = fs::read_to_string(path_list)?;
    for name in data.lines().filter(|s| !s.is_empty()) {
        safe_relative(name)?;
        let path = root.join(name);
        if !path.exists() {
            continue;
        } // A removal is not a new language dependency.
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        require(
            ![
                "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "sh", "ps1", "go", "rb", "php",
                "java", "lua", "c",
            ]
            .contains(&ext),
            &format!("language policy refused {name}; migrate logic to Rust or Vaulta-native C++"),
        )?;
        if ext == "html" {
            let html = fs::read_to_string(path)?.to_lowercase();
            require(!html.contains("<script") && !html.contains("javascript:") && !html.contains("onclick=") && !html.contains("onload="),
                "HTML script-bearing change requires explicit native migration review; extension is not an exemption")?;
        }
    }
    println!("LANGUAGE GUARD PASS for the supplied changed-path list (not a whole-stack verdict)");
    Ok(())
}
fn main() {
    let args: Vec<_> = env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("prepare") => prepare(&args[1..]),
        Some("offline") => offline(&args[1..]),
        Some("verify") if args.len() == 3 => verify_snapshot(Path::new(&args[1]), &args[2]),
        Some("inside") if args.len() == 1 || (args.len() == 2 && args[1] == "--probe-only") => {
            inside(args.len() == 2)
        }
        Some("law") if args.len() == 3 => laws(Path::new(&args[1]), Path::new(&args[2])),
        Some("audit") if args.len() == 4 => audit(
            Path::new(&args[1]),
            Path::new(&args[2]),
            Path::new(&args[3]),
        ),
        Some("guard") if args.len() == 3 => {
            language_guard(Path::new(&args[1]), Path::new(&args[2]))
        }
        _ => Err(
            "usage: bsigner-recovery prepare|offline|verify|law|audit|guard (see README)".into(),
        ),
    };
    if let Err(e) = result {
        eprintln!("RECOVERY FAIL: {e}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering};
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let p = env::temp_dir().join(format!(
                "recovery-integrity-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&p).unwrap();
            fs::create_dir(p.join("source")).unwrap();
            fs::write(p.join("source/input"), "retained fixture").unwrap();
            write_json(&p.join("manifest.json"), &inventory(&p, true).unwrap()).unwrap();
            Self(p)
        }
        fn hash(&self) -> String {
            digest(&self.0.join("manifest.json")).unwrap()
        }
        fn verify(&self) -> Result<()> {
            verify_snapshot(&self.0, &self.hash())
        }
        fn rewrite(&self, rows: Value) {
            fs::remove_file(self.0.join("manifest.json")).unwrap();
            write_json(&self.0.join("manifest.json"), &rows).unwrap();
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }
    #[test]
    fn retained_and_changed_bytes() {
        let f = Fixture::new();
        assert!(f.verify().is_ok());
        fs::write(f.0.join("source/input"), "retained fixturE").unwrap();
        assert!(f.verify().is_err());
    }
    #[test]
    fn missing_and_extra() {
        let f = Fixture::new();
        fs::remove_file(f.0.join("source/input")).unwrap();
        assert!(f.verify().is_err());
        fs::write(f.0.join("source/input"), "retained fixture").unwrap();
        fs::write(f.0.join("injected"), "config").unwrap();
        assert!(f.verify().is_err());
    }
    #[test]
    fn file_symlink_substitution() {
        let f = Fixture::new();
        fs::remove_file(f.0.join("source/input")).unwrap();
        symlink("../../outside", f.0.join("source/input")).unwrap();
        assert!(f.verify().is_err());
    }
    #[test]
    fn duplicate_and_parent_paths() {
        let f = Fixture::new();
        let mut rows = read_json(&f.0.join("manifest.json")).unwrap();
        let row = rows[0].clone();
        rows.as_array_mut().unwrap().push(row);
        f.rewrite(rows);
        assert!(f.verify().is_err());
        f.rewrite(json!([{"path":"../outside","bytes":0,"sha256":"bad"}]));
        assert!(f.verify().is_err());
    }
    #[test]
    fn independent_anchor_refuses_rewritten_manifest() {
        let f = Fixture::new();
        let old = f.hash();
        fs::write(f.0.join("source/input"), "replacement").unwrap();
        fs::remove_file(f.0.join("manifest.json")).unwrap();
        write_json(&f.0.join("manifest.json"), &inventory(&f.0, true).unwrap()).unwrap();
        assert!(verify_snapshot(&f.0, &old).is_err());
    }
    #[test]
    fn ancestor_symlink_refused() {
        let f = Fixture::new();
        fs::rename(f.0.join("source"), f.0.join("other")).unwrap();
        symlink("other", f.0.join("source")).unwrap();
        assert!(f.verify().is_err());
    }
    #[test]
    fn file_mode_change_refused() {
        let f = Fixture::new();
        let path = f.0.join("source/input");
        let old = path.metadata().unwrap().permissions().mode();
        fs::set_permissions(path, fs::Permissions::from_mode(old ^ 0o100)).unwrap();
        assert!(f.verify().is_err());
    }
    #[test]
    fn law_verdict_and_pin_required() {
        let pins = BTreeSet::from(["public-id".to_owned()]);
        let good = json!({"verified":true,"kind":"detached","id":"public-id"});
        assert!(check_verified(&good, &pins).is_ok());
        for bad in [
            json!({"verified":false,"kind":"detached","id":"public-id"}),
            json!({"verified":true,"kind":"other","id":"public-id"}),
            json!({"verified":true,"kind":"detached","id":"unlisted"}),
            json!({}),
        ] {
            assert!(check_verified(&bad, &pins).is_err());
        }
    }
    #[test]
    fn language_guard_refuses_new_script_and_embedded_script() {
        let f = Fixture::new();
        let list = f.0.join("paths.txt");
        fs::write(f.0.join("native.rs"), "fn main() {}").unwrap();
        fs::write(&list, "native.rs\n").unwrap();
        assert!(language_guard(&f.0, &list).is_ok());
        fs::write(f.0.join("controller.py"), "pass").unwrap();
        fs::write(&list, "controller.py\n").unwrap();
        assert!(language_guard(&f.0, &list).is_err());
        fs::write(f.0.join("view.html"), "<SCRIPT>bad()</SCRIPT>").unwrap();
        fs::write(&list, "view.html\n").unwrap();
        assert!(language_guard(&f.0, &list).is_err());
    }
}
