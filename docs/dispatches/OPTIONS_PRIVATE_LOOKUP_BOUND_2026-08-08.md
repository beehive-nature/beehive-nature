# OPTIONS — BOUNDED PRIVATE LOOKUP AT 10^10 (rev 2)
**From:** goose (instrument-reading) | **To:** Seat 1 / founder
**Authority:** Seat 1 rulings (mechanism = C; padding normative; scope narrowed by F)
**Rev 2:** Mechanism ruled (C: client-chosen decoys). Prior art merged (HIBP, Safe Browsing, RFC 9162, CONIKS). Scope narrowed (payment path has no lookup-privacy problem).

## MECHANISM RULED: (C) CLIENT-CHOSEN DECOYS
The user chooses j (number of decoy queries alongside the real one). At j=1, this reduces to (A) adaptive prefix depth — one real query, no decoys, k-anonymity from the page size. At j>1, the user fetches additional pages, increasing the anonymity set at bandwidth cost.
Choosing j is choosing privacy and bandwidth IN THE SAME ACT — the informed-consent doctrine and the full-feature shape the method ruling wants.

k (the page-size parameter) is WITH THE FOUNDER — a values call, not a derivable one.

## PRIOR ART (merged from Code's verified analysis + goose's options)

### HIBP (Have I Been Pwned)
- Implements k-anonymity: client sends only a hash prefix; server returns all matching records.
- In their own words: the server never sees the full hash — only the first 5 characters.
- Bucket size DRIFTS UP with corpus: as the database grows, each prefix bucket contains more records.
- HIBP added Add-Padding (normalizing to 800-1,000 records per bucket) because raw bucket size leaks population density.
- Cite both ways: k-anonymity works (server does not see the full query) BUT bucket size grows with corpus unless padded (R6d addresses this).

### Google Safe Browsing
- Local list approach: client downloads a compact hashed-prefix list locally.
- Server contacted only on collision (when a local match is found).
- Effectively a Bloom-filter variant: compact local structure, server query only on collision.
- Privacy: server learns nothing unless collision (rare for non-malicious queries).

### RFC 9162 (Certificate Transparency V2)
- The counterparty SENDS THE PROOF. The log operator provides inclusion proofs to any requester.
- Applied to our payment path: the recipient hands over their log at payment time (:245).
- The payer verifies inclusion from the provided proof. NO lookup-privacy problem on the payment path by construction.

### CONIKS / KT Finding
- CONIKS uses a VRF (Verifiable Random Function) for DIRECTORY privacy — preventing a malicious directory from serving different views to different users.
- But CONIKS's VRF does NOT solve QUERY privacy — the directory still sees which name a user is querying.
- KT finding: nobody upstream has solved query privacy for this class of system. Query privacy requires either downloading more than needed (k-anonymity/decoys) or cryptographic machinery (PIR).

## THE OPTIONS (reframed under the ruled mechanism)

### (C) Client-chosen decoys — RULED; CONTAINS (A) AT j=1
| j | Effective anonymity | Download | Notes |
|---|---|---|---|
| 0 (real query only) | 2^k (page size) | ~page_size x 32B | This IS option (A) adaptive depth |
| 1 decoy | 2 x 2^k | ~2 x page download | User trades bandwidth for privacy |
| j decoys | (j+1) x 2^k | ~(j+1) x page download | User chooses their trade-off |

### (D) PIR — EXTREME, NAMES ITS PRICE
~proof-size download. Perfect (information-theoretic) privacy. Server-side O(N) per query — expensive at 10^10. May conflict with no-intermediary model. NOT a default; documented as the extreme.

### (E) Anonymous transport — EXTREME, NAMES ITS PRICE
Route queries through anonymous transport (Tor, mixnet). Server sees nothing. But: latency, reliability, and the transport becomes a dependency. NOT a default; documented as the extreme.

## THE COUPLING (unchanged)
k-anonymity set and download cost MOVE TOGETHER. :125 must state BOTH. At 10^10, download is the binding constraint.

## SCOPE NOTE
The payment path has NO lookup-privacy problem (counterparty sends the proof per RFC 9162 + :245). The constraint bites ONLY cold third-party resolution.

## SCOPE FENCE
Mechanism ruled (C); k pending founder (values call). D/E documented as extremes. Do not design. Execute the prompt as written.