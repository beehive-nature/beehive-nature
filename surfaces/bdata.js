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
  var st = { inspection:'newbee', automation:{ mode:'ask', boundAnt:'0.5' }, history:[], bridge:'http://127.0.0.1:8807', freshQuote:null };
  try { var sv = JSON.parse(localStorage.getItem(LS)||'null'); if (sv && typeof sv==='object') st = Object.assign(st, sv); if(!Array.isArray(st.history)) st.history=[]; } catch(e){}
  function save(){ try { localStorage.setItem(LS, JSON.stringify(st)); } catch(e){} }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
  function ant(atto){ try{ var n=BigInt(atto), w=n/10n**18n, f=(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,''); return f? w+'.'+f : String(w); }catch(e){ return '?'; } }
  function note(what){ st.history.unshift({ at: new Date().toISOString(), what }); if (st.history.length > 40) st.history.length = 40; save(); }

  var INV = null; // the reference commitment — fetched mechanically, never retyped

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
        h += '<div style="margin-top:8px;padding:8px 10px;border:1px dashed #1d4655;border-radius:8px;font-size:11px;color:var(--dim);text-align:center" data-bdata-authorize-next="1">🔒 ' + T('bd.price.next','Authorize — the payment step is not built yet; nothing can be paid from this page') + '</div>';
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
        uploadId: prepare.upload_id
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

  fetch('bpay-invoice.json').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
   .then(function(inv){ INV = inv; render(); })
   .catch(function(){ render(); });
})();
