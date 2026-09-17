// bpay-invoice.js — Phase A loader for the preservation-invoice panel in
// wallet.html (the spend-audit pattern: dynamically-injected panels keep
// their data-i18n keys in a separate JS file, so the static corpus-English
// check reads only the page's own markup).
//
// Loads the same-origin INVOICE-1 artifact (bpay-invoice.json — built
// mechanically from the live keyless bridge quote by
// scripts/bpay-mvp/invoice-from-quote.mjs), RECOMPUTES the owed sum from the
// carried quotes in-page (the page never trusts the stored total), and
// renders: identity (name/bytes/sha256), the resolved sharing policy with a
// plain-language "who can get this?" line, the ANT storage obligation, native
// gas SEPARATELY (never folded), quote freshness, the commitment digest, and
// the honest waiting state.
//
// PHASE A LAW: nothing here can spend. There is no authorization route on
// this panel — the recon1-oracle A9c tripwire owns that string until the
// Phase C SURFACE_READY re-ruling; do not add one from this file.
(function(){
  var T = (window.BNRLanguage && window.BNRLanguage.text) ? window.BNRLanguage.text.bind(window.BNRLanguage) : function(k,f){return f;};
  var card = document.getElementById('bpay-card');
  if(!card) return;
  function ant(atto){ try{ var n=BigInt(atto), w=n/10n**18n, f=(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,''); return f? w+'.'+f : String(w); }catch(e){ return '?'; } }
  fetch('bpay-invoice.json').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
   .then(function(inv){
     var d = inv.domain || {}, a = d.artifact || {}, q = (d.quote || {}), g = (d.gas || {}), p = (d.policy || {});
     var line = (inv.lines||[]).filter(function(l){return l.asset==='ANT';})[0];
     if(!line) throw new Error('no ANT line');
     /* owed is RECOMPUTED here from the carried quotes — the page never trusts the stored total */
     var sum = line.quotes.reduce(function(s,x){ return s+BigInt(x.amount_atto); }, 0n).toString();
     if(sum !== line.amountAtto) throw new Error('quote sum mismatch');
     var sha = a.sha256 || '';
     var h = '';
     h += '<div style="font-size:12px;letter-spacing:.12em;color:var(--cyan);text-transform:uppercase">' + T('wl.bpay.ready','Ready for you') + '</div>';
     h += '<div style="font-size:15px;margin-top:4px"><b>' + (d.media&&d.media.title||'') + '</b></div>';
     h += '<div style="font-size:11px;opacity:.8">' + (d.media&&d.media.creator||'') + '</div>';
     h += '<div class="row" style="margin-top:10px;flex-wrap:wrap;gap:6px 18px;font-size:12px">';
     h +=   '<span><span data-i18n="wl.bpay.file">' + T('wl.bpay.file','file') + '</span>: <b>' + a.name + '</b></span>';
     h +=   '<span><span data-i18n="wl.bpay.size">' + T('wl.bpay.size','size') + '</span>: <b data-bpay-bytes="' + a.bytes + '">' + a.bytes.toLocaleString('en-US') + ' bytes</b></span>';
     h += '</div>';
     h += '<div style="font-size:10px;font-family:monospace;opacity:.75;margin-top:2px" title="' + sha + '">sha256 ' + sha.slice(0,16) + '…' + sha.slice(-8) + '</div>';
     /* sharing policy — the resolved policy the quote bound, "who can get this?" in plain words */
     if(p.preset){
       h += '<div class="row" style="margin-top:10px;gap:6px 18px;font-size:12px;flex-wrap:wrap">';
       h +=   '<span>🌐 <span data-i18n="wl.bpay.share">' + T('wl.bpay.share','sharing') + '</span>: <b>' + p.preset + '</b></span>';
       h += '</div>';
       h += '<div style="font-size:11px;opacity:.85;margin-top:2px"><b>' + T('wl.bpay.who','Who can get this?') + '</b> ' + (p.access||'') + '</div>';
       h += '<div style="font-size:10px;opacity:.6;margin-top:2px">' + T('wl.bpay.sharenote','your sharing choice is made in the chooser before quoting — never silently inferred') + '</div>';
     }
     h += '<div class="row" style="margin-top:12px;gap:6px 24px;flex-wrap:wrap;font-size:13px">';
     h +=   '<span>⬡ <span data-i18n="wl.bpay.owed">' + T('wl.bpay.owed','storage') + '</span>: <b data-bpay-owed-atto="' + sum + '">' + ant(sum) + ' ANT</b></span>';
     h +=   '<span>⛽ <span data-i18n="wl.bpay.gas">' + T('wl.bpay.gas','network fee (gas)') + '</span>: <span data-bpay-gas-wei="' + (g.estimated_wei || 'wallet-side') + '"><b>' + T('wl.bpay.gasside','separate') + '</b> · Arbitrum ETH</span></span>';
     h += '</div>';
     h += '<div style="font-size:10px;opacity:.7;margin-top:2px">' + T('wl.bpay.gasnote','gas is Arbitrum ETH from your wallet at signing — never folded into the storage quote') + '</div>';
     h += '<div class="row" style="margin-top:8px;gap:6px 18px;flex-wrap:wrap;font-size:11px;opacity:.85">';
     h +=   '<span>' + (line.quotes.length) + ' × ' + T('wl.bpay.quotes','chunk quotes') + ' · ' + d.payment_type + '</span>';
     h +=   '<span><span data-i18n="wl.bpay.fresh">' + T('wl.bpay.fresh','quote obtained') + '</span> ' + (q.obtained_at||'').replace('T',' ').replace(/\.\d+Z$/,' UTC') + '</span>';
     h += '</div>';
     if(d.trezor_ux && d.trezor_ux.shape === 'wave_batch'){
       h += '<div style="font-size:10px;opacity:.7;margin-top:2px">' + T('wl.bpay.shape','wave mode: one device confirmation per quote — the surface will print the exact count before any signing') + '</div>';
     }
     h += '<div style="font-size:10px;font-family:monospace;opacity:.7;margin-top:4px">' + T('wl.bpay.commit','commitment') + ' ' + (inv.commitment&&inv.commitment.digest||'') + '</div>';
     h += '<div style="margin-top:10px;padding:8px 10px;border:1px solid #1d4655;border-radius:8px;font-size:12px">';
     h +=   '<span style="color:var(--amber)">⏳</span> <b data-bpay-state="awaiting">' + T('wl.bpay.state','awaiting your authorization') + '</b>';
     h +=   '<div style="font-size:10px;opacity:.7;margin-top:2px">' + T('wl.bpay.statenote','the authorization surface is not built yet — this panel renders; it cannot spend') + '</div>';
     h += '</div>';
     card.innerHTML = h;
   })
   .catch(function(e){
     card.innerHTML = '<span style="color:var(--amber)">⚠ ' + T('wl.bpay.loadfail','no invoice loaded') + ' (' + (e && e.message ? e.message : 'error') + ')</span>';
   });
})();
