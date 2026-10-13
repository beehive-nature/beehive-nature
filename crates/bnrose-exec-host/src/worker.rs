//! The workers (BNROSE-RUST-001).
//!
//! A worker answers admission and step requests with verdict bytes. Three
//! implementations share the trait:
//!
//! - [`NativeWorker`] — the core through the shim's own ABI (`native_admit`
//!   / `native_step`), the bytes any other backend must reproduce.
//! - [`WasmWorker`] — the SAME crate compiled to wasm32-unknown-unknown,
//!   run under PINNED Wasmtime (`=49.0.2`) behind the narrowest interface
//!   this host can offer: fuel metering (a deterministic instruction
//!   budget), epoch interruption (a wall-clock watchdog against anything
//!   fuel cannot bound), a memory cap through a `ResourceLimiter` (which
//!   also measures peak), and a Linker with NOTHING in it — the module
//!   imports nothing, so the worker can call out to nothing.
//! - [`ParanoidWorker`] — runs the native answer beside the chosen worker
//!   and requires byte equality on every verdict. Disagreement is a hard
//!   stop (`WorkerError::Disagreement`), because the supervisor acts on
//!   verdicts; a corrupted module must fail closed, not quietly win.
//!
//! Keys never cross this boundary in either direction: requests carry
//! envelopes, policies, states and clocks; verdicts carry decisions and
//! digests. The signing seed and the MAC keys live in the supervisor.

use std::sync::{Arc, Barrier};
use std::time::Duration;

/// The pinned Wasmtime this host was built against (see Cargo.toml; the
/// pin is the receipt's word for "which engine produced these verdicts").
pub const WASMTIME_PIN: &str = "=49.0.2";

/// The bounds one worker runs under (recorded in receipts).
#[derive(Clone, Copy, Debug)]
pub struct Bounds {
    /// Fuel granted per call (consumed fuel is reported per verdict).
    pub fuel: u64,
    /// Wall-clock watchdog ticks (one tick per WATCHDOG_INTERVAL).
    pub ticks: u64,
    /// Linear-memory ceiling in bytes.
    pub memory_cap: usize,
}

impl Default for Bounds {
    fn default() -> Self {
        Bounds {
            fuel: 2_000_000_000,
            ticks: 40,
            memory_cap: 8 * 1024 * 1024,
        }
    }
}

/// How often the watchdog thread advances the engine epoch.
pub const WATCHDOG_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Debug)]
pub enum WorkerError {
    /// The module trapped; fuel exhaustion and epoch deadline are named.
    Trap { kind: TrapKind, message: String },
    /// The paranoid dual-run caught the backends disagreeing.
    Disagreement { native: Vec<u8>, other: Vec<u8> },
    /// The module is not usable (missing exports, no memory, bad ABI).
    Unusable(String),
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum TrapKind {
    FuelExhausted,
    EpochDeadline,
    Other,
}

impl std::fmt::Display for WorkerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WorkerError::Trap { kind, message } => write!(f, "worker trap ({kind:?}): {message}"),
            WorkerError::Disagreement { .. } => {
                write!(f, "worker disagreement: native and worker verdicts differ")
            }
            WorkerError::Unusable(w) => write!(f, "worker unusable: {w}"),
        }
    }
}

pub trait Worker {
    fn name(&self) -> &'static str;
    /// Fuel consumed by the last call (a diagnostic, never a verdict).
    fn last_fuel(&self) -> u64;
    fn admit(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError>;
    fn step(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError>;
}

// ---- the native worker -----------------------------------------------------

pub struct NativeWorker {
    fuel: u64,
}

impl NativeWorker {
    pub fn new() -> NativeWorker {
        NativeWorker { fuel: 0 }
    }
}

impl Default for NativeWorker {
    fn default() -> Self {
        Self::new()
    }
}

impl Worker for NativeWorker {
    fn name(&self) -> &'static str {
        "native"
    }
    fn last_fuel(&self) -> u64 {
        self.fuel
    }
    fn admit(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        self.fuel = 0;
        Ok(bnrose_exec_wasm::native_admit(req))
    }
    fn step(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        self.fuel = 0;
        Ok(bnrose_exec_wasm::native_step(req))
    }
}

// ---- the wasm worker (pinned Wasmtime, nothing linked) ---------------------

mod wt {
    // Isolating the wasmtime types keeps the trait layer buildable without
    // the engine (docs and native-only consumers).
    pub use wasmtime::{Engine, Instance, Linker, Memory, Module, Store, TypedFunc};
}

struct Ctx {
    limiter: MemLimiter,
}

struct MemLimiter {
    cap: usize,
    peak: usize,
}

#[allow(refining_impl_trait)]
impl wasmtime::ResourceLimiter for MemLimiter {
    fn memory_growing(
        &mut self,
        current: usize,
        desired: usize,
        _maximum: Option<usize>,
    ) -> wasmtime::Result<bool> {
        if desired > self.cap {
            return Ok(false);
        }
        if desired > self.peak {
            self.peak = desired;
        }
        let _ = current;
        Ok(true)
    }
    fn table_growing(
        &mut self,
        _current: usize,
        desired: usize,
        _maximum: Option<usize>,
    ) -> wasmtime::Result<bool> {
        Ok(desired <= 1024)
    }
}

pub struct WasmWorker {
    #[allow(dead_code)]
    engine: Arc<wt::Engine>,
    store: wt::Store<Ctx>,
    instance: wt::Instance,
    memory: wt::Memory,
    req_off: u32,
    verdict_off: u32,
    bounds: Bounds,
    fuel_used: u64,
    peak_mem: usize,
}

impl WasmWorker {
    /// Instantiate `module_bytes` under `bounds`. The engine is configured
    /// BEFORE any code runs: fuel on, epoch interruption on, a modest
    /// stack — and a linker with zero modules, which is the module's
    /// entire view of the host.
    pub fn new(module_bytes: &[u8], bounds: Bounds) -> Result<WasmWorker, WorkerError> {
        let mut cfg = wasmtime::Config::new();
        cfg.consume_fuel(true)
            .epoch_interruption(true)
            .max_wasm_stack(512 * 1024);
        let engine =
            wt::Engine::new(&cfg).map_err(|e| WorkerError::Unusable(format!("engine: {e}")))?;
        let module = wt::Module::new(&engine, module_bytes)
            .map_err(|e| WorkerError::Unusable(format!("module: {e}")))?;
        // THE NARROW INTERFACE: nothing is linked. Any import the module
        // declares makes instantiation fail right here.
        let linker = wt::Linker::<Ctx>::new(&engine);
        let mut store = wt::Store::new(
            &engine,
            Ctx {
                limiter: MemLimiter {
                    cap: bounds.memory_cap,
                    peak: 0,
                },
            },
        );
        store.limiter(|ctx| &mut ctx.limiter);
        // a fuel-metered store starts EMPTY: instantiation and the ABI
        // handshake calls below run on fuel too, so pour it in first —
        // and the epoch deadline defaults to zero, so the watchdog's very
        // first tick would trap the handshake: both bounds start HERE
        store
            .set_fuel(bounds.fuel)
            .map_err(|e| WorkerError::Unusable(format!("prime fuel: {e}")))?;
        store.set_epoch_deadline(bounds.ticks);
        let instance = linker.instantiate(&mut store, &module).map_err(|e| {
            WorkerError::Unusable(format!("instantiate (undeclared imports refuse here): {e}"))
        })?;
        let memory = instance
            .get_memory(&mut store, "memory")
            .ok_or_else(|| WorkerError::Unusable("module exports no memory".into()))?;
        let version: wt::TypedFunc<(), i32> = instance
            .get_typed_func(&mut store, "bnrose_abi_version")
            .map_err(|e| WorkerError::Unusable(format!("bnrose_abi_version: {e}")))?;
        if version
            .call(&mut store, ())
            .map_err(|e| WorkerError::Unusable(format!("abi version call: {e}")))? as u32
            != bnrose_exec_core::ABI_VERSION
        {
            return Err(WorkerError::Unusable(
                "module speaks another ABI version".into(),
            ));
        }
        let req_fn: wt::TypedFunc<(), i32> = instance
            .get_typed_func(&mut store, "bnrose_req_arena")
            .map_err(|e| WorkerError::Unusable(format!("bnrose_req_arena: {e}")))?;
        let verdict_fn: wt::TypedFunc<(), i32> = instance
            .get_typed_func(&mut store, "bnrose_verdict_arena")
            .map_err(|e| WorkerError::Unusable(format!("bnrose_verdict_arena: {e}")))?;
        instance
            .get_typed_func::<(i32, i32, i32, i32), i32>(&mut store, "bnrose_admit")
            .map_err(|e| WorkerError::Unusable(format!("bnrose_admit: {e}")))?;
        instance
            .get_typed_func::<(i32, i32, i32, i32), i32>(&mut store, "bnrose_step")
            .map_err(|e| WorkerError::Unusable(format!("bnrose_step: {e}")))?;
        // the watchdog: one thread per engine, ticking the epoch forever
        let engine_handle = Arc::new(engine.clone());
        let started = Arc::new(Barrier::new(2));
        let gate = started.clone();
        std::thread::Builder::new()
            .name("bnrose-wasm-watchdog".into())
            .spawn(move || {
                gate.wait();
                loop {
                    std::thread::sleep(WATCHDOG_INTERVAL);
                    engine_handle.increment_epoch();
                }
            })
            .map_err(|e| WorkerError::Unusable(format!("watchdog: {e}")))?;
        started.wait();
        let req_off = req_fn
            .call(&mut store, ())
            .map_err(|e| WorkerError::Unusable(format!("req arena: {e}")))?
            as u32;
        let verdict_off = verdict_fn
            .call(&mut store, ())
            .map_err(|e| WorkerError::Unusable(format!("verdict arena: {e}")))?
            as u32;
        Ok(WasmWorker {
            engine: Arc::new(engine),
            store,
            instance,
            memory,
            req_off,
            verdict_off,
            bounds,
            fuel_used: 0,
            peak_mem: 0,
        })
    }

    pub fn peak_memory(&self) -> usize {
        self.peak_mem.max(self.store.data().limiter.peak)
    }

    fn call_named(&mut self, export: &str, req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        let f: wt::TypedFunc<(i32, i32, i32, i32), i32> = self
            .instance
            .get_typed_func(&mut self.store, export)
            .map_err(|e| WorkerError::Unusable(format!("{export}: {e}")))?;
        self.call(&f, req)
    }

    fn call(
        &mut self,
        f: &wt::TypedFunc<(i32, i32, i32, i32), i32>,
        req: &[u8],
    ) -> Result<Vec<u8>, WorkerError> {
        if req.len() > bnrose_exec_core::MAX_REQUEST {
            return Err(WorkerError::Unusable(format!(
                "request of {} bytes over the ABI ceiling",
                req.len()
            )));
        }
        self.store
            .set_fuel(self.bounds.fuel)
            .map_err(|e| WorkerError::Trap {
                kind: TrapKind::Other,
                message: format!("set fuel: {e}"),
            })?;
        self.store.set_epoch_deadline(self.bounds.ticks);
        self.memory
            .write(&mut self.store, self.req_off as usize, req)
            .map_err(|e| WorkerError::Trap {
                kind: TrapKind::Other,
                message: format!("write req: {e}"),
            })?;
        let out = f.call(
            &mut self.store,
            (
                self.req_off as i32,
                req.len() as i32,
                self.verdict_off as i32,
                bnrose_exec_core::MAX_VERDICT as i32,
            ),
        );
        let fuel_left = self.store.get_fuel().unwrap_or(0);
        self.fuel_used = self.bounds.fuel.saturating_sub(fuel_left);
        self.peak_mem = self.peak_mem.max(self.store.data().limiter.peak);
        let n = match out {
            Ok(n) => n as usize,
            Err(err) => {
                // the fuel/epoch cause lives at the error CHAIN's root
                // ("all fuel consumed by WebAssembly", "wasm trap:
                // interrupt"); the head of the chain is just the backtrace
                let chain: Vec<String> = err.chain().map(|c| c.to_string()).collect();
                let message = chain.join("; ");
                let kind = if chain.iter().any(|c| c.contains("fuel")) {
                    TrapKind::FuelExhausted
                } else if chain
                    .iter()
                    .any(|c| c.contains("interrupt") || c.contains("epoch"))
                {
                    TrapKind::EpochDeadline
                } else {
                    TrapKind::Other
                };
                return Err(WorkerError::Trap { kind, message });
            }
        };
        let mut verdict = vec![0u8; n];
        self.memory
            .read(&mut self.store, self.verdict_off as usize, &mut verdict)
            .map_err(|e| WorkerError::Trap {
                kind: TrapKind::Other,
                message: format!("read verdict: {e}"),
            })?;
        Ok(verdict)
    }
}

impl Worker for WasmWorker {
    fn name(&self) -> &'static str {
        "wasm"
    }
    fn last_fuel(&self) -> u64 {
        self.fuel_used
    }
    fn admit(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        self.call_named("bnrose_admit", req)
    }
    fn step(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        self.call_named("bnrose_step", req)
    }
}

// ---- the paranoid dual-run --------------------------------------------------

pub struct ParanoidWorker {
    pub native: NativeWorker,
    pub worker: Box<dyn Worker>,
}

impl ParanoidWorker {
    pub fn around(worker: Box<dyn Worker>) -> ParanoidWorker {
        ParanoidWorker {
            native: NativeWorker::new(),
            worker,
        }
    }
}

impl Worker for ParanoidWorker {
    fn name(&self) -> &'static str {
        "paranoid"
    }
    fn last_fuel(&self) -> u64 {
        self.worker.last_fuel()
    }
    fn admit(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        let native = self.native.admit(req)?;
        let other = self.worker.admit(req)?;
        if native != other {
            return Err(WorkerError::Disagreement { native, other });
        }
        Ok(native)
    }
    fn step(&mut self, req: &[u8]) -> Result<Vec<u8>, WorkerError> {
        let native = self.native.step(req)?;
        let other = self.worker.step(req)?;
        if native != other {
            return Err(WorkerError::Disagreement { native, other });
        }
        Ok(native)
    }
}

/// Locate the wasm module for tests and the CLI: the env var when the
/// harness names it, else the conventional target path. Absent module is
/// an ERROR, not a skip — a skipped agreement suite is not a pass.
pub fn wasm_module_bytes() -> Result<Vec<u8>, String> {
    use std::path::PathBuf;
    let p = match std::env::var("BNROSE_EXEC_WASM") {
        Ok(v) if !v.is_empty() => PathBuf::from(v),
        _ => {
            let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            p.push("../../target/wasm32-unknown-unknown/release/bnrose_exec_wasm.wasm");
            p
        }
    };
    std::fs::read(&p).map_err(|e| {
        format!(
            "wasm module not found at {} ({e}); build it: cargo build -p bnrose-exec-wasm --target wasm32-unknown-unknown --release, or set BNROSE_EXEC_WASM",
            p.display()
        )
    })
}
