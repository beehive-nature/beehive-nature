//! Identity resolution — the DID document is the root of trust, never the
//! PDS. `did:plc` resolves via the PLC directory; `did:web` via the
//! domain's `/.well-known/did.json`. From the document we take exactly two
//! facts: the PDS endpoint (`#atproto_pds` service) and the signing key
//! (`#atproto` verification method). A handle is only ever a *pointer* to
//! a DID; the DID document's `alsoKnownAs` is checked back against a
//! requested handle and any mismatch is surfaced as a warning, not
//! silently accepted.
//!
//! SCOPE (ruled Seat 1 2026-08-09): the `#atproto` signing key here is the
//! **ATProto identity key** — secp256k1 (ES256K), as ATProto mandates. It is NOT
//! the **bDiD record-signing key**, which is ed25519 (`did-autonomi-spec` keyAlg)
//! and is verified in [`crate::record_sig`] under R1b. Two distinct keys at two
//! distinct layers; do not conflate them (this note exists because they were).

use serde_json::Value as Json;

use crate::commit::{KeyError, SigningKey};

/// What the mirror needs to know about an account.
#[derive(Debug, Clone)]
pub struct AccountIdentity {
    pub did: String,
    /// PDS base URL (origin), e.g. `https://morel.us-east.host.bsky.network`.
    pub pds: String,
    /// The `#atproto` signing key exactly as published (`z…` multibase).
    /// Pinned into reports so a receipt can be re-verified even if the DID
    /// document later rotates.
    pub signing_key_multibase: String,
    pub signing_key: SigningKey,
    /// `alsoKnownAs` handles (without the `at://` prefix).
    pub handles: Vec<String>,
}

#[derive(Debug)]
pub enum DidError {
    UnsupportedMethod(String),
    Transport(String),
    Http { status: u16, url: String },
    BadDocument(String),
    Key(KeyError),
}

impl std::fmt::Display for DidError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DidError::UnsupportedMethod(m) => write!(f, "did method {m:?} unsupported"),
            DidError::Transport(e) => write!(f, "did resolution transport: {e}"),
            DidError::Http { status, url } => write!(f, "did resolution: HTTP {status} from {url}"),
            DidError::BadDocument(e) => write!(f, "did document: {e}"),
            DidError::Key(e) => write!(f, "did document signing key: {e}"),
        }
    }
}

impl std::error::Error for DidError {}

/// Where DID documents come from. Tests inject fixtures; the live
/// implementation is [`HttpDirectory`].
pub trait DidDirectory {
    fn did_document(&self, did: &str) -> Result<Json, DidError>;
}

pub struct HttpDirectory {
    pub plc_base: String,
    pub agent: ureq::Agent,
}

impl HttpDirectory {
    pub fn new(plc_base: &str) -> HttpDirectory {
        HttpDirectory {
            plc_base: plc_base.trim_end_matches('/').to_string(),
            agent: ureq::AgentBuilder::new()
                .timeout(std::time::Duration::from_secs(30))
                .build(),
        }
    }

    fn fetch_json(&self, url: &str) -> Result<Json, DidError> {
        match self.agent.get(url).call() {
            Ok(resp) => resp
                .into_json::<Json>()
                .map_err(|e| DidError::BadDocument(format!("{url}: {e}"))),
            Err(ureq::Error::Status(status, _)) => Err(DidError::Http {
                status,
                url: url.to_string(),
            }),
            Err(e) => Err(DidError::Transport(e.to_string())),
        }
    }
}

impl DidDirectory for HttpDirectory {
    fn did_document(&self, did: &str) -> Result<Json, DidError> {
        if let Some(_id) = did.strip_prefix("did:plc:") {
            self.fetch_json(&format!("{}/{}", self.plc_base, did))
        } else if let Some(host) = did.strip_prefix("did:web:") {
            // Only bare-hostname did:web (no port, no path segments) — the
            // only form atproto identities use.
            if host.contains(':') || host.contains('%') || host.is_empty() {
                return Err(DidError::UnsupportedMethod(format!("did:web:{host}")));
            }
            self.fetch_json(&format!("https://{host}/.well-known/did.json"))
        } else {
            Err(DidError::UnsupportedMethod(
                did.split(':').take(2).collect::<Vec<_>>().join(":"),
            ))
        }
    }
}

/// Extract the mirror-relevant identity facts from a DID document.
pub fn identity_from_document(did: &str, doc: &Json) -> Result<AccountIdentity, DidError> {
    let doc_id = doc.get("id").and_then(Json::as_str).unwrap_or_default();
    if doc_id != did {
        return Err(DidError::BadDocument(format!(
            "document id {doc_id:?} != requested {did:?}"
        )));
    }

    let vm = doc
        .get("verificationMethod")
        .and_then(Json::as_array)
        .ok_or_else(|| DidError::BadDocument("no verificationMethod".into()))?;
    let key_entry = vm
        .iter()
        .find(|m| {
            m.get("id")
                .and_then(Json::as_str)
                .is_some_and(|id| id.ends_with("#atproto"))
        })
        .ok_or_else(|| DidError::BadDocument("no #atproto verification method".into()))?;
    let key_multibase = key_entry
        .get("publicKeyMultibase")
        .and_then(Json::as_str)
        .ok_or_else(|| DidError::BadDocument("#atproto method has no publicKeyMultibase".into()))?
        .to_string();
    let signing_key = SigningKey::from_multibase(&key_multibase).map_err(DidError::Key)?;

    let services = doc
        .get("service")
        .and_then(Json::as_array)
        .ok_or_else(|| DidError::BadDocument("no service array".into()))?;
    let pds = services
        .iter()
        .find(|s| {
            s.get("id")
                .and_then(Json::as_str)
                .is_some_and(|id| id.ends_with("#atproto_pds"))
                && s.get("type").and_then(Json::as_str) == Some("AtprotoPersonalDataServer")
        })
        .and_then(|s| s.get("serviceEndpoint").and_then(Json::as_str))
        .ok_or_else(|| DidError::BadDocument("no #atproto_pds service endpoint".into()))?;
    if !pds.starts_with("https://") {
        return Err(DidError::BadDocument(format!(
            "pds endpoint {pds:?} is not https"
        )));
    }

    let handles = doc
        .get("alsoKnownAs")
        .and_then(Json::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Json::as_str)
                .filter_map(|s| s.strip_prefix("at://"))
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default();

    Ok(AccountIdentity {
        did: did.to_string(),
        pds: pds.trim_end_matches('/').to_string(),
        signing_key_multibase: key_multibase,
        signing_key,
        handles,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(did: &str, key: &str) -> Json {
        serde_json::json!({
            "id": did,
            "alsoKnownAs": ["at://bqueenbee.beehivenature.com"],
            "verificationMethod": [{
                "id": format!("{did}#atproto"),
                "type": "Multikey",
                "controller": did,
                "publicKeyMultibase": key,
            }],
            "service": [{
                "id": "#atproto_pds",
                "type": "AtprotoPersonalDataServer",
                "serviceEndpoint": "https://pds.example.org/"
            }]
        })
    }

    fn test_key_multibase() -> String {
        // e7 01 ‖ compressed secp256k1 point for the [7;32] test key.
        let sk = k256::ecdsa::SigningKey::from_slice(&[7u8; 32]).unwrap();
        let point = sk.verifying_key().to_encoded_point(true);
        let mut payload = vec![0xe7, 0x01];
        payload.extend_from_slice(point.as_bytes());
        // reuse the commit.rs test encoder shape inline
        const ALPHA: &[u8; 58] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        let mut digits: Vec<u8> = Vec::new();
        for &byte in payload.iter() {
            let mut carry = byte as u32;
            for d in digits.iter_mut() {
                let v = (*d as u32) * 256 + carry;
                *d = (v % 58) as u8;
                carry = v / 58;
            }
            while carry > 0 {
                digits.push((carry % 58) as u8);
                carry /= 58;
            }
        }
        let mut s = String::from("z");
        for &d in digits.iter().rev() {
            s.push(ALPHA[d as usize] as char);
        }
        s
    }

    #[test]
    fn extracts_pds_key_and_handles() {
        let did = "did:plc:testtesttest";
        let id = identity_from_document(did, &doc(did, &test_key_multibase())).unwrap();
        assert_eq!(id.pds, "https://pds.example.org");
        assert_eq!(id.handles, vec!["bqueenbee.beehivenature.com"]);
        assert_eq!(id.signing_key.curve_name(), "secp256k1");
    }

    #[test]
    fn refuses_mismatched_document_id() {
        let err = identity_from_document(
            "did:plc:expected",
            &doc("did:plc:other", &test_key_multibase()),
        )
        .unwrap_err();
        assert!(matches!(err, DidError::BadDocument(_)));
    }

    #[test]
    fn refuses_non_https_pds() {
        let did = "did:plc:testtesttest";
        let mut d = doc(did, &test_key_multibase());
        d["service"][0]["serviceEndpoint"] = Json::from("http://pds.example.org");
        assert!(matches!(
            identity_from_document(did, &d),
            Err(DidError::BadDocument(_))
        ));
    }
}
