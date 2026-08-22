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
    '#adOrb{position:fixed;left:18px;bottom:18px;z-index:9990;width:52px;height:52px;border-radius:50%;',
    '  background:radial-gradient(circle at 35% 30%,#3a2e08,#1a1405);border:1.5px solid #FFD700;color:#FFD700;',
    '  font-size:22px;cursor:pointer;display:grid;place-items:center;' + (reduce ? '' : 'animation:adPulse 3.4s ease-in-out infinite;'),
    '  transition:transform .2s} #adOrb:hover{transform:scale(1.09)}',
    '#adWin{position:fixed;left:18px;bottom:82px;z-index:9991;width:min(440px,calc(100vw - 36px));max-height:min(600px,72vh);',
    '  display:none;flex-direction:column;background:#0a0f0b;border:1px solid #243026;border-radius:14px;overflow:hidden;',
    '  box-shadow:0 14px 44px rgba(0,0,0,.55)} #adWin.on{display:flex;' + (reduce ? '' : 'animation:adIn .32s cubic-bezier(.2,.9,.3,1)') + '}',
    '#adHead{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #243026;background:#0e1611}',
    '#adHead .t{font:11px \'IBM Plex Mono\',monospace;color:#FFD700;letter-spacing:.08em}',
    '#adHead .x{margin-left:auto;background:none;border:none;color:#8a9a8a;font-size:15px;cursor:pointer}',
    '#adAgents{display:flex;gap:5px;flex-wrap:wrap;padding:9px 12px;border-bottom:1px solid #243026}',
    '.adAg{background:#101a14;border:1px solid #243026;border-radius:99px;color:#8a9a8a;cursor:pointer;',
    '  font:10px \'IBM Plex Mono\',monospace;padding:4px 11px;transition:all .18s} .adAg:hover{color:#00E5FF;border-color:#00E5FF}',
    '.adAg[aria-pressed="true"]{color:#FFD700;border-color:#FFD700;box-shadow:0 0 10px rgba(255,215,0,.22)}',
    '#adBody{flex:1;overflow:auto;min-height:120px}',
    '#adBody iframe{width:100%;height:460px;border:none;background:#07090b}',
    '.adPanel{padding:12px 14px;font:11px/1.75 \'IBM Plex Mono\',monospace;color:#8a9a8a}',
    '.adPanel b{color:#e2efdb} .adPanel a{color:#00E5FF;text-decoration:none}',
    '#adFoot{display:flex;gap:7px;padding:9px 12px;border-top:1px solid #243026}',
    '#adPrompt{flex:1;background:#0d1a15;border:1px solid #243026;border-radius:8px;color:#e2efdb;',
    '  font:11.5px \'IBM Plex Mono\',monospace;padding:8px 10px;outline:none} #adPrompt:focus{border-color:#FFD700}',
    '#adSend{background:#26123a;color:#c9a0ff;border:1px solid #243026;border-radius:8px;cursor:pointer;',
    '  font:11px \'IBM Plex Mono\',monospace;padding:8px 13px} #adSend:hover{background:#c9a0ff;color:#000}'
  ].join('\n');
  document.head.appendChild(css);

  var orb = document.createElement('button');
  orb.id = 'adOrb'; orb.title = '⚙ the machine — Alt+/ summon · Alt+1..4 switch AIs · double-click to hide';
orb.textContent = '⚙';
  var win = document.createElement('div');
  win.id = 'adWin';
  win.innerHTML =
    '<div id="adHead"><span class="t">🐝 the agent dock</span><button class="x" title="close">✕</button></div>' +
    '<div id="adAgents"></div>' +
    '<div id="adBody"></div>' +
    '<div id="adFoot"><input id="adPrompt" placeholder="ask the agents — or type /help"><button id="adSend">send</button></div>';
  document.body.appendChild(orb); document.body.appendChild(win);

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

  function render() {
    var body = win.querySelector('#adBody');
    var a = AGENTS.filter(function (x) { return x.id === cur; })[0];
    if (a.kind === 'iframe') {
      body.innerHTML = '<iframe src="' + a.src + '" title="' + a.chip + '"></iframe>';
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

  orb.onclick = function () { win.classList.toggle('on'); if (win.classList.contains('on')) win.querySelector('#adPrompt').focus(); };

  /* ── mobile laws (no Alt keys down here): tap summons; LONG-PRESS the ⚙ hides the
     machine to its whisper; tap the whisper to summon again; the agent chips are
     touch-native quick-switch. The anchor-app (PWA) carries all of it standalone. ── */
  var lpTimer = null, lpFired = false;
  orb.addEventListener('touchstart', function (e) {
    lpFired = false;
    lpTimer = setTimeout(function () {
      lpFired = true; hidden = true;
      orb.style.opacity = '.35'; orb.style.transform = 'scale(.6)';
      win.classList.remove('on');
      orb.title = '⚙ hidden — tap the whisper to summon';
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch (err) {} }
    }, 520);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) {
    orb.addEventListener(ev, function () { clearTimeout(lpTimer); }, { passive: true });
  });
  orb.addEventListener('click', function () {
    if (lpFired) { lpFired = false; return; } /* the long-press already acted */
    if (hidden) { unhide(); }
  });
  win.querySelector('.x').onclick = function () { win.classList.remove('on'); };
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
    win.classList.remove('on');
    orb.title = '⚙ hidden — Alt+H to summon the machine';
  });
  function unhide() { hidden = false; orb.style.opacity = ''; orb.style.transform = '';
    orb.title = '⚙ the machine — Alt+/ summon · Alt+1..4 switch AIs · double-click to hide'; }
  function switchAgent(i) {
    var chips = agentsEl.querySelectorAll('.adAg');
    if (chips[i]) chips[i].click();
    if (!win.classList.contains('on')) win.classList.add('on');
  }
  document.addEventListener('keydown', function (e) {
    if (!e.altKey) return;
    if (e.key === '/' || e.key.toLowerCase() === 'm') { e.preventDefault();
      if (hidden) { unhide(); win.classList.add('on'); win.querySelector('#adPrompt').focus(); }
      else { win.classList.toggle('on'); if (win.classList.contains('on')) win.querySelector('#adPrompt').focus(); } }
    else if (e.key.toLowerCase() === 'h') { e.preventDefault(); unhide(); win.classList.add('on'); }
    else if (['1','2','3','4'].indexOf(e.key) >= 0) { e.preventDefault(); if (hidden) unhide(); switchAgent(+e.key - 1); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && win.classList.contains('on')) win.classList.remove('on');
  });
  /* the whisper hint rides the /help panel */
  var origRender = render;
})();
