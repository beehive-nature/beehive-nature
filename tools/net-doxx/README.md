# doxx NETWORK adapter: tungsten test

The question: can doxx.net act as a bounded, replaceable `NETWORK` adapter
for BNR? It must not become a dependency, an identity source or a naming
authority. Constitution I and III already settle this: transport is an
adapter and no vendor is constitutional. Doxx tunnel tokens, IPs and keys
appear in BNR records only as run-salted adapter references
(`doxx:tunnel:<hash>`).

**Status: live verdict FAIL** (run `tt-20261005031759-e336b5`, 2026-10-05,
harness `fcf6a2029`, reconciliation `reconciled`). Every network check
passed:

- Deny by default held.
- The grant opened in about 40 s.
- The other port and the outsider were denied, with paths proven alive.
- The seat's device credential was walled off (403 ×3).
- Revocation took effect in 12 s.
- Cleanup removed all three tunnels.
- The net-admin token could not see any other token. Live disproved
  finding 1 below.

The single blocker is that a role=device credential still worked 150 s and
more after the `expires_at` the harness set. `create_token` did not echo an
expiry, so doxx either ignored the requested expiry or stored a different
one. A credential BNR cannot time-bound fails least privilege.

An earlier run's FAIL on revoke was this harness's bug: the delete left out
`src_port`. It is fixed in `fcf6a2029`.

## What the run does

Three tunnels are created, each in its own Linux network namespace: service
**A**, seat **B** (bFUzZ) and outsider **C**. The host's routes are never
touched.

| step | check | what counts |
|---|---|---|
| read first | `authority.no-token-disclosure` | `user_list_tokens` called with the net-admin credential must not return tokens in full; its own token is the witness |
| | refusals | the run stops before any mutation if the role is not net-admin, if there is no expiry, or if Link All is on |
| provision | `control.tunnels-up`, `control.listener-alive` | a WireGuard handshake in every namespace; A answers its own probe on both ports |
| deny by default | `baseline.deny` | B cannot reach A:18080 before any grant |
| grant | capability `bnr.net-capability/1` | a hash-committed tuple: seat B, A:18080, TCP, a 600 s window; one `firewall_rule_add` |
| exercise | `grant.exercise` | B reaches A:18080 and verifies an HMAC proof (a bare TCP connect proves nothing on this box) |
| edges | `negative.other-port`, `negative.other-source` | B cannot reach A:18081; C cannot reach A:18080 |
| | `negative.device-cannot-write` | a role=device credential bound to B cannot add a rule, see another tunnel or read another tunnel's config. Only a success counts as an escape, and only an explicit API refusal counts as a wall. A 5xx or a transport error is neither, so it makes the run INCONCLUSIVE |
| revoke | `revoke.deny` | the rule is deleted and B is denied again. This is re-checked after the paths are proven alive (`control.paths-alive-after-revoke`), so a dead path cannot pass for a revocation |
| expiry | `expiry.device-token` | the device credential stops working after its `expires_at`, which is enforced by the vendor |
| cleanup | `cleanup.*` | the run's own tunnels, rules and namespaces are removed, and nothing else |

The verdict is computed from observations, never written by hand:

- **FAIL**: any check that let traffic through, or any disclosed credential.
- **INCONCLUSIVE**: a refused start (the credential is not net-admin, has
  no expiry, or Link All is on), a harness error, any failed or missing
  control, or a missing check. A broken probe is never a pass and never a
  fail.
- **FAIL**: a grant that did not open a path the controls proved alive.
- **PASS_WITH_LIMITATIONS**: everything holds, but the findings below stand.
  Against the documented product this is the best possible verdict.
- **PASS**: everything holds and no limitation remains.

`reconcileNetReceipt` recomputes the receipt digest, the capability hash and
the verdict. It also checks that every verified edge lies inside the
capability, and that revocation came before `not_after`. Nineteen tests
cover the honest product and the sabotaged ones: an ignored grant, a delete
that keeps forwarding, a wide grant, full token listing, a dead path, a 5xx
treated as a wall, a tunnel that lists late, a vendor echoing a credential,
and a forged receipt. Each of 15 deliberate mutations of the guards fails
at least one test.

## Receipt (`bnr.net-receipt/1`)

| field | contents |
|---|---|
| `principal` | `seat:bFUzZ` |
| `adapter` | doxx, plus the pinned documentation |
| `authority` | `{capability, capability_hash, credential: {role, expires_at, scope counts}}` |
| `window` | `not_before`, `not_after`, `granted_at`, `revoked_at`, `deny_observed_at` |
| `lifecycle` | maps onto bPay's QUOTE → INVOICE → AUTHORIZATION → (execution) → RECEIPT → RECONCILIATION. Quote and invoice are recorded as **absent**, with the reason |
| `usage` | `exposed: false` |
| `calls[]` | endpoint, HTTP status and the sha256 of the *redacted* response |
| `observations[]` | the checks above |
| `findings[]` | limitations and blockers |
| `verdict`, `receipt_digest` | digest = sha256 over `bnr/net-receipt/v1 ‖ 0x00 ‖ canonical JSON`, using the bPay canonicaliser |

Doxx exposes no per-capability price, so no price is invented. Before
anything is written, the receipt is scanned against every secret the run
handled; on a match the run refuses to write it.

## Findings from the documentation (live run pending)

Sources: the `config.doxx.net` self-description, v1.1.0, fetched
2026-10-05T01:15Z, and `doxxcorp/config.doxx.net` at `e57b777`. Both are
pinned in `tungsten.mjs`.

1. **Authority escape: disproved live.** The net-admin token listed only itself. Docs-era note: `user_list_tokens` is "Available to any
   token role" and returns "token (full)". If that is true live, a net-admin
   or read-only token can read the admin token, and least privilege is
   void. The older GitHub reference shows masked tokens (`...gtGwEnvY`).
   The live run settles which is true.
   This is the check most likely to turn the verdict into FAIL.
2. **Doxx holds every WireGuard private key.** Keys are generated server
   side and returned by `list_tunnels` and `wireguard`, including to
   net-admin. Doxx can impersonate any seat.
3. **WireGuard terminates at the hub.** Seat-to-seat traffic crosses the
   doxx backbone. BNR has to encrypt end to end inside the route.
4. **The firewall is inbound only.** A rule like "seat may reach
   github.com:443" cannot be expressed. Only "who may reach this seat" can.
5. **Firewall rules have no TTL.** `not_after` is enforced by BNR revoking
   the rule. If the controller dies, the rule stays.
6. **No usage, metering or audit API, and responses are unsigned.** bMeter
   can check the receipt's internal consistency, not the vendor's
   provenance. For production this runs into Constitution V.1 (users fund
   what they consume): a flat subscription cannot be metered per
   capability. **Escalated, not resolved.**
7. **Net-admin can mint device credentials but cannot revoke them.**
   Revoke and delete are admin only, so the credential's expiry is the only
   bound net-admin controls.
8. **The capability is unsigned.** It is a hash commitment from this
   harness. The receipt proves consistency, not who authorized it.

## Smallest credible NETWORK interface

The test shows that three of the six hypothesised verbs do not belong to
the adapter:

- `authorize` and `receipt` are BNR's: the capability and the receipt.
- `exercise` belongs to the seat, and its evidence comes from BNR's own
  probe. An adapter must not be its own witness.

That leaves five verbs on the adapter itself:

| verb | doxx today | direct WireGuard tomorrow | Tor onion |
|---|---|---|---|
| `describe()` → capabilities (`inbound_allow`, `egress_policy`, `rule_ttl`, `usage`, `vendor_holds_keys`) | true, false, false, false, true | true, true (nftables), true, true, false | true, false, false, false, false |
| `observe()` → redacted state | `list_tunnels`, `firewall_rule_list` | `wg show`, `nft list` | service list |
| `provision(endpoint)` / `teardown` | `create_tunnel` / `delete_tunnel` | peer add / remove on our own hub | create / remove an onion service |
| `grant(route)` → handle | `firewall_rule_add` | an nftables rule | client auth key |
| `revoke(handle)` | `firewall_rule_delete` | delete the rule | remove the client auth |

`DoxxAdapter` implements this as a closed list of endpoints. Every account,
token-administration, DNS, domain, proxy and Link All mutation is refused
before it leaves the box. `create_token` is refused for any role but
`device`.

## Running it

- **Tests:** `npm test` (CI step "doxx tungsten harness").
- **Data-plane self-test:** `node selftest-netns.mjs`. Needs root on Linux.
  No vendor is involved: two namespaces peer over loopback WireGuard.
- **Live run:** the founder runs the one line in `live.sh`. A hidden prompt
  takes the token. The receipt lands in `out/`.
