// bdata.js — My Data (bData): the organism-level data surface. Owner of
// file/data policy, audience, automation, preservation and history. bPay is
// the economic organ, invoked only when a data operation needs value; its
// evidence returns here. (UX architecture correction, founder 2026-09-17.)
//
// LAWS HELD HERE:
//  - BEFORE commitment: policy is freely editable (audience/automation/bounds).
//  - AFTER commitment: changing a load-bearing policy CREATES A SUCCESSOR
//    plan requirement ("a new quote is required") — history is appended,
//    never mutated. Yesterday's legitimate operations stay legitimate.
//  - Automation is a first-class dimension: Ask me / Automatic within explicit
//    limits / Never — capabilities-bound, economically bounded.
//  - Unsupported private audiences stay VISIBLY UNAVAILABLE with reasons.
//  - Nothing here can spend; there is no authorization route (the A9c
//    tripwire owns that vocabulary until Phase C's re-ruling).
(function(){
  var T = (window.BNRLanguage && window.BNRLanguage.text) ? window.BNRLanguage.text.bind(window.BNRLanguage) : function(k,f){return f;};
  var LS = 'bdata-v1';
  var st = { inspection:'newbee', automation:{ mode:'ask', boundAnt:'0.5' }, history:[], bridge:'http://127.0.0.1:8807', freshQuote:null, authorization:null, authReviewOpen:false, signing:{ service:'http://127.0.0.1:8808', phase:null, review:null, receipt:null, refusal:null, error:null, settled:null, preflight:null, demoCeremony:false } };
  try { var sv = JSON.parse(localStorage.getItem(LS)||'null'); if (sv && typeof sv==='object') st = Object.assign(st, sv); if(!Array.isArray(st.history)) st.history=[]; if (!st.signing || typeof st.signing!=='object') st.signing = {}; st.signing = Object.assign({ service:'http://127.0.0.1:8808', phase:null, review:null, receipt:null, refusal:null, error:null, settled:null, preflight:null, demoCeremony:false }, st.signing); } catch(e){}
  function save(){ try { localStorage.setItem(LS, JSON.stringify(st)); } catch(e){} }
  window.__bdata = st; // test hook: the gate reads live state directly
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
  function ant(atto){ try{ var n=BigInt(atto), w=n/10n**18n, f=(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,''); return f? w+'.'+f : String(w); }catch(e){ return '?'; } }
  function note(what){ st.history.unshift({ at: new Date().toISOString(), what }); if (st.history.length > 40) st.history.length = 40; save(); }

  var INV = null;    // the reference commitment (machine) — fetched mechanically, never retyped
  var FINV = null;   // the CURRENT founder invoice — the authorization binds THIS lineage

  var UNAVAIL = [
    { id:'only-me', reason:'private-DataMap custody path not yet qualified' },
    { id:'selected-people', reason:'recipient capability/key granting not yet qualified' }
  ];

  function shelf(){
    if (!INV) return '<div class="card law" data-bdata-shelf="empty">' + T('bd.shelf.empty','no data objects registered on this device yet — intake adds them; the Bux community video is the first registered object and loads from the estate reference') + '</div>';
    var d = INV.domain||{}, a = d.artifact||{}, pol = d.policy||{}, aud = pol.audience||{}, line = (INV.lines||[]).filter(function(l){return l.asset==='ANT';})[0];
    var committed = !!(INV.commitment && INV.commitment.digest);
    var h = '<div class="card" data-bdata-object="bux-try-autonomi">';
    h += '<div class="row" style="justify-content:space-between"><div><b>' + esc((d.media&&d.media.title)||a.name) + '</b><div style="font-size:11px;color:var(--dim)">' + esc((d.media&&d.media.creator)||'') + '</div></div><span class="tag">' + T('bd.registered','registered intake') + '</span></div>';
    h += '<div class="row" style="margin-top:8px;gap:6px 18px;font-size:12px;flex-wrap:wrap"><span>' + esc(a.name) + ' · <span data-bdata-bytes="' + a.bytes + '">' + a.bytes.toLocaleString('en-US') + '</span> bytes</span><span class="mono" style="opacity:.7">sha256 ' + esc(String(a.sha256).slice(0,16)) + '…</span></div>';
    /* who can get this — THE ORIGIN (advisor law, 2026-09-17): the desire to
       make something public belongs HERE, in My Data; bPay receives the
       already-resolved operation. Selecting Public is the founder gesture —
       recorded in the SHARED policy key the wallet panel reads at boot, so
       the choice ORIGINATES in My Data and the wallet merely renders it.
       Because a commitment exists, a (re)selection SUPPLANTS — the note below
       states the new-quote law; nothing history-shaped is mutated. */
    var shared = {};
    try { shared = JSON.parse(localStorage.getItem('bpay-policy-v1')||'{}') || {}; } catch(e){}
    var chosenHere = !!(shared.audience === 'public' && shared.selectedAt);
    h += '<div style="margin-top:10px;font-size:12px"><b>' + T('wl.bpay.who','Who can get this?') + '</b> ' + esc(aud.access || pol.access || '') + '</div>';
    h += '<div class="row" style="margin-top:6px;gap:6px">';
    h += '<button type="button" data-bdata-aud="public" class="' + (chosenHere?'on':'') + '" style="' + (chosenHere?'':'background:transparent;color:inherit;') + '">🌐 ' + T('wl.bpay.aud.public','Public') + '</button>';
    UNAVAIL.forEach(function(u){
      h += '<button type="button" class="off" data-bdata-aud="' + u.id + '" data-bdata-unavailable="' + u.id + '" disabled title="' + esc(u.reason) + '">🔒 ' + (u.id==='only-me'?T('wl.bpay.aud.onlyme','Only me'):T('wl.bpay.aud.selected','Selected people')) + '</button>';
    });
    h += '</div>';
    if (chosenHere) {
      h += '<div style="margin-top:6px;font-size:12px">' + T('wl.bpay.youchose','You chose') + ' <b>🌐 ' + T('wl.bpay.aud.public','Public') + '</b> <span style="opacity:.65;font-size:10px">· ' + T('wl.bpay.selectedat','chosen at') + ' ' + String(shared.selectedAt).replace('T',' ').replace(/\.\d+Z$/,' UTC') + '</span> — ' + esc(T('bd.origin.note','this choice originated in My Data; bPay receives the resolved plan and asks only about its economics')) + '</div>';
    } else {
      h += '<div class="law" style="margin-top:6px">' + T('bd.origin.choose','the current binding is the machine reference; choosing Public yourself makes the policy YOURS — the selection is yours to make, here') + '</div>';
    }
    if (committed) h += '<div class="law" style="margin-top:6px" data-bdata-supersede-note="1">' + T('bd.supersede','a carried-quote-set commitment exists — changing the audience changes the preservation plan and requires a new quote; the old plan remains as history') + '</div>';
    else h += '<div class="law" style="margin-top:6px">' + T('bd.freely','no commitment yet — audience is freely adjustable') + '</div>';
    /* ONE PAGE, ONE CONCEPT, ONE CLICK AT A TIME (founder ruling, 2026-09-18:
       'having a clicked button take me to wallet.html is the wrong approach.
       we need simple one concept/click at a time'). The ceremony never leaves
       My Data: choose WHO → ask the PRICE (bPay invoked in place behind the
       button; the answer renders here) → AUTHORIZE later (Phase C, absent by
       law). No navigation. The wallet remains the economics VIEW, not a
       destination. */
    if (line) {
      if (chosenHere) {
        var fq = st.freshQuote;
        h += '<div style="margin-top:14px;padding:14px 16px;border:1px solid #2c4a5a;border-radius:12px">';
        h += '<div style="font-size:13px;font-weight:600;text-align:center">' + T('bd.price.h','What does it cost now?') + '</div>';
        if (!fq) {
          h += '<button type="button" data-bdata-quote-go="1" style="display:block;width:100%;margin-top:10px;padding:14px 16px;border:1px solid #2c4a5a;border-radius:12px;background:#0e2d3a;color:var(--cyan);font-size:16px;font-weight:600;cursor:pointer">➜ ' + T('bd.price.go','Get the storage price') + '</button>';
          h += '<div class="law" style="margin-top:6px;text-align:center" data-bdata-price-hint="1">' + T('bd.price.askingnote','one press asks the live network; it can take up to a minute') + '</div>';
        } else {
          h += '<div style="margin-top:10px;text-align:center"><span style="font-size:26px;font-weight:700" data-bdata-fresh-atto="' + fq.totalAtto + '">' + ant(fq.totalAtto) + ' ANT</span></div>';
          h += '<div class="law" style="margin-top:2px;text-align:center">' + T('bd.price.caused','current price — caused by your choice') + ' · ' + T('wl.bpay.fresh','quote obtained') + ' ' + String(fq.obtainedAt).replace('T',' ').replace(/\.\d+Z$/,' UTC') + '</div>';
          h += '<div class="row" style="margin-top:6px;gap:6px 18px;flex-wrap:wrap;font-size:11px;justify-content:center;opacity:.85"><span data-bdata-quote-obligations="' + fq.count + '">' + fq.count + ' × ' + T('wl.bpay.quotes','chunk quotes') + ' · ' + esc(fq.shape) + '</span><span>⛽ ' + T('wl.bpay.gasside','separate') + ' · Arbitrum ETH</span></div>';
          h += '<div class="law" style="margin-top:4px;text-align:center" data-bdata-nothing-paid="1"><b>' + T('wl.bpay.nothingpaid','Nothing has been paid.') + '</b></div>';
          h += '<div style="margin-top:6px;text-align:center"><button type="button" data-bdata-price-refresh="1" style="padding:5px 12px;border:1px solid #1d4655;border-radius:8px;background:transparent;color:inherit;cursor:pointer;font-size:11px">↻ ' + T('bd.price.refresh','refresh the price') + '</button> <span style="font-size:10px;opacity:.55">' + T('bd.price.cached','cached — shown instantly; a refresh asks the network again') + '</span></div>';
        }
        h += '<div class="law" style="margin-top:8px;text-align:center" id="bdata-price-stat"></div>';
        h += ceremonyRail();
        h += authorizeStep(st.freshQuote);
        h += '<div class="row" style="margin-top:8px;gap:6px 18px;flex-wrap:wrap;font-size:11px;justify-content:center;opacity:.7"><span>' + T('bd.price.reference','reference (machine, not chosen by you)') + ': ' + ant(line.amountAtto) + ' ANT</span></div>';
        h += '</div>';
        h += '<div class="row" data-bdata-bridge-row style="margin-top:6px;gap:8px;align-items:center;display:none"><span style="font-size:11px;opacity:.8">' + T('wl.bpay.bridge','quote service') + ':</span><input id="bdata-bridge" value="' + esc(st.bridge) + '" style="background:#0b1e26;border:1px solid #1d4655;color:inherit;border-radius:6px;padding:3px 8px;font-size:11px;font-family:monospace" /></div>';
      } else {
        h += '<div style="margin-top:14px;padding:14px 16px;border:1px dashed #2c4a5a;border-radius:12px;text-align:center" data-bdata-preserve-waiting="1">';
        h += '<div style="font-size:14px;opacity:.75">' + T('bd.preserve.first','first choose who can get this — then the price is one press away') + '</div>';
        h += '</div>';
      }
    }
    h += '</div>';
    return h;
  }

  function autoCard(){
    var m = st.automation.mode;
    var h = '';
    [['ask', T('bd.auto.ask','Ask me')], ['auto', T('bd.auto.auto','Automatic within limits')], ['never', T('bd.auto.never','Never')]].forEach(function(pair){
      h += '<button type="button" data-bdata-auto="' + pair[0] + '" class="' + (m===pair[0]?'on':'') + '" style="' + (m===pair[0]?'':'background:transparent;color:inherit;') + '">' + pair[1] + '</button> ';
    });
    if (m === 'auto') {
      h += '<span class="row" style="margin-top:8px;gap:8px"><span style="font-size:12px">' + T('bd.auto.bound','each operation at most') + '</span><input id="bdata-bound" type="number" min="0" step="0.000001" value="' + esc(st.automation.boundAnt) + '"> <span style="font-size:12px">ANT</span></span>';
      h += '<div class="law" style="margin-top:4px">' + T('bd.auto.boundnote','an autonomous preserve above the bound is refused — it must ask') + '</div>';
    }
    h += '<div class="law" style="margin-top:6px" data-bdata-auto-mode="' + m + '">' + (m==='ask' ? T('bd.auto.asknote','every economic gesture asks you first — through the surface, never chat') : m==='auto' ? T('bd.auto.autonote','your bees may preserve within the bound you set; capabilities they lack stay unavailable') : T('bd.auto.nevernote','nothing spends unless you press it yourself')) + '</div>';
    return h;
  }

  function cyber(){
    if (!INV) return '';
    var d = INV.domain||{}, a = d.artifact||{}, pol = d.policy||{}, aud = pol.audience||{}, line = (INV.lines||[]).filter(function(l){return l.asset==='ANT';})[0]||{};
    var h = '';
    function S(t, body){ return '<div class="sect"><b>' + t + '</b> — ' + body + '</div>'; }
    h += S('Payload', esc(a.name) + ' · ' + a.bytes.toLocaleString('en-US') + ' bytes · <span class="mono">sha256 ' + esc(a.sha256) + '</span> (the original, never re-encoded)');
    h += S('Audience', 'resolved: <b>' + esc(aud.selected||'public') + '</b> — ' + esc(aud.access || pol.access || '') + ' · ' + T('bd.cyber.audnote','adjustable before commitment; after commitment a change supersedes (new quote), never mutates'));
    h += S('Storage', 'adapter: Autonomi (production network, keyless prepare proven) · deterministic address once stored: <span class="mono">' + esc(d.data_map_address||'—') + '</span> · state: <b style="color:var(--amber)">' + T('bd.cyber.state','NOT STORED — nothing has been paid') + '</b>');
    h += S('Authority', T('bd.cyber.auth','the founder gesture alone changes policy or spends; agents prepare and verify; chat text is never canonical'));
    h += S('Automation', esc(st.automation.mode) + (st.automation.mode==='auto' ? ' (bound ' + esc(st.automation.boundAnt) + ' ANT per operation)' : '') + ' — governs future decisions only');
    h += S('Value', (line.amountAtto ? 'reference commitment <span class="mono">' + esc((INV.commitment&&INV.commitment.digest)||'') + '</span> · ceiling ' + ant(line.amountAtto) + ' ANT' : 'no priced obligation yet') + ' · ' + T('bd.cyber.value','bPay (wallet) holds the obligation when economics are required'));
    h += S('Evidence', T('bd.cyber.evidence','live quote receipt banked in-tree (docs/receipts/); no payment evidence yet — quote ≠ purchased ≠ uploaded ≠ retrieved'));
    h += '<div class="sect"><b>History</b> — <span style="color:var(--dim)">' + T('bd.cyber.hist','append-only policy editions; supersede, never rewrite') + '</span>';
    if (!st.history.length) h += '<div class="hist">—</div>';
    st.history.forEach(function(e){
      h += '<div class="hist" data-bdata-history="1"><span class="mono">' + esc(String(e.at).replace('T',' ').replace(/\.\d+Z$/,' UTC')) + '</span> · ' + esc(e.what) + '</div>';
    });
    h += '</div>';
    return h;
  }

  function render(){
    document.getElementById('shelf').innerHTML = shelf();
    document.getElementById('auto-card').innerHTML = autoCard();
    var insp = document.getElementById('insp');
    insp.innerHTML = ['newbee','raver','cypherpunk'].map(function(r){
      return '<button type="button" data-bdata-insp="' + r + '" class="' + (st.inspection===r?'on':'') + '" style="' + (st.inspection===r?'':'background:transparent;color:inherit;') + 'padding:3px 10px;border-radius:12px;font-size:11px">' + r + '</button>';
    }).join(' ');
    document.getElementById('cyber').innerHTML = cyber();
    document.getElementById('cyber').style.display = (st.inspection==='cypherpunk') ? '' : 'none';
    var bridgeRow = document.querySelector('[data-bdata-bridge-row]');
    if (bridgeRow) bridgeRow.style.display = (st.inspection==='cypherpunk') ? '' : 'none';
    /* the Raver band: object summary is always visible; raver adds nothing yet —
       the anatomy lives in cypherpunk (honest: two useful depths today) */
    bind();
  }

  /* THE PRICE, IN PLACE — bPay invoked behind the button (one concept, one
     click, one page). LATENCY LAW (founder, 2026-09-19: "needs to get close
     to 200ms"): choosing Public IS the trigger — the network ask starts the
     instant the gesture lands, so the ~40-60s physics of re-encrypting and
     re-quoting 204 MB hides behind the decision instead of behind a second
     press; the obtained price is CACHED (renders instantly on every revisit);
     a network flake auto-retries ONCE, honestly labelled, then surfaces the
     manual retry. No spend, no authorization (absent by law). */
  function fetchPrice(isAutoRetry){
    var stat = document.getElementById('bdata-price-stat');
    var pin = INV && INV.domain && INV.domain.artifact ? INV.domain.artifact.sha256 : null;
    if (!pin) { if (stat) stat.textContent = '⚠ ' + T('wl.bpay.loadfail','no invoice loaded'); return; }
    if (stat) stat.textContent = '… ' + T('bd.price.asking','asking Autonomi — up to a minute');
    var go = document.querySelector('[data-bdata-quote-go]');
    if (go) go.disabled = true;
    fetch(st.bridge.replace(/\/$/,'') + '/v1/upload/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifact_sha256: pin, audience: 'public', force_fresh: true })
    }).then(function(r){
      if (!r.ok) return r.text().then(function(t){ throw new Error('HTTP ' + r.status + (t ? ' — ' + t.slice(0,160) : '')); });
      return r.json();
    }).then(function(prepare){
      if (!prepare.policy || prepare.policy.binding.indexOf('founder-selected') !== 0)
        throw new Error(T('bd.price.nobind','the quote service did not bind your selected policy — refused'));
      if (prepare.artifact_sha256 !== pin) throw new Error('artifact mismatch — refused');
      var sum = (prepare.payments||[]).reduce(function(s,p){ return s + BigInt(p.amount_atto); }, 0n).toString();
      if (prepare.total_amount_atto && prepare.total_amount_atto !== sum) throw new Error('quote sum mismatch');
      st.freshQuote = {
        obtainedAt: new Date().toISOString(),
        totalAtto: sum,
        count: (prepare.payments||[]).length,
        shape: prepare.payment_type,
        uploadId: prepare.upload_id,
        payments: (prepare.payments||[]).map(function(p){ return { quote_hash:p.quote_hash, rewards_address:p.rewards_address, amount_atto:p.amount_atto }; })
      };
      save(); render();
    }).catch(function(e){
      var msg = e && e.message ? String(e.message) : 'error';
      // one honest auto-retry on network-shaped failures (the 502/insufficient-peers
      // class the founder hit live); never loops, never hides the failure
      if (!isAutoRetry && /HTTP 5|insufficient peers|network|Failed to fetch/i.test(msg)) {
        if (stat) stat.textContent = '↻ ' + T('bd.price.retry','the network flaked — retrying once…');
        setTimeout(function(){ fetchPrice(true); }, 3000);
        return;
      }
      if (stat) stat.textContent = '⚠ ' + T('bd.price.fail','Autonomi did not answer') + ': ' + msg.slice(0,140);
      var again = document.querySelector('[data-bdata-quote-go]');
      if (again) again.disabled = false;
    });
  }

  function bind(){
    document.querySelectorAll('[data-bdata-insp]').forEach(function(b){
      b.addEventListener('click', function(){ st.inspection = b.dataset.bdataInsp; save(); render(); });
    });
    var quoteGo = document.querySelector('[data-bdata-quote-go]');
    if (quoteGo) quoteGo.addEventListener('click', function(){ fetchPrice(); });
    var priceRefresh = document.querySelector('[data-bdata-price-refresh]');
    if (priceRefresh) priceRefresh.addEventListener('click', function(){ fetchPrice(); });
    var reviewOpen = document.querySelector('[data-bdata-review-open]');
    if (reviewOpen) reviewOpen.addEventListener('click', function(){ st.authReviewOpen = true; render(); });
    var authGo = document.querySelector('[data-bdata-auth-go]');
    if (authGo) authGo.addEventListener('click', authorizePress);
    var authCancel = document.querySelector('[data-bdata-auth-cancel]');
    if (authCancel) authCancel.addEventListener('click', cancelPress);
    var preflightBtn = document.querySelector('[data-bdata-preflight-go]');
    if (preflightBtn) preflightBtn.addEventListener('click', preflightRun);
    var signOpenBtn = document.querySelector('[data-bdata-sign-open]');
    if (signOpenBtn) signOpenBtn.addEventListener('click', signOpen);
    var signGoBtn = document.querySelector('[data-bdata-sign-go]');
    if (signGoBtn) signGoBtn.addEventListener('click', signGo);
    var settleBtn = document.querySelector('[data-bdata-settle-go]');
    if (settleBtn) settleBtn.addEventListener('click', settleGo);
    var bridgeInput = document.getElementById('bdata-bridge');
    if (bridgeInput) bridgeInput.addEventListener('change', function(){ st.bridge = bridgeInput.value.trim() || 'http://127.0.0.1:8807'; save(); });
    /* THE ORIGIN GESTURE — selecting Public in My Data. The click records the
       resolved policy in the SHARED key (the wallet panel reads it at boot and
       renders "You chose Public" — the choice originates here, never there)
       and appends a policy edition to this surface's history. No quote, no
       prepare, no spend: the economics stay bPay's to propose. */
    document.querySelectorAll('[data-bdata-aud="public"]').forEach(function(b){
      b.addEventListener('click', function(){
        var shared = {};
        try { shared = JSON.parse(localStorage.getItem('bpay-policy-v1')||'{}') || {}; } catch(e){}
        if (shared.audience === 'public' && shared.selectedAt) return; // already chosen — no re-record
        shared.audience = 'public';
        shared.selectedAt = new Date().toISOString();
        try { localStorage.setItem('bpay-policy-v1', JSON.stringify(shared)); } catch(e){}
        note(T('bd.hist.audience','audience policy: chosen 🌐 Public by the founder — originated in My Data; supersedes the machine reference binding (new quote required); the reference plan remains as history'));
        render();
        // LATENCY LAW: the gesture IS the trigger — the network ask starts now,
        // hiding the ~40-60s physics behind the decision instead of a second press
        if (!st.freshQuote) fetchPrice();
      });
    });
    document.querySelectorAll('[data-bdata-auto]').forEach(function(b){
      b.addEventListener('click', function(){
        var from = st.automation.mode;
        var to = b.dataset.bdataAuto;
        if (from === to) return;
        st.automation.mode = to;
        save();
        // policy change AFTER operations may exist: append-only history, never rewrite
        note(T('bd.hist.auto','automation policy: ') + from + ' → ' + to + (to==='auto' ? ' (bound ' + st.automation.boundAnt + ' ANT)' : '') + T('bd.hist.fwd',' — governs future decisions; prior operations unchanged'));
        render();
      });
    });
    var bound = document.getElementById('bdata-bound');
    if (bound) bound.addEventListener('change', function(){
      var v = parseFloat(bound.value);
      if (!(v >= 0)) { bound.value = st.automation.boundAnt; return; }
      var from = st.automation.boundAnt;
      st.automation.boundAnt = String(v);
      save();
      note(T('bd.hist.bound','automation bound: ') + from + ' → ' + v + ' ANT' + T('bd.hist.fwd',' — governs future decisions; prior operations unchanged'));
    });
  }

  /* ── THE CEREMONY RAIL (Phase E UX) ────────────────────────────────────────
     The frozen backend states, surfaced as one visible spine so the founder
     always knows where in the ceremony this page is — and what has NOT
     happened yet:
     PREPARED → AUTHORIZATION REVIEW → AUTHORIZED → DEVICE PREFLIGHT →
     SIGNING REVIEW → SIGNED / NOT BROADCAST
     Orientation only — never an affordance (one-concept/one-click law). */
  function ceremonyRail(){
    if (!st.freshQuote) return '';
    var auth = st.authorization, sg = st.signing;
    var authorized = !!(auth && auth.state === 'authorized-for-signing');
    var signed = !!(sg.receipt && sg.receipt.state === 'signed');
    var preflightDone = !!(sg.preflight && sg.preflight.state === 'confirmed');
    var steps = [
      { id:'prepared',    label:T('bd.cer.prepared','prepared'),            done:true },
      { id:'authreview',  label:T('bd.cer.authreview','authorization review'), done:authorized, current:!authorized },
      { id:'authorized',  label:T('bd.cer.authorized','authorized'),        done:authorized },
      { id:'preflight',   label:T('bd.cer.preflight','device preflight'),   done:preflightDone, current:authorized && !preflightDone },
      { id:'signreview',  label:T('bd.cer.signreview','signing review'),    done:signed, current:authorized && preflightDone && !signed },
      { id:'signed',      label:T('bd.cer.signed','SIGNED / NOT BROADCAST'),done:signed, current:signed, terminal:true }
    ];
    var h = '<div class="row" style="margin-top:10px;gap:3px;flex-wrap:wrap" data-bdata-rail="1">';
    steps.forEach(function(s, i){
      var style = 'font-size:9px;letter-spacing:.05em;padding:2px 7px;border-radius:9px;border:1px solid ';
      if (s.done) style += 'var(--line2);color:var(--dim)';
      else if (s.current) style += 'var(--cyan);color:var(--cyan);font-weight:700';
      else style += 'var(--line);color:var(--faint)';
      h += '<span data-bdata-rail-step="' + s.id + '" data-state="' + (s.done?'done':s.current?'current':'future') + '" style="' + style + '">' + (s.done && !s.current ? '✓ ' : (i+1) + ' ') + esc(s.label) + '</span>';
    });
    h += '</div>';
    return h;
  }

  /* ── OBSERVATION A — the harmless device preflight ────────────────────────
     Board ruling (fedb2095): the first real Safe 7 ceremony splits into two
     observations. A proves the PIPE and nothing else — device → transport →
     derived address → a deliberate rejection handled cleanly. It cannot
     spend: no transaction is signed, zero broadcast, by construction.
     Trezor Suite (if used) is named as TRANSPORT INFRASTRUCTURE underneath;
     this page remains the cockpit and the device screen is the truth.
     THE TRANSPORT SEAM: until the hardware lane lands, the device gesture
     here is a labeled SIMULATED rehearsal (estate law: simulated behavior
     is labeled, never implied). When the Safe 7 transport arrives, the same
     seam binds to the real transport receipt — no backend semantics here. */
  function observationA(v){
    var sg = st.signing, pf = sg.preflight;
    var demoTransport = /hot TESTNET key/i.test(String(v.path||'')) || /-DEMO$/.test(String(v.mode||''));
    var transport = demoTransport
      ? T('bd.obs.a.trdemo','hot TESTNET key (demo transport) — the Safe 7 arrives with the hardware lane')
      : T('bd.obs.a.trhw','Trezor Safe 7 — Suite MCP as transport infrastructure underneath; this page stays the cockpit');
    var h = '<div style="margin-top:10px;padding:12px;border:1px solid var(--cyan);border-radius:12px" data-bdata-obs-a="' + (pf ? pf.state : 'idle') + '">';
    h += '<div style="font-size:12px;font-weight:700;color:var(--cyan);letter-spacing:.06em;text-transform:uppercase">🛡 ' + esc(T('bd.obs.a.h','OBSERVATION A — the harmless device preflight')) + '</div>';
    h += '<div class="law" style="margin-top:2px">' + esc(T('bd.obs.a.law','this observation cannot spend — no transaction is signed. It proves the pipe (device → transport → address) and that a refusal is handled cleanly. Zero broadcast, by construction.')) + '</div>';
    h += '<div class="row" style="margin-top:6px;gap:4px 14px;font-size:11px;flex-wrap:wrap"><span>' + esc(transport) + '</span><span class="mono">path ' + esc(String(v.path||'').split(' (')[0]) + '</span></div>';
    if (v.payer) h += '<div class="row" style="margin-top:2px;gap:8px;font-size:11px;flex-wrap:wrap"><span style="color:var(--dim)">' + T('bd.sign.payer','payer expected') + '</span><span class="mono" style="overflow-wrap:anywhere">' + esc(v.payer) + '</span></div>';
    h += '<div class="law" style="margin-top:4px">⚙ ' + esc(T('bd.obs.a.sim','rehearsal — SIMULATED transport until the hardware lane lands; the Safe 7\u2019s own answer is the receipt')) + '</div>';
    if (!pf || pf.state === 'idle') {
      h += '<div style="margin-top:8px;text-align:center"><button type="button" data-bdata-preflight-go="1" style="padding:10px 16px;border:1px solid var(--cyan);border-radius:10px;background:#0e2d3a;color:var(--cyan);font-size:13px;font-weight:600;cursor:pointer">🛡 ' + esc(T('bd.obs.a.go','Run the harmless preflight')) + '</button></div>';
    } else if (pf.state === 'run') {
      h += '<div style="margin-top:8px;font-size:12px;text-align:center;color:var(--cyan)">… ' + esc(T('bd.obs.a.running','asking the device — watch its screen; a confirm or a rejection are both normal answers')) + '</div>';
    } else if (pf.state === 'confirmed') {
      h += '<div style="margin-top:8px;padding:8px 10px;border:1px solid var(--cyan);border-radius:8px;font-size:12px;color:var(--cyan)" data-bdata-preflight-confirmed="1">✓ ' + esc(T('bd.obs.a.confirmed','preflight confirmed — the derived address matches the expected payer')) + (pf.address ? ':<div class="mono" style="margin-top:2px;overflow-wrap:anywhere">' + esc(pf.address) + '</div>' : '') + '</div>';
    } else if (pf.state === 'rejected') {
      h += '<div style="margin-top:8px;padding:8px 10px;border:1px solid var(--cyan);border-radius:8px;font-size:12px;color:var(--cyan)" data-bdata-preflight-rejected="1">✋ <b>' + esc(T('bd.obs.a.rejected','you rejected the preflight on the device — nothing was signed, nothing was sent')) + '</b><div class="law" style="margin-top:2px">' + esc(T('bd.obs.a.normal','a rejection is a normal, user-controlled outcome — nothing failed')) + '</div></div>';
      h += '<div style="margin-top:6px;text-align:center"><button type="button" data-bdata-preflight-go="1" style="padding:8px 14px;border:1px solid var(--cyan);border-radius:10px;background:transparent;color:var(--cyan);cursor:pointer;font-size:12px">🛡 ' + esc(T('bd.obs.a.again','Run the harmless preflight again')) + '</button></div>';
    } else if (pf.state === 'mismatch') {
      h += '<div style="margin-top:8px;padding:8px 10px;border:1px dashed #5a2c2c;border-radius:8px;font-size:12px;color:var(--amber)" data-bdata-preflight-mismatch="1">⚠ ' + esc(T('bd.obs.a.mismatch','the derived address does NOT match the expected payer — a discrepancy, not a failure; do not proceed')) + '</div>';
    }
    h += '</div>';
    return h;
  }

  function preflightRun(){
    var sg = st.signing, v = sg.review;
    if (!v) return;
    sg.preflight = { state:'run', at:new Date().toISOString() };
    save(); render();
    // THE TRANSPORT SEAM (labeled above): a rehearsal today, the Safe 7's own
    // answer when the hardware lane lands. The probe outcome is the device's,
    // never the organ's — and it is never persisted as a signature.
    var answer = (window.__bdataPreflightSim === 'reject') ? 'reject' : 'confirm';
    setTimeout(function(){
      if (answer === 'reject') sg.preflight = { state:'rejected', at:new Date().toISOString() };
      else sg.preflight = { state:'confirmed', address:v.payer || null, at:new Date().toISOString() };
      save(); render();
    }, 700);
  }

  /* ── OBSERVATION B — the two real signatures ──────────────────────────────
     Visually distinct from A on purpose (gold vs cyan, pen vs shield): this
     is the observation that can create value obligations. Before it begins,
     the review shows EXACTLY 2 device signatures and what each signs — the
     count law (1 + ceil(n/256)) stated before any device interaction. */
  function observationB(v){
    var sg = st.signing;
    var confirmed = !!(sg.preflight && sg.preflight.state === 'confirmed');
    var demoTransport = /hot TESTNET key/i.test(String(v.path||'')) || /-DEMO$/.test(String(v.mode||''));
    var h = '<div style="margin-top:10px;padding:12px;border:1px solid var(--gold);border-radius:12px' + (confirmed ? '' : ';opacity:.75') + '"' + (confirmed ? ' data-bdata-sign-review="1"' : '') + ' data-bdata-obs-b="' + (confirmed ? 'open' : 'locked') + '">';
    h += '<div style="font-size:12px;font-weight:700;color:var(--gold);letter-spacing:.06em;text-transform:uppercase">✍ ' + esc(T('bd.obs.b.h','OBSERVATION B — the two real signatures')) + '</div>';
    if (!confirmed) {
      h += '<div class="law" style="margin-top:4px;text-align:center">🔒 ' + esc(T('bd.obs.b.locked','locked — complete Observation A first')) + '</div>';
      h += '</div>';
      return h;
    }
    h += '<div style="margin-top:8px;font-size:13px;font-weight:600;text-align:center">' + T('bd.sign.h','What the Trezor will sign') + '</div>';
    if (v.testnet) h += '<div style="margin-top:6px;padding:6px 8px;border:1px solid var(--gold);border-radius:8px;text-align:center;font-size:11px;font-weight:700;color:var(--gold)" data-bdata-sign-testnet="1">🧪 ' + (v.replica ? T('bd.sign.replica','ARBITRUM-SEPOLIA-SHAPED TESTNET-REPLICA — real Autonomi contract artifacts on a LOCAL ledger; NOT public Arbitrum Sepolia; no real value') : T('bd.sign.tn','ARBITRUM SEPOLIA TESTNET — public testnet; no real value')) + '<br>' + T('bd.sign.tnnote','the Safe 7 arrives with the hardware transport — a hot TESTNET key signs in this proof') + '</div>';
    function rrow(k, vv){ return '<div class="row" style="margin-top:6px;gap:8px;font-size:12px;flex-wrap:wrap"><span style="min-width:110px;color:var(--dim)">' + k + '</span><span class="mono" style="flex:1;min-width:200px;overflow-wrap:anywhere">' + vv + '</span></div>'; }
    h += rrow('artifact', esc(String(v.artifact_sha256).slice(0,16)) + '… · ' + Number(v.artifact_bytes).toLocaleString('en-US') + ' B');
    h += rrow(T('wl.bpay.audience','audience'), '🌐 ' + esc(v.audience) + ' — ' + T('bd.auth.binding','founder-selected, origin My Data'));
    h += rrow(T('bd.auth.invoice','invoice'), esc(String(v.invoice_digest).slice(0,23)) + '…');
    h += rrow(T('bd.sign.job','job / quotes'), esc(v.upload_id) + ' · ' + v.quote_count + ' ' + T('bd.sign.quotes','quotes'));
    h += rrow(T('bd.auth.ceiling','ANT ceiling'), '<b>' + ant(v.ant_ceiling_atto) + ' ANT</b> — ' + T('bd.auth.exact','exact, never above'));
    h += rrow(T('bd.auth.gas','gas'), '⛽ ' + T('bd.sign.gasnote','separate — Arbitrum ETH, worst case per transaction shown at the device'));
    h += rrow(T('bd.sign.contracts','contracts'), 'ANT <span style="overflow-wrap:anywhere">' + esc(v.token) + '</span> · vault <span style="overflow-wrap:anywhere">' + esc(v.vault) + '</span> · chain ' + v.chain_id);
    h += rrow(T('bd.sign.payer','payer'), v.payer ? '<span style="overflow-wrap:anywhere">' + esc(v.payer) + '</span> · ' + esc(String(v.path||'').split(' (')[0]) : T('bd.sign.payerpending','derived from your Trezor at the harmless preflight — the device proves it before anything signs'));
    if (v.plan_hash) h += rrow(T('bd.sign.plan','sealed plan'), esc(String(v.plan_hash).slice(0,23)) + '…');
    /* THE TWO-SIGNATURE MANIFEST — exactly what the mission demands shown
       before B: 2 device signatures, and what each one signs. */
    h += '<div style="margin-top:10px;padding:10px;border:1px dashed var(--gold);border-radius:10px" data-bdata-sig-manifest="1">';
    h += '<div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--gold)">' + esc(T('bd.obs.b.manifest','the two device signatures, before anything signs')) + '</div>';
    h += '<div style="margin-top:6px;font-size:12px"><b>1/2 · ' + esc(T('bd.obs.b.sig1','signature 1 of 2 — ERC-20 approve')) + '</b><div class="law">' + esc(T('bd.obs.b.sig1n','the payment vault may spend exactly the ANT total — bounded, never unlimited')) + '</div><div class="mono" style="font-size:10px;overflow-wrap:anywhere">approve(' + esc(v.vault) + ', ' + ant(v.ant_ceiling_atto) + ' ANT) · ' + esc(T('bd.obs.b.ontoken','on the ANT token')) + ' ' + esc(v.token) + '</div></div>';
    h += '<div style="margin-top:8px;font-size:12px"><b>2/2 · ' + esc(T('bd.obs.b.sig2','signature 2 of 2 — payForQuotes, one call')) + '</b><div class="law">' + esc(T('bd.obs.b.sig2n','carries ALL the quote payments to the vault in a single transaction')) + '</div><div class="mono" style="font-size:10px;overflow-wrap:anywhere">payForQuotes(' + v.quote_count + ' ' + esc(T('bd.sign.quotes','quotes')) + ') · ' + esc(T('bd.obs.b.onvault','on the vault')) + ' ' + esc(v.vault) + ' · ' + esc(T('bd.obs.b.chain','chain')) + ' ' + v.chain_id + '</div></div>';
    h += '<div class="law" style="margin-top:6px"><b>' + v.transaction_count + ' ' + T('bd.sign.expected','expected') + '</b> — ' + (v.transaction_count === 2 ? T('bd.sign.two','1 ERC-20 approve (the vault may spend the exact ANT total) + 1 payForQuotes carrying all quotes') : T('bd.sign.N','see slot list')) + ' · ' + (demoTransport ? esc(T('bd.obs.b.demokey','both signed by the hot TESTNET key in this proof')) : esc(T('bd.obs.b.deviceeach','each appears on the Safe 7 screen — confirm only what matches this review'))) + '</div>';
    h += '</div>';
    h += '<div class="law" style="margin-top:8px;text-align:center"><b>' + T('bd.sign.nobroadcast','SIGNING DOES NOT BROADCAST OR PAY.') + '</b> ' + T('bd.sign.nobroadcastnote','Each transaction appears on the Safe 7 screen; confirm only what matches this review. A refusal is a normal outcome.') + '</div>';
    h += '<div style="margin-top:8px;text-align:center"><button type="button" data-bdata-sign-go="1" style="padding:12px 20px;border:1px solid var(--gold);border-radius:10px;background:#0e2d3a;color:var(--gold);font-size:15px;font-weight:700;cursor:pointer">✍ ' + T('bd.sign.go','Begin device signing') + '</button></div>';
    h += '<div class="law" style="margin-top:4px;text-align:center" id="bdata-sign-stat"></div>';
    h += '</div>';
    return h;
  }

  /* ── THE AUTHORIZATION STEP (Phase C) ──────────────────────────────────────
     One founder-reviewed authorization object, bound to the exact open job and
     invoice lineage, BEFORE any signing path exists. The press creates intent
     only: nothing is signed, nothing is paid, nothing is uploaded — signing is
     Phase E, and it may not begin until a signature succeeds. The bridge
     enforces every binding at creation (digest wall = no silent requote; the
     ceiling is exact; the audience must be the founder-selected one). */
  function authorizeStep(fq){
    if (!fq) return '<div style="margin-top:8px;padding:8px 10px;border:1px dashed #1d4655;border-radius:8px;font-size:11px;color:var(--dim);text-align:center" data-bdata-authorize-next="1">🔒 ' + T('bd.price.next','Authorize — the payment step is not built yet; nothing can be paid from this page') + '</div>';
    var fl = FINV && (FINV.lines||[]).filter(function(l){return l.asset==='ANT';})[0];
    if (!fl || fl.amountAtto !== fq.totalAtto) {
      return '<div style="margin-top:8px;padding:8px 10px;border:1px dashed #1d4655;border-radius:8px;font-size:11px;color:var(--amber);text-align:center" data-bdata-review-stale="1">⚠ ' + T('bd.auth.warncache','your cached price does not match the current invoice — refresh the price first; the authorization binds the live quote, never a stale one') + '</div>';
    }
    var d = FINV.domain||{}, a = d.artifact||{}, aud = d.policy&&d.policy.audience||{};
    var auth = st.authorization;
    var h = '<div style="margin-top:10px;padding:12px;border:1px solid #2c4a5a;border-radius:12px" data-bdata-review="1">';
    if (auth && auth.state === 'authorized-for-signing') {
      h += '<div style="font-size:13px;text-align:center">🔑 ' + T('bd.auth.done','Authorized for signing — nothing signed, nothing paid; signing arrives with Phase E') + '</div>';
      h += '<div class="law" style="text-align:center;margin-top:2px">auth <span class="mono">' + esc(auth.id) + '</span> · ' + T('bd.auth.cancelnote','cancellation is always lawful before a signature exists') + '</div>';
      h += signingStep();
      h += '<div style="margin-top:8px;text-align:center"><button type="button" data-bdata-auth-cancel="1" style="padding:8px 16px;border:1px solid #1d4655;border-radius:8px;background:transparent;color:inherit;cursor:pointer;font-size:13px">✕ ' + T('bd.auth.cancel','Cancel authorization') + '</button></div>';
      h += '</div>';
      return h;
    }
    if (st.authReviewOpen) {
      var rp = reviewPanel();
      if (rp) { h += rp; h += '</div>'; return h; }
    }
    if (auth && auth.state === 'cancelled') {
      h += '<div style="font-size:12px;text-align:center;color:var(--dim)">✕ ' + T('bd.auth.cancelled','Cancelled — no paid or uploaded state exists') + '</div>';
      h += '<div style="margin-top:6px;text-align:center"><button type="button" data-bdata-review-open="1" style="padding:8px 16px;border:1px solid #1d4655;border-radius:8px;background:transparent;color:inherit;cursor:pointer;font-size:12px">' + T('bd.auth.review','Review what you are authorizing') + '</button></div>';
      h += '</div>';
      return h;
    }
    h += '<div style="margin-top:8px;text-align:center"><button type="button" data-bdata-review-open="1" style="padding:12px 16px;border:1px solid #2c4a5a;border-radius:10px;background:#0e2d3a;color:var(--cyan);font-size:15px;font-weight:600;cursor:pointer">➜ ' + T('bd.auth.review','Review what you are authorizing') + '</button></div>';
    h += '</div>';
    return h;
  }

  function reviewPanel(){
    var fq = st.freshQuote; if (!fq || !FINV) return;
    var d = FINV.domain||{}, a = d.artifact||{}, aud = d.policy&&d.policy.audience||{};
    var line = (FINV.lines||[]).filter(function(l){return l.asset==='ANT';})[0];
    var h = '<div style="margin-top:10px;padding:12px;border:1px solid var(--gold);border-radius:12px" data-bdata-review-panel="1">';
    h += '<div style="font-size:13px;font-weight:600;text-align:center">' + T('bd.auth.h','What you are authorizing') + '</div>';
    function row(k, v){ return '<div class="row" style="margin-top:6px;gap:8px;font-size:12px;flex-wrap:wrap"><span style="min-width:110px;color:var(--dim)">' + k + '</span><span class="mono" style="flex:1;min-width:200px">' + v + '</span></div>'; }
    h += row(T('bd.auth.invoice','invoice'), esc((FINV.identity&&FINV.identity.contentDigest)||'') + ' <span style="opacity:.6">(' + T('bd.auth.lineage','lineage') + ': ' + esc(String((FINV.identity&&FINV.identity.priorDigest)||'').slice(0,23)) + '…)</span>');
    h += row('artifact', esc(a.name) + ' · ' + a.bytes.toLocaleString('en-US') + ' B · sha256 ' + esc(String(a.sha256).slice(0,12)) + '…');
    h += row(T('wl.bpay.audience','audience'), '🌐 public — <b>' + T('bd.auth.binding','founder-selected, origin My Data') + '</b>');
    h += row(T('bd.auth.ceiling','ANT ceiling'), '<b>' + ant(line.amountAtto) + ' ANT</b> — ' + T('bd.auth.exact','exact, never above'));
    h += row(T('bd.auth.gas','gas'), '⛽ ' + T('bd.auth.gasnote','separate — Arbitrum ETH, wallet-side at signing; never folded into storage'));
    h += row(T('bd.auth.fresh','freshness'), T('wl.bpay.fresh','quote obtained') + ' ' + String(fq.obtainedAt).replace('T',' ').replace(/\.\d+Z$/,' UTC') + ' · ' + T('bd.auth.singleuse','single-use — a re-quote voids this authorization automatically (the digest wall)'));
    h += '<div style="margin-top:8px;font-size:11px;color:var(--dim)">' + T('bd.auth.stops','stop conditions') + ': ' + ((FINV.authorization&&FINV.authorization.stopConditions)||[T('bd.auth.stopquote','quote set superseded or consumed'),T('bd.auth.stopartifact','artifact identity mismatch')]).map(esc).join(' · ') + '</div>';
    h += '<div class="law" style="margin-top:8px;text-align:center"><b>' + T('wl.bpay.nothingpaid','Nothing has been paid.') + '</b> ' + T('bd.auth.noroute','This press creates a bounded intent to sign — it cannot move value; signing is Phase E and starts only from this authorization.') + '</div>';
    h += '<div style="margin-top:8px;text-align:center"><button type="button" data-bdata-auth-go="1" style="padding:12px 20px;border:1px solid var(--gold);border-radius:10px;background:#0e2d3a;color:var(--gold);font-size:15px;font-weight:700;cursor:pointer">🔑 ' + T('bd.auth.go','I authorize this') + '</button></div>';
    h += '<div class="law" style="margin-top:4px;text-align:center" id="bdata-auth-stat"></div>';
    h += '</div>';
    return h;
  }

  function authorizePress(){
    var stat = document.getElementById('bdata-auth-stat');
    var fq = st.freshQuote; if (!fq || !FINV) return;
    if (stat) stat.textContent = '…';
    var fl = (FINV.lines||[]).filter(function(l){return l.asset==='ANT';})[0];
    fetch(st.bridge.replace(/\/$/,'') + '/v1/authorization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_id: fq.uploadId,
        invoice_digest: FINV.identity.contentDigest,
        commitment_digest: FINV.commitment.digest,
        artifact_sha256: FINV.domain.artifact.sha256,
        artifact_bytes: FINV.domain.artifact.bytes,
        audience: 'public',
        ant_ceiling_atto: fl.amountAtto,
        gas_ceiling: 'separate — wallet-side at signing',
        stop_conditions: (FINV.authorization && FINV.authorization.stopConditions) || [],
        gesture: 'founder press in My Data @ ' + new Date().toISOString()
      })
    }).then(function(r){
      if (!r.ok) return r.text().then(function(t){ throw new Error('HTTP ' + r.status + (t ? ' — ' + t.slice(0,180) : '')); });
      return r.json();
    }).then(function(rec){
      st.authorization = { id: rec.authorization_id, state: rec.state };
      st.authReviewOpen = false;
      save();
      note(T('bd.hist.auth','authorization ') + rec.authorization_id + ' — ' + T('bd.hist.authnote','founder press in My Data; authorized-for-signing; nothing signed/paid/uploaded'));
      render();
    }).catch(function(e){
      if (stat) stat.textContent = '⚠ ' + (e && e.message ? String(e.message).slice(0,180) : 'error');
    });
  }

  function cancelPress(){
    if (!st.authorization || !st.authorization.id) return;
    fetch(st.bridge.replace(/\/$/,'') + '/v1/authorization/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorization_id: st.authorization.id })
    }).then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
   .then(function(rec){
      st.authorization = { id: rec.authorization_id, state: rec.state };
      st.authReviewOpen = false;
      save();
      note(T('bd.hist.authcancel','authorization ') + rec.authorization_id + ' — ' + T('bd.hist.authcancelnote','cancelled by the founder before any signature existed; no paid or uploaded state exists'));
      render();
    }).catch(function(e){
      console.error('bdata cancel error', e && e.message); // surfaced, never swallowed
      var stat = document.getElementById('bdata-auth-stat');
      if (stat) stat.textContent = '⚠ ' + String(e && e.message || e).slice(0,160);
    });
  }

  /* ── THE SIGNING STEP (Phase E) ────────────────────────────────────────────
     From the completed authorization to a LOCALLY VERIFIED signature on the
     founder's Trezor — and a hard STOP. The signing cockpit service (local,
     default :8808) enforces every binding BEFORE the device is asked, and
     verifies every device result through the watchpay wall before the UI may
     say SIGNED. Signing does NOT broadcast, does NOT pay, does NOT upload.
     The one-press law: exactly one primary affordance at each moment; a
     refusal names its law; there is no automatic retry after dispatch. */
  function signPayments(){
    var fq = st.freshQuote;
    if (!fq || !fq.payments || !fq.payments.length) return null;
    return fq.payments;
  }
  function signingStep(){
    var auth = st.authorization, sg = st.signing;
    if (!auth || auth.state !== 'authorized-for-signing') return '';
    // TERMINAL: SIGNED — the phase's success state. Unmistakable by law:
    // NOT BROADCAST · NOT PAID · NOT UPLOADED, the broadcast step visibly
    // LOCKED (never hidden), the receipt offered for inspection BEFORE any
    // further gesture, and — during a real Safe 7 ceremony — NO settlement
    // action of any kind (settlement exists only under a TESTNET receipt
    // born from the hot-key demo, the banked pipeline proof).
    if (sg.receipt && sg.receipt.state === 'signed') {
      var r = sg.receipt;
      var h = '<div style="margin-top:10px;padding:12px;border:1px solid var(--gold);border-radius:12px" data-bdata-signed="1">';
      h += '<div style="font-size:14px;font-weight:700;text-align:center;color:var(--gold)">✍ ' + T('bd.sign.signed','SIGNED — verified locally') + '</div>';
      (r.slots||[]).forEach(function(s){
        h += '<div class="row" style="margin-top:6px;gap:8px;font-size:12px;flex-wrap:wrap"><span style="min-width:110px;color:var(--dim)">' + s.slot + ' · ' + esc(s.operation) + '</span><span class="mono" style="flex:1;min-width:200px;overflow-wrap:anywhere">' + esc(s.tx_hash) + '</span></div>';
      });
      h += '<div class="row" style="margin-top:6px;gap:8px;font-size:12px"><span style="min-width:110px;color:var(--dim)">' + T('bd.sign.signer','verified signer') + '</span><span class="mono" style="overflow-wrap:anywhere">' + esc((r.slots&&r.slots[0]&&r.slots[0].signer)||r.payer||'') + '</span></div>';
      if (r.testnet) h += '<div style="margin-top:6px;padding:5px 8px;border:1px solid var(--gold);border-radius:8px;text-align:center;font-size:10px;font-weight:700;color:var(--gold)" data-bdata-receipt-testnet="1">🧪 ' + (r.replica ? 'TESTNET-REPLICA receipt (local ledger, real artifacts — NOT public Sepolia)' : 'TESTNET receipt (public Arbitrum Sepolia)') + '</div>';
      h += '<div style="margin-top:8px;padding:9px 10px;border:2px solid var(--amber);border-radius:10px;text-align:center;font-size:13px;font-weight:700;color:var(--amber)" data-bdata-notbroadcast="1">' + T('bd.sign.stops','NOT BROADCAST · NOT PAID · NOT UPLOADED.') + '</div>';
      h += '<div class="law" style="margin-top:4px;text-align:center">' + T('bd.sign.stopsnote','Signing ends here. Broadcast is a separate founder-authorized phase — locked, not hidden.') + ' ' + T('bd.sign.inspect','Inspect this receipt before anything else happens.') + '</div>';
      h += '<div class="row" style="margin-top:6px;gap:6px;justify-content:center;flex-wrap:wrap"><span class="tag" data-bdata-broadcast-locked="1" style="border-color:var(--line2);color:var(--dim)">⏸ ' + T('bd.sign.broadcastlocked','broadcast — a separate founder-authorized phase · locked') + '</span></div>';
      if (r.testnet && sg.demoCeremony) {
        if (sg.settled) {
          h += '<div style="margin-top:8px;padding:8px;border:1px solid var(--gold);border-radius:8px;font-size:12px" data-bdata-settled="1">🧪 <b>' + (r.replica ? T('bd.sign.settledreplica','SETTLED ON THE TESTNET-REPLICA') : T('bd.sign.settled','SETTLED ON TESTNET')) + '</b> — ' + (r.replica ? T('bd.sign.settlednotereplica','both transactions confirmed on the Arbitrum-Sepolia-shaped REPLICA ledger (real Autonomi artifacts, local chain 421614 — NOT public Sepolia); the pipeline is proven end to end; MAINNET UNTOUCHED') : T('bd.sign.settlednote','both transactions confirmed on the Arbitrum Sepolia TESTNET ledger; the pipeline is proven end to end; MAINNET UNTOUCHED')) + '<div class="mono" style="margin-top:4px;overflow-wrap:anywhere">' + (sg.settled.transactions||[]).map(function(t){return t.tx_hash;}).join('<br>') + '</div></div>';
        } else {
          h += '<div style="margin-top:8px;text-align:center"><button type="button" data-bdata-settle-go="1" style="padding:10px 16px;border:1px solid var(--gold);border-radius:10px;background:#0e2d3a;color:var(--gold);font-size:13px;font-weight:600;cursor:pointer">🧪 ' + T('bd.sign.settle','Settle on TESTNET (pipeline proof)') + '</button><div class="law" style="margin-top:4px" id="bdata-settle-stat"></div></div>';
        }
      }
      h += '</div>';
      return h;
    }
    // A refusal names its law and stays explicit (no retry button — the law
    // that refused says what must change)
    if (sg.refusal) {
      return '<div style="margin-top:10px;padding:10px 12px;border:1px dashed #5a2c2c;border-radius:12px;font-size:12px;color:var(--amber)" data-bdata-sign-refused="1">⛔ ' + T('bd.sign.refused','Signing refused') + ' — <span class="mono">' + esc(sg.refusal.law) + '</span>: ' + esc(String(sg.refusal.why).slice(0,200)) + '</div>';
    }
    // A DEVICE REJECTION IS A NORMAL, USER-CONTROLLED OUTCOME — never styled
    // as a system failure. The frozen backend reports both classes through
    // the same error envelope; the cockpit classifies by the transport's own
    // words (reject/refuse/cancel/deny), renders the calm panel for the
    // user's deliberate choice, and keeps the amber ⚠ for genuine failures.
    if (sg.error) {
      var userHeldBack = /reject|refus|cancel|denied|deny/i.test(String(sg.error.why||'') + ' ' + String(sg.error.what||''));
      if (userHeldBack) {
        return '<div style="margin-top:10px;padding:10px 12px;border:1px solid var(--cyan);border-radius:12px;font-size:12px;color:var(--cyan)" data-bdata-sign-rejected="1">✋ <b>' + T('bd.sign.rejecth','You rejected this on the device') + '</b> — ' + T('bd.sign.rejectn','nothing was signed, nothing was sent — a rejection is a normal, user-controlled outcome, not a system failure; no automatic retry, begin again only from your own decision') + '</div>' + observationB(sg.review);
      }
      return '<div style="margin-top:10px;padding:10px 12px;border:1px dashed #5a2c2c;border-radius:12px;font-size:12px;color:var(--amber)" data-bdata-sign-error="1">⚠ ' + T('bd.sign.err','Device session ended without a verified signature') + ': ' + esc(String(sg.error.why||sg.error).slice(0,180)) + '<div class="law" style="margin-top:4px">' + T('bd.sign.errlaw','No automatic retry — an uncertain device outcome stays explicit; begin again only from your own decision.') + '</div></div>' + (sg.review ? observationB(sg.review) : '');
    }
    // REVIEW: the two-observation track. A first (harmless), then B (real).
    if (sg.phase === 'review' && sg.review) {
      return observationA(sg.review) + observationB(sg.review);
    }
    if (sg.phase === 'dispatching') {
      return '<div style="margin-top:10px;padding:10px 12px;border:1px solid var(--gold);border-radius:12px;font-size:12px;text-align:center" data-bdata-sign-dispatching="1">✍ ' + T('bd.sign.working','Device session live — watch the Safe 7 screen; this page waits for the verified result') + ' <span id="bdata-sign-stat">…</span></div>';
    }
    if (sg.phase === 'loading') {
      return '<div style="margin-top:10px;padding:10px 12px;border:1px solid #2c4a5a;border-radius:12px;font-size:12px;text-align:center" data-bdata-sign-loading="1">… ' + T('bd.sign.loading','checking every binding law before the device is asked') + '</div>';
    }
    return '<div style="margin-top:8px;text-align:center"><button type="button" data-bdata-sign-open="1" style="padding:12px 16px;border:1px solid #2c4a5a;border-radius:10px;background:#0e2d3a;color:var(--gold);font-size:15px;font-weight:600;cursor:pointer">✍ ' + T('bd.sign.open','Sign with Trezor') + '</button></div>';
  }

  function signBody(){
    var fq = st.freshQuote, ps = signPayments();
    if (!ps) return null;
    return {
      authorization_id: st.authorization && st.authorization.id,
      upload_id: fq.uploadId,
      payments: ps
    };
  }

  function signOpen(){
    var body = signBody();
    if (!body) { render(); return; }
    st.signing.phase = 'loading'; st.signing.refusal = null; st.signing.error = null;
    fetch(st.signing.service.replace(/\/$/,'') + '/v1/sign/state', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
    .then(function(o){
      st.signing.phase = null;
      if (!o.ok) { st.signing.refusal = (o.j && o.j.refusal) || { law:'service', why:'signing service refused' }; }
      else {
        st.signing.review = o.j.review;
        st.signing.phase = 'review';
        st.signing.preflight = null; // a fresh review starts Observation A over
        // THE SETTLEMENT LAW (UX): the settle affordance exists ONLY under a
        // TESTNET receipt born from the hot-key DEMO ceremony (the banked
        // pipeline proof). A real Safe 7 ceremony — the first hardware
        // ceremony included — NEVER shows a settlement action: it ends at
        // SIGNED / NOT BROADCAST, the receipt inspected before any gesture.
        st.signing.demoCeremony = /hot TESTNET key/i.test(String(o.j.review.path||'')) || /-DEMO$/.test(String(o.j.review.mode||''));
      }
      save(); render();
    }).catch(function(e){
      st.signing.phase = null; st.signing.error = { why:'signing service unreachable — ' + String(e && e.message || e).slice(0,120) };
      save(); render();
    });
  }

  function signGo(){
    var stat = document.getElementById('bdata-sign-stat');
    var body = signBody();
    if (!body) return;
    if (!(st.signing.preflight && st.signing.preflight.state === 'confirmed')) { render(); return; } // B is locked until A confirms
    if (stat) stat.textContent = '…';
    st.signing.phase = 'dispatching'; render();
    fetch(st.signing.service.replace(/\/$/,'') + '/v1/sign/begin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, body, { path: "m/44'/60'/0'/0/0" }))
    }).then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
    .then(function(o){
      st.signing.phase = null;
      if (o.ok && o.j.receipt && o.j.receipt.state === 'signed') { st.signing.receipt = o.j.receipt; note(T('bd.hist.signed','SIGNED on Trezor — verified locally; ') + (o.j.receipt.slots||[]).length + ' tx · NOT broadcast/paid/uploaded'); }
      else if (!o.ok && o.j.refusal) { st.signing.refusal = o.j.refusal; }
      else { st.signing.error = { what: o.j && o.j.error, why: (o.j && o.j.why) || 'device session ended without a verified signature' }; }
      save(); render();
    }).catch(function(e){
      st.signing.phase = null;
      st.signing.error = { why: String(e && e.message || e).slice(0,160) };
      console.error('bdata sign error', st.signing.error.why); // surfaced, never swallowed
      save(); render();
    });
  }

  /* Settle on TESTNET — the founder-ordered pipeline proof. Structurally
     testnet-only: the button exists ONLY under a testnet receipt, the
     service refuses any non-testnet receipt, and the organ's receipt
     forever records broadcast:false (this settle is a service-layer
     proof, never an organ act). Mainnet settlement does not exist. */
  function settleGo(){
    var stat = document.getElementById('bdata-settle-stat');
    if (stat) stat.textContent = '… ' + T('bd.sign.settling','sending to the TESTNET ledger — waiting for confirmations');
    fetch(st.signing.service.replace(/\/$/,'') + '/v1/testnet/settle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorization_id: st.authorization && st.authorization.id })
    }).then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
    .then(function(o){
      if (o.ok && o.j.transactions) {
        st.signing.settled = o.j;
        note(T('bd.hist.settled','SETTLED on TESTNET — pipeline proven end to end; mainnet untouched'));
      } else if (stat) {
        stat.textContent = '⛔ ' + String((o.j && o.j.refusal && (o.j.refusal.law + ': ' + o.j.refusal.why)) || o.j.why || 'settled refused').slice(0,180);
      }
      save(); render();
    }).catch(function(e){
      if (stat) stat.textContent = '⚠ ' + String(e && e.message || e).slice(0,140);
      console.error('bdata settle error', e); // surfaced, never swallowed
    });
  }

  fetch('bpay-invoice.json').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
   .then(function(inv){ INV = inv; render(); })
   .catch(function(){ render(); });
  fetch('bpay-invoice-founder.json').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
   .then(function(finv){ FINV = finv; render(); })
   .catch(function(){ /* the authorization step stays locked without the current founder invoice */ render(); });
})();
