/* ant-transport.js — the WebRTC Direct dial funnel, measured in this browser.
   The Autonomi browser SDK dials storage nodes over certificate-pinned WebRTC Direct. Its own
   lookup code says a third to a half of the endpoints it finds on mainnet time out when dialled.
   This file counts that here, from the browser's own RTCPeerConnection events, for every dial:
     dial → ICE connected → DTLS connected → data channel open → first answer → bytes
   It wraps the constructor once, before the SDK loads; the SDK resolves RTCPeerConnection at each
   dial, so every dial is seen. Nothing leaves the device and no endpoint address is exposed: the
   address is kept in memory only to tell endpoints apart. Lookup rounds are not visible from here
   (the frames are the SDK's own), so they are not counted. */
(function () {
  'use strict';
  var Native = window.RTCPeerConnection;
  if (!Native || window.__antTransport) return;
  var now = function () { return performance.now(); };
  var dials = [], endpoints = Object.create(null), subs = [], bytes = 0, seq = 0, timer = 0;
  var emit = function () {
    if (timer) return;
    timer = setTimeout(function () { timer = 0; subs.forEach(function (fn) { try { fn(); } catch (e) { /* a reader never breaks a dial */ } }); }, 200);
  };
  // The answer the SDK builds from the advertised multiaddr carries the node's UDP candidate.
  var endpointOf = function (sdp) {
    var c = /a=candidate:\S+ \d+ udp \d+ (\S+) (\d+) typ/i.exec(sdp);
    if (c) return c[1] + ':' + c[2];
    var ip = /^c=IN IP[46] (\S+)/m.exec(sdp), port = /^m=application (\d+)/m.exec(sdp);
    return ip && port ? ip[1] + ':' + port[1] : null;
  };
  var mark = function (d, step) {
    if (d[step] != null || d.end != null) return;
    d[step] = now() - d.t0; d.reached = step;
    var e = step === 'open' && d.ep && endpoints[d.ep];
    if (e) { if (e.dead && !e.opened) e.recovered = true; e.opened++; }
    emit();
  };
  var finish = function (d) {
    if (d.end != null) return;
    d.end = now() - d.t0; d.outcome = d.open != null ? 'opened' : 'dead';
    var e = d.ep && endpoints[d.ep];
    if (e && d.outcome === 'dead') e.dead++;
    emit();
  };
  var track = function (pc) {
    var d = { t0: now(), ep: null, ice: null, dtls: null, open: null, first: null, end: null, bytes: 0, reached: 'dial', outcome: null };
    dials.push(d); seq++; emit();
    var setRemote = pc.setRemoteDescription;
    pc.setRemoteDescription = function (desc) {
      if (!d.ep && desc && desc.sdp) {
        d.ep = endpointOf(desc.sdp);
        if (d.ep && !endpoints[d.ep]) endpoints[d.ep] = { dead: 0, opened: 0, recovered: false };
      }
      return setRemote.apply(pc, arguments);
    };
    pc.addEventListener('iceconnectionstatechange', function () {
      var s = pc.iceConnectionState;
      if (s === 'connected' || s === 'completed') mark(d, 'ice'); else if (s === 'failed') finish(d);
    });
    pc.addEventListener('connectionstatechange', function () {
      var s = pc.connectionState;
      if (s === 'connected') { mark(d, 'ice'); mark(d, 'dtls'); } else if (s === 'failed' || s === 'closed') finish(d);
    });
    var channel = pc.createDataChannel;
    pc.createDataChannel = function () {
      var ch = channel.apply(pc, arguments);
      ch.addEventListener('open', function () { mark(d, 'open'); });
      ch.addEventListener('message', function (e) {
        var x = e.data, n = x == null ? 0 : x.byteLength != null ? x.byteLength : x.size != null ? x.size : String(x).length;
        mark(d, 'first'); d.bytes += n; bytes += n; emit();
      });
      return ch;
    };
    var close = pc.close;
    pc.close = function () { finish(d); return close.apply(pc, arguments); };
  };
  var Wrapped = function RTCPeerConnection(config) {
    var pc = arguments.length ? new Native(config) : new Native();
    try { track(pc); } catch (e) { /* the dial goes on unmeasured */ }
    return pc;
  };
  Wrapped.prototype = Native.prototype;
  Object.setPrototypeOf(Wrapped, Native);
  window.RTCPeerConnection = Wrapped;

  var pct = function (sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : null; };
  // Counts and timings only: no address, no peer id.
  var snapshot = function () {
    var opened = 0, closed = 0, dead = 0, waiting = 0, deadMs = 0, by = { dial: 0, ice: 0, dtls: 0 }, connect = [], answer = [];
    dials.forEach(function (d) {
      if (d.open != null) { opened++; if (d.end != null) closed++; connect.push(d.open); if (d.first != null) answer.push(d.first); }
      else if (d.outcome === 'dead') { dead++; deadMs += d.end; by[d.reached === 'dial' ? 'dial' : d.reached === 'ice' ? 'ice' : 'dtls']++; }
      else waiting++;
    });
    connect.sort(function (a, b) { return a - b; }); answer.sort(function (a, b) { return a - b; });
    var eps = Object.keys(endpoints), reachable = 0, unreachable = 0, recovered = 0;
    eps.forEach(function (k) { var e = endpoints[k]; if (e.opened) reachable++; else if (e.dead) unreachable++; if (e.recovered) recovered++; });
    return {
      dials: seq, opened: opened, closed: closed, dead: dead, waiting: waiting,
      openRate: opened + dead ? opened / (opened + dead) : null,
      endpoints: eps.length, endpointsReachable: reachable, endpointsUnreachable: unreachable, endpointsRecovered: recovered,
      endpointRate: reachable + unreachable ? reachable / (reachable + unreachable) : null,
      deadAt: by, deadMs: deadMs, failedPerOpened: opened ? dead / opened : null,
      connectP50: pct(connect, 0.5), connectP95: pct(connect, 0.95), answerP50: pct(answer, 0.5), answerP95: pct(answer, 0.95),
      bytes: bytes
    };
  };
  window.__antTransport = {
    snapshot: snapshot,
    subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }
  };
})();
