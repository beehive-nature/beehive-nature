# HANDOFF → Claude Code · Fix the Visual Layer · 2026-08-18

## THE PROBLEM
The founder sees plain-text or black-walled pages on his device. The hub, coop, farmers, and several surfaces render unstyled or invisible on his screen. Multiple fix attempts shipped but his cache (oxygen/CDN layer) keeps serving stale bytes. zCode burned the founder's patience on repeated "it's fixed" claims that didn't reach his eyeballs.

## WHAT TO DO (in priority order)

### 1. Add Cache-Control meta tags to EVERY surface
Every `.html` file in `surfaces/` needs this in `<head>`:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```
This forces every CDN/browser/proxy to re-fetch. Do this FIRST — it's the root cause of every "fix didn't work" report.

### 2. Verify the hub renders styled on mobile
The hub at `surfaces/index.html` (commit c370410) is a sitemap tree with 5 color-coded branches. Test on a phone-width viewport. If CSS fails, check for:
- CSS custom properties not supported (very old browser)
- Flexbox on `.leaves` containers
- The `border-left: 3px solid var(--bc)` on branch headers

### 3. The tour bar (surfaces/tour.js, v7)
Single-line horizontal scroll. If it covers content on narrow screens, check:
- `max-height: 40px` is enforced
- `flex-wrap: nowrap` is set
- `overflow-x: auto` allows scrolling
If still broken, reduce to 10 most important links.

### 4. Coop + Farmers Market visibility
Both had "black wall" issues. The inline `display:none` on overlays should prevent fullscreen dark layers. If still invisible:
- Check if body background renders (should be #0A0A0F)
- Remove the `background-image` SVG data-URIs from body
- Test with CSS disabled to confirm HTML structure is sound

### 5. Gallery/Explorer/Education surfaces
These were rebuilt multiple times. Verify:
- `inscription-explorer.html` shows the doorway ("whose art shall we visit?")
- `gallery.html` renders the walking tour
- `market.html` shows USDC-priced listing cards
- All pages include `tour.js` via script tag

### 6. The parlor extension (surfaces/blight/parlor.js)
This wraps `openRoom()` to add spot value + offers + AI seat to the gallery.
- Verify it loads after the main script
- Check `pointers.js` loads before it
- The `toll.js` renders the 5-USDC escrow event

## KEY FILES
```
surfaces/index.html          — the hub (sitemap tree)
surfaces/tour.js             — the nav bar (v7)
surfaces/blight/*.html       — all gallery surfaces
surfaces/blight/parlor.js    — room extension
surfaces/blight/pointers.js  — PTR library
surfaces/blight/relay.js     — nostr transport
surfaces/blight/bsky.js      — bsky transport
surfaces/blight/toll.js      — anti-spam gate
surfaces/blight/hearth.html  — AI prompt window
surfaces/blight/pulse.html   — relay wall
surfaces/keys/addresses.html — DID binding
```

## STANDING LAWS
- Parse gate + scan gate BEFORE every push: `node -e "parse check" && sh scripts/secret-scan.sh tree && git add && git commit && git push`
- NEVER use heredocs for file edits — use the Write/Edit tools
- Every surface keeps its own visual identity
- done = the founder CONFIRMS he can see it on HIS device

## THE FOUNDER'S DEVICE
He's on a phone or narrow-screen device. His browser caches aggressively. The oxygen CDN layer serves stale assets. Every "fix" must include a cache-bypass verification step. Ask him to test in incognito mode to separate code bugs from cache bugs.
