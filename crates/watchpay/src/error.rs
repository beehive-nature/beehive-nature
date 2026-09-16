//! Error model. Every validation refusal names the offending field — the
//! field names are stable API/test surface (`refusal names the field` law).

use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum Error {
    /// A validation refusal naming the offending plan/tx/receipt field.
    #[error("field `{field}`: {reason}")]
    Field { field: &'static str, reason: String },
    /// Ledger (durable state machine) refusal. The message states the exact
    /// blocking state and the required explicit action.
    #[error("ledger: {0}")]
    Ledger(String),
    /// Storage/IO failure under the ledger root.
    #[error("io: {0}")]
    Io(String),
    /// Malformed input that is not field-addressable (bad JSON shape, etc).
    #[error("malformed input: {0}")]
    Malformed(String),
}

impl Error {
    pub fn field(field: &'static str, reason: impl Into<String>) -> Error {
        Error::Field {
            field,
            reason: reason.into(),
        }
    }

    /// Convenience for tests and callers: the named field, if this is a field refusal.
    pub fn field_name(&self) -> Option<&'static str> {
        match self {
            Error::Field { field, .. } => Some(field),
            _ => None,
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error::Io(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;
