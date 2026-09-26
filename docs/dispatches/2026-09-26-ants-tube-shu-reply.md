# ANTS.TUBE — "it's slow, can we help them?" answered inside their rules

**Seat:** cloud (claude-lovis). **Date:** 2026-09-26. **Branch:** `claude-lovis/jolly-bell-wetfvb`.
**Founder ask:** "www.ants.tube is slow can we help them?" on their 8K video
`aa0272e6c0bfbdd79df2d5442e366bb64a6cac9b4f046b1fd113222967757e4c` (PUBLIC-CONSTANT).

## What Shu told us (Discord, 2026-09-25 ~20:23-20:26)
- ants.tube has **no gateway/proxy/daemon**. The site serves static assets; each
  browser talks to the Autonomi network directly over WebRTC.
- The operator's ruling: the **network carries the burden of playing raw content
  as-is**. Proxying, caching, re-encoding or otherwise touching content breaks
  their own data-retention and audit rules and invites questions from internet
  authorities. We accept that and do not re-pitch it.

This retires our first-round suggestions **for them** (edge first-chunk cache,
antd pin, rendition ladder, faststart remux): each is operator-side custody.

## What the evidence says (7-agent research → 3 drafts → skeptical judge)
Limits:
- This sandbox is egress-blocked for ants.tube, skaists.dev and discord. Nothing
  below is measured against the ants.tube video itself.
- Anything marked UNVERIFIED is exactly that.

1. **8K bitrate.** YouTube's 8K SDR upload guidance is 80-160 Mbps at 24-30 fps
   (support.google.com/youtube/answer/1722171, via search snippet). Delivered
   AV1/HEVC 8K is about 50 Mbps or more. The codec and bitrate of `aa0272e6…` are
   **UNVERIFIED**.
2. **Browser-direct throughput is young.** The ant-client PR #186 staging run shows
   a per-download p50 of 1.24 MiB/s, about 10.4 Mbit/s. ant-node PR #220 staging
   took 96.6 s over WASM against 15.5 s native for 20 MB. Both merged 2026-09-22
   (github.com/WithAutonomi/ant-client/pull/186, /ant-node/pull/220). These are
   staging numbers, not mainnet.
3. **Chunks.** Self-encryption chunks are at most 4,190,208 bytes, so 80-160 Mbps
   means sustaining about 2.4-4.8 verified chunk fetches every second.
4. **Decode is the viewer's own wall.** Many devices cannot decode 8K smoothly at
   any bandwidth:
   - NVDEC H.264 has long been capped at 4096²; Blackwell adds 8K H.264.
   - Safari on Mac tops out at 4K on YouTube.
   - Only M3+ Macs have hardware AV1 decode.
   - Software AV1 8K60 drops frames.

   (Search snippets and secondary sources.) `MediaCapabilities.decodingInfo()`
   answers `smooth` = "without dropping frames" (w3c/media-capabilities index.bs),
   and a static site can call it before spending a byte.
5. **ants.tube itself:** there is no public indexed information about it. Our
   2026-09-21 dispatch recorded it on Devnet. Whether it reads mainnet today is
   **UNVERIFIED**.

**Conclusion:** the slowness is mostly physics outside the operator. The file is
roughly 8-15x faster than the measured browser-direct median, and it needs a
decoder many viewers lack. Their model does not need fixing to explain that.

## The reply (judge-synthesized; founder posts it or not)
> fair, that's a clean line and i respect it. network carries it, operator stays
> out. not re-pitching proxies or re-encodes.
>
> for scale: youtube's 8K upload guidance is ~80-160 Mbps, and the browser-direct
> testnet median i've seen is ~10 Mbit/s. plenty of devices can't decode 8K
> smoothly either. so the wall may be the path or the viewer's decoder, not the
> site.
>
> one no-strings offer: if that address resolves from our side, we pull it and
> post plain numbers: codec, bitrate, faststart or not, and the MB/s we got
> (labelled, since ours isn't browser webrtc). once the codec's known, any browser
> can check itself with MediaCapabilities before spending bandwidth.
>
> we also run a small autonomi node. that's general capacity, not a fix for that
> one file. want the numbers?

**The judge struck these from the drafts:**
- "giving our node more room". A fence resize is a FOUNDER RULING
  (`ops/ant-node/fence.md`).
- "opening a port so ants.tube viewers reach it". A new inbound port is a founder
  gesture, and whether `ant` 0.3.6 can pin `--webrtc-port` is UNVERIFIED.
- "nothing to audit". That over-reads Shu.
- An unconditional "we pull it". Devnet is possible.
- Any hint that bViEw's Blob technique plays 8K smoothly. It does not:
  `PLAY_MIN` = 12 MiB (`surfaces/bview.html:147`) is about 1-2 s of 8K, and there
  is no MSE.

## What the estate can do, each with its gate
1. **Measure `aa0272e6…` read-only** and post codec, resolution, bitrate, duration,
   faststart, size and our MB/s, labelled "native, not browser WebRTC".
   - Prefer a native CLI read over the door, so that
     `ops/ant-node/first-chunk-cache.mjs` does not keep 2 MiB of a third party's
     file on our disk.
   - If it does not resolve, say so.
   - GATE: a seat with network (box or laptop). Read-only.
2. **Re-measure our node** with `docs/runbooks/autonomi-observe.sh`: the version
   (did it auto-upgrade to 0.19/0.20 and gain the #220 WebRTC listener?), PUT
   refusal, and `df` on `/` and `/mnt/ant-store`.
   - The last receipt, 2026-09-12, showed the fence 93% full, PUTs refused, and
     root at 8.4G, below the 10G floor.
   - The "31GB free" figure is from 2026-08-29 and is stale.
   - GATE: box seat, read-only. This comes before any capacity claim.
3. **Founder decisions, only after disk recovery:**
   - (a) Grow node capacity with a fence resize or an OCI block volume.
   - (b) Make the node browser-reachable: pin the WebRTC port, add an iptables
     INPUT door and `netfilter-persistent save`, a possible OCI UDP rule, and the
     `ops/` change in the same commit.

   GATE: FOUNDER. It is only worth doing if ants.tube reads the same network.
4. **Community:** encourage people to run their own nodes (the
   `surfaces/bantfarm.html` pattern), framed as participation, not revenue. This
   is the operator-respecting way to lighten "the network's burden".
5. **Offer client-only code only if invited:** a `decodingInfo()` precheck plus a
   live MB/s meter. GATE: their invitation, **and** resolving our license mismatch
   first. `LICENSE` is Apache-2.0 text, while `README.md:11,126` and
   `docs/LICENSING.md` say AGPL-3.0-only (verified this session).
6. **Our own lane (bViEw):**
   - Replace the fixed 12 MiB `PLAY_MIN` with a seconds-based threshold
     (size / moov duration), or MSE.
   - Add a `decodingInfo()` precheck before large fetches.
   - A dead `held`/`SEGMENT` counter sits at `:399` and `:499`.

## Gates and receipts
- No code changed. This dispatch is the only file.
- Network: curl and WebFetch to ants.tube, skaists.dev and discord were refused by
  the sandbox egress proxy (403 CONNECT). WebSearch worked.
- Workflow `wf_83e3d5ec-bd1`: 7 agents (3 research, 3 drafts, 1 judge), 0 errors.
  Drafts scored respect-first 7, viewer-and-network 5, measure-offer 8.
- Not done: any live measurement, anything posted to Discord, any box change.
