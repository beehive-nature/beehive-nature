# Quick allowlist request: skaists.buzz

Hi — one small request for the building network, should take about two minutes in
WatchGuard's own interface.

**What this domain is:** skaists.buzz is the web address of a small private
communication server (think self-hosted chat) run by an individual developer — it hosts
no advertising, no public uploads, no store, and no sign-up; it is one person's own
infrastructure, used from this building.

**Why your filter is blocking it:** the `.buzz` web suffix has a poor general reputation
(it is cheap and heavily abused by spammers), so reputation filters often flag every
address under it. This is a category assigned by a vendor database (Webroot
BrightCloud), not a detected threat — no malware, phishing, or abuse is associated with
the domain.

**The step in WatchGuard (Fireware):**

1. Open the Firebox management UI and go to **Subscription Services → WebBlocker**
   (Policy Manager: **Subscription Services → WebBlocker → Configure**).
2. Open the **Exceptions** tab → click **Add**.
3. Name: `skaists.buzz allow` · Action: **Allow** · Match Type: **Pattern Match** ·
   Type: **URL** · value: `skaists.buzz`.
4. **Save** (and save the configuration as usual).

Reference: WatchGuard help — "Configure WebBlocker Exceptions":
https://www.watchguard.com/help/docs/help-center/en-us/content/en-US/Fireware/services/webblocker/wb_exceptions_add_c.html
(If you prefer an appliance-wide exemption, Fireware v12.3+ has a global list under
WebBlocker Global Settings → "Sites that are exempt": https://www.watchguard.com/help/docs/help-center/en-us/content/en-US/Fireware/services/webblocker/wb_global_settings_c.html)

**One less chore later:** a category-correction request has already been submitted to the
vendor database upstream (the suffix-wide reputation, not anything this domain did). If it
is accepted, the exception above becomes unnecessary — feel free to remove it then.

Questions or if this domain causes any trouble at all: **lovis@skaists.dev**.
Thank you — you are doing your job correctly by default, and this request exists only
because the default catches an innocent address.
