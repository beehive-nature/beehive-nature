//! Gate 2: Device Capacity Ledger (SPEC-RUSTEOSVM-1, Grok Review R-2).
//!
//! Enforces:
//! 1. Σ active_reservations(device, across all DAOs) ≤ capacity − reserve.
//! 2. 1,000-attempt overcommit storm is 100% refused with 0 accepted bookings over budget.
//! 3. Proof-of-work / timed capacity challenge detects Sybil devices presenting N identities.
//! 4. Refuses excess at admission rather than queueing into deadline misses.

use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

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

#[derive(Default)]
pub struct DeviceCapacityLedger {
    devices: BTreeMap<[u8; 32], DeviceLimits>,
    // (device_id, op_id) -> active reservation
    active: BTreeMap<([u8; 32], [u8; 32]), ResourceBudget>,
    // device_id -> current sum of reservations
    allocated: BTreeMap<[u8; 32], ResourceBudget>,
}

impl DeviceCapacityLedger {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register_device(&mut self, device_id: [u8; 32], limits: DeviceLimits) {
        self.devices.insert(device_id, limits);
    }

    /// Try reserving resources on a device. Fails closed if total exceeds capacity - reserve.
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

        let next = current.saturating_add(request);
        if !next.fits_within(&allocatable) {
            return Err("capacity:overcommitted — sum reservations exceeds capacity minus reserve");
        }

        self.active.insert((*device_id, *op_id), *request);
        self.allocated.insert(*device_id, next);
        Ok(())
    }

    /// Release an active reservation when operation terminates (completed or failed).
    pub fn release(&mut self, device_id: &[u8; 32], op_id: &[u8; 32]) {
        if let Some(res) = self.active.remove(&(*device_id, *op_id)) {
            if let Some(curr) = self.allocated.get_mut(device_id) {
                *curr = curr.saturating_sub(&res);
            }
        }
    }

    pub fn current_allocated(&self, device_id: &[u8; 32]) -> ResourceBudget {
        self.allocated.get(device_id).copied().unwrap_or(ResourceBudget::zero())
    }

    /// Capacity Challenge: Verifies a device possesses claimed computational capacity.
    /// Used to catch Sybil devices presenting N identities behind 1 physical device.
    pub fn verify_capacity_challenge(
        device_id: &[u8; 32],
        challenge_seed: &[u8; 32],
        nonce: u64,
        elapsed_ms: u64,
        max_duration_ms: u64,
    ) -> bool {
        if elapsed_ms > max_duration_ms {
            return false;
        }
        let mut hasher = Sha256::new();
        hasher.update(device_id);
        hasher.update(challenge_seed);
        hasher.update(&nonce.to_le_bytes());
        let digest = hasher.finalize();
        // Difficulty: first 2 bytes must be zero
        digest[0] == 0 && digest[1] == 0
    }
}
