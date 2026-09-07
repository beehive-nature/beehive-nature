/* ═══════════════════════════════════════════════════════════════════════
   THE AGENT DOCK — the estate's agents, one prompt window, any surface.
   Founder word (2026-08-22): "put in heARTh bAiGenTs bQueenBee bLOVErAi
   accessible in all the surfaces (start with wallet/dashboard) with a
   prompt window and agentic to the new standard of quality to match our
   stack."

   First-party only: the agents are OUR surfaces (bqueenbee-live, hearth),
   embedded as iframes; bLOVErAi is the handoff composer pattern; bAigents
   carries its honest weigh-in (the meter exists, the mesh does not — say so).
   Zero third-party anything. Include from any surface:

     <script src="agent-dock.js?v=1"></script>

   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.__agentDock) return; window.__agentDock = true;
  var R = location.pathname.indexOf('/beehive-nature/') === 0 ? '/beehive-nature/surfaces/' : '/surfaces/';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = document.createElement('style');
  css.textContent = [
    '@keyframes adPulse{0%,100%{box-shadow:0 0 10px rgba(255,215,0,.28)}50%{box-shadow:0 0 26px rgba(255,215,0,.62)}}',
    '@keyframes adIn{0%{opacity:0;transform:translateY(18px) scale(.97)}100%{opacity:1;transform:none}}',
    '#adOrb{position:fixed;left:18px;bottom:66px;z-index:9999;width:52px;height:52px;border-radius:50%;',
    '  background:radial-gradient(circle at 35% 30%,#3a2e08,#1a1405);border:1.5px solid #FFD700;color:#FFD700;',
    '  font-size:22px;cursor:pointer;display:grid;place-items:center;' + (reduce ? '' : 'animation:adPulse 3.4s ease-in-out infinite;'),
    '  transition:transform .2s} #adOrb:hover{transform:scale(1.09)}',
    '#adOrb,#adWin,#adWin *{box-sizing:border-box}',
    '#adWin{position:fixed;left:18px;bottom:82px;z-index:9999;width:min(440px,calc(100vw - 36px));height:min(600px,calc(100vh - 100px));min-height:0;',
    '  display:none;flex-direction:column;background:#0a0f0b;border:1px solid #243026;border-radius:14px;overflow:hidden;',
    '  box-shadow:0 14px 44px rgba(0,0,0,.55)} #adWin.on{display:flex;' + (reduce ? '' : 'animation:adIn .32s cubic-bezier(.2,.9,.3,1)') + '}',
    '#adHead{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #243026;background:#0e1611}',
    '#adHead,#adAgents,#adFoot{flex-shrink:0}',
    '#adHead .t{font:14px \'IBM Plex Mono\',monospace;color:#FFD700;letter-spacing:.04em}',
    '#adHead .x{margin-left:auto;background:none;border:none;color:#8a9a8a;font-size:18px;cursor:pointer;min-width:44px;min-height:44px}',
    '#adAgents{display:flex;gap:5px;flex-wrap:wrap;padding:9px 12px;border-bottom:1px solid #243026}',
    '.adAg{background:#101a14;border:1px solid #243026;border-radius:99px;color:#8a9a8a;cursor:pointer;',
    '  font:14px \'IBM Plex Mono\',monospace;min-height:44px;padding:6px 11px;transition:all .18s} .adAg:hover{color:#00E5FF;border-color:#00E5FF}',
    '.adAg[aria-pressed="true"]{color:#FFD700;border-color:#FFD700;box-shadow:0 0 10px rgba(255,215,0,.22)}',
    '#adBody{flex:1;overflow:auto;min-height:0;overscroll-behavior:contain}',
    '#adBody.has-frame{display:flex;flex-direction:column;overflow:hidden}',
    '#adBody iframe{display:block;flex:1;min-height:0;width:100%;height:100%;border:none;background:#07090b}',
    '#adBody.has-frame>.adPanel{flex:none;max-height:45%;overflow:auto}',
    '.adPanel{padding:12px 14px;font:14px/1.75 \'IBM Plex Mono\',monospace;color:#8a9a8a;overflow-wrap:anywhere}',
    '.adPanel b{color:#e2efdb} .adPanel a{color:#00E5FF;text-decoration:none}',
    '#adFoot{display:flex;gap:7px;padding:9px 12px;border-top:1px solid #243026}',
    '#adPrompt{flex:1;min-width:0;background:#0d1a15;border:1px solid #243026;border-radius:8px;color:#e2efdb;',
    '  font:16px \'IBM Plex Mono\',monospace;padding:8px 10px;min-height:44px} #adPrompt:focus{border-color:#FFD700}',
    '#adSend{background:#26123a;color:#c9a0ff;border:1px solid #243026;border-radius:8px;cursor:pointer;',
    '  font:14px \'IBM Plex Mono\',monospace;padding:8px 13px;min-height:44px} #adSend:hover{background:#c9a0ff;color:#000}',
    '#adWin button:focus-visible,#adPrompt:focus-visible,#adOrb:focus-visible{outline:2px solid currentColor;outline-offset:-4px}',
    'body[data-reg=bee] #adOrb{background:#fff;color:#326b39;border-color:#ccd7cf;animation:none;box-shadow:0 2px 12px #18362a18}',
    'body[data-reg=bee] #adWin{color-scheme:light;background:#f6f7f2;color:#18362a;border-color:#ccd7cf;box-shadow:0 12px 36px #18362a26}',
    'body[data-reg=bee] #adHead{background:#fff;border-color:#ccd7cf}',
    'body[data-reg=bee] #adHead .t,body[data-reg=bee] #adHead .x{color:#18362a;font-family:system-ui,-apple-system,sans-serif;letter-spacing:0}',
    'body[data-reg=bee] #adAgents,body[data-reg=bee] #adFoot{border-color:#ccd7cf}',
    'body[data-reg=bee] .adAg,body[data-reg=bee] #adPrompt{font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#18362a;border-color:#ccd7cf}',
    'body[data-reg=bee] .adAg[aria-pressed=true],body[data-reg=bee] #adSend{background:#326b39;color:#fff;border-color:#326b39;box-shadow:none;font-family:system-ui,-apple-system,sans-serif}',
    'body[data-reg=bee] #adPrompt::placeholder{color:#52695b;opacity:1}',
    'body[data-reg=bee] .adPanel{font-family:system-ui,-apple-system,sans-serif;color:#435f4e}',
    'body[data-reg=bee] .adPanel b{color:#18362a}body[data-reg=bee] .adPanel a{color:#29628f;text-decoration:underline}'
  ].join('\n');
  document.head.appendChild(css);

  var orb = document.createElement('button');
  orb.id = 'adOrb'; orb.title = '⚙ the machine — tap to summon · long-press to hide · Alt+/ · Alt+1..4';
  orb.type = 'button';
  orb.setAttribute('aria-label', 'Open the agent dock');
  orb.setAttribute('aria-controls', 'adWin');
  orb.setAttribute('aria-expanded', 'false');
  /* the founder's mobile screenshots caught the complex SVG paths rendering mangled.
     Fix: a simple, universally-safe centered gear — circle + spokes, no path data.
     display:grid + place-items:center on the button guarantees true centering. */
  orb.style.cssText = 'font-size:26px;line-height:1;padding:0;text-align:center;';
  orb.innerHTML = '<span style="display:block;font-size:26px;line-height:1;transform:translateY(-1px)">⚙</span>';
  var win = document.createElement('div');
  win.id = 'adWin';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-labelledby', 'adTitle');
  win.innerHTML =
    '<div id="adHead"><span class="t" id="adTitle">🐝 the agent dock</span><button class="x" type="button" title="close" aria-label="Close the agent dock">✕</button></div>' +
    '<div id="adAgents"></div>' +
    '<div id="adBody"></div>' +
    '<div id="adFoot"><input id="adPrompt" aria-label="Ask the agents" placeholder="ask the agents — or type /help"><button id="adSend" type="button">send</button></div>';
  document.body.appendChild(orb);
  document.body.appendChild(win);
  /* A toolbar only occupies the viewport when it is fixed and visible.
     The front door's in-flow footer can be tall even inside a closed details:
     treating that height as a bottom obstruction pushed the orb above the screen.
     Keep both controls within the viewport, including zoom/keyboard resizing. */
  (function(){
    function fit(){
      var viewport = window.visualViewport;
      var vh = viewport ? viewport.height : window.innerHeight;
      var keyboard = viewport ? Math.max(0, window.innerHeight - vh - viewport.offsetTop) : 0;
      var bar = document.getElementById('tbar');
      var fixed = bar && getComputedStyle(bar).position === 'fixed';
      var rect = fixed ? bar.getBoundingClientRect() : null;
      var h = rect && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
        ? Math.ceil(window.innerHeight - Math.max(0, rect.top)) : 0;
      var floor = bar ? 18 : 66; // preserve the pre-toolbar fail-safe on legacy pages
      var bottom = Math.min(Math.max(floor, h + 10 - keyboard), Math.max(12, vh - 64));
      orb.style.bottom = (keyboard + bottom) + 'px';
      // A very tall expanded toolbar must not leave the dialog unusably short.
      var dialogBottom = Math.min(bottom + 64, Math.max(12, vh * .25));
      win.style.bottom = (keyboard + dialogBottom) + 'px';
      win.style.height = Math.max(0, Math.min(600, vh - dialogBottom - 12)) + 'px';
      if (h) {
        var need = h + 22;
        var cur = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
        if (cur < need) document.body.style.paddingBottom = need + 'px';
      }
    }
    fit();
    addEventListener('resize', fit);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', fit);
      window.visualViewport.addEventListener('scroll', fit);
    }
    /* ResizeObserver refines a bar that already exists; MutationObserver catches
       the bar ARRIVING. The MO must NOT be nested inside a ResizeObserver check —
       a browser without RO would then get no bar-arrival handling at all. */
    var bar = document.getElementById('tbar');
    if (bar && window.ResizeObserver) { new ResizeObserver(fit).observe(bar); }
    if (!bar) {
      var mo = new MutationObserver(function(){
        var b = document.getElementById('tbar');
        if (b) { mo.disconnect(); fit();
                 if (window.ResizeObserver) { new ResizeObserver(fit).observe(b); } }
      });
      mo.observe(document.documentElement, {childList:true, subtree:true});
    }
  })();

  var AGENTS = [
    { id: 'queen', chip: '🐝 bQueenBee', kind: 'iframe', src: R + 'bqueenbee-live.html',
      note: 'the hive\'s machine agent — every answer carries its receipt; 26 tongues, two-way voice.' },
    { id: 'hearth', chip: '🔥 heARTh', kind: 'iframe', src: R + 'blight/hearth.html',
      note: 'co-create with the hive AI — every answer an artifact.' },
    { id: 'baigents', chip: '🤖 bAigents', kind: 'panel',
      note: '<b>the honest weigh-in</b> (the bMeshAsi law): the meter exists and is tested (bmesh-meter 17 · bmesh-ram 17, both chains pinned); the mesh itself — peers, registry, dispatch — does not yet. Shared vRAM rides when it does. <a href="' + R + 'bmeshasi.html" target="_blank" rel="noopener">the exchange ↗</a>' },
    { id: 'bloverai', chip: '💌 bLOVErAi', kind: 'compose',
      note: 'the handoff window — your question composed with our sources, for any AI you already hold. Nothing is sent by this dock.' }
  ];
  var cur = 'queen', convo = [], installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  function metaAnswer(v) {
    if (!/app|install|homescreen|home screen|home-screen/i.test(v)) return null;
    var btn = installEvt
      ? '<button id="adInst" style="background:#26123a;color:#c9a0ff;border:1px solid #243026;border-radius:8px;font:11px IBM Plex Mono,monospace;padding:9px 16px;cursor:pointer;margin-top:8px">📲 install the BNRoSe app now</button>'
      : '';
    return '<div class="adPanel"><b>the machine answers (it lives in the app):</b><br>' +
      'This fleet IS an installable app — first-party, no store.<br><br>' +
      '<b>Android/Chrome:</b> menu ⋮ → <i>Add to Home screen</i> / <i>Install app</i><br>' +
      '<b>iOS/Safari:</b> Share ⬆️ → <i>Add to Home Screen</i><br><br>' +
      'The ⚙ lands on your home screen with the Queen, 26 tongues, the name desk, and your soul connected.' + btn + '</div>';
  }

  var agentsEl = win.querySelector('#adAgents');
  AGENTS.forEach(function (a) {
    var b = document.createElement('button');
    b.className = 'adAg'; b.textContent = a.chip; b.setAttribute('aria-pressed', String(a.id === cur));
    b.onclick = function () { cur = a.id; agentsEl.querySelectorAll('.adAg').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); render(); };
    agentsEl.appendChild(b);
  });

  /* Same-origin embedded reading only; the standalone agent pages keep their
     own presentation. No answers, disclosures or agent capabilities are changed. */
  function syncFrame() {
    var frame = win.querySelector('iframe');
    if (!frame) return;
    try {
      var doc = frame.contentDocument;
      if (!doc || !doc.head) return;
      doc.documentElement.classList.toggle('ad-bee', document.body.getAttribute('data-reg') === 'bee');
      if (doc.getElementById('adReading')) return;
      var style = doc.createElement('style'); style.id = 'adReading';
      style.textContent =
        'html.ad-bee{color-scheme:light;--bg:#f6f7f2;--ink:#18362a;--dim:#435f4e;--line:#ccd7cf;--gold:#326b39;--cyan:#29628f;--violet:#65509a}' +
        'html.ad-bee body{background:var(--bg);color:var(--ink);font:16px/1.7 system-ui,-apple-system,sans-serif;padding:20px 16px}' +
        'html.ad-bee h1{font-size:24px;letter-spacing:0;text-shadow:none}' +
        'html.ad-bee header p,html.ad-bee .law,html.ad-bee .msg,html.ad-bee .note{font-size:16px!important}' +
        'html.ad-bee section,html.ad-bee .msg{background:#fff;color:var(--ink);border-color:var(--line)}' +
        'html.ad-bee section h2,html.ad-bee .machine,html.ad-bee .badge,html.ad-bee footer,html.ad-bee .who,html.ad-bee .msg a{font-size:14px;letter-spacing:0}' +
        'html.ad-bee input,html.ad-bee button{font-family:inherit!important;font-size:16px!important;min-width:0;min-height:44px}' +
        'html.ad-bee input,html.ad-bee #seeds button,html.ad-bee #quick button{background:#fff!important;color:var(--ink)!important;border-color:var(--line)!important}';
      doc.head.appendChild(style);
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    } catch (e) { /* a navigated frame may leave our origin; never reach across it */ }
  }
  document.addEventListener('bregister', syncFrame);

  function render() {
    var body = win.querySelector('#adBody');
    var a = AGENTS.filter(function (x) { return x.id === cur; })[0];
    body.classList.toggle('has-frame', a.kind === 'iframe');
    if (a.kind === 'iframe') {
      body.innerHTML = '<iframe src="' + a.src + '" title="' + a.chip + '"></iframe>';
      body.querySelector('iframe').addEventListener('load', syncFrame);
    } else if (a.kind === 'panel') {
      body.innerHTML = '<div class="adPanel">' + a.note + '</div>';
    } else if (a.kind === 'compose') {
      var out = '<div class="adPanel"><b>bLOVErAi — the handoff composer</b><br>' + a.note + '<br><br>';
      if (convo.length) {
        convo.forEach(function (m) { out += '<span style="color:#5f6f61">you:</span> ' + String(m).replace(/</g, '&lt;') + '<br>'; });
        out += '<br><b>composed handoff (copy — it never leaves your hands):</b><br>"' +
          convo.join(' ; ').replace(/</g, '&lt;') +
          ' — asked via the BNRoSe agent dock; sources are public and re-runnable at github.com/beehive-nature/beehive-nature"';
      }
      body.innerHTML = out + '</div>';
    }
  }
  render();

  function setOpen(open) {
    win.classList.toggle('on', open);
    orb.setAttribute('aria-expanded', String(open));
    orb.setAttribute('aria-label', open ? 'Close the agent dock' : 'Open the agent dock');
    if (open) win.querySelector('#adPrompt').focus();
    else orb.focus();
  }
  orb.onclick = function () {
    if (lpFired) { lpFired = false; return; }
    if (hidden) { unhide(); setOpen(true); }
    else setOpen(!win.classList.contains('on'));
  };

  /* ── mobile laws (no Alt keys down here): tap summons; LONG-PRESS the ⚙ hides the
     machine to its whisper; tap the whisper to summon again; the agent chips are
     touch-native quick-switch. The anchor-app (PWA) carries all of it standalone. ── */
  var lpTimer = null, lpFired = false;
  orb.addEventListener('touchstart', function (e) {
    lpFired = false;
    lpTimer = setTimeout(function () {
      lpFired = true; hidden = true;
      orb.style.opacity = '.35'; orb.style.transform = 'scale(.6)';
      setOpen(false);
      orb.title = '⚙ hidden — tap the whisper to summon';
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch (err) {} }
    }, 520);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) {
    orb.addEventListener(ev, function () { clearTimeout(lpTimer); }, { passive: true });
  });
  win.querySelector('.x').onclick = function () { setOpen(false); };
  function send() {
    var inp = win.querySelector('#adPrompt'); var v = (inp.value || '').trim(); if (!v) return;
    inp.value = '';
    if (v === '/help') { convo = []; render();
      var body = win.querySelector('#adBody');
      body.insertAdjacentHTML('afterbegin', '<div class="adPanel"><b>the dock speaks:</b> I carry four agents. 🐝 answers with receipts (speak any tongue). 🔥 co-creates artifacts. 🤖 tells the mesh truth (meter yes, mesh not yet). 💌 composes handoffs. Agentic actions grow per surface — the wallet floor composes registeracc already. KEYS: Alt+/ summon · Alt+1..4 switch AI · double-click ⚙ hide · Alt+H re-summon · Esc close.</div>');
      return; }
    var meta = metaAnswer(v);
    if (meta) {
      var bodym = win.querySelector('#adBody');
      if (cur === 'queen' || cur === 'hearth') { bodym.innerHTML = meta + bodym.innerHTML; }
      else bodym.innerHTML = meta;
      var ib = win.querySelector('#adInst');
      if (ib) ib.onclick = function () { if (installEvt) { installEvt.prompt(); installEvt = null; } };
      return;
    }
    convo.push(v);
    if (cur === 'bloverai' || cur === 'baigents') render();
    else { var body = win.querySelector('#adBody'); var f = body.querySelector('iframe');
      if (f && f.contentWindow) { try { f.contentWindow.postMessage({ dockPrompt: v }, '*'); } catch (e) {} } }
  }
  win.querySelector('#adSend').onclick = send;
  win.querySelector('#adPrompt').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

  /* ── the machine's laws of motion: summon, hide, switch — with ease ──
     Alt+/ (or Alt+M) toggles the window · Esc closes · double-click the ⚙ hides the
     dock entirely (a whisper-⚙ edge remains) · Alt+1..4 switches AIs instantly ·
     Alt+H re-summons from hidden. Reduced-motion users get the same keys, no motion. */
  var hidden = false;
  orb.addEventListener('dblclick', function () {
    hidden = true; orb.style.opacity = '.35'; orb.style.transform = 'scale(.6)';
    setOpen(false);
    orb.title = '⚙ hidden — Alt+H to summon the machine';
  });
  function unhide() { hidden = false; orb.style.opacity = ''; orb.style.transform = '';
    orb.title = '⚙ the machine — Alt+/ summon · Alt+1..4 switch AIs · double-click to hide'; }
  function switchAgent(i) {
    var chips = agentsEl.querySelectorAll('.adAg');
    if (chips[i]) chips[i].click();
    setOpen(true);
  }
  document.addEventListener('keydown', function (e) {
    if (!e.altKey) return;
    if (e.key === '/' || e.key.toLowerCase() === 'm') { e.preventDefault();
      if (hidden) { unhide(); setOpen(true); }
      else setOpen(!win.classList.contains('on')); }
    else if (e.key.toLowerCase() === 'h') { e.preventDefault(); unhide(); setOpen(true); }
    else if (['1','2','3','4'].indexOf(e.key) >= 0) { e.preventDefault(); if (hidden) unhide(); switchAgent(+e.key - 1); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && win.classList.contains('on')) setOpen(false);
  });
  /* the whisper hint rides the /help panel */
  var origRender = render;
})();
