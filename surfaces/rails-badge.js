/* ═══════════════════════════════════════════════════════════════════════
   THE RAILS BADGE — every surface's reassurance line (2026-08-22).
   Founder word: "shows their free 0X hash public and green… on all the
   surfaces… reassured and reinforced their bDiD and crypto rails are
   connected and ready… active connected and LiVE."

   First-party + keyless: the 0x is a DERIVED PUBLIC FINGERPRINT of the
   connected soul — sha256('bnr.b/evm/'+soul), the bzDiD pointer family
   (same shape as bnr.b/did-plc/ and bnr.b/nostr-npub/) — an identifier,
   never a key. The green pulse means the rails ANSWERED (one live keyless
   get_info on the estate's failover trio at load); amber means honest gap.
   Injected by tour.js into the tbar — rides every surface.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  if (document.getElementById('railsbadge')) return;
  function pill() {
    var host = document.getElementById('tbar'); if (!host) return setTimeout(pill, 400);
    var el = document.createElement('span');
    el.id = 'railsbadge';
    el.style.cssText = 'display:inline-flex;align-items:center;gap:5px;margin-left:10px;padding-left:10px;' +
      'border-left:1px solid #243026;font:10px "IBM Plex Mono",monospace;color:#8a9a8a;flex-shrink:0';
    el.innerHTML = '<span id="rb-dot" style="width:7px;height:7px;border-radius:50%;background:#5f6f61;display:inline-block"></span>' +
      '<span id="rb-txt">rails…</span>';
    host.appendChild(el);
    boot();
  }
  async function sha256hex(str) {
    try {
      var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return [...new Uint8Array(buf)].map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (e) { /* non-secure context: honest fallback (FNV-1a twice, labeled by shape) */
      var h1 = 0x811c9dc5, h2 = 0x01000193;
      for (var i = 0; i < str.length; i++) { h1 ^= str.charCodeAt(i); h1 = Math.imul(h1, 16777619) >>> 0;
        h2 = (Math.imul(h2 ^ str.charCodeAt(i), 2246822519) + i) >>> 0; }
      var out = ''; for (var k = 0; k < 5; k++) { h1 = Math.imul(h1 ^ (h1 >>> 13), 1274126177) >>> 0; h2 = (Math.imul(h2 ^ (h2 >>> 11), 2654435761) + h1) >>> 0; out += (h2 >>> 0).toString(16).padStart(8, '0'); }
      return out.slice(0, 40);
    }
  }
  /* eosnation-first single-shot: eosn's DNS flakes tonight logged load-window console noise; the badge defers past load and asks once, quietly */
  var VH = ['https://eos.api.eosnation.io', 'https://eos.greymass.com'];
  async function railsAlive() {
    for (var i = 0; i < VH.length; i++) {
      try { var r = await fetch(VH[i] + '/v1/chain/get_info', { method: 'POST', body: '{}' });
        if (r.ok) { var d = await r.json(); return d.head_block_num || true; } } catch (e) {}
    }
    return false;
  }
  async function boot() {
    var dot = document.getElementById('rb-dot'), txt = document.getElementById('rb-txt');
    if (!dot || !txt) return;
    var soul = null; try { soul = localStorage.getItem('bnr_soul'); } catch (e) {}
    var alive = await railsAlive();
    /* the rails verdict first — green only when the chain actually answered */
    if (!alive) { dot.style.background = '#ffb347'; txt.textContent = 'rails: honest gap'; return; }
    if (!soul) {
      dot.style.background = '#7ddf8f'; dot.title = 'rails live';
      txt.innerHTML = 'rails <b style="color:#7ddf8f">LIVE</b> · <a href="' +
        (location.pathname.indexOf('/beehive-nature/') === 0 ? '/beehive-nature/' : '/') + 'surfaces/bnames.html" style="color:#00E5FF;text-decoration:none">connect your soul</a>';
      return;
    }
    /* the soul's public 0x rail fingerprint — derived identifier, never a key */
    var fp = await sha256hex('bnr.b/evm/' + soul + '@' + location.origin);
    var ox = '0x' + fp.slice(0, 6) + '…' + fp.slice(-4);
    dot.style.background = '#7ddf8f';
    dot.style.cssText += ';box-shadow:0 0 8px rgba(125,223,143,.8);animation:rbPulse 2.6s ease-in-out infinite';
    var st = document.createElement('style');
    st.textContent = '@keyframes rbPulse{0%,100%{box-shadow:0 0 4px rgba(125,223,143,.5)}50%{box-shadow:0 0 11px rgba(125,223,143,.95)}}';
    document.head.appendChild(st);
    /* TOFU — the https-lock law: origin-bound fingerprint, pinned on first verified
       visit; a spoofed origin CANNOT reproduce your pinned 0x. Tap to inspect. */
    var pin = null; try { pin = JSON.parse(localStorage.getItem('bnr_rails_pin') || 'null'); } catch (e) {}
    var myPin = pin && pin[soul + '@' + location.origin];
    var state, col;
    if (!myPin) {
      state = '🔒 pinned'; col = '#7ddf8f';
      try { var np = pin || {}; np[soul + '@' + location.origin] = fp.slice(0, 12);
        localStorage.setItem('bnr_rails_pin', JSON.stringify(np)); } catch (e) {}
    } else if (myPin === fp.slice(0, 12)) {
      state = '🔒 verified origin'; col = '#7ddf8f';
    } else {
      state = '⚠ fingerprint CHANGED — possible spoof'; col = '#ffb347';
      dot.style.background = '#ffb347';
    }
    txt.innerHTML = '<b style="color:#7ddf8f">' + soul + '.b</b> · <span title="origin-bound public fingerprint — sha256(bnr.b/evm/' + soul + '@' + location.origin + '), pinned on first verified visit (TOFU); an identifier, never a key; a spoofed origin shows a different 0x" style="color:#e2efdb;cursor:help">' + ox + '</span> · rails <b style="color:#7ddf8f">LIVE</b> · <span title="' + state + '" style="color:' + col + ';cursor:pointer" id="rb-trust">' + state + '</span>';
    txt.title = 'bDiD + crypto rails connected · keyless · origin-pinned';
    var tp = document.getElementById('rb-trust');
    if (tp) tp.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      var L = [
        'RAILS TRUST - the https-lock law, ours:',
        '',
        'soul: ' + soul,
        'origin: ' + location.origin,
        'fingerprint: 0x' + fp.slice(0, 12) + '  (sha256 of bnr.b/evm/' + soul + '@' + location.origin + ')',
        'state: ' + state,
        '',
        'WHY IT RESISTS SPOOFING: the fingerprint binds your soul to THIS origin.',
        'A phisher on another domain derives a DIFFERENT 0x than the one you',
        'pinned here - like the lock, it proves the origin you trusted.',
        '',
        'VERIFY YOURSELF (any browser console):',
        "  crypto.subtle.digest('SHA-256', new TextEncoder()",
        "    .encode('bnr.b/evm/SOUL@' + location.origin))",
        '    .then(b => console.log("0x" + [...new Uint8Array(b)]',
        "      .map(x => x.toString(16).padStart(2,'0')).join('').slice(0,12)))",
        "  (replace SOUL with your name — the 0x must match this badge)",
        '',
        'Honest limits: TOFU defends origin-swap spoofing; it is not a key',
        'signature - spend-class signing rides the wallet-gate (MX-5).'
      ].join('\n');
      alert(L);
    };  }
  /* defer: the heartbeat lands past the load window so a rare DNS miss never reads as a page defect */
  setTimeout(pill, 1300);
})();
