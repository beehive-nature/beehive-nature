# zCode — bnames dead-RPC heal + enfill bookkeeping — 2026-09-12

Assignment: #10 c5649534881 (focused follow-up to the live-acceptance
finding). Branch `zcode/bnames-rpc-heal-2026-09-12` off main `09ae7d5f`.
One commit; no production node changes; no new endpoints invented.

## The heal

`surfaces/bnames.html` HOSTS led with `https://api.eosn.io` — NXDOMAIN
publicly (Cloudflare + Google DoH Status 3, SOA from eosn.io's own AWS
nameservers; re-confirmed this session), so every visitor's first
registry read died on DNS. Fix: HOSTS is now exactly the two confirmed
hosts, `eos.api.eosnation.io` then `eos.greymass.com` — meter.py's rule
since 2026-08-29, now applied to the page. The now-moot `file://`
carve-out (`[HOSTS[1],HOSTS[2]]`) is simplified away — its indices would
have gone stale. The `post()` fallback shape, the truthful
unavailable-state copy, and the inert `RPC=null` signing path are
untouched.

## Endpoint evidence (bounded, public, read-only)

POST `/v1/chain/get_table_rows` `{code:'kingbeelovis',scope:'kingbeelovis',table:'config',limit:1}`:

- `https://eos.api.eosnation.io` → **HTTP 200**, `{"rows":[{"admin":"kingbeelovis","registration_fee":"0.0000 EOS","registration_days":365,"initialized":1}],"more":false}`
- `https://eos.greymass.com` → **HTTP 200**, byte-identical row (cross-host agreement)

DoH: both hosts Status 0; `api.eosn.io` Status 3 (NXDOMAIN). The probe
claims nothing beyond the config row shown.

## Regressions added

- `e2e/bnames-rpc.test.mjs` (CI-wired into the front-door node --test
  line): zero `api.eosn.io` occurrences anywhere in bnames.html; HOSTS is
  exactly the two confirmed hosts; the enfill record exists and every
  recorded cell still really is English-fill (a future real translation
  must remove its entry — stale records fail).
- `e2e/bnames-gate.mjs` (seat-side browser gate) +H1/+H2: **H1** zero
  requests to the dead host while the registry loads, watched at the
  network layer (passes offline — it counts only the forbidden host);
  **H2** with every chain host aborted, the page shows the truthful
  "couldn't reach the chain" copy. Gate now 21/21.

Local verification: bnames-rpc 3/3 · bnames-gate 21/21 ·
estate-source 11/11 (corpus whole, 28 tongues × 1,350 keys) ·
lang-coverage 12/12.

## enfill bookkeeping — six cells, not four (count corrected)

The assignment's "four cells" came from my receipt's miscounted word
("four"); the artifact confirms **six key:lang cells across four keys**,
each verified `value === en` against main's corpus before recording:
`bld.cmp.dock:{lv,th,gd}` (en "BlanguageDOCK" — brand-keep suspected),
`bld.title:th`, `bst.h.set:th` (en "THE SET"), `bst.quote:th` (the wOlf
quote). Recorded verbatim as `_meta.enfill['edu-i18n-recovery']`; no
translation was rewritten — recording only, per order. `bld.cmp.dock`
being en in three tongues while ru/tt/uk carry cells is draft state from
#43, meaning review stays in #7.

## Limitations / follow-ups (out of this focused scope)

The dead host still lives in six other call-sites, named for a fleet
sweep lane: `bmeshasi.html` (FIRST position — same user-visible defect
class as bnames had), `wallet.html` + `wallet-adapter-vaulta.js` (dead
tail), `bantfarm.html`, `blight/workbench.html`, `blight/vaulta-reader.html`
(middle positions), plus `surfaces/workbench.tmp` and a historical
mention in `onboarding/vendor/BUILD-NOTES.md` (doc, harmless). Chain
data on the live page is otherwise exactly what the probe returned.
