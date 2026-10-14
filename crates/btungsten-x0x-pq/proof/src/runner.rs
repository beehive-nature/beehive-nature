use crate::{
    binding::{self, Result},
    names, obligations,
};
use serde_json::{json, Value};
use std::{
    env,
    fs::{self, File},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

struct Runner {
    out: PathBuf,
    runs: Vec<Value>,
}

impl Runner {
    fn run(&mut self, name: &str, mut command: Command, expected: i32) -> Result<String> {
        let log = self.out.join(format!("{name}.log"));
        let stream = File::create(&log)?;
        command
            .stdout(Stdio::from(stream.try_clone()?))
            .stderr(Stdio::from(stream));
        println!("PREPARE RUN {name}");
        let started = Instant::now();
        let mut child = command.spawn()?;
        let status = loop {
            if let Some(status) = child.try_wait()? {
                break status;
            }
            if started.elapsed() > Duration::from_secs(1800) {
                child.kill()?;
                child.wait()?;
                return Err(format!("{name}: timeout, no proof result").into());
            }
            thread::sleep(Duration::from_millis(100));
        };
        let bytes = fs::read(&log)?;
        self.runs.push(json!({"name":name,"exit_code":status.code(),"expected_exit":expected,
            "seconds":started.elapsed().as_secs_f64(),"log":log.file_name().unwrap().to_string_lossy(),"sha256":binding::tag(&bytes)}));
        if status.code() != Some(expected) {
            return Err(format!(
                "{name}: exit {:?}, expected {expected}; see {}",
                status.code(),
                log.display()
            )
            .into());
        }
        Ok(String::from_utf8(bytes)?)
    }
}

fn linked_mir(dir: &Path, found: &mut Vec<PathBuf>) -> Result<()> {
    for e in fs::read_dir(dir)? {
        let p = e?.path();
        if p.is_dir() {
            linked_mir(&p, found)?;
        } else if p
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.starts_with("pq_prepare_proof-") && n.ends_with(".linked-mir.json"))
        {
            found.push(p);
        }
    }
    Ok(())
}

fn version(program: &Path) -> Result<String> {
    let output = Command::new(program).arg("--version").output()?;
    if !output.status.success() {
        return Err(format!("{} --version failed", program.display()).into());
    }
    let mut bytes = output.stdout;
    bytes.extend(output.stderr);
    Ok(String::from_utf8(bytes)?.trim().into())
}

fn executable(program: &Path) -> Result<PathBuf> {
    if program.components().count() > 1 {
        return Ok(program.canonicalize()?);
    }
    for dir in env::split_paths(&env::var_os("PATH").ok_or("PATH is absent")?) {
        let path = dir.join(program);
        if path.is_file() {
            return Ok(path);
        }
    }
    Err(format!("{} is not on PATH", program.display()).into())
}

pub fn run(out: &Path, saw: &Path) -> Result<()> {
    let proof = Path::new(env!("CARGO_MANIFEST_DIR"));
    let root = proof.ancestors().nth(3).ok_or("missing repository root")?;
    fs::create_dir_all(out)?;
    let out = out.canonicalize()?;
    if out.starts_with(proof) || proof.starts_with(&out) {
        return Err("receipt directory overlaps proof sources".into());
    }
    let receipt = out.join("run.json");
    if receipt.exists() {
        fs::remove_file(&receipt)?;
    }
    // Clear only this lane's named artifacts, before even the source gate.
    // A failed early retry must not present a preceding run's honest receipt.
    let mut owned: Vec<String> = [
        "source-pins.json",
        "proof.linked-mir.json",
        "names.saw",
        "common.saw",
        "Boundary.cry",
        "gate-tests.log",
        "mir-build.log",
    ]
    .into_iter()
    .map(str::to_string)
    .collect();
    for mode in [
        "honest",
        "accept",
        "reject",
        "message",
        "context",
        "signature",
        "empty",
    ] {
        for ext in ["json", "log"] {
            owned.push(format!("native-{mode}.{ext}"));
        }
    }
    for script in obligations::scripts() {
        for suffix in [".saw", ".log", "-summary.json"] {
            owned.push(format!("formal-{}{suffix}", script.name));
        }
    }
    for file in &owned {
        match fs::remove_file(out.join(file)) {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(e.into()),
        }
    }
    let mut runner = Runner {
        out: out.clone(),
        runs: vec![],
    };
    let started = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let mut evidence = json!({"schema":"btungsten.prepared-proof-run/1","result":"FAIL","started_unix":started,
        "formal_scope":"conditional wrapper equivalence on the enumerated slice lengths; all bytes symbolic",
        "arithmetic":"UNESTABLISHED", "full_system_qualification":"UNESTABLISHED"});
    let result = (|| -> Result<()> {
        let bound = binding::verify(root, proof)?;
        fs::write(
            out.join("source-pins.json"),
            serde_json::to_vec_pretty(&bound)?,
        )?;
        evidence["bindings"] = bound;
        let binary = env::current_exe()?;
        evidence["binary_sha256"] = binding::tag(&fs::read(&binary)?).into();
        let saw = executable(saw)?;
        let mut tool_versions = serde_json::Map::new();
        for (name, path) in [
            ("saw", saw.clone()),
            ("mir-json", executable(Path::new("mir-json"))?),
            ("z3", executable(Path::new("z3"))?),
            ("rustc", executable(Path::new("rustc"))?),
        ] {
            let v = version(&path)?;
            if name == "saw" && !v.starts_with("1.6 (68eed5f ") {
                return Err("SAW must be pinned 1.6".into());
            }
            if name == "mir-json" && !v.contains("nightly-2026-03-21") {
                return Err("wrong MIR toolchain".into());
            }
            tool_versions.insert(
                name.into(),
                json!({"version":v,"binary_sha256":binding::tag(&fs::read(path)?)}),
            );
        }
        evidence["tools"] = tool_versions.into();
        let mut test = Command::new("cargo");
        test.current_dir(proof).args([
            "test",
            "--locked",
            "--offline",
            "--bin",
            "pq-prepare-proof",
        ]);
        let log = runner.run("gate-tests", test, 0)?;
        if !log.contains("test result: ok. 2 passed; 0 failed;") {
            return Err("gate tests did not execute exactly two required tests".into());
        }
        for (mode, target) in [
            ("honest", None),
            ("accept", Some("empty-signature")),
            ("reject", Some("valid")),
            ("message", Some("ignored-message-suffix")),
            ("context", Some("ignored-context")),
            ("signature", Some("ignored-signature-suffix")),
            ("empty", None),
        ] {
            let name = format!("native-{mode}");
            let path = out.join(format!("{name}.json"));
            if path.exists() {
                fs::remove_file(&path)?;
            }
            let mut cmd = Command::new(&binary);
            cmd.args(["native", mode]).arg(&path);
            runner.run(&name, cmd, if mode == "honest" { 0 } else { 1 })?;
            let v: Value = serde_json::from_slice(&fs::read(path)?)?;
            let failures = v["failures"].as_array().ok_or("native failures absent")?;
            let missing = v["missing"].as_array().ok_or("native coverage absent")?;
            if v["required_rows"] != 21 || v["unexpected"] != json!([]) {
                return Err("wrong native coverage inventory".into());
            }
            if mode == "empty" {
                if v["executed"] != 0
                    || v["result"] != "FAIL"
                    || missing.len() != 21
                    || !failures.is_empty()
                {
                    return Err("empty coverage was not refused".into());
                }
            } else if v["executed"] != 4245
                || !missing.is_empty()
                || (mode == "honest" && (v["result"] != "PASS" || !failures.is_empty()))
                || target.is_some_and(|t| {
                    v["result"] != "FAIL" || !failures.iter().any(|f| f["row"] == t)
                })
            {
                return Err(
                    format!("native {mode} failed its specific acceptance/refusal gate").into(),
                );
            }
        }
        let mir_dir = out.join(format!("mir-{started}-{}", std::process::id()));
        if mir_dir.exists() {
            return Err("fresh MIR directory already exists".into());
        }
        let lock_before = fs::read(proof.join("Cargo.lock"))?;
        let mut build = Command::new("cargo");
        build
            .current_dir(proof)
            .args(["saw-build", "--lib"])
            .env("RUSTUP_TOOLCHAIN", "nightly-2026-03-21")
            .env("CARGO_NET_OFFLINE", "true")
            .env("CARGO_TARGET_DIR", &mir_dir);
        runner.run("mir-build", build, 0)?;
        if fs::read(proof.join("Cargo.lock"))? != lock_before {
            return Err("MIR build changed the lock".into());
        }
        let mut found = vec![];
        linked_mir(&mir_dir, &mut found)?;
        if found.len() != 1 {
            return Err(format!(
                "expected exactly one fresh linked MIR, found {}",
                found.len()
            )
            .into());
        }
        let mir = out.join("proof.linked-mir.json");
        fs::copy(&found[0], &mir)?;
        evidence["mir_sha256"] = binding::tag(&fs::read(&mir)?).into();
        evidence["symbols"] = names::generate(&mir, &out.join("names.saw"))?;
        for file in ["common.saw", "Boundary.cry"] {
            fs::copy(proof.join(file), out.join(file))?;
        }
        let mut formal = vec![];
        for script in obligations::scripts() {
            let name = format!("formal-{}", script.name);
            let file = format!("{name}.saw");
            fs::write(out.join(&file), &script.body)?;
            let mut cmd = Command::new(&saw);
            cmd.current_dir(&out).arg(&file);
            let expected = if script.control { 2 } else { 0 };
            let log = runner.run(&name, cmd, expected)?;
            obligations::validate(&script, Some(expected), &log)?;
            formal.push(json!({"name":script.name,"result":if script.control {"REFUTED"} else {"PROVEN-CONDITIONAL"},"obligations":script.markers}));
            println!(
                "PREPARE FORMAL {name}: {}",
                if script.control {
                    "intended counterexample"
                } else {
                    "all 36 required obligations proven"
                }
            );
        }
        evidence["formal"] = formal.into();
        if binding::verify(root, proof)? != evidence["bindings"] {
            return Err("sources changed during proof execution".into());
        }
        evidence["result"] = "PASS".into();
        Ok(())
    })();
    evidence["runs"] = runner.runs.into();
    evidence["completed_unix"] = SystemTime::now()
        .duration_since(UNIX_EPOCH)?
        .as_secs()
        .into();
    if let Err(error) = &result {
        evidence["error"] = error.to_string().into();
    }
    let mut files = serde_json::Map::new();
    for file in owned {
        let p = out.join(&file);
        if p.is_file() {
            files.insert(file, binding::tag(&fs::read(&p)?).into());
        }
    }
    evidence["files"] = files.into();
    fs::write(receipt, serde_json::to_string_pretty(&evidence)? + "\n")?;
    result
}
