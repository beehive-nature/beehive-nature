//! CD capability manifests: capabilities are EXPLICIT and BOUND before
//! intent construction — no adapter may silently claim semantics it cannot
//! provide (CD-8 send gate as a versioned manifest axis; CD-9 composition
//! by intersection; CD-10 mock-vs-live manifest truth with an identity
//! and a divergence table).

/// The LN upto mechanisms (LU-5): how a maximum becomes an actual —
/// hold-invoice (settle-on-release) or MPP (partial-fill sum). The
/// mechanism is named in the manifest, never implied.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum LnUptoMechanism {
    Hold,
    Mpp,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MechanismSet {
    pub hold: bool,
    pub mpp: bool,
}

impl MechanismSet {
    pub const NONE: MechanismSet = MechanismSet {
        hold: false,
        mpp: false,
    };
    pub const BOTH: MechanismSet = MechanismSet {
        hold: true,
        mpp: true,
    };

    pub fn supports(&self, m: LnUptoMechanism) -> bool {
        match m {
            LnUptoMechanism::Hold => self.hold,
            LnUptoMechanism::Mpp => self.mpp,
        }
    }
}

/// Who is actually behind the transport (CD-10): a mock declares its
/// divergences; a live transport declares its URL shape. A manifest that
/// lies about either is detectable at law (the lying-mock negative
/// control fails through the evidence rules, not through trust).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TransportIdentity {
    Mock {
        divergences: &'static [&'static str],
    },
    Live {
        url_shape: &'static str,
    },
}

/// CD-7 response-read axis, decided BEFORE construction: how responses
/// are readable after a request. `None` means send-then-blind — the
/// permanent-Unknown trap — and therefore FORBIDS enabled sends.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResponseReadAxis {
    PostReq,
    WsRequired,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CapabilityManifest {
    pub identity: TransportIdentity,
    pub mechanisms: MechanismSet,
    pub response_read: ResponseReadAxis,
    pub sends_enabled: bool,
    /// CD-8: the send gate bumps ADDITIVELY (a versioned history of
    /// authorizations, never a silent toggle).
    pub send_gate_version: u32,
}

#[derive(Debug, thiserror::Error)]
pub enum ManifestError {
    #[error("manifest: sends enabled with NO response read — send-then-blind is the permanent-Unknown trap, refused pre-construction (CD-7/CD-8)")]
    BlindSend,
    #[error("manifest: {0}")]
    Other(&'static str),
}

impl CapabilityManifest {
    /// The manifest's own laws (run at construction; the rail re-checks
    /// at every intent).
    pub fn validate(&self) -> Result<(), ManifestError> {
        if self.sends_enabled && self.response_read == ResponseReadAxis::None {
            return Err(ManifestError::BlindSend);
        }
        Ok(())
    }

    /// CD-8 additive bump: enabling sends is a NEW version, never a
    /// silent flip; blind sends stay refused at every version.
    pub fn enable_sends_bump(&mut self) -> Result<(), ManifestError> {
        // Validate the WOULD-BE state: a bump that would create a blind
        // send is refused and versions nothing.
        let next = CapabilityManifest {
            sends_enabled: true,
            ..self.clone()
        };
        next.validate()?;
        self.send_gate_version += 1;
        self.sends_enabled = true;
        Ok(())
    }

    pub fn supports(&self, m: LnUptoMechanism) -> bool {
        self.mechanisms.supports(m)
    }
}
