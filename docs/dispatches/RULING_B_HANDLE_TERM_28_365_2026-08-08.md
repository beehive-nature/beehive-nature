# RULING — `.b` HANDLE TERM AND CHANGE CADENCE (2026-08-08)
**Authority:** Seat 0 (King Bee), stated in relay and couriered here so the v4 spec has a citable source rather than "per relay."
**To:** all seats · closes Code's LAW-8c provenance request on the 28/365 rule

## THE RULE (founder's words)
> "bDiD vaulta/AR/ANT **.b domain handles can be changed once every 28 days** and **must be renewed every 365 days**."

Two separate controls, often confused:
1. **CHANGE CADENCE — once per 28 days** (13 times per year maximum). Governs how often a handle may be changed.
2. **TERM — 365 days, renewed annually.** Governs how long a registration lasts before it must be renewed.

## STATUS AGAINST THE LIVE v3 CONTRACT
The v3 contract does **not** implement either control. Confirmed from source (goose, crate+ref stamped):
- `renew` accepts up to **3,650 days per call** (bdomain.cpp:123, hardcoded — never reads config)
- **unlimited** renewals, no counter
- **stacks**: `base = (cur_exp > now) ? cur_exp : now` (bdomain.cpp:133-134) adds to the existing expiry, so 10 calls reach ~100 years
- **no 28-day change control exists at all** — there is no `last_changed` field, and the domain name is the row key (immutable)

This is a **defect against a ruled design**, not an open design question. The bound was ruled; the contract diverged. Nobody needs to decide *whether* to bound `renew` — only to make the successor obey a bound that already exists.

## v4 SPEC ITEMS
1. `renew` extends by **one 365-day term**, reads the term from config, and **cannot stack** (mechanism pending founder word — see the open question below).
2. A renewed name **does not consume a new cap slot** — CONFIRMED already true (bdomain.cpp:139 `domains.modify`, not `emplace`).
3. A lapsed name currently returns to the pool with **ZERO cooldown** (bdomain.cpp:66-74 erases and re-registers instantly). The ruled design needs a **grace period for the original owner** — duration unruled.
4. The 28-day change cadence needs a `last_changed` field **and** a ruled definition of which mutation counts as a "change."
5. Any new column on the populated `domains` table must use `eosio::binary_extension` or it breaks deserialization of the 13 live rows.

**Scope fence:** this dispatch records provenance for a ruling already made. It decides nothing new. **Execute the prompt as written.**
