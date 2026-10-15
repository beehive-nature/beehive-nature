//! `bnrose-dest` — the independent destination process (BNROSE-NETPART-001).
//! Usage: bnrose-dest <log-path> <port-or-0>; prints the bound port.

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let log = std::path::PathBuf::from(args.get(1).cloned().unwrap_or_else(|| "dest.log".into()));
    let port: u16 = args.get(2).and_then(|p| p.parse().ok()).unwrap_or(0);
    let listener = std::net::TcpListener::bind(("127.0.0.1", port)).expect("bind");
    let bound = listener.local_addr().expect("addr").port();
    println!("{bound}");
    std::io::Write::flush(&mut std::io::stdout()).ok();
    bnrose_netpart::dest::Destination::new(log).serve(listener);
}
