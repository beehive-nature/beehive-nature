//! x0x-control CLI. Subcommands:
//!   keygen --seed-out FILE --pub-out FILE
//!   send --pub FILE --order FILE --out FILE
//!   serve-once --seed FILE --policy FILE --ledger FILE --in FILE --out FILE
//!              [--bsigner PATH --sign-key-id ID --sign-keydir DIR --rec-env VAR]
//!   selftest
//! Seed material is file-held and never printed. Signing, when
//! requested, is delegated to the frozen bsigner CLI; the recovery
//! secret travels only by env var name, never by value, never here.

use std::collections::HashSet;
use std::path::PathBuf;
use std::process::ExitCode;

use x0x_control::envelope::{b64_decode, b64_encode, open_order, seal_order, KemIdentity};
use x0x_control::exec::execute_order;
use x0x_control::order::{Order, Policy};

fn arg(args: &[String], name: &str) -> Option<String> {
    args.windows(2).find(|w| w[0] == name).map(|w| w[1].clone())
}

fn read(path: &str) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| format!("read {path}: {e}"))
}

fn write(path: &str, text: &str) -> Result<(), String> {
    std::fs::write(path, text).map_err(|e| format!("write {path}: {e}"))
}

fn load_seed(path: &str) -> Result<KemIdentity, String> {
    let raw = b64_decode(read(path)?.trim())?;
    let seed: [u8; 64] = raw
        .try_into()
        .map_err(|_| "seed file must hold 64 bytes".to_string())?;
    Ok(KemIdentity::from_seed(seed))
}

fn write_seed(path: &str, text: &str) -> Result<(), String> {
    // Seed material is 0600 from birth on Unix; the file must never
    // transit through a world-readable default-umask window.
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut f = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .map_err(|e| format!("write {path}: {e}"))?;
        use std::io::Write as _;
        return f.write_all(text.as_bytes()).map_err(|e| e.to_string());
    }
    #[cfg(not(unix))]
    write(path, text)
}

fn cmd_keygen(args: &[String]) -> Result<i32, String> {
    let seed_out = arg(args, "--seed-out").ok_or("--seed-out required")?;
    let pub_out = arg(args, "--pub-out").ok_or("--pub-out required")?;
    let id = KemIdentity::generate()?;
    write_seed(&seed_out, &b64_encode(&id.seed))?;
    let pub_json = serde_json::json!({
        "kem_alg": "ml-kem-768",
        "encapsulation_key_b64": b64_encode(&id.public),
    });
    write(&pub_out, &serde_json::to_string_pretty(&pub_json).unwrap())?;
    println!("keygen ok: seed -> {seed_out}, public -> {pub_out} (seed never printed)");
    Ok(0)
}

fn cmd_send(args: &[String]) -> Result<i32, String> {
    let pub_path = arg(args, "--pub").ok_or("--pub required")?;
    let order_path = arg(args, "--order").ok_or("--order required")?;
    let out = arg(args, "--out").ok_or("--out required")?;
    let pub_json: serde_json::Value =
        serde_json::from_str(&read(&pub_path)?).map_err(|e| e.to_string())?;
    let public = b64_decode(
        pub_json["encapsulation_key_b64"]
            .as_str()
            .ok_or("pub file missing encapsulation_key_b64")?,
    )?;
    let order: Order = serde_json::from_str(&read(&order_path)?).map_err(|e| e.to_string())?;
    let env = seal_order(&order, &public)?;
    write(&out, &serde_json::to_string_pretty(&env).unwrap())?;
    println!("sealed order {} -> {out}", order.id);
    Ok(0)
}

fn cmd_serve_once(args: &[String]) -> Result<i32, String> {
    let seed = load_seed(&arg(args, "--seed").ok_or("--seed required")?)?;
    let policy: Policy =
        serde_json::from_str(&read(&arg(args, "--policy").ok_or("--policy required")?)?)
            .map_err(|e| e.to_string())?;
    let ledger_path: PathBuf = arg(args, "--ledger").ok_or("--ledger required")?.into();
    // Single-flight: one serve-once process per ledger at a time.
    // An O_EXCL lockfile is created before serving and removed when
    // this process finishes; a second serve against the same ledger
    // is refused, never raced. A stale lockfile after a crash is an
    // operator-visible stop, removed by hand — never silently.
    struct LockGuard(std::path::PathBuf);
    impl Drop for LockGuard {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }
    let lock_path = ledger_path.with_extension("lock");
    let _lock = match std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&lock_path)
    {
        Ok(_) => LockGuard(lock_path),
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
            return Err(
                "ledger locked by another serve-once process (or stale lockfile)".to_string(),
            );
        }
        Err(e) => return Err(format!("open ledger lock: {e}")),
    };
    let in_path = arg(args, "--in").ok_or("--in required")?;
    let out_path = arg(args, "--out").ok_or("--out required")?;

    let mut seen: HashSet<String> = std::fs::read_to_string(&ledger_path)
        .unwrap_or_default()
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    let env: x0x_control::SealedEnvelope =
        serde_json::from_str(&read(&in_path)?).map_err(|e| e.to_string())?;
    let order = open_order(&env, &seed)?;
    // Write-ahead replay ledger: persist the nonce BEFORE serving,
    // so a crash after execution can never re-serve this order.
    if !seen.contains(&order.nonce) {
        let mut ledger = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&ledger_path)
            .map_err(|e| e.to_string())?;
        use std::io::Write as _;
        writeln!(ledger, "{}", order.nonce).map_err(|e| e.to_string())?;
        ledger.sync_all().map_err(|e| e.to_string())?;
    }
    let outcome = execute_order(&order, &policy, &env, &mut seen);

    write(
        &out_path,
        &serde_json::to_string_pretty(&outcome.receipt).unwrap(),
    )?;

    // Optional receipt signature via the frozen bsigner CLI only.
    if let (Some(bsigner), Some(key_id), Some(keydir), Some(rec_env)) = (
        arg(args, "--bsigner"),
        arg(args, "--sign-key-id"),
        arg(args, "--sign-keydir"),
        arg(args, "--rec-env"),
    ) {
        let sig_out = format!("{out_path}.sig.json");
        let status = std::process::Command::new(&bsigner)
            .args([
                "sign",
                "--key-id",
                &key_id,
                "--file",
                &out_path,
                "--rec-env",
                &rec_env,
                "--keydir",
                &keydir,
                "--out",
                &sig_out,
            ])
            .status()
            .map_err(|e| format!("spawn bsigner: {e}"))?;
        if !status.success() {
            return Err(format!("bsigner sign failed with {status}"));
        }
        println!("receipt signed -> {sig_out}");
    }

    println!(
        "order {} verdict {:?} (receipt {out_path})",
        outcome.receipt.order_id, outcome.receipt.verdict
    );
    Ok(outcome.exit_code)
}

fn cmd_selftest() -> Result<i32, String> {
    use x0x_control::order::{CommandRule, Probe, Verdict};
    // Enable the gated echo-args helper for child invocations.
    std::env::set_var("X0X_CONTROL_SELFTEST", "1");

    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .into_owned();
    let id = KemIdentity::generate()?;
    let order = Order {
        id: "selftest-1".to_string(),
        scope: "selftest.echo".to_string(),
        argv: vec![exe.clone(), "echo-args".into(), "state-ok".into()],
        stdin: None,
        issued_by: "selftest".to_string(),
        nonce: format!("selftest-{}", std::process::id()),
        timeout_secs: 0,
        expires_at: u64::MAX,
        pre: vec![Probe {
            argv: vec![exe.clone(), "echo-args".into(), "pre-ok".into()],
            expect_exit: 0,
            stdout_contains: Some("pre-ok".into()),
        }],
        post: vec![Probe {
            argv: vec![exe.clone(), "echo-args".into(), "post-ok".into()],
            expect_exit: 0,
            stdout_contains: Some("post-ok".into()),
        }],
    };
    let mut policy = Policy::default();
    policy.scopes.insert(
        "selftest.echo".to_string(),
        vec![CommandRule {
            argv0: exe.clone(),
            max_args: 2,
            arg_prefixes: vec![],
        }],
    );

    let env = seal_order(&order, &id.public)?;
    let opened = open_order(&env, &id)?;
    let mut seen = HashSet::new();
    let out = execute_order(&opened, &policy, &env, &mut seen);
    assert_eq!(out.receipt.verdict, Verdict::Completed);
    assert!(out
        .receipt
        .exec
        .as_ref()
        .unwrap()
        .stdout
        .contains("state-ok"));
    println!("selftest PASS: sealed order executed, pre/post state verified");

    // Wrong-key open must fail, tamper must fail, replay must refuse.
    let other = KemIdentity::generate()?;
    assert!(open_order(&env, &other).is_err());
    let replay = execute_order(&opened, &policy, &env, &mut seen);
    assert_eq!(replay.receipt.verdict, Verdict::RefusedReplay);
    let mut rogue = order.clone();
    rogue.scope = "selftest.root".to_string();
    rogue.nonce = "fresh-nonce".to_string();
    let rogue_env = seal_order(&rogue, &id.public)?;
    let refused = execute_order(&rogue, &policy, &rogue_env, &mut seen);
    assert_eq!(refused.receipt.verdict, Verdict::RefusedScope);
    // Probe-scope escape: valid order argv, probe argv outside scope.
    let mut esc = order.clone();
    esc.nonce = "escape-nonce".to_string();
    esc.pre = vec![Probe {
        argv: vec!["/bin/evil".to_string()],
        expect_exit: 0,
        stdout_contains: None,
    }];
    let esc_env = seal_order(&esc, &id.public)?;
    let esc_out = execute_order(&esc, &policy, &esc_env, &mut seen);
    assert_eq!(esc_out.receipt.verdict, Verdict::RefusedScope);
    println!("selftest PASS: wrong key refused, replay refused, out-of-scope refused");
    println!("selftest PASS: probe-scope escape refused before any execution");
    Ok(0)
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    // Test helper used by selftest as a harmless scoped command.
    // Gated: only active when the selftest parent sets the env flag,
    // so a deployed binary never exposes it.
    if std::env::var_os("X0X_CONTROL_SELFTEST").is_some()
        && args.first().map(String::as_str) == Some("echo-args")
    {
        println!("{}", args[1..].join(" "));
        return ExitCode::from(0);
    }
    let result = match args.first().map(String::as_str) {
        Some("keygen") => cmd_keygen(&args[1..]),
        Some("send") => cmd_send(&args[1..]),
        Some("serve-once") => cmd_serve_once(&args[1..]),
        Some("selftest") => cmd_selftest(),
        _ => Err("usage: x0x-control <keygen|send|serve-once|selftest>".to_string()),
    };
    match result {
        Ok(code) => ExitCode::from(code as u8),
        Err(e) => {
            eprintln!("x0x-control: {e}");
            ExitCode::from(1)
        }
    }
}
