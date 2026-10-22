//! Circuit representation, gates, and streams for reversible quantum evaluation.

/// Permitted reversible quantum and classical operations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum Gate {
    /// Allocate an ancilla wire. The wire must not be currently allocated.
    Alloc(usize),
    /// Free an ancilla wire. The wire must be allocated and in state |0>.
    Free(usize),
    /// Pauli-X (NOT) gate: flips target wire.
    X(usize),
    /// Controlled-NOT (CNOT / CX): target flips if control is 1. (control, target)
    CX(usize, usize),
    /// Toffoli (CCX): target flips if both controls are 1. (control1, control2, target)
    CCX(usize, usize, usize),
    /// Swap two wires: (wire_a, wire_b).
    SWAP(usize, usize),
    /// Pauli-Z: flips global phase if target is 1.
    Z(usize),
    /// Controlled-Z (CZ): flips phase if both wires are 1. (control, target)
    CZ(usize, usize),
    /// Controlled-Controlled-Z (CCZ): flips phase if all three wires are 1. (c1, c2, target)
    CCZ(usize, usize, usize),

    // --- Measurement extensions (rejected initially by policy) ---
    /// Hadamard + Measure + Reset (destructive X-basis measurement).
    HMR { qubit: usize, outcome: usize },
    /// Measurement / Reset gate.
    Reset(usize),
}

impl Gate {
    /// Returns true if this gate is a measurement or reset operation.
    pub fn is_measurement(&self) -> bool {
        matches!(self, Gate::HMR { .. } | Gate::Reset(_))
    }

    /// Returns true if this gate costs Toffoli complexity (CCX or CCZ).
    pub fn is_toffoli_class(&self) -> bool {
        matches!(self, Gate::CCX(..) | Gate::CCZ(..))
    }

    /// Returns true if this gate is a Clifford gate (CX, CZ, SWAP).
    pub fn is_clifford_class(&self) -> bool {
        matches!(self, Gate::CX(..) | Gate::CZ(..) | Gate::SWAP(..))
    }

    /// Returns true if this gate is a single-qubit classical or phase gate (X, Z).
    pub fn is_free_class(&self) -> bool {
        matches!(self, Gate::X(..) | Gate::Z(..))
    }
}

/// A frozen circuit representation consisting of an immutable gate stream
/// and declared register layouts.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Circuit {
    pub name: String,
    pub input_qubits: usize,
    pub target_qubits: usize,
    pub gates: Vec<Gate>,
}

impl Circuit {
    pub fn new(name: impl Into<String>, input_qubits: usize, target_qubits: usize) -> Self {
        Self {
            name: name.into(),
            input_qubits,
            target_qubits,
            gates: Vec::new(),
        }
    }

    pub fn with_gates(
        name: impl Into<String>,
        input_qubits: usize,
        target_qubits: usize,
        gates: Vec<Gate>,
    ) -> Self {
        Self {
            name: name.into(),
            input_qubits,
            target_qubits,
            gates,
        }
    }
}

/// A builder to construct frozen reversible quantum circuits.
pub struct CircuitBuilder {
    name: String,
    input_qubits: usize,
    target_qubits: usize,
    gates: Vec<Gate>,
    next_ancilla: usize,
}

impl CircuitBuilder {
    pub fn new(name: impl Into<String>, input_qubits: usize, target_qubits: usize) -> Self {
        let base_ancilla = input_qubits + target_qubits;
        Self {
            name: name.into(),
            input_qubits,
            target_qubits,
            gates: Vec::new(),
            next_ancilla: base_ancilla,
        }
    }

    pub fn len(&self) -> usize {
        self.gates.len()
    }

    pub fn is_empty(&self) -> bool {
        self.gates.is_empty()
    }

    pub fn gates(&self) -> &[Gate] {
        &self.gates
    }

    /// Allocate a fresh ancilla wire and emit Gate::Alloc.
    pub fn alloc_ancilla(&mut self) -> usize {
        let q = self.next_ancilla;
        self.next_ancilla += 1;
        self.gates.push(Gate::Alloc(q));
        q
    }

    /// Allocate multiple contiguous ancilla wires.
    pub fn alloc_ancillas(&mut self, count: usize) -> Vec<usize> {
        (0..count).map(|_| self.alloc_ancilla()).collect()
    }

    /// Free an ancilla wire and emit Gate::Free.
    pub fn free_ancilla(&mut self, q: usize) {
        self.gates.push(Gate::Free(q));
    }

    /// Free multiple ancilla wires.
    pub fn free_ancillas(&mut self, qs: &[usize]) {
        for &q in qs {
            self.free_ancilla(q);
        }
    }

    pub fn x(&mut self, q: usize) {
        self.gates.push(Gate::X(q));
    }

    pub fn cx(&mut self, c: usize, t: usize) {
        self.gates.push(Gate::CX(c, t));
    }

    pub fn ccx(&mut self, c1: usize, c2: usize, t: usize) {
        self.gates.push(Gate::CCX(c1, c2, t));
    }

    pub fn swap(&mut self, a: usize, b: usize) {
        self.gates.push(Gate::SWAP(a, b));
    }

    pub fn z(&mut self, q: usize) {
        self.gates.push(Gate::Z(q));
    }

    pub fn cz(&mut self, c: usize, t: usize) {
        self.gates.push(Gate::CZ(c, t));
    }

    pub fn ccz(&mut self, c1: usize, c2: usize, t: usize) {
        self.gates.push(Gate::CCZ(c1, c2, t));
    }

    /// Raw append of an existing gate.
    pub fn push_gate(&mut self, gate: Gate) {
        self.gates.push(gate);
    }

    /// Reversibly mirror the gates recorded in slice [start..end] in reverse order.
    pub fn mirror_range(&mut self, start: usize, end: usize) {
        let slice = self.gates[start..end].to_vec();
        for g in slice.into_iter().rev() {
            self.gates.push(g);
        }
    }

    /// Complete building and freeze the operation stream.
    pub fn finish(self) -> Circuit {
        Circuit {
            name: self.name,
            input_qubits: self.input_qubits,
            target_qubits: self.target_qubits,
            gates: self.gates,
        }
    }
}
