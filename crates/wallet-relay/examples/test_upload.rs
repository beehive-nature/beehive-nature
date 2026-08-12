//! End-to-end upload test: generates a test Ed25519 DataItem, POSTs to the relay,
//! reads back the response. Run on the VPS after starting the relay.
//!
//! Usage: RELAY_URL=http://127.0.0.1:8080 cargo run --example test_upload -p wallet-relay

use ed25519_dalek::SigningKey;

fn main() {
    let sk = SigningKey::from_bytes(&[7u8; 32]);
    let (id, item) = atmirror::arweave::build_ed25519_data_item(
        &sk,
        b"Hello BNR DeStorage - first sovereign upload test 2026-08-11",
        &[],
    );

    eprintln!("DataItem ID: {}", id);
    eprintln!("DataItem size: {} bytes", item.len());

    let relay = std::env::var("RELAY_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".into());
    eprintln!("POSTing to {}/v1/upload ...", relay);

    let resp = ureq::post(&format!("{relay}/v1/upload"))
        .set("Content-Type", "application/octet-stream")
        .send_bytes(&item);

    match resp {
        Ok(r) => {
            let body: serde_json::Value = r.into_json().unwrap_or_default();
            println!("{}", serde_json::to_string_pretty(&body).unwrap_or_default());

            if body.get("forwarded").and_then(|v| v.as_bool()).unwrap_or(false) {
                let tx = body
                    .pointer("/accepted/id")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&id);
                eprintln!("\nWaiting 10s for on-chain confirmation...");
                std::thread::sleep(std::time::Duration::from_secs(10));

                let st = ureq::get(&format!("{relay}/v1/arweave/status/{tx}")).call();
                match st {
                    Ok(s) => println!("\nRead-back:\n{}", s.into_string().unwrap_or_default()),
                    Err(e) => eprintln!("Status check failed: {e}"),
                }
            }
        }
        Err(e) => eprintln!("Upload FAILED: {e}"),
    }
}
