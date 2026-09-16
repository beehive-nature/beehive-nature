# Approved decisions to preserve

These are project decisions and implementation requirements, not assertions that the implementation already exists.

## Human and payment model

Human's private funds -> funded, bounded spending authority -> private b-meter receipt -> service settlement adapter -> only the information required by that route.

Keep the gas tank logical; do not require a permanent public wallet for every agent. bzDiD/bSAFE supplies purpose-bound authority evidence. Raw biometrics and stable device certificates stay out of ordinary payment messages. bRESPECT can supply optional, scoped policy evidence without becoming a universal tracking identifier.

One UI approval can coordinate many capabilities and settlement legs. It does not guarantee cross-chain atomicity. The wallet-local global plan ID must not be handed to every provider. A false submission timeout must not create another payment.

## Implementations and assets

Rust is the leading implementation choice for the shared off-chain core. Native Vaulta is the reference settlement adapter. A is the PoC/MVP reference asset; the eventual product foregrounds b plus an explicitly indicative or executable dollar/RWA-token quote. b's issuance, decimals, backing and exchange value remain unspecified until deliberately decided. Preserve exact historical assets and conversion terms.

ANT/Arbitrum is the second concrete settlement route, paired with a separate Autonomi private-storage adapter. Reserve the actual service and execution assets in each domain. Do not assume an approval can create liquidity, make b natively accepted by other protocols, or make a paymaster universally available.

Retain Autonomi, Arweave, Filecoin/IPFS and other qualifying decentralized storage as separate adapters. Arweave is a candidate for deliberately public permanent artifacts, not biometric or private receipt archival. Free service allowances are optional optimizations, not protocol guarantees or quotas to evade.

## Latest native/EVM decision

Promote exSat to a primary implementation reference for a native Vaulta/EVM boundary. Investigate using native proof verification and settlement logic behind EVM application calls. Pin and inspect official implementation, transaction nesting, failure propagation, mappings, authority checks, fees and licenses before claiming compatibility.

Native and EVM execution domains may share an authoritative host transaction; this must be demonstrated for the selected path. A separate host network or external bridge is a different settlement assurance. Do not describe an ordinary EVM runtime as an independently scaling rollup.

An accepted same-host integration must roll back both the payment state and dependent EVM entitlement on verifier rejection. Establish correct invocation authority and protect against reentrancy, replay and cross-domain substitution. Same-host atomicity does not hide public metadata.

Use one authoritative issuance domain for mapped b representations and prove conservation. Explicitly test precision conversion and remainder handling. Do not inherit Bitcoin custody, XSAT incentives or exSat's operational dependencies just because the architecture is useful.

## Economics and participation

Prefer implementations that minimize unavoidable recurring cost after meeting privacy, correctness, recovery and sovereignty requirements. Record human, hive and sponsor outlays and realized operator revenue separately. Forecast earnings are not funded authority.

newbee: useful local/read-only baseline and bounded sponsored allowance.
raver: full end-user functions under explicit budgets.
cypherpunk: operator roles with bounded agent permissions and separately reconciled operating budgets.

No mandatory subscription, governance weighting, biometric exposure or unlimited root-key delegation follows from these profiles.

## Security and scale

Use versioned proof/crypto suites with pinned verification keys, statements, encoding and retirement policies. No protocol guarantee follows from a scheme label. Keep unsupported routes disabled.

Evaluate active state growth, proof cost, low-resource client requirements, recovery, exits and mandatory operator dependencies under the ratified 10B Homeostasis Test. Cryptography and networks remain replaceable. Research targets are not achieved population-scale security measurements.
