# Z2.A Trezor audit review — corrections before implementation

Codex (Astra), 2026-09-12. Reviewed z2.a's audit commit `dfeaaddb` and its
proposed z2.b orders. **Disposition: return to z2.a for bounded corrections;
do not execute the existing section 7 implementation order.** The inventory
is useful, but several conclusions and payment-safety assumptions are wrong
or exceed the evidence. Four hosted checks succeed on the audit commit;
that does not verify the claims in the document.

This review reads code and documentation only. No wallet, device, signing,
broadcast, upload, app install, or production action was performed. Other
seats' worktrees were read only. z2.a retains ownership of its corrections.

## 1. Blocking: Suite MCP calldata claim is contradicted by official source

The audit says `trezor_send_transaction` has no `data` parameter and therefore
cannot carry Autonomi contract calls. The official tools reference explicitly
lists `data`, `chainId`, fee fields, and `broadcast`. At the inspected Trezor
Suite source pin `aee3f9e8`, `mcp-server.ts` declares `data` in that tool's
schema, puts `params.data` in the EVM transaction, and invokes
`ethereumSignTransaction`. The capability is present in this source, not
merely inferred from a generic Connect method.

- [Official tools reference](https://docs.trezor.io/trezor-suite/packages/suite-desktop/skills/trezor-mcp/references/tools-reference.html)
- [Pinned MCP implementation](https://github.com/trezor/trezor-suite/blob/aee3f9e8ebbcba0983d47a9e577385cbb40271ba/packages/suite-desktop-core/src/modules/mcp-server.ts)

Correction: retract the categorical impossibility claim. Separately identify
what the installed Suite version actually supports. A repository or docs
capability is not proof it ships in Suite 26.6.1 or works with this device.
No signing tool call is needed for that source/version audit. Preserve the
founder's existing preference for our Connect signing surface; support in
Suite does not itself authorize changing that preference. Do not confuse
tool capability, vendor agent guidance, and founder authorization.

## 2. Blocking: the JavaScript payment reference is not a proven receipt decoder

At the audit pin, `ops/ant-extsig/member-pay.mjs` constructs `VAULT_ABI` with
one function and **no event declaration**. It then calls
`vaultC.interface.parseLog`, searches for an event name matching `/merkle/i`,
and falls back to `rc.transactionHash` as the supposed winner hash. That
interface cannot decode the missing event. A transaction hash is not a
validated winner-pool hash; no fallback may substitute one for the other.

The harness README explicitly says the executed devnet leg used a standalone
evmlib wallet directly. It calls the ethers script a documented browser-wallet
shape. The actual devnet receipt cannot be extended to claim this JavaScript
parser was exercised or that its mainnet behavior is proven.

- [Pinned script](https://github.com/beehive-nature/beehive-nature/blob/dfeaaddb/ops/ant-extsig/member-pay.mjs)
- [Pinned harness evidence](https://github.com/beehive-nature/beehive-nature/blob/dfeaaddb/ops/ant-extsig/README.md)

Correction: identify the exact ABI event and named output field at the pinned
payment contract. Specify strict receipt checks: successful status, expected
chain/contract/transaction and payer-to-plan binding, matching batch, and
unambiguous event. Missing, wrong-contract, malformed, or ambiguous evidence
must refuse. No hash fallback. Require a real decoded devnet receipt and
negative fixtures before using this as the payment reference.

## 3. Blocking: payment-plan and retry orders are incomplete

The proposed export lists commitment **counts** and totals. The call being
composed requires the ordered `(rewards address, amount)` commitments, depth,
and timestamp. Counts and totals do not determine that calldata. Define a
versioned, bounded schema containing all required public payment inputs,
integer units/ranges, an immutable job/batch identity, expiry, expected payer,
network and contracts, and a commitment to the complete reviewed plan. Keep
private DataMaps and decryption capabilities out of the payment envelope.
Distinguish a public upload address from a private retrieval capability.

Likewise, obtaining a new pending nonce for every attempt is **not** an
idempotency guard. An earlier transaction can be pending, confirmed while
the client timed out, or broadcast just before a crash. A new nonce can pay
the same batch again. Specify durable per-batch state and reconciliation of
pending/mined/reverted/replaced/unknown outcomes. Unknown must not trigger
automatic re-signing. Bind and validate the returned signature/transaction
against the reviewed plan before any broadcast. Include token and gas
ceilings and the existing admission gate; exact token approval alone is not
a total spending ceiling.

## 4. Blocking: in-memory recovery is not process-death recovery

At ant-core `dbc01ce8`, `FinalizeOutcome::Partial` carries an opaque
`FinalizeResume` handle. The documentation says dropping that handle abandons
the upload and may remove the merkle spill directory. This is useful
same-process retry support. It does not establish recovery after the process
and its prepared state are lost.

- [Pinned finalize types and functions](https://github.com/WithAutonomi/ant-client/blob/dbc01ce8fdbdfe9ac4d064d35f36b4684bf6a616/ant-core/src/data/client/file.rs)

The z2.b design explicitly keeps `PreparedUpload` in memory, yet requests a
kill/restart recovery proof. Those statements are inconsistent. Separate
fresh-client reconnect while retaining prepared state, partial-finalize
retry, and actual process-death recovery. Retain the paid-but-unfinished risk
until restart recovery is implemented and tested. Do not retire that risk
because issue #140 has an in-process fix.

## 5. Record corrections

- **Luna:** it is the model label supplied by the founder, not a guaranteed
  git author/branch name. A negative name search cannot establish that the
  session or its work did not exist. Report the read-only Suite bridge found
  in PR #8, with exact author/session attribution unresolved where necessary.
  Do not describe it as somebody else's work without evidence.
- **Release pin:** `v0.1.0-alpha.98` resolves to `206da1d15f9657c915ab63254f56f91250d4759c`.
  `56819f24` is the next documentation commit, not the release tag. The
  inspected WSL clone also reports `206da1d`. Record the release and checkout
  separately; keep the dependency pin explicit.
- **Attribution:** `dfeaaddb` has founder as both author and committer and no
  parsed seat coauthor trailer. That is not the standing founder-author /
  seat-committer / seat-trailer shape. Correct the next descendant's metadata
  and record the earlier mismatch; never rewrite history or claim a descendant
  changes the original metadata.
- **Gates:** the original Sepolia end-to-end vault plan may need revision,
  but a missing deployed payment vault does not invalidate a separate
  device/Connect testnet preflight. Keep emulator/devnet, hardware preflight,
  and funded mainnet ceremonies distinct. Do not turn a mainnet transaction
  into the default first device test. Report transaction-signature counts
  separately from firmware-dependent physical button presses.

## 6. Revised implementation sequence

After this correction receives review, z2.b should be a bounded offline
payment-plan / validation / receipt-and-recovery contract slice with
synthetic inputs and no real device or network spend. The Watch-It caller
must retain private state locally and protect any localhost mutation API
against unauthorized callers; loopback alone is not authorization. Confirm
how explicit external mode selects a wallet-less client without altering
or erasing an existing hot wallet.

Then review a separate Connect adapter slice. A full Watch-It upload API,
pay-desk UI, real-device flow, and paid upload are not one small unchecked
assignment. Upstream PR #8's maintainer invited a separate discussion/PR for
the read-only bridge, not blanket acceptance of a larger external payment
architecture. Keep one disclosed feature per upstream proposal and no
SKAISTS branding in stock W@tch.

## 7. Paste-ready correction order

```text
Continue z2.a in the SAME session, GLM 5.3 MAX. Do not start z2.b yet.

Read C:\Users\travi\wt-zcode-watch-jams-plur\docs\dispatches\2026-09-12-z2a-trezor-review.md.
Correct your audit at dfeaaddb in your own existing worktree. Re-check each
finding against its pinned source; amend the conclusions and replace the
old section 7 orders so they cannot be mistaken for current authorization.

Deliver: (1) an evidence table distinguishing observed, source-supported,
mock-tested, live-tested and unverified; (2) a complete proposed payment-plan
and receipt/state contract; (3) narrowly scoped offline z2.b orders covering
validation and failure cases before any device or broadcast integration.

No device session, signing, broadcast, real upload, wallet changes, or
production edits. Do not change the founder's Connect preference. Do not
patch ops/ant-extsig or other seats' code in this audit correction; identify
the source defect and specify its regression requirements. Do not claim
Luna never existed. Use a correctly attributed descendant, no force push.
Report the corrected pin, remaining uncertainties, and review link.
```
