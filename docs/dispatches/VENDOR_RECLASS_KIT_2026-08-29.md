# VENDOR REPUTATION RECLASSIFICATION KIT — the .buzz mislabel fight-back · 2026-08-29

**The finding:** the .buzz block is WatchGuard WebBlocker, category "Elevated Exposure", policy
WebBlocker.Resident — a VENDOR REPUTATION CLASSIFICATION carried by the BrightCloud/Webroot DB.
It follows the TLD reputation, not our hostname or our conduct. Equivalent classifications are
likely at Fortinet, Zscaler, Cisco Umbrella.

**Honest status: PREPARED, NOT SUBMITTED.** Every vendor gates dispute submissions behind
human verification (measured live: BrightCloud = reCAPTCHA; Fortinet = ALTCHA that escalates
to a visual code; Zscaler/Umbrella = account or JS walls). Nothing was auto-submitted —
each needs the founder's one gesture. Everything below is pre-drafted so each gesture is
two minutes.

## The case (paste-ready, used everywhere)

> Genuine technology site (agent estate, published licenses, public repo). Misclassified via
> .buzz TLD reputation; clean sibling: skaists.dev

Extended version (Fortinet comment field, already typed into their form once — screenshot banked):

> Our two hive domains are mis-rated via .buzz TLD reputation (WatchGuard WebBlocker shows
> Elevated Exposure on this classifier family). skaists.buzz and beehivenature.buzz are a small
> self-hosted agent-estate: real published surfaces (https://skaists.dev — clean-rated sibling
> on the same box), public open-source repo, Apache-2.0/BSL licenses, no ads, no user content,
> no malware or phishing history. Requesting re-classification to Information Technology.

Contact to use everywhere: **lovis@skaists.dev** · Travis Remington · Beehive Nature Reserve.
(Verification emails will land here — the estate owns the domain, the sink can catch them.)

## Per-vendor: channel, what's prepared, turnaround norm

| vendor | current category | dispute channel | status | turnaround norm |
|---|---|---|---|---|
| **WatchGuard WebBlocker** (founder-measured: Elevated Exposure) | rides **BrightCloud/Webroot** DB | OpenText DbChange form: support.threatintel.opentext.com/tools/url-ip-lookup.php → Look up → "request review"/dispute modal (fields: urlIP, email, recommended categories, concern) | form driven to completion, **reCAPTCHA gates submit** — founder one-click | BrightCloud disputes typically process in a few days to ~2 weeks |
| **Webroot/BrightCloud** | same DB as WatchGuard — one dispute covers both | same form | same gesture | same |
| **Fortinet FortiGuard** | lookup bot-walled from here; founder can check at fortiguard.com/webfilter | official form: **fortiguard.com/faq/wfratingsubmit** (url + suggested category "Information Technology" + name/email/company + comment) — **fully drafted and typed once already** (screenshot `fortinet-submit-skaists_buzz.png`); final visual CAPTCHA needs founder | founder reads the code, clicks Submit · ~2 min per domain | typically 1–2 weeks; success often silent (re-check the lookup) |
| **Cisco Umbrella** | Investigate API/categories are account-walled to outside clients | Umbrella support ticket ("categorization request") after free account at support.umbrella.com; or through Cisco Talos reputation center | not started (account wall) | days–weeks |
| **Zscaler** | sitereview lookup JS-walled to headless | sitereview.zscaler.com → look up domain → "Request Review" (email + reason) | not started (wall) | typically ~1 week |

## The founder's sign-steps (numbered, ~10 minutes total)

1. **BrightCloud/OpenText** (fixes WatchGuard + Webroot at once): open
   support.threatintel.opentext.com/tools/url-ip-lookup.php → Look up `skaists.buzz` → in the
   review request, email `lovis@skaists.dev`, recommended category **Computer and Internet Info**,
   concern = the short case above → solve the reCAPTCHA → Submit. Repeat for `beehivenature.buzz`.
2. **Fortinet**: open fortiguard.com/faq/wfratingsubmit → fill (drafted above; category
   **Information Technology**) → read the CAPTCHA code → Submit. Repeat for `beehivenature.buzz`.
3. **Zscaler**: sitereview.zscaler.com → look up both domains → Request Review (email + the short case).
4. **Cisco Umbrella**: free support account → categorization ticket for both domains, cite skaists.dev.
5. Re-check in ~2 weeks: fortiguard.com/webfilter + the WatchGuard block page itself.

## What this does and does not fix

It corrects the label at the source where correctable — it does **not** replace the dual-home
(`relay.skaists.dev` fallback, live and proven) or the clean-TLD plan. Reputation decay of a
whole TLD classification is slow; the guaranteed path stays the guarantee.

## Measurement note (honest)

Vendor lookups are bot-walled by design (FortiGuard 403/empty to non-browsers, BrightCloud
reCAPTCHA, Zscaler 403, Umbrella account-walled) — measured live, screenshots banked. The
founder's own block page remains the strongest measurement of WatchGuard's classification;
independent headless re-measurement of the others was not possible and is not claimed.

## MEASUREMENT SWEEP — 2026-08-29 (headed real-browser, screenshots banked)

The founder asked for current categories per vendor before disputing. Measured result —
**every named vendor walls its public category lookup against non-customer, non-human
clients**, so no independent outside measurement of the categories exists. What the sweep
established, per vendor:

| vendor | lookup verdict (measured live) | evidence |
|---|---|---|
| Webroot BrightCloud (WatchGuard's source) | lookup fires but verdict requires reCAPTCHA; result region renders empty without it | `v-bc-skaists_buzz.png`, `bc-dispute-result.png` |
| Zscaler Site Review | banner: "Site review service is available for **Zscaler customers only**" — Look Up disabled | `v-zs-skaists_buzz.png` |
| Broadcom Blue Coat SiteReview | "We need to verify that you're a human…" | `v-bcp-skaists_buzz.png` |
| Cisco Talos/Umbrella | "Performing security verification … verifies you are not a bot" | `v-ta-skaists_buzz.png` |
| FortiGuard | HTTP 403 to non-browser clients; empty render in headless | `v-fg-skaists_buzz.png` |

**Consequence, stated plainly:** the only ground-truth category measurement available to
anyone outside a vendor customer login is the block page itself — which the founder already
holds for WatchGuard ("Elevated Exposure", WebBlocker.Resident). The disputes therefore go
through each vendor's human-gated channel with the prepared evidence pack (above); until a
founder gesture completes a gate, the honest status per vendor is **prepared — pending human
submission**, not "submitted".

**Deliverable B landed alongside:** `docs/NETWORK-ALLOWLIST-NOTE.md` — the one-page,
jargon-free allowlist request for the building's IT admin, with the WebBlocker exception
menu path cited from WatchGuard's own docs (Subscription Services → WebBlocker →
Exceptions → Add; global exempt list v12.3+).
