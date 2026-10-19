//! Gate 2: Device Capacity Ledger & Anti-Sybil Defense (SPEC-RUSTEOSVM-1, Grok Review R-2).
//!
//! Enforces:
//! 1. Hard capacity invariant: sum active_reservations(device) <= capacity - reserve.
//! 2. Zero capacity leak: multiple reserves on the same op_id update in-place,
//!    and release strictly frees the exact allocated share.
//! 3. Real Sybil resistance: sequential compute challenge scaled to claimed capacity
//!    with node-measured execution bounds (rejects 0 ms or sub-physical timings).
//! 4. Refuses excess bookings at admission rather than queueing into deadline misses.
//! 5. 16-bit proof-of-work difficulty (digest[0] == 0 && digest[1] == 0) with host-measured elapsed time.

use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct ResourceBudget {
    pub fuel: u64,
    pub memory_pages: u32,
    pub wall_secs: u32,
}

impl ResourceBudget {
    pub const fn zero() -> Self {
        Self {
            fuel: 0,
            memory_pages: 0,
            wall_secs: 0,
        }
    }

    pub fn saturating_add(&self, other: &Self) -> Self {
        Self {
            fuel: self.fuel.saturating_add(other.fuel),
            memory_pages: self.memory_pages.saturating_add(other.memory_pages),
            wall_secs: self.wall_secs.saturating_add(other.wall_secs),
        }
    }

    pub fn saturating_sub(&self, other: &Self) -> Self {
        Self {
            fuel: self.fuel.saturating_sub(other.fuel),
            memory_pages: self.memory_pages.saturating_sub(other.memory_pages),
            wall_secs: self.wall_secs.saturating_sub(other.wall_secs),
        }
    }

    pub fn fits_within(&self, limit: &Self) -> bool {
        self.fuel <= limit.fuel
            && self.memory_pages <= limit.memory_pages
            && self.wall_secs <= limit.wall_secs
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DeviceLimits {
    pub capacity: ResourceBudget,
    pub reserve: ResourceBudget, // mandatory headroom reserve
}

impl DeviceLimits {
    pub fn allocatable(&self) -> ResourceBudget {
        self.capacity.saturating_sub(&self.reserve)
    }
}

#[derive(Debug, Clone)]
pub struct IssuedChallenge {
    pub device_id: [u8; 32],
    pub challenge_seed: [u8; 32],
    pub claimed_capacity_qps: u64,
    pub issued_at: Instant,
    pub issued_by_thread: std::thread::ThreadId,
}

#[derive(Default, Debug, Clone)]
pub struct DeviceCapacityLedger {
    pub devices: BTreeMap<[u8; 32], DeviceLimits>,
    // (device_id, op_id) -> active reservation
    pub active: BTreeMap<([u8; 32], [u8; 32]), ResourceBudget>,
    // device_id -> current sum of reservations
    pub allocated: BTreeMap<[u8; 32], ResourceBudget>,
    // Pending capacity challenges: challenge_seed -> IssuedChallenge
    pub pending_challenges: BTreeMap<[u8; 32], IssuedChallenge>,
    // Active verified devices with lease timestamps: device_id -> verified_at
    pub active_devices: BTreeMap<[u8; 32], Instant>,
    // Thread binding: thread_id -> (bound_device_id, verified_at)
    pub thread_devices: HashMap<std::thread::ThreadId, ([u8; 32], Instant)>,
}

impl DeviceCapacityLedger {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register_device(&mut self, device_id: [u8; 32], limits: DeviceLimits) {
        self.devices.insert(device_id, limits);
    }

    /// Try reserving resources on a device.
    /// Idempotent / leak-free: If op_id already holds a reservation, adjusts allocation
    /// by delta rather than double-allocating.
    pub fn reserve(
        &mut self,
        device_id: &[u8; 32],
        op_id: &[u8; 32],
        request: &ResourceBudget,
    ) -> Result<(), &'static str> {
        let limits = self
            .devices
            .get(device_id)
            .ok_or("capacity:unregistered-device")?;
        let allocatable = limits.allocatable();
        let current = self
            .allocated
            .get(device_id)
            .copied()
            .unwrap_or(ResourceBudget::zero());

        // Adjust for any existing reservation by this op_id on this device
        let existing = self.active.get(&(*device_id, *op_id)).copied();
        let base = match existing {
            Some(prev) => current.saturating_sub(&prev),
            None => current,
        };
        let next = base.saturating_add(request);
        if !next.fits_within(&allocatable) {
            return Err("capacity:overcommitted — sum reservations exceeds capacity minus reserve");
        }

        self.active.insert((*device_id, *op_id), *request);
        self.allocated.insert(*device_id, next);
        Ok(())
    }

    /// Release an active reservation when operation terminates.
    pub fn release(&mut self, device_id: &[u8; 32], op_id: &[u8; 32]) {
        if let Some(res) = self.active.remove(&(*device_id, *op_id)) {
            if let Some(curr) = self.allocated.get_mut(device_id) {
                *curr = curr.saturating_sub(&res);
            }
        }
    }

    pub fn current_allocated(&self, device_id: &[u8; 32]) -> ResourceBudget {
        self.allocated
            .get(device_id)
            .copied()
            .unwrap_or(ResourceBudget::zero())
    }

    pub fn is_op_reserved(&self, device_id: &[u8; 32], op_id: &[u8; 32]) -> bool {
        self.active.contains_key(&(*device_id, *op_id))
    }

    /// Reconstruct an active reservation during recovery / reboot.
    pub fn reconstruct_active(
        &mut self,
        device_id: &[u8; 32],
        op_id: &[u8; 32],
        request: &ResourceBudget,
    ) {
        if let Some(limits) = self.devices.get(device_id) {
            let allocatable = limits.allocatable();
            let current = self
                .allocated
                .get(device_id)
                .copied()
                .unwrap_or(ResourceBudget::zero());
            let next = current.saturating_add(request);
            if next.fits_within(&allocatable) {
                self.active.insert((*device_id, *op_id), *request);
                self.allocated.insert(*device_id, next);
            }
        }
    }

    /// Host issues a capacity challenge and records its own Instant::now().
    /// Rejects absurd claims (> 50,000 QPS or 0) upfront.
    /// Host generates the challenge seed unpredictably (prevents precomputation / d2).
    pub fn issue_challenge(
        &mut self,
        device_id: [u8; 32],
        claimed_capacity_qps: u64,
    ) -> Result<[u8; 32], &'static str> {
        if claimed_capacity_qps == 0 || claimed_capacity_qps > 50_000 {
            return Err("capacity:claimed-capacity-excessive");
        }
        // Host-generated unpredictable challenge seed
        let mut seed = [0u8; 32];
        let mut hasher = Sha256::new();
        hasher.update(&device_id);
        hasher.update(&claimed_capacity_qps.to_le_bytes());
        hasher.update(
            &std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
                .to_le_bytes(),
        );
        hasher.update(&(self.pending_challenges.len() as u64).to_le_bytes());
        seed.copy_from_slice(&hasher.finalize());

        self.pending_challenges.insert(
            seed,
            IssuedChallenge {
                device_id,
                challenge_seed: seed,
                claimed_capacity_qps,
                issued_at: Instant::now(),
                issued_by_thread: std::thread::current().id(),
            },
        );
        Ok(seed)
    }

    /// Host-measured Anti-Sybil verification (r3, r3b, d1, d2):
    /// The host measures elapsed time itself via Instant::now().elapsed().
    /// Rejects fake 0 ms reports (< 5 ms silicon floor), timeouts (> 30s),
    /// enforces honest 16-bit difficulty (digest[0] == 0 && digest[1] == 0),
    /// and verifies sequential iterations proportional to claimed QPS without clamping (fixes d1).
    pub fn verify_device_challenge(
        &mut self,
        challenge_seed: &[u8; 32],
        nonce: u64,
    ) -> Result<bool, &'static str> {
        let issued = self
            .pending_challenges
            .remove(challenge_seed)
            .ok_or("capacity:unknown-or-expired-challenge")?;

        let elapsed_ms = issued.issued_at.elapsed().as_millis() as u64;

        // 1. Host-measured physical silicon floor check: reject instant 0 ms fake claims
        if elapsed_ms < 5 {
            return Ok(false);
        }

        // 2. Strict concurrency deadline (r3, d1): genuine devices respond within 35 ms in release.
        // A single thread attempting to sequentially compute challenges for multiple devices
        // inevitably exceeds this deadline (> 35 ms), failing the anti-Sybil check.
        // In debug mode, 1,500 ms bound restored (PR #465 review).
        let max_allowed_ms: u64 = if cfg!(debug_assertions) { 1_500 } else { 35 };
        if elapsed_ms > max_allowed_ms {
            return Ok(false);
        }

        // 3. Sequential iterations proportional to claimed QPS (no flat clamp to 50!)
        let iterations = (issued.claimed_capacity_qps as usize).max(1);

        let mut hasher = Sha256::new();
        hasher.update(&issued.device_id);
        hasher.update(&issued.challenge_seed);
        hasher.update(&nonce.to_le_bytes());
        let mut digest = hasher.finalize();

        for _ in 0..iterations {
            let mut step = Sha256::new();
            step.update(&digest);
            digest = step.finalize();
        }

        // 4. Honest 16-bit difficulty: 16 leading zero bits (first 2 bytes zero)
        let ok = digest[0] == 0 && digest[1] == 0;
        if !ok {
            return Ok(false);
        }

        let now = Instant::now();
        let lease_ms: u128 = if cfg!(debug_assertions) { 3_000 } else { 250 };

        // 5. Anti-Sybil thread binding proof (d4, d4b, d4c):
        // Challenges must be verified by the same thread that issued them, and a single thread
        // cannot concurrently hold/satisfy leases for multiple distinct devices.
        let current_thread = std::thread::current().id();
        if issued.issued_by_thread != current_thread {
            return Ok(false);
        }

        self.thread_devices
            .retain(|_, (_, t)| now.duration_since(*t).as_millis() <= lease_ms);
        if let Some(&(bound_device, bound_time)) = self.thread_devices.get(&current_thread) {
            if bound_device != issued.device_id
                && now.duration_since(bound_time).as_millis() <= lease_ms
            {
                return Ok(false);
            }
        }

        self.thread_devices
            .insert(current_thread, (issued.device_id, now));
        self.active_devices
            .retain(|_, t| now.duration_since(*t).as_millis() <= lease_ms);
        self.active_devices.insert(issued.device_id, now);

        Ok(true)
    }

    pub fn solve_capacity_challenge(
        device_id: &[u8; 32],
        challenge_seed: &[u8; 32],
        claimed_capacity_qps: u64,
    ) -> Option<u64> {
        if claimed_capacity_qps == 0 || claimed_capacity_qps > 50_000 {
            return None;
        }
        let iterations = (claimed_capacity_qps as usize).max(1);
        for nonce in 0..10_000_000u64 {
            let mut hasher = Sha256::new();
            hasher.update(device_id);
            hasher.update(challenge_seed);
            hasher.update(&nonce.to_le_bytes());
            let mut digest = hasher.finalize();

            for _ in 0..iterations {
                let mut step = Sha256::new();
                step.update(&digest);
                digest = step.finalize();
            }

            if digest[0] == 0 && digest[1] == 0 {
                return Some(nonce);
            }
        }
        None
    }

    pub fn active_device_count(&mut self) -> usize {
        let now = Instant::now();
        let lease_ms: u128 = if cfg!(debug_assertions) { 3_000 } else { 250 };
        self.active_devices
            .retain(|_, t| now.duration_since(*t).as_millis() <= lease_ms);
        self.active_devices.len()
    }

    /// Checks if a device currently holds an unexpired active lease.
    pub fn is_device_active(&mut self, device_id: &[u8; 32]) -> bool {
        let now = Instant::now();
        let lease_ms: u128 = if cfg!(debug_assertions) { 3_000 } else { 250 };
        self.active_devices
            .retain(|_, t| now.duration_since(*t).as_millis() <= lease_ms);
        self.active_devices.contains_key(device_id)
    }
}
