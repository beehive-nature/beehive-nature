// bpay-invoice.js — Phase B: the chooser comes FIRST (founder order 2026-09-17).
//
// The audience policy (🌐 Public — available; 🔒 Only me / 🔒 Selected people —
// VISIBLY UNAVAILABLE with reasons, never promised) is a real product gesture:
// selecting Public and asking for a fresh quote sends the RESOLVED policy to
// the keyless bridge (prepare CONSUMES it — no hidden Visibility default gets
// promoted into a choice). Inspection depth (newbee / raver / cypherpunk) is a
// SEPARATE axis: it changes what is inspectable, never the audience or the
// authority — opening cypherpunk view must not alter one byte of policy.
//
// PHASE LAWS HELD HERE:
//  - nothing can spend; there is NO authorization route on this panel (the
//    recon1-oracle A9c tripwire owns that string until Phase C's re-ruling)
//  - owed is RECOMPUTED in-page from the carried quotes, never trusted
//  - the confirmation count is NEVER inferred from the quote count — it will
//    come from the payment adapter's transaction plan (Phase E)
//  - the founder's gesture is recorded (localStorage + the bridge's persisted
//    job binding "founder-selected:public"); an agent never simulates it
(function(){
  var T = (window.BNRLanguage && window.BNRLanguage.text) ? window.BNRLanguage.text.bind(window.BNRLanguage) : function(k,f){return f;};
  var card = document.getElementById('bpay-card');
  if(!card) return;
  var BRIDGE_DEFAULT = 'http://127.0.0.1:8807';
  var LS = 'bpay-policy-v1';
  var st = { audience:null, selectedAt:null, inspection:'newbee', bridge:BRIDGE_DEFAULT };
  try { var saved = JSON.parse(localStorage.getItem(LS)||'null'); if (saved && typeof saved==='object') st = Object.assign(st, saved); } catch(e){}
  /* SHARED-POLICY FIELD OWNERSHIP (ceremony-blocking repair, 2026-09-17):
     this tab NEVER writes its whole local snapshot back — a stale tab must
     not erase newer founder policy. Presentation/service writes carry ONLY
     {inspection, bridge}; an explicit founder gesture writes ONLY its policy
     fields. Every write merges with the LATEST stored object, so a View
     change can never alter Policy (the orthogonality law). */
  function save(fields){
    try {
      var latest = JSON.parse(localStorage.getItem(LS)||'null')||{};
      localStorage.setItem(LS, JSON.stringify(Object.assign({}, latest, fields||{})));
    } catch(e){}
  }
  function ant(atto){ try{ var n=BigInt(atto), w=n/10n**18n, f=(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,''); return f? w+'.'+f : String(w); }catch(e){ return '?'; } }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

  // the artifact pin arrives mechanically from the committed reference invoice
  // (Phase A) — the page never retypes identity
  var PIN = null, refInvoice = null;

  // The ONE live choice is a button. What cannot be chosen yet is a PLAIN ROW
  // with its reasons in sight — the plain one first, the technical one after —
  // never a disabled, struck button (dead affordances are banned; same law and
  // same words as My Data, so the two surfaces cannot drift).
  function audBtn(id, icon, labelKey, labelFallback, available, why, tech){
    var box = 'display:block;width:100%;box-sizing:border-box;text-align:left;margin-top:6px;padding:8px 10px;border-radius:8px;color:inherit;';
    if (!available) {
      return '<div class="bpay-aud bpay-aud-off" role="radio" aria-checked="false" aria-disabled="true" data-audience="' + id + '" data-bpay-unavailable="' + id + '" style="' + box + 'border:1px dashed #1d4655;cursor:default">'
        + icon + ' <b data-i18n="' + labelKey + '">' + T(labelKey,labelFallback) + '</b>'
        + ' <span style="font-size:11px;opacity:.85">· ' + T('bd.aud.notyet','Not available yet') + '</span>'
        + '<div style="font-size:12px;opacity:.85;margin-top:2px">' + T(why[0],why[1]) + '</div>'
        + '<div style="font-size:11px;opacity:.65;margin-top:1px">' + T(tech[0],tech[1]) + '</div></div>';
    }
    var h = '<button type="button" class="bpay-aud' + (st.audience===id ? ' bpay-aud-on' : '') + '" role="radio" aria-checked="' + (st.audience===id ? 'true' : 'false') + '" data-audience="' + id + '" style="' + box + 'border:1px solid #1d4655;background:transparent;cursor:pointer">';
    h += icon + ' <b data-i18n="' + labelKey + '">' + T(labelKey,labelFallback) + '</b>';
    h += ' <span style="opacity:.7;font-size:11px">— ' + T('wl.bpay.aud.public.desc','anyone with the address can retrieve it') + '</span>';
    h += '</button>';
    return h;
  }

  function renderChooser(){
    var h = '';
    h += '<div style="font-size:13px;font-weight:bold;margin-top:2px">' + T('wl.bpay.choose','Choose how this is shared') + '</div>';
    h += audBtn('public','🌐','wl.bpay.aud.public','Public',true);
    h += audBtn('only-me','🔒','wl.bpay.aud.onlyme','Only me',false,['bd.aud.onlyme.why','Private storage for your eyes only is not ready.'],['bd.aud.onlyme.tech','private-DataMap custody path not yet qualified']);
    h += audBtn('selected-people','👥','wl.bpay.aud.selected','Selected people',false,['bd.aud.selected.why','Sharing with people you pick is not ready.'],['bd.aud.selected.tech','recipient capability/key granting not yet qualified']);
    h += '<div style="font-size:10px;opacity:.6;margin-top:6px">' + T('wl.bpay.sharenote','your sharing choice is made in the chooser before quoting — never silently inferred') + '</div>';
    // inspection depth — a SEPARATE axis; never alters audience or authority
    h += '<div class="row" style="margin-top:12px;gap:8px;align-items:center;flex-wrap:wrap">';
    h += '<span style="font-size:11px;opacity:.8">' + T('wl.bpay.inspect','view') + ':</span>';
    ['newbee','raver','cypherpunk'].forEach(function(r){
      h += '<button type="button" data-inspection="' + r + '" style="padding:3px 10px;border:1px solid ' + (st.inspection===r?'var(--cyan)':'#1d4655') + ';border-radius:12px;background:' + (st.inspection===r?'#0e2d3a':'transparent') + ';color:inherit;cursor:pointer;font-size:11px">' + r + '</button>';
    });
    h += '</div>';
    h += '<div style="font-size:10px;opacity:.6">' + T('wl.bpay.inspect.note','changes what you can inspect and configure — never the audience or your authority') + '</div>';
    // the quote-service endpoint is cypherpunk-view configuration
    h += '<div class="row" data-min-insp="cypherpunk" style="margin-top:6px;gap:8px;align-items:center;display:none">';
    h += '<span style="font-size:11px;opacity:.8">' + T('wl.bpay.bridge','quote service') + ':</span>';
    h += '<input id="bpay-bridge" value="' + esc(st.bridge) + '" style="background:#0b1e26;border:1px solid #1d4655;color:inherit;border-radius:6px;padding:3px 8px;font-size:11px;font-family:monospace" />';
    h += '</div>';
    // the gesture's record + the fresh-quote action (quote only — never a payment)
    if (st.audience === 'public') {
      h += '<div style="margin-top:10px;font-size:12px">' + T('wl.bpay.youchose','You chose') + ' <b>🌐 ' + T('wl.bpay.aud.public','Public') + '</b>';
      if (st.selectedAt) h += ' <span style="opacity:.65;font-size:10px">· ' + T('wl.bpay.selectedat','chosen at') + ' ' + String(st.selectedAt).replace('T',' ').replace(/\.\d+Z$/,' UTC') + '</span>';
      h += '</div>';
      h += '<button type="button" id="bpay-quote-go" style="margin-top:6px;padding:8px 14px;border:1px solid #2c4a5a;border-radius:8px;background:#0e2d3a;color:var(--cyan);cursor:pointer;font-size:13px">♡ ' + T('wl.bpay.getquote','Get a fresh quote') + '</button>';
      h += '<span id="bpay-quote-stat" style="font-size:11px;opacity:.75;margin-left:8px"></span>';
    }
    // the honest waiting state — until Phase C earns the authorization route
    h += '<div style="margin-top:12px;padding:8px 10px;border:1px solid #1d4655;border-radius:8px;font-size:12px">';
    h += '<span style="color:var(--amber)">⏳</span> <b data-bpay-state="awaiting">' + T('wl.bpay.state','awaiting your authorization') + '</b>';
    h += '<div style="font-size:10px;opacity:.7;margin-top:2px">' + T('wl.bpay.statenote','the authorization surface is not built yet — this panel renders; it cannot spend') + '</div>';
    h += '</div>';
    return h;
  }

  function invoiceBlock(inv, current){
    var d = inv.domain || {}, a = d.artifact || {}, q = (d.quote || {}), g = (d.gas || {}), p = (d.policy || {}), aud = (p.audience || {});
    var line = (inv.lines||[]).filter(function(l){return l.asset==='ANT';})[0];
    if(!line) return '';
    var sum = line.quotes.reduce(function(s,x){ return s+BigInt(x.amount_atto); }, 0n).toString();
    if(sum !== line.amountAtto) return '<div style="color:var(--amber)">quote sum mismatch — refused</div>';
    var sha = a.sha256 || '';
    var h = '<div style="margin-top:14px;padding:10px;border:1px solid ' + (current?'#2c4a5a':'#1d4655') + ';border-radius:10px' + (current?'':';opacity:.8') + '">';
    h += '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + (current?'var(--cyan)':'var(--amber)') + '">' + (current
      ? T('wl.bpay.quote.current','Current storage quote — caused by your choice')
      : T('wl.bpay.quote.ref','Reference quote (not chosen by you)')) + '</div>';
    if (current) h += '<div style="font-size:12px;margin-top:4px">' + T('wl.bpay.youchose','You chose') + ' <b>🌐 ' + T('wl.bpay.aud.public','Public') + '</b> — ' + esc(aud.access || p.access || '') + '</div>';
    h += '<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:4px 16px;font-size:12px">';
    h += '<span>' + esc(a.name||'') + ' · <span data-bpay-bytes="' + a.bytes + '">' + a.bytes.toLocaleString('en-US') + '</span> bytes</span>';
    h += '<span>sha256 <span style="font-family:monospace">' + sha.slice(0,16) + '…</span></span>';
    h += '</div>';
    h += '<div class="row" style="margin-top:8px;gap:6px 24px;flex-wrap:wrap;font-size:13px">';
    h += '<span>⬡ <b data-bpay-owed-atto="' + sum + '">' + ant(sum) + ' ANT</b></span>';
    h += '<span>⛽ <span data-bpay-gas-wei="' + (g.estimated_wei || 'wallet-side') + '">' + T('wl.bpay.gasside','separate') + ' · Arbitrum ETH</span></span>';
    h += '</div>';
    h += '<div class="row" style="margin-top:4px;gap:6px 16px;flex-wrap:wrap;font-size:11px;opacity:.85">';
    h += '<span data-bpay-quote-obligations="' + ((d.trezor_ux&&d.trezor_ux.quote_obligations)||line.quotes.length) + '">' + line.quotes.length + ' × ' + T('wl.bpay.quotes','chunk quotes') + ' · ' + esc(d.payment_type||'') + '</span>';
    h += '<span>' + T('wl.bpay.fresh','quote obtained') + ' ' + esc(String(q.obtained_at||'').replace('T',' ').replace(/\.\d+Z$/,' UTC')) + '</span>';
    h += '</div>';
    h += '<div style="font-size:10px;opacity:.65;margin-top:2px">' + T('wl.bpay.singleuse','single-use — re-quoted at payment time; this exact set is persisted on the keyless bridge') + '</div>';
    h += '<div style="font-size:10px;opacity:.65" ' + (current && d.trezor_ux && d.trezor_ux.expected_confirmations==null ? 'data-bpay-expected-confirmations=""' : '') + '>' + T('wl.bpay.shape','payment shape on record; device confirmations will be shown from the transaction plan produced by the payment adapter — never inferred from the quote count') + '</div>';
    h += '<div style="font-size:10px;font-family:monospace;opacity:.6;margin-top:2px;overflow-wrap:anywhere">' + T('wl.bpay.commit','commitment') + ' ' + esc((inv.commitment&&inv.commitment.digest)||'') + '</div>';
    if (current) h += '<div style="margin-top:8px;font-size:12px;font-weight:bold">' + T('wl.bpay.nothingpaid','Nothing has been paid.') + '</div>';
    h += '</div>';
    return h;
  }

  function applyInspection(){
    var want = st.inspection;
    var order = { newbee:0, raver:1, cypherpunk:2 };
    card.querySelectorAll('[data-min-insp]').forEach(function(el){
      el.style.display = (order[(el.dataset.minInsp||'cypherpunk')] <= order[want]) ? '' : 'none';
    });
  }

  function render(){
    var h = renderChooser();
    if (refInvoice) h += invoiceBlock(refInvoice, false);
    h += '<div id="bpay-fresh"></div>';
    card.innerHTML = h;
    applyInspection();
    // audience selection — the ONE available choice; unavailable rows are
    // plain prose with their reasons (never promised, never pressable)
    card.querySelectorAll('[data-audience]').forEach(function(b){
      b.addEventListener('click', function(){
        if (b.getAttribute('aria-disabled') === 'true') return;
        if (b.dataset.audience !== 'public') return; // unavailable modes are never selectable
        st.audience = 'public'; st.selectedAt = new Date().toISOString();
        save({ audience: 'public', selectedAt: st.selectedAt }); // policy-owned merge write — service fields of other tabs survive
        render();
      });
    });
    card.querySelectorAll('[data-inspection]').forEach(function(b){
      b.addEventListener('click', function(){ st.inspection = b.dataset.inspection; save({ inspection: st.inspection }); render(); });
    });
    var bridgeInput = document.getElementById('bpay-bridge');
    if (bridgeInput) bridgeInput.addEventListener('change', function(){ st.bridge = bridgeInput.value.trim() || BRIDGE_DEFAULT; save({ bridge: st.bridge }); });
    var go = document.getElementById('bpay-quote-go');
    if (go) go.addEventListener('click', freshQuote);
  }

  function freshQuote(){
    var stat = document.getElementById('bpay-quote-stat');
    var fresh = document.getElementById('bpay-fresh');
    if (!PIN) { if(stat) stat.textContent = '⚠ ' + T('wl.bpay.loadfail','no invoice loaded'); return; }
    if (stat) stat.textContent = '…';
    // the RESOLVED policy rides the request: audience chosen by the founder,
    // artifact by pin (never a local path), force_fresh for a true fresh quote
    fetch(st.bridge.replace(/\/$/,'') + '/v1/upload/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifact_sha256: PIN, audience: st.audience, force_fresh: true })
    }).then(function(r){
      if (!r.ok) return r.text().then(function(t){ throw new Error('HTTP ' + r.status + (t ? ' — ' + t.slice(0,200) : '')); });
      return r.json();
    }).then(function(prepare){
      if (!prepare.policy || prepare.policy.binding.indexOf('founder-selected') !== 0)
        throw new Error('bridge did not bind the founder-selected policy');
      if (prepare.artifact_sha256 !== PIN) throw new Error('artifact mismatch — refused');
      var sum = (prepare.payments||[]).reduce(function(s,p){ return s + BigInt(p.amount_atto); }, 0n).toString();
      if (prepare.total_amount_atto && prepare.total_amount_atto !== sum) throw new Error('quote sum mismatch');
      var now = new Date().toISOString();
      var inv = {
        schema: 'bpay.invoice-generic/1',
        domain: {
          artifact: { name: (refInvoice&&refInvoice.domain&&refInvoice.domain.artifact&&refInvoice.domain.artifact.name)||'artifact', sha256: prepare.artifact_sha256, bytes: prepare.artifact_bytes },
          media: (refInvoice&&refInvoice.domain&&refInvoice.domain.media)||{},
          payment_type: prepare.payment_type,
          chunks: { total: prepare.total_chunks, already_stored: prepare.already_stored||0 },
          quote: { obtained_at: now, provider: 'antd-bridge (live, keyless)', confidence: 'measured-live-network', upload_id: prepare.upload_id, durable_reload: true, policy_binding: prepare.policy.binding },
          gas: { asset: 'ETH', estimated_wei: null, source: 'wallet-side', note: 'Arbitrum One native gas, from your wallet at signing — never folded into storage' },
          data_map_address: prepare.data_map_address || null,
          policy: { object: 'one-policy-object', audience: { selected: prepare.policy.audience, selected_by: 'founder product gesture @ ' + st.selectedAt + ' → bridge binding ' + prepare.policy.binding, available: ['public'], unavailable: [
            { id: 'only-me', reason: 'private-DataMap custody path not yet qualified' },
            { id: 'selected-people', reason: 'recipient capability/key granting not yet qualified' }
          ] }, inspection: { advanced: 'inspection depth only — never alters policy' }, access: 'anyone who obtains the Autonomi address can retrieve the artifact' },
          trezor_ux: { shape: prepare.payment_type, quote_obligations: (prepare.payments||[]).length, expected_confirmations: null }
        },
        lines: [ { kind: 'storage', asset: 'ANT', amountAtto: sum, quotes: (prepare.payments||[]).map(function(p){ return { quote_hash: p.quote_hash, amount_atto: String(p.amount_atto) }; }) } ]
      };
      // in-page rendering recomputes owed from the quotes; the CANONICAL
      // INVOICE-1 artifact (digests) is built repo-side from this same
      // prepare response by scripts/bpay-mvp/invoice-from-quote.mjs
      fresh.innerHTML = invoiceBlock(inv, true) +
        '<details data-min-insp="cypherpunk" style="display:none;margin-top:4px;font-size:10px"><summary style="cursor:pointer;opacity:.7">raw plan (cypherpunk view)</summary><pre style="white-space:pre-wrap;word-break:break-all;opacity:.7">' + esc(JSON.stringify({ upload_id: prepare.upload_id, policy: prepare.policy, payment_type: prepare.payment_type, total_amount_atto: prepare.total_amount_atto, payments: (prepare.payments||[]).length + ' quotes (hashes carried in the canonical artifact)' }, null, 1)) + '</pre></details>';
      applyInspection();
      if (stat) stat.textContent = '';
    }).catch(function(e){
      if (stat) stat.textContent = '⚠ ' + T('wl.bpay.freshfail','fresh quote failed') + ': ' + (e && e.message ? e.message.slice(0,180) : 'error');
    });
  }

  fetch('bpay-invoice.json').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
   .then(function(inv){ refInvoice = inv; PIN = inv.domain && inv.domain.artifact && inv.domain.artifact.sha256; render(); })
   .catch(function(){ render(); });
})();
