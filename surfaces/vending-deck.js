/* vending-deck.js — the value deck's core: pure, no DOM, no network.
   What a minted agent carries, card by card; every card is a DOOR this
   page asks at load, never a stored promise. This file only turns each
   door's real answer into rows and states, so e2e/vending-deck.test.mjs can
   hold it to the sources without a browser.

   Doors (every one cited, every one read live by vending-deck.html):
   - jungle4 `bnrapolltest` tables rates/tithe/config/certs (SPEC-VENDING-2
     §contract) — the same door surfaces/vending.html reads.
   - x0x daemon REST (saorsa-labs/x0x src/server/mod.rs): /health, /groups,
     /groups/:id/members, /groups/:id/messages. The daemon's CorsLayer admits
     LITERAL loopback IP origins only (src/server/auth.rs
     is_allowed_loopback_origin_str: `localhost` rejected), and every route
     sits behind a bearer token (auth_middleware); a short session token is
     minted by POST /auth/session from the durable one.
   - the hive relay's public feed https://relay.skaists.dev/hive/public/
     (docs/dispatches/2026-09-20-read-a-buzz-message.md): index.json +
     <channel>.json, CORS pinned to https://skaists.dev.
   - block/buzz preview-features.json (5 entries; resolveEnabled defaults
     false) — why Workspace and Repos start empty in Buzz.

   Every unknown is a WORD, never 0 and never a dash (skaists law). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.bDeck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── the deck ──────────────────────────────────────────────────────────
     One row per card, in the order they stack. `door` names what is asked;
     `entity` is the skaists colour axis (human / you / ai / biomass / b). */
  var CARDS = [
    { id: 'cert',  door: 'jungle4', entity: 'you',      layer: 1, spec: 'SPEC-VENDING-2 §certificate' },
    { id: 'law',   door: 'jungle4', entity: 'ai',       layer: 3, spec: 'SPEC-VENDING-2 §contract' },
    { id: 'mem',   door: 'gated',   entity: 'you',      layer: 2, spec: 'SPEC-VENDING-2 §memory' },
    { id: 'mesh',  door: 'x0x',     entity: 'ai',       layer: 0, spec: 'docs/dispatches/2026-09-05-x0x-box-mesh.md' },
    { id: 'buzz',  door: 'relay',   entity: 'sovereign', layer: 0, spec: 'docs/dispatches/2026-09-20-read-a-buzz-message.md' },
    { id: 'work',  door: 'manifest', entity: 'ai',      layer: 0, spec: 'block/buzz preview-features.json' },
    { id: 'repos', door: 'static',  entity: 'ai',       layer: 0, spec: 'CLAUDE.md §4 repos' }
  ];

  /* the four states a card can be in. `asking` is the only one with a clock;
     `declined` and `notyet` always carry a reason key — a card is never just
     silent. */
  var STATES = ['asking', 'answered', 'declined', 'notyet'];

  /* the estate's public repositories — the code an agent is built from.
     Public by CLAUDE.md §4; owners as GitHub answers them (read 2026-09-25:
     LOVErnment-DAO lives under skaists, the other two under beehive-nature). */
  var REPOS = [
    { owner: 'beehive-nature', name: 'beehive-nature', what: 'the kernel workspace and the estate surfaces', url: 'https://github.com/beehive-nature/beehive-nature' },
    { owner: 'skaists', name: 'LOVErnment-DAO', what: 'personhood and biometrics specs', url: 'https://github.com/skaists/LOVErnment-DAO' },
    { owner: 'beehive-nature', name: 'b-domain', what: 'the .b registry contract, live at kingbeelovis', url: 'https://github.com/beehive-nature/b-domain' }
  ];

  /* block/buzz preview-features.json at buzz-src (2026-09-07 e1035672) and at
     the installed fork's source (wt-zcode-nip42-r1, 2026-09-18 5031a703):
     the same five ids, all defaulting to off (resolveEnabled: `overrides[id]
     ?? false`). Projects = "Git repository browser and collaboration";
     Workflows = "YAML-defined automations with approval gates". */
  var BUZZ_PREVIEW = ['workflows', 'projects', 'pulse', 'forum', 'agentManagedProfiles'];

  var LOOPBACK_DOOR = 'http://127.0.0.1:12700';   /* ops/x0x/x0xd-laptop.toml api_address */
  var TUNNEL_DOOR = 'http://127.0.0.1:18080';     /* x0x-tunnel.ps1 laptop→box forward */
  var HIVE_GROUP = 'hive-porch';

  function num(v) { var n = typeof v === 'number' ? v : parseFloat(v); return isFinite(n) ? n : null; }

  /* ── jungle4 ─────────────────────────────────────────────────────────── */
  /* rates row: {rail, basis:"0.6000 A", tithe_bp} · tithe row: {percent_bp,
     destination} · config row: {admin, max_certs, certs_count, spec} — the
     field names as jungle4 bnrapolltest answers them (read 2026-09-25).
     Returns null for anything not read. */
  function law(rates, tithe, config) {
    var rows = (rates && rates.rows) || [];
    var row = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].rail === 'vaulta') { row = rows[i]; break; }
    if (!row && rows.length) row = rows[0];
    var t = ((tithe && tithe.rows) || [])[0] || null;
    var c = ((config && config.rows) || [])[0] || null;
    var basisA = row && typeof row.basis === 'string' ? num(row.basis.split(' ')[0]) : null;
    return {
      rail: row ? row.rail : null,
      basisA: basisA,
      titheBp: t ? num(t.percent_bp) : null,
      titheDest: t ? String(t.destination) : null,
      maxCerts: c ? num(c.max_certs) : null,
      count: c ? num(c.certs_count != null ? c.certs_count : c.count) : null
    };
  }

  /* certs rows: {id, agent_name, owner, member_key, ar_id, content_hash,
     template_id, tongue, minted} → newest first */
  function certs(table) {
    var name = function (r) { return r && (typeof r.agent_name === 'string' ? r.agent_name : (typeof r.name === 'string' ? r.name : null)); };
    var rows = ((table && table.rows) || []).filter(function (r) { return name(r) !== null; });
    rows = rows.slice().sort(function (a, b) { return String(b.minted || '').localeCompare(String(a.minted || '')); });
    return rows.map(function (r) {
      return { name: name(r), owner: r.owner || null, ar: r.ar_id || null, hash: r.content_hash || null, template: r.template_id || null, minted: r.minted || null };
    });
  }

  /* ── x0x ────────────────────────────────────────────────────────────── */
  /* Whether a page at `origin` may ask a daemon at `door` at all: the
     daemon's CORS predicate admits only literal loopback IPs (127.0.0.0/8,
     [::1]) with an http(s) scheme. `null` (file://) and `localhost` are
     refused by the daemon itself, so the page says so BEFORE asking. */
  function originMayAsk(origin) {
    if (typeof origin !== 'string') return false;
    var m = /^https?:\/\/([^/@]+)$/.exec(origin.trim());
    if (!m) return false;
    var host = m[1].replace(/:\d+$/, '');
    if (host === '[::1]') return true;
    var v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
    return !!v4 && v4[1] === '127';
  }

  /* /health → {status, version, peers, send_ready_peers, degraded_reason?} */
  function health(j) {
    if (!j || typeof j !== 'object') return null;
    return {
      status: typeof j.status === 'string' ? j.status : null,
      version: typeof j.version === 'string' ? j.version : null,
      peers: num(j.peers),
      ready: num(j.send_ready_peers),
      why: typeof j.degraded_reason === 'string' ? j.degraded_reason : null
    };
  }

  /* /groups → {ok, groups:[{group_id, name, description, creator, created_at, member_count}]} */
  function groups(j) {
    var list = (j && Array.isArray(j.groups)) ? j.groups : [];
    return list.filter(function (g) { return g && typeof g.group_id === 'string'; }).map(function (g) {
      return { id: g.group_id, name: typeof g.name === 'string' ? g.name : null, members: num(g.member_count), created: num(g.created_at) };
    });
  }

  function hive(list, name) {
    name = name || HIVE_GROUP;
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return null;
  }

  /* /groups/:id/messages → GroupPublicMessage[] (src/groups/public_message.rs):
     author_agent_id · kind (chat|announcement|delegation, serde tag) · body ·
     timestamp (u64) · signature. Seconds or milliseconds are both seen in the
     wild; anything past 1e12 is milliseconds. Newest last, capped. */
  function messages(j, cap) {
    var list = Array.isArray(j) ? j : (j && (j.messages || j.items)) || [];
    cap = cap || 8;
    var out = list.filter(function (m) { return m && typeof m.body === 'string' && typeof m.author_agent_id === 'string'; })
      .map(function (m) {
        var ts = num(m.timestamp);
        if (ts != null && ts > 1e12) ts = Math.floor(ts / 1000);
        return { who: m.author_agent_id.slice(0, 8), kind: typeof m.kind === 'string' ? m.kind : 'chat', body: m.body, at: ts, sig: typeof m.signature === 'string' ? m.signature.slice(0, 8) : null };
      })
      .sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    return out.slice(-cap);
  }

  /* ── the hive relay's public feed ───────────────────────────────────── */
  /* index.json → {rule, channels:[{id, name}]}; a channel may appear under
     more than one uuid (two "general" rooms are live) — keep every row, the
     uuid is the identity, the name is a label. */
  function rooms(j) {
    var list = (j && Array.isArray(j.channels)) ? j.channels : [];
    return list.filter(function (c) { return c && /^[0-9a-f-]{36}$/.test(String(c.id)); })
      .map(function (c) { return { id: c.id, name: typeof c.name === 'string' ? c.name : null }; });
  }

  function room(list, name) {
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return list[0] || null;
  }

  /* <channel>.json → messages as read.html reads them: {id, pubkey, name,
     content, created_at(s), e_tags|tags}. Newest last, capped. */
  function feed(j, cap) {
    var list = Array.isArray(j) ? j : (j && (j.messages || j.events)) || [];
    cap = cap || 5;
    return list.filter(function (m) { return m && typeof m.content === 'string'; })
      .map(function (m) { return { who: m.name || (m.pubkey ? String(m.pubkey).slice(0, 8) : null), body: m.content, at: num(m.created_at) }; })
      .sort(function (a, b) { return (a.at || 0) - (b.at || 0); })
      .slice(-cap);
  }

  /* ── buzz preview features ──────────────────────────────────────────── */
  /* preview-features.json → the ids that gate the workspace; `on` mirrors
     resolveEnabled: an explicit override wins, else false. */
  function previews(manifest, overrides) {
    var list = (manifest && Array.isArray(manifest.features)) ? manifest.features : [];
    overrides = overrides || {};
    return list.map(function (f) {
      var on = Object.prototype.hasOwnProperty.call(overrides, f.id) ? !!overrides[f.id] : false;
      return { id: f.id, name: f.name, on: on };
    });
  }

  /* ── states and the briefing ────────────────────────────────────────── */
  function state(kind, reason, at) {
    if (STATES.indexOf(kind) < 0) throw new Error('unknown card state: ' + kind);
    if ((kind === 'declined' || kind === 'notyet') && !reason) throw new Error(kind + ' needs a reason');
    return { kind: kind, reason: reason || null, at: at == null ? null : at };
  }

  /* the strip above the stack: derived every time from the cards, never
     stored. {answering, asking, declined, notyet, total} */
  function briefing(states) {
    var out = { answering: 0, asking: 0, declined: 0, notyet: 0, total: 0 };
    Object.keys(states).forEach(function (k) {
      var s = states[k]; if (!s) return; out.total++;
      if (s.kind === 'answered') out.answering++; else if (s.kind === 'asking') out.asking++;
      else if (s.kind === 'declined') out.declined++; else out.notyet++;
    });
    return out;
  }

  /* whole-sentence slots: "{n} of {m}" — word order stays the translator's */
  function fill(sentence, slots) {
    return String(sentence).replace(/\{(\w+)\}/g, function (_, k) {
      return Object.prototype.hasOwnProperty.call(slots, k) ? String(slots[k]) : '{' + k + '}';
    });
  }

  return {
    CARDS: CARDS, STATES: STATES, REPOS: REPOS, BUZZ_PREVIEW: BUZZ_PREVIEW,
    LOOPBACK_DOOR: LOOPBACK_DOOR, TUNNEL_DOOR: TUNNEL_DOOR, HIVE_GROUP: HIVE_GROUP,
    law: law, certs: certs, originMayAsk: originMayAsk, health: health, groups: groups, hive: hive,
    messages: messages, rooms: rooms, room: room, feed: feed, previews: previews,
    state: state, briefing: briefing, fill: fill
  };
});
