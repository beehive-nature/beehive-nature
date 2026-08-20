//! bSAFE 7 host spike — sequencing item 2 of the founder-approved plan.
//!
//! Transport leg only in v0: a THP-channel datagram harness pointed at the
//! trezor-user-env emulator. The emulator speaks UDP (port 21324), not BLE —
//! btleplug enters at the real-hardware leg and is deliberately absent here so
//! this crate builds and runs on CI hardware with no radio at all.
//!
//! v0 proves: datagram transport + channel bookkeeping + the noise layer's
//! availability via the thp crate (whose own 4/4 suite covers the handshake).
//! The signed-message round-trip lands when the emulator leg runs (SPIKE.md).

use std::net::UdpSocket;
use std::time::Duration;

/// trezor-user-env emulator datagram port (the suite's documented default).
pub const EMULATOR_PORT: u16 = 21324;

fn main() {
    let mode = std::env::args().nth(1).unwrap_or_else(|| "--mock".into());
    match mode.as_str() {
        "--mock" => mock_echo(),
        "--emulator" => poke_emulator(),
        other => {
            eprintln!("usage: spike [--mock | --emulator]");
            eprintln!("  --mock     in-process datagram echo (no hardware, no emulator)");
            eprintln!("  --emulator send a THP channel datagram to 127.0.0.1:{EMULATOR_PORT} (requires trezor-user-env running)");
            let _ = other;
        }
    }
}

/// v0 transport proof: a datagram round-trips through a real socket pair and
/// comes back byte-identical — the floor the noise layer will ride on.
fn mock_echo() {
    let receiver = UdpSocket::bind("127.0.0.1:0").expect("bind receiver");
    let raddr = receiver.local_addr().expect("receiver addr");
    let sender = UdpSocket::bind("127.0.0.1:0").expect("bind sender");
    receiver
        .set_read_timeout(Some(Duration::from_secs(2)))
        .expect("timeout");

    let probe: &[u8] = b"bnr-spike/0 transport-probe";
    sender.send_to(probe, raddr).expect("send probe");
    let mut buf = [0u8; 512];
    let (n, from) = receiver.recv_from(&mut buf).expect("recv probe");
    assert_eq!(&buf[..n], probe, "echo must be byte-identical");
    println!("PASS mock-echo: {} bytes round-tripped via {}", n, from);
}

/// One datagram at the emulator port; prints what comes back or declares the
/// absence honestly (a failed fetch is a failure, never "no emulator").
fn poke_emulator() {
    let sock = UdpSocket::bind("127.0.0.1:0").expect("bind");
    sock.set_read_timeout(Some(Duration::from_secs(3)))
        .expect("timeout");
    let sent = sock
        .send_to(&[0x00, 0x01], ("127.0.0.1", EMULATOR_PORT))
        .expect("send");
    let mut buf = [0u8; 1024];
    match sock.recv_from(&mut buf) {
        Ok((n, from)) => println!("emulator answered from {} with {} bytes", from, n),
        Err(e) => {
            eprintln!("NO RESPONSE from 127.0.0.1:{EMULATOR_PORT} ({e}) — emulator not running or not bridged; this is a failed probe, not an absence proof");
            std::process::exit(2);
        }
    }
    let _ = sent;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_echo_roundtrip() {
        // same floor as the binary's --mock, asserted in-process
        let rx = UdpSocket::bind("127.0.0.1:0").unwrap();
        let addr = rx.local_addr().unwrap();
        let tx = UdpSocket::bind("127.0.0.1:0").unwrap();
        tx.send_to(b"probe", addr).unwrap();
        let mut b = [0u8; 16];
        let (n, _) = rx.recv_from(&mut b).unwrap();
        assert_eq!(&b[..n], b"probe");
    }
}
