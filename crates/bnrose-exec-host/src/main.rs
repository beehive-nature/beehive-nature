//! `bnrose-exec` — the BNRoSe L2 vertical slice's executable face
//! (BNROSE-RUST-001). See `cli.rs` for the contract.

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    std::process::exit(bnrose_exec_host::cli::run_cli(args));
}
