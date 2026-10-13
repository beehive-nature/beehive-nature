//! keys-door binary.
//!
//!   keys-door serve  --config edge.toml
//!   keys-door verify --config edge.toml --envelope FILE
//!
//! `serve` refuses to start without both verifiers (an empty bsigner_path is
//! a refusal, never a skip). It loads the serve state, answers from it once
//! it verifies, then polls every source every poll_secs. The public listener
//! serves the release; health answers on health_listen only.
//!
//! `verify` is offline: it prints one verdict JSON for one envelope against
//! the config and the local serve state (read only) and exits 0 on accept,
//! 1 on refuse, 2 on a usage or config error.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use keys_door::config::Config;
use keys_door::door::{offline_verdict, Door};
use keys_door::record::MAX_ENVELOPE;
use keys_door::server::{health_router, router, Shared};
use keys_door::sources::UreqHttp;
use keys_door::verify::Verifiers;

const USAGE: &str = "usage: keys-door serve --config edge.toml\n       keys-door verify --config edge.toml --envelope FILE";

fn flag(args: &[String], name: &str) -> Option<PathBuf> {
    args.windows(2)
        .find(|w| w[0] == name)
        .map(|w| PathBuf::from(&w[1]))
}

fn setup(args: &[String]) -> Result<(Config, Verifiers), String> {
    let path = flag(args, "--config").ok_or(USAGE)?;
    let cfg = Config::load(&path)?;
    let verifiers = Verifiers::new(&cfg.bsigner_path, &std::env::temp_dir())?;
    Ok((cfg, verifiers))
}

fn serve(args: &[String]) -> Result<(), String> {
    let (cfg, verifiers) = setup(args)?;
    let shared = Arc::new(RwLock::new(Shared::default()));
    let (listen, health_listen, poll) = (cfg.listen, cfg.health_listen, cfg.poll_secs);
    let mut door = Door::new(
        cfg,
        verifiers,
        Box::new(UreqHttp::default()),
        shared.clone(),
    );
    door.load();
    door.poll(false);
    std::thread::spawn(move || loop {
        door.poll(true);
        std::thread::sleep(Duration::from_secs(poll));
    });
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(|e| e.to_string())?;
    rt.block_on(async move {
        let public = tokio::net::TcpListener::bind(listen)
            .await
            .map_err(|e| format!("{listen}: {e}"))?;
        let health = tokio::net::TcpListener::bind(health_listen)
            .await
            .map_err(|e| format!("{health_listen}: {e}"))?;
        eprintln!("keys-door: serving on {listen}, health on {health_listen}");
        let a = async { axum::serve(public, router(shared.clone())).await };
        let b = async { axum::serve(health, health_router(shared.clone())).await };
        tokio::try_join!(a, b)
            .map(|_| ())
            .map_err(|e| e.to_string())
    })
}

fn read_envelope(path: &Path) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    std::fs::File::open(path)
        .and_then(|f| f.take(MAX_ENVELOPE as u64 + 1).read_to_end(&mut bytes))
        .map_err(|e| format!("{}: {e}", path.display()))?;
    Ok(bytes)
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let rest = args.get(1..).unwrap_or(&[]);
    match args.first().map(String::as_str) {
        Some("serve") => match serve(rest) {
            Ok(()) => ExitCode::SUCCESS,
            Err(e) => {
                eprintln!("keys-door: {e}");
                ExitCode::from(2)
            }
        },
        Some("verify") => {
            let run = setup(rest).and_then(|(cfg, v)| {
                let path = flag(rest, "--envelope").ok_or(USAGE)?;
                Ok(offline_verdict(&cfg, &v, &read_envelope(&path)?))
            });
            match run {
                Ok((verdict, ok)) => {
                    println!("{verdict}");
                    if ok {
                        ExitCode::SUCCESS
                    } else {
                        ExitCode::from(1)
                    }
                }
                Err(e) => {
                    eprintln!("keys-door: {e}");
                    ExitCode::from(2)
                }
            }
        }
        _ => {
            eprintln!("{USAGE}");
            ExitCode::from(2)
        }
    }
}
