/* bchat-cockpit.js — the connection-health strip, projected from the receipt stream.
   There is no second health state machine: every light and every evidence row is a fold
   over the receipts the page already writes (events and references, never contents).
   A light is green only when a receipt proves it; absence of evidence is never green.
   The relay's own words are carried verbatim (e.g. "restricted: not a relay member").
   Timings are application events with their names (dial → open, challenge → AUTH,
   AUTH → OK, EVENT → OK); nothing here pretends to be network ping or packet counts. */
(function (G) {
  'use strict';
  var RESTRICTED = /restricted/i;

  function fold(receipts) {
    var s = {
      key: null, vectors: null, road: 'unknown', roadFrom: '', net: 'online',
      url: '', relay: 'idle', socket: '', dialAt: null, openAt: null, closeAt: null,
      challengeAt: null, authAt: null, authOkAt: null, authOk: null, verdict: '',
      offered: {}, eventOkMs: null, published: 0, received: 0, rejected: 0, refused: 0, lastEvent: ''
    };
    // the page keeps receipts newest first; fold oldest first
    receipts.slice().reverse().forEach(function (r) {
      var t = r.ts;
      switch (r.event) {
        case 'key-armed': s.key = true; break;
        case 'key-forgotten': s.key = false; break;
        case 'vectors-run': s.vectors = { passed: +r.passed || 0, total: +r.total || 0 }; break;
        case 'road-remembered': if (s.roadFrom !== 'probed') { s.road = r.road; s.roadFrom = 'remembered'; } break;
        case 'road-probe': s.road = r.road === 'none' ? 'offline' : r.road; s.roadFrom = 'probed'; break;
        case 'net-offline': s.net = 'offline'; break;
        case 'net-online': s.net = 'online'; break;
        case 'relay-dial':
          s.url = r.ref; s.relay = 'dialling'; s.socket = 'dialling'; s.dialAt = t;
          s.openAt = s.closeAt = s.challengeAt = s.authAt = s.authOkAt = null; s.authOk = null; s.verdict = '';
          if (s.roadFrom !== 'probed' && r.road) { s.road = r.road; s.roadFrom = 'dialled'; }
          break;
        case 'relay-open': s.relay = 'connected'; s.socket = 'open'; s.openAt = t; break;
        case 'nip42-challenge': if (s.relay !== 'restricted') s.relay = 'challenged'; s.challengeAt = t; break;
        case 'nip42-auth': s.authAt = t; break;
        case 'nip42-verdict':
          s.authOk = r.ok === true; s.authOkAt = t; s.verdict = String(r.note || '');
          s.relay = s.authOk ? 'authed' : RESTRICTED.test(s.verdict) ? 'restricted' : 'refused';
          break;
        case 'sub-closed':
          if (r.note) s.verdict = String(r.note);
          if (RESTRICTED.test(s.verdict)) s.relay = 'restricted';
          break;
        case 'dm-offered': s.offered[r.ref] = t; break;
        case 'dm-published':
          s.published++; s.lastEvent = String(r.ref || '');
          if (s.offered[r.ref] != null) s.eventOkMs = t - s.offered[r.ref];
          if (s.relay !== 'restricted') s.relay = 'published';
          break;
        case 'dm-rejected':
          s.rejected++; s.verdict = String(r.note || 'unspecified');
          if (s.offered[r.ref] != null) s.eventOkMs = t - s.offered[r.ref];
          if (RESTRICTED.test(s.verdict)) s.relay = 'restricted';
          break;
        case 'dm-received': s.received++; s.lastEvent = String(r.ref || ''); break;
        case 'dm-refused': s.refused++; break;
        case 'relay-closed': s.socket = 'closed'; s.closeAt = t; if (s.relay !== 'restricted' && s.relay !== 'refused') s.relay = 'closed'; break;
        case 'relay-error': s.socket = 'error'; if (s.relay !== 'restricted' && s.relay !== 'refused') s.relay = 'error'; break;
      }
    });
    return s;
  }

  var ms = function (a, b) { return a != null && b != null ? Math.max(0, b - a) + ' ms' : ''; };
  var dur = function (n) { var x = Math.floor(n / 1000), h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, sec = x % 60; return (h ? h + ':' : '') + (h && m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec; };

  function project(receipts, now) {
    var s = fold(receipts || []);
    now = now == null ? Date.now() : now;
    var L = [];
    L.push(s.key ? { key: 'identity', tone: 'ok', word: '✓ local key armed' }
      : { key: 'identity', tone: 'idle', word: s.key === false ? 'no key · forgotten here' : 'no key yet' });
    var v = s.vectors;
    L.push(v && v.total && v.passed === v.total ? { key: 'crypto', tone: 'ok', word: '✓ NIP-44 vectors passed ' + v.passed + '/' + v.total }
      : v ? { key: 'crypto', tone: 'bad', word: '✗ NIP-44 vectors ' + v.passed + '/' + v.total }
      : { key: 'crypto', tone: 'idle', word: 'vectors not run in this page' });
    if (s.net === 'offline' || s.road === 'offline') L.push({ key: 'road', tone: 'idle', word: 'offline' });
    else if (s.road === 'fallback') L.push({ key: 'road', tone: 'alt', word: '↪ fallback · ' + (s.roadFrom === 'remembered' ? 'remembered' : s.roadFrom) });
    else if (s.road === 'primary' && (s.roadFrom === 'probed' || s.socket === 'open' || s.openAt != null)) L.push({ key: 'road', tone: 'ok', word: '✓ primary' });
    else if (s.road === 'primary') L.push({ key: 'road', tone: 'idle', word: 'primary · not probed' });
    else L.push({ key: 'road', tone: 'idle', word: 'not probed' });
    var R = {
      idle: ['idle', 'not dialled'], dialling: ['idle', 'dialling'], connected: ['idle', 'socket open · not authed'],
      challenged: ['idle', 'challenged · AUTH sent'], authed: ['ok', '✓ authed'], published: ['ok', '✓ published'],
      restricted: ['bad', s.verdict || 'restricted'], refused: ['bad', s.verdict || 'refused'],
      closed: ['idle', 'closed'], error: ['bad', 'socket error']
    }[s.relay];
    L.push({ key: 'relay', tone: R[0], word: R[1] });
    var ev = s.published + s.received;
    L.push(ev ? { key: 'receipt', tone: 'ok', word: '✓ event evidence · ' + ev + (ev === 1 ? ' event' : ' events') }
      : { key: 'receipt', tone: 'idle', word: 'no event evidence yet' });

    var tick = function (at, extra) { return at != null ? '✓' + (extra ? ' · ' + extra : '') : '—'; };
    var info = [
      ['road', s.url ? s.url + ' · ' + (s.road === 'fallback' ? 'fallback' : 'primary') : 'not dialled'],
      ['dialled', tick(s.dialAt)],
      ['socket open', tick(s.openAt, ms(s.dialAt, s.openAt) && 'dial → open ' + ms(s.dialAt, s.openAt))],
      ['NIP-42 challenged', tick(s.challengeAt)],
      ['AUTH answered', tick(s.authAt, ms(s.challengeAt, s.authAt) && 'challenge → AUTH ' + ms(s.challengeAt, s.authAt))],
      ['AUTH verdict', s.authOk == null ? '—' : (s.authOk ? '✓ OK true' : '✗ OK false') + (ms(s.authAt, s.authOkAt) ? ' · AUTH → OK ' + ms(s.authAt, s.authOkAt) : '')],
      ['publication', s.published ? '✓ ' + s.published + ' published' : s.rejected ? '✗ ' + s.rejected + ' rejected' : '—'],
      ['relay verdict', s.verdict || '—'],
      ['EVENT → OK', s.eventOkMs != null ? s.eventOkMs + ' ms · last offer' : '—'],
      ['last event', s.lastEvent ? s.lastEvent.slice(0, 8) + '…' : '—'],
      ['session', s.openAt != null ? dur((s.closeAt != null ? s.closeAt : now) - s.openAt) + (s.closeAt != null ? ' · closed' : ' · open') : '—'],
      ['events', s.published + ' published · ' + s.received + ' received · ' + s.rejected + ' rejected · ' + s.refused + ' refused']
    ];
    return { lights: L, info: info, live: s.socket === 'open' };
  }

  G.BCHATCOCKPIT = { fold: fold, project: project };
})(typeof window !== 'undefined' ? window : globalThis);
