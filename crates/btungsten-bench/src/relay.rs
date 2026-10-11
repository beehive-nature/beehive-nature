//! A loopback TCP relay between the RB01 evaluator (which connects to it) and
//! the garbler (which it connects to). It counts and digests the bytes in
//! each direction, independently of the providers' own counters, and can
//! inject one fault in the garbler-to-evaluator direction once a byte
//! threshold has been forwarded.

use std::io::{Read, Write};
use std::net::{Shutdown, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use sha2::{Digest, Sha256};

#[derive(Clone, Debug)]
pub enum Fault {
    None,
    /// After this many garbler-to-evaluator bytes, shut both connections.
    CloseAfter(u64),
    /// After this many garbler-to-evaluator bytes, stop forwarding in both
    /// directions and hold the connections open for the duration.
    StallAfter(u64, Duration),
    /// After this many garbler-to-evaluator bytes, notify the harness (which
    /// kills the garbler process) and keep relaying whatever still flows.
    NotifyAfter(u64),
}

#[derive(Debug, Default)]
pub struct Report {
    pub garbler_to_evaluator: u64,
    pub evaluator_to_garbler: u64,
    pub g2e_digest: String,
    pub e2g_digest: String,
    pub fault_fired: bool,
    pub error: Option<String>,
}

pub struct Relay {
    pub port: u16,
    handle: JoinHandle<Report>,
}

impl Relay {
    pub fn finish(self) -> Report {
        self.handle.join().unwrap_or_else(|_| Report {
            error: Some("relay thread panicked".into()),
            ..Report::default()
        })
    }
}

pub fn start(
    garbler: SocketAddr,
    fault: Fault,
    notify: Option<Sender<()>>,
    accept_within: Duration,
) -> std::io::Result<Relay> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    listener.set_nonblocking(true)?;
    let handle = std::thread::spawn(move || {
        let deadline = Instant::now() + accept_within;
        let ev = loop {
            match listener.accept() {
                Ok((s, _)) => break s,
                Err(e)
                    if e.kind() == std::io::ErrorKind::WouldBlock && Instant::now() < deadline =>
                {
                    std::thread::sleep(Duration::from_millis(2));
                }
                Err(e) => {
                    return Report {
                        error: Some(format!("accept: {e}")),
                        ..Report::default()
                    }
                }
            }
        };
        let _ = ev.set_nonblocking(false);
        let gb = match TcpStream::connect(garbler) {
            Ok(s) => s,
            Err(e) => {
                return Report {
                    error: Some(format!("connect to garbler: {e}")),
                    ..Report::default()
                }
            }
        };
        let _ = ev.set_nodelay(true);
        let _ = gb.set_nodelay(true);
        let stop = Arc::new(AtomicBool::new(false));
        let (ev2, gb2) = match (ev.try_clone(), gb.try_clone()) {
            (Ok(a), Ok(b)) => (a, b),
            _ => {
                return Report {
                    error: Some("clone sockets".into()),
                    ..Report::default()
                }
            }
        };
        let stop_up = stop.clone();
        let up = std::thread::spawn(move || pump(ev2, gb2, None, &stop_up));
        let down = pump(gb, ev, Some((fault, notify)), &stop);
        let upr = up.join().unwrap_or_default();
        Report {
            garbler_to_evaluator: down.bytes,
            evaluator_to_garbler: upr.bytes,
            g2e_digest: down.digest,
            e2g_digest: upr.digest,
            fault_fired: down.fired,
            error: None,
        }
    });
    Ok(Relay { port, handle })
}

#[derive(Default)]
struct Pumped {
    bytes: u64,
    digest: String,
    fired: bool,
}

fn pump(
    mut src: TcpStream,
    mut dst: TcpStream,
    fault: Option<(Fault, Option<Sender<()>>)>,
    stop: &AtomicBool,
) -> Pumped {
    let mut h = Sha256::new();
    let mut n_total = 0u64;
    let mut fired = false;
    let (fault, notify) = fault.unwrap_or((Fault::None, None));
    let threshold = match fault {
        Fault::None => u64::MAX,
        Fault::CloseAfter(t) | Fault::StallAfter(t, _) | Fault::NotifyAfter(t) => t,
    };
    let mut buf = vec![0u8; 1 << 16];
    loop {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        let n = match src.read(&mut buf) {
            Ok(0) | Err(_) => break,
            Ok(n) => n,
        };
        let take = if !fired && n_total + n as u64 >= threshold {
            (threshold - n_total) as usize
        } else {
            n
        };
        if dst.write_all(&buf[..take]).is_err() {
            break;
        }
        h.update(&buf[..take]);
        n_total += take as u64;
        if !fired && n_total >= threshold {
            fired = true;
            match &fault {
                Fault::CloseAfter(_) => {
                    stop.store(true, Ordering::SeqCst);
                    let _ = src.shutdown(Shutdown::Both);
                    let _ = dst.shutdown(Shutdown::Both);
                    break;
                }
                Fault::StallAfter(_, hold) => {
                    stop.store(true, Ordering::SeqCst);
                    std::thread::sleep(*hold);
                    let _ = src.shutdown(Shutdown::Both);
                    let _ = dst.shutdown(Shutdown::Both);
                    break;
                }
                Fault::NotifyAfter(_) => {
                    if let Some(tx) = &notify {
                        let _ = tx.send(());
                    }
                    // the rest of this chunk still goes through
                    if take < n {
                        if dst.write_all(&buf[take..n]).is_err() {
                            break;
                        }
                        h.update(&buf[take..n]);
                        n_total += (n - take) as u64;
                    }
                }
                Fault::None => {}
            }
        }
    }
    let _ = dst.shutdown(Shutdown::Write);
    Pumped {
        bytes: n_total,
        digest: format!("sha256:{}", crate::digest::b64url(&h.finalize())),
        fired,
    }
}
