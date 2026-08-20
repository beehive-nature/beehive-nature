//! bsafe-host — transport layer for the bSAFE 7 Rust host.
//!
//! Design: `Transport` is dumb bytes; everything smart (framing, Noise channel,
//! countersign fingerprints, message protobufs) lives above it in `bsafe-thp`
//! and the (future) `bsafe-messages` crate generated from trezor-firmware's
//! protobuf definitions.
//!
//! Sprint spike goal (hardware day): implement `BleTransport` against a real
//! Safe 7 — scan, connect, discover the THP GATT service, then run the
//! `bsafe_thp` Noise XX handshake through it and display the device static key
//! as fingerprint words for the on-device confirm. `MemTransport` below lets
//! everything above the radio be built and tested today.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum TransportError {
    #[error("transport closed")]
    Closed,
    #[error("io: {0}")]
    Io(String),
}

/// Bytes in, bytes out. One frame per call; framing/crypto belong to bsafe-thp.
pub trait Transport {
    fn send(&mut self, frame: &[u8]) -> Result<(), TransportError>;
    fn recv(&mut self) -> Result<Vec<u8>, TransportError>;
}

/// In-memory loopback pair — the test double that stands in for the radio, so
/// the protocol stack above is fully exercisable in CI with no hardware.
pub mod mem {
    use super::{Transport, TransportError};
    use std::collections::VecDeque;
    use std::sync::{Arc, Mutex};

    #[derive(Default)]
    struct Shared {
        a_to_b: VecDeque<Vec<u8>>,
        b_to_a: VecDeque<Vec<u8>>,
    }

    pub struct MemTransport {
        shared: Arc<Mutex<Shared>>,
        is_a: bool,
    }

    pub fn pair() -> (MemTransport, MemTransport) {
        let shared = Arc::new(Mutex::new(Shared::default()));
        (
            MemTransport { shared: shared.clone(), is_a: true },
            MemTransport { shared, is_a: false },
        )
    }

    impl Transport for MemTransport {
        fn send(&mut self, frame: &[u8]) -> Result<(), TransportError> {
            let mut s = self.shared.lock().map_err(|e| TransportError::Io(e.to_string()))?;
            if self.is_a { s.a_to_b.push_back(frame.to_vec()) } else { s.b_to_a.push_back(frame.to_vec()) }
            Ok(())
        }
        fn recv(&mut self) -> Result<Vec<u8>, TransportError> {
            let mut s = self.shared.lock().map_err(|e| TransportError::Io(e.to_string()))?;
            let q = if self.is_a { &mut s.b_to_a } else { &mut s.a_to_b };
            q.pop_front().ok_or(TransportError::Closed)
        }
    }
}

/// BLE transport skeleton (feature `ble`). Fill in during the hardware spike.
#[cfg(feature = "ble")]
pub mod ble {
    //! Spike checklist against a real Safe 7:
    //! 1. `Manager::new()` → adapters → scan with a name/service filter.
    //! 2. Connect; enumerate services; identify the THP service + TX/RX
    //!    characteristics (constants pinned into `Dialect` once known).
    //! 3. Subscribe to notifications (RX), write-without-response (TX).
    //! 4. Adapt to `Transport` (one GATT write / notification per THP frame).
    //! 5. Run `bsafe_thp` Noise XX through it; surface `remote_static` as
    //!    fingerprint words; human confirms on the device screen (T3 §0.3).
    // Intentionally left as an interface sketch — compiles only with `--features ble`.
}

#[cfg(test)]
mod tests {
    use super::mem::pair;
    use super::Transport;
    use bsafe_thp::{
        decode_frame, encode_frame, initiator, into_channel, responder, Dialect,
    };

    /// The whole stack minus the radio: frames over a transport carrying a Noise
    /// XX handshake, then an encrypted "sign request / approval" exchange.
    #[test]
    fn full_stack_over_mem_transport() {
        let d = Dialect::default();
        let (mut host, mut device) = pair();

        let mut hs_i = initiator([0x11; 32]);
        let mut hs_r = responder([0x22; 32]);

        // -> e
        let m1 = hs_i.write_message_vec(b"").unwrap();
        host.send(&encode_frame(&d, 0, &m1).unwrap()).unwrap();
        let f = device.recv().unwrap();
        hs_r.read_message_vec(decode_frame(&d, &f).unwrap().payload).unwrap();
        // <- e,ee,s,es
        let m2 = hs_r.write_message_vec(b"").unwrap();
        device.send(&encode_frame(&d, 0, &m2).unwrap()).unwrap();
        let f = host.recv().unwrap();
        hs_i.read_message_vec(decode_frame(&d, &f).unwrap().payload).unwrap();
        // -> s,se
        let m3 = hs_i.write_message_vec(b"").unwrap();
        host.send(&encode_frame(&d, 0, &m3).unwrap()).unwrap();
        let f = device.recv().unwrap();
        hs_r.read_message_vec(decode_frame(&d, &f).unwrap().payload).unwrap();

        let mut ch_host = into_channel(hs_i, true).unwrap();
        let mut ch_dev = into_channel(hs_r, false).unwrap();

        // encrypted request over a frame
        let req = ch_host.seal(b"approve: mint bDiD record");
        host.send(&encode_frame(&d, 1, &req).unwrap()).unwrap();
        let f = device.recv().unwrap();
        let got = ch_dev.open(decode_frame(&d, &f).unwrap().payload).unwrap();
        assert_eq!(got, b"approve: mint bDiD record");

        // encrypted approval back
        let ok = ch_dev.seal(b"APPROVED on-device");
        device.send(&encode_frame(&d, 1, &ok).unwrap()).unwrap();
        let f = host.recv().unwrap();
        let got = ch_host.open(decode_frame(&d, &f).unwrap().payload).unwrap();
        assert_eq!(got, b"APPROVED on-device");
    }
}
