fn main() {
    if let Err(error) = h01_frozen_qualification::main_entry(std::env::args().skip(1).collect()) {
        eprintln!("H01 FROZEN QUALIFICATION FAILED: {error}");
        std::process::exit(1);
    }
}
