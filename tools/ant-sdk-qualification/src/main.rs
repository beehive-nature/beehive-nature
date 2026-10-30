use std::io::{self, Read, Write};

fn run() -> Result<(), String> {
    let mut input = Vec::new();
    io::stdin()
        .lock()
        .take(ant_sdk_qualification::MAX_INPUT_BYTES + 1)
        .read_to_end(&mut input)
        .map_err(|error| format!("stdin: {error}"))?;
    if input.len() as u64 > ant_sdk_qualification::MAX_INPUT_BYTES {
        return Err("request exceeds 64 MiB limit".into());
    }
    let request =
        serde_json::from_slice(&input).map_err(|error| format!("request JSON: {error}"))?;
    let result = ant_sdk_qualification::execute(&request)?;
    let mut output = io::stdout().lock();
    serde_json::to_writer(&mut output, &result).map_err(|error| format!("stdout JSON: {error}"))?;
    output
        .write_all(b"\n")
        .map_err(|error| format!("stdout: {error}"))
}

fn main() {
    if let Err(error) = run() {
        eprintln!("ant-sdk-qualification: {error}");
        std::process::exit(2);
    }
}
