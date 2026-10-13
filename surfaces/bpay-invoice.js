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
//  - the quote-only action never spends; hosted purchasing requires a separate
//    exact invoice authorization and the key holder's browser-wallet signature
//  - owed is RECOMPUTED in-page from the carried quotes, never trusted
//  - the confirmation count is NEVER inferred from the quote count — it will
//    come from the payment adapter's transaction plan (Phase E)
//  - the founder's gesture is recorded (localStorage + the bridge's persisted
//    job binding "founder-selected:public"); an agent never simulates it
(function(){
  var T = (window.BNRLanguage && window.BNRLanguage.text) ? window.BNRLanguage.text.bind(window.BNRLanguage) : function(k,f){return f;};
  var card = document.getElementById('bpay-card');
  if(!card) return;
  var BRIDGE_DEFAULT = ''; // No local service is required or selected by this wallet.
  var LS = 'bpay-policy-v1';
  // The file quote asks Autonomi itself through the official browser kit
  // (vendor/ant-browser-sdk/0.1.1). Its size limits come from the kit's own
  // limits.js; the kit and its network connection load only when a quote is asked.
  var ANT_KIT = '/vendor/ant-browser-sdk/0.1.1/';
  var antLimits = null, antKit = null, antClient = null, quoteRun = null;
  var limitsLoad = import(ANT_KIT + 'limits.js').then(function(m){ antLimits = m.SDK_LIMITS; }, function(){ antLimits = null; });
  var st = { audience:null, selectedAt:null, inspection:'newbee', bridge:BRIDGE_DEFAULT };
  try { var saved = JSON.parse(localStorage.getItem(LS)||'null'); if (saved && typeof saved==='object') st = Object.assign(st, saved); } catch(e){}
  if (/^https?:\/\/(localhost|127\.0\.0\.1):8807(?:\/|$)/i.test(st.bridge)) st.bridge = '';
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
  function plainBytes(n){
    var units = [[1e12,'TB'],[1e9,'GB'],[1e6,'MB'],[1e3,'KB']];
    for (var i = 0; i < units.length; i++) if (n >= units[i][0]) return (n/units[i][0]).toLocaleString('en-US',{maximumFractionDigits:2}) + ' ' + units[i][1];
    return n.toLocaleString('en-US') + (n === 1 ? ' byte' : ' bytes');
  }
  function sizeRange(){ return plainBytes(antLimits.minFileBytes) + ' to ' + plainBytes(antLimits.maxFileBytes); }

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
        + '<div data-min-insp="cypherpunk" style="font-size:11px;opacity:.65;margin-top:1px;display:none">' + T(tech[0],tech[1]) + '</div></div>';
    }
    var h = '<button type="button" class="bpay-aud' + (st.audience===id ? ' bpay-aud-on' : '') + '" role="radio" aria-checked="' + (st.audience===id ? 'true' : 'false') + '" data-audience="' + id + '" style="' + box + 'border:1px solid #1d4655;background:transparent;cursor:pointer">';
    h += icon + ' <b data-i18n="' + labelKey + '">' + T(labelKey,labelFallback) + '</b>';
    h += '<span style="opacity:.7;font-size:11px">: ' + T('wl.bpay.aud.public.desc','anyone with the address can retrieve it') + '</span>';
    h += '</button>';
    return h;
  }

  function renderChooser(){
    var h = '<div class="ant-intro">Store a file with your bzDiD wallet. Review the ANT price and a separate ETH fee limit before you pay.</div>';
    h += '<div style="font-size:13px;font-weight:bold;margin-top:2px">' + T('wl.bpay.choose','Choose how this is shared') + '</div>';
    h += audBtn('public','🌐','wl.bpay.aud.public','Public',true);
    if(st.audience==='public')h += '<div class="ant-help">'+T('wl.bpay.youchose','You chose')+' <b>🌐 '+T('wl.bpay.aud.public','Public')+'</b><span data-min-insp="cypherpunk" style="display:none"> · chosen at '+esc(st.selectedAt||'not recorded')+'</span></div>';
    h += '<details class="wallet-secondary"><summary>Private sharing · not available yet</summary>';
    h += audBtn('only-me','🔒','wl.bpay.aud.onlyme','Only me',false,['bd.aud.onlyme.why','Private storage for your eyes only is not ready.'],['bd.aud.onlyme.tech','private-DataMap custody path not yet qualified']);
    h += audBtn('selected-people','👥','wl.bpay.aud.selected','Selected people',false,['bd.aud.selected.why','Sharing with people you pick is not ready.'],['bd.aud.selected.tech','recipient capability/key granting not yet qualified']);
    h += '</details>';
    if(st.audience === 'public') h += purchasePanel();
    h += '<details id="ant-quote-only" class="wallet-secondary"><summary>Just check a price · no sign-in needed</summary>';
    // Inspection follows the wallet register; there is no second view selector.
    // the quote-service endpoint is cypherpunk-view configuration
    h += '<div class="row" data-min-insp="cypherpunk" style="margin-top:6px;gap:8px;align-items:center;display:none">';
    h += '<span style="font-size:11px;opacity:.8">' + T('wl.bpay.bridge','quote service') + ':</span>';
    h += '<input id="bpay-bridge" aria-label="Autonomi quote service URL" value="' + esc(st.bridge) + '" style="background:#0b1e26;border:1px solid #1d4655;color:inherit;border-radius:6px;padding:3px 8px;font-size:11px;font-family:monospace" />';
    h += '</div>';
    // the gesture's record + the fresh-quote action (quote only — never a payment)
    if (st.audience === 'public') {
      h += '<div class="wa-note"><label for="ant-quote-file">File to quote' + (antLimits ? ' (' + sizeRange() + ', the Autonomi browser kit\'s limits; your browser may allow less)' : '') + '</label><input id="ant-quote-file" type="file" style="display:block;width:100%;max-width:100%;margin:8px 0"><div>This browser splits the file into chunks itself and asks Autonomi storage nodes for a price using only addresses and sizes. The file\'s contents stay in this browser, and nothing is paid or published.</div><button type="button" id="ant-quote-go">Get Autonomi quote</button> <button type="button" id="ant-quote-cancel" hidden>Stop request</button><div id="ant-quote-status" role="status" aria-live="polite"></div></div>';
      h += '<div style="margin-top:10px;font-size:12px">' + T('wl.bpay.youchose','You chose') + ' <b>🌐 ' + T('wl.bpay.aud.public','Public') + '</b>';
      if (st.selectedAt) h += ' <span data-min-insp="cypherpunk" style="opacity:.65;font-size:10px;display:none">· ' + T('wl.bpay.selectedat','chosen at') + ' ' + String(st.selectedAt).replace('T',' ').replace(/\.\d+Z$/,' UTC') + '</span>';
      h += '</div>';
      // a reference quote service is cypherpunk configuration: its button and its line never reach bee or raver
      h += '<span data-min-insp="cypherpunk" style="display:none">';
      if(st.bridge) h += '<button type="button" id="bpay-quote-go" style="margin-top:6px;padding:8px 14px;border:1px solid #2c4a5a;border-radius:8px;background:#0e2d3a;color:var(--cyan);cursor:pointer;font-size:13px">♡ ' + T('wl.bpay.getquote','Get a fresh quote') + '</button>';
      h += '<span id="bpay-quote-stat" style="font-size:11px;opacity:.75;margin-left:8px"></span></span>';
    }
    // the honest waiting state — until Phase C earns the authorization route
    h += '<div style="margin-top:12px;padding:8px 10px;border:1px solid #1d4655;border-radius:8px;font-size:12px">';
    h += '<b data-bpay-state="awaiting">A quote does not authorize payment.</b>';
    h += '<div style="font-size:14px;margin-top:6px">This is an estimate only. Use the storage invoice to review a payable price with your bzDiD wallet.</div>';
    h += '</div></details>';
    return h;
  }

  /* ══ THE TEST NETWORK (wallet.html?net=devnet) ══
     The same purchase, end to end, on a local Autonomi devnet (tools/ant-testnet/start.sh):
     ten storage nodes reached over WebRTC Direct and a local Anvil chain (31337) carrying
     the test ANT token and payment vault. Nothing on it has value. The page reads the
     devnet's own manifest from this computer (loopback only), connects the kit to those
     nodes, and pays with the same bzDiD keychain signer pinned to the test chain and the
     token and vault the nodes authenticated. Mainnet is never reachable from this mode. */
  var ANT_TEST=/(^|[?&])net=devnet(&|$)/.test(location.search);
  var DEVNET='http://127.0.0.1:25000';
  var devnetCache=null;
  function loopback(u){
    var x=new URL(u);
    if(x.protocol!=='http:'||!/^\d{1,5}$/.test(x.port)||Number(x.port)<1||Number(x.port)>65535)throw new Error('The test network named a test chain that is not an http port on this computer');
    return 'http://127.0.0.1:'+x.port;
  }
  // F2: storage nodes only at private IPv4 addresses (this computer, its WSL guest or the LAN)
  function privateSeed(a){
    var m=/^\/ip4\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/udp\/\d{1,5}\/webrtc-direct\//.exec(a);
    if(!m)return false;
    var o=m.slice(1).map(Number);if(o.some(function(v){return v>255;}))return false;
    return o[0]===127||o[0]===10||(o[0]===172&&o[1]>=16&&o[1]<=31)||(o[0]===192&&o[1]===168);
  }
  async function devnetProfile(signal){
    if(devnetCache)return devnetCache;
    async function get(path){
      // F3: a redirect is a refusal — the manifest comes from this computer's loopback or not at all
      var r;try{r=await fetch(DEVNET+path,{signal:signal,cache:'no-store',redirect:'error'});}catch(e){throw new Error('Could not reach the test network on this computer (or it answered with a redirect, which is refused). Start it, and when your browser asks, allow skaists.dev to reach apps on this device.');}
      if(!r.ok)throw new Error('The local test network answered HTTP '+r.status);
      return r.json();
    }
    var browser=await get('/api/browser-manifest.json'),devnet=await get('/api/devnet-manifest.json');
    var profile=antTestProfile(browser,devnet);
    // the banner reads like a receipt: how many private-address nodes and which loopback port, measured, not promised
    var banner=document.querySelector('.ant-test-banner');
    if(banner){var strong=document.createElement('b');strong.textContent='TEST NETWORK';banner.replaceChildren(strong,document.createTextNode(' · a local Autonomi devnet and test chain on this computer: '+profile.seeds.length+' storage nodes at private addresses, test chain at '+profile.rpcUrl+'. Test ANT and test ETH have no value, and nothing here touches Arbitrum One.'));}
    // Anvil mines only when a transaction arrives; the payer confirms a payment only once a
    // later block exists. On the test chain alone (31337, checked), mine one block a second.
    if(Number(await antTestRpc(profile,'eth_chainId',[]))!==31337)throw new Error('The test chain is not 31337; refusing it');
    await antTestRpc(profile,'evm_setIntervalMining',[1]);
    devnetCache=profile;return profile;
  }
  // Read the two manifests into a kit profile. Refuses anything that is not the test chain.
  function antTestProfile(browser,devnet){
    var nodes=browser&&(browser.bootstrap||browser.nodes||browser.endpoints)||[];
    var seeds=nodes.map(function(n){return typeof n==='string'?n:(n.multiaddr||n.address);}).filter(function(a){return typeof a==='string'&&privateSeed(a);});
    var pay=browser&&(browser.payment_network||browser.payment)||{};
    var evm=devnet&&(devnet.evm||devnet.evm_info)||{};
    var payment={chainId:Number(pay.chain_id),paymentTokenAddress:String(pay.payment_token_address||'').toLowerCase(),paymentVaultAddress:String(pay.payment_vault_address||'').toLowerCase()};
    if(payment.chainId!==31337)throw new Error('This test network is not the local test chain (31337); refusing it');
    if(!/^0x[0-9a-f]{40}$/.test(payment.paymentTokenAddress)||!/^0x[0-9a-f]{40}$/.test(payment.paymentVaultAddress))throw new Error('The test network named no payment token or vault');
    if(!seeds.length)throw new Error('The test network listed no storage nodes at a private address');
    if(typeof evm.rpc_url!=='string')throw new Error('The test network named no test chain');
    return {id:'bnr-devnet',seeds:seeds,payment:payment,rpcUrl:loopback(evm.rpc_url)};
  }
  async function antTestRpc(profile,method,params){
    // F3: the test chain answers at its loopback port or not at all; a redirect is a refusal
    var r;try{r=await fetch(profile.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',redirect:'error',body:JSON.stringify({jsonrpc:'2.0',id:1,method:method,params:params})});}catch(e){throw new Error('The test chain did not answer on this computer, or answered with a redirect, which is refused');}
    var j=await r.json();if(j.error)throw new Error('Test chain refused '+method+': '+String(j.error.message||'').slice(0,120));return j.result;
  }
  // Test funds: the local chain's own unlocked dev account sends test ANT, and Anvil sets the
  // test ETH balance. No private key is read, held or typed anywhere.
  async function antTestFund(profile,address){
    if(Number(await antTestRpc(profile,'eth_chainId',[]))!==31337)throw new Error('Not the local test chain');
    var accounts=await antTestRpc(profile,'eth_accounts',[]);
    if(!accounts||!accounts[0])throw new Error('The test chain has no dev account to fund from');
    await antTestRpc(profile,'anvil_setBalance',[address,'0xde0b6b3a7640000']);  // 1 test ETH
    var pad=function(v){return BigInt(v).toString(16).padStart(64,'0');};
    var data='0xa9059cbb'+address.toLowerCase().replace(/^0x/,'').padStart(64,'0')+pad(10n*10n**18n);  // 10 test ANT
    var hash=await antTestRpc(profile,'eth_sendTransaction',[{from:accounts[0],to:profile.payment.paymentTokenAddress,data:data}]);
    var mined=false;
    for(var i=0;i<40&&!mined;i++){var rc=await antTestRpc(profile,'eth_getTransactionReceipt',[hash]);if(rc){if(rc.status!=='0x1')throw new Error('The test ANT transfer reverted');mined=true;}else await new Promise(function(r){setTimeout(r,250);});}
    if(!mined)throw new Error('The test ANT transfer was not mined yet; press again in a moment');
    var bal=await antTestRpc(profile,'eth_call',[{to:profile.payment.paymentTokenAddress,data:'0x70a08231'+address.toLowerCase().replace(/^0x/,'').padStart(64,'0')},'latest']);
    return {ant:BigInt(bal).toString()};
  }

  // Hosted storage purchasing lives beside the existing quote-only chooser.
  // It uses the same bundled Autonomi client and AntPay wire implementation.
  function purchasePanel(){
    return '<details id="ant-purchase" class="ant-stage" open><summary>Pay ANT to store a public file</summary>'+
      '<ol class="wallet-steps" aria-label="Storage progress"><li data-ant-step="prepare" aria-current="step"><b>1</b><span>Prepare</span></li><li data-ant-step="review"><b>2</b><span>Review &amp; pay</span></li><li data-ant-step="verify"><b>3</b><span>Verify receipt</span></li></ol>'+
      (ANT_TEST?'<div class="ant-test-banner" role="note"><b>TEST NETWORK</b> · a local Autonomi devnet and test chain on this computer. Test ANT and test ETH have no value, and nothing here touches Arbitrum One.</div>':'')+
      '<div class="ant-intro">Public means anyone with the address can read your file. Stored files cannot be deleted.</div>'+
      '<div id="ant-buy-session" class="ant-session" aria-live="polite"><span id="ant-session-message">Checking your wallet…</span> <a id="ant-connect" href="#kc-sec" data-kc-return="storage">Connect your bzDiD keychain</a></div>'+
      '<div id="ant-buy-keychain"></div>'+
      '<div class="ant-fields"><div><label for="ant-buy-file">Public file (3 bytes to 32 MiB)</label><input id="ant-buy-file" type="file" aria-describedby="ant-file-help"><small id="ant-file-help">Choose the file you want to keep.</small></div>'+
      '<div><label for="ant-buy-gas">ETH network-fee ceiling</label><input id="ant-buy-gas" inputmode="decimal" placeholder="Your ETH ceiling" aria-describedby="ant-gas-help"><small id="ant-gas-help">Covers approvals and all attempts. ANT storage is priced separately. This limit does not authorize payment.</small></div></div>'+
      '<button id="ant-fund" type="button">'+(ANT_TEST?'Get test ANT and test ETH':'Fund this wallet · ETH / ANT')+'</button><div id="ant-funding" hidden></div>'+
      '<button id="ant-buy-start" class="ant-primary" type="button">Prepare storage invoice / resume</button> <button id="ant-buy-stop" type="button" hidden>Stop waiting</button>'+
      '<div id="ant-buy-status" role="status" aria-live="polite">Prepare an invoice to see the exact ANT total. Nothing is signed at this step.</div><div id="ant-buy-invoice" tabindex="-1"></div><div id="ant-buy-download"></div>'+
      '<details class="wallet-secondary"><summary>Limits &amp; resuming an interrupted purchase</summary><div class="ant-help">The storage ceiling is 100 ANT per file. Your wallet pays on '+(ANT_TEST?'the local test chain':'Arbitrum One')+'. The ETH ceiling covers approvals and all attempts. Keep this browser’s saved data and resume with the same file after an interruption. Another browser or device does not share this payment record unless you save it here and open it there: the record carries what was signed and sent, never a key.</div>'+
      '<div class="ant-help"><a id="ant-buy-record" href="#" hidden>Save this file’s payment record</a></div>'+
      '<div class="ant-help"><label for="ant-buy-record-in">Open a saved payment record (from another browser)</label> <input id="ant-buy-record-in" type="file" accept="application/json"></div><div id="ant-buy-record-status" role="status" aria-live="polite"></div></details>'+
      '<details id="ant-buy-proof" hidden><summary>Receipt and verified hash</summary><pre id="ant-buy-receipt" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></details></details>';
  }
  function bindPurchase(){
    var start=document.getElementById('ant-buy-start'),stop=document.getElementById('ant-buy-stop'),status=document.getElementById('ant-buy-status'),view=document.getElementById('ant-buy-invoice'),receipt=document.getElementById('ant-buy-receipt');
    if(!start)return;
    var active=null,downloadUrl=null;
    var input=document.getElementById('ant-buy-file'),fee=document.getElementById('ant-buy-gas');
    document.getElementById('ant-fund').onclick=async function(){
      var box=document.getElementById('ant-funding');box.hidden=false;box.replaceChildren();
      if(ANT_TEST){
        try{
          box.textContent='Sending test ANT and test ETH to your keychain’s test address…';
          var prof=await devnetProfile();
          var who=await paySigner(prof).address(); // the same chooser the invoice uses: funding, display and payer agree
          var got=await antTestFund(prof,who);
          box.textContent='Funded on the test network: '+ant(got.ant)+' test ANT and 1 test ETH at '+who+' ('+payerWords()+').';
        }catch(e){box.textContent='Test funding stopped: '+(e&&e.message||e);}
        return;
      }
      try{
        var address=await paySigner(null).address(); // the account that will pay, never another
        var title=document.createElement('h3');title.textContent='Receive ETH and ANT · Arbitrum One ('+payerWords()+')';box.append(title);
        var note=document.createElement('div');note.textContent='Send on Arbitrum One (chain 42161). ETH pays network fees; ANT pays storage. Scan this address, or click the QR to copy it.';box.append(note);
        var qr=document.createElement('button');qr.type='button';qr.setAttribute('aria-label','Copy Arbitrum funding address');qr.innerHTML=BNRPAY.receiveQr(address);box.append(qr);
        var text=document.createElement('div');text.style.overflowWrap='anywhere';text.textContent=address;box.append(text);
        var copied=document.createElement('div');copied.setAttribute('role','status');box.append(copied);
        qr.onclick=async function(){try{await navigator.clipboard.writeText(address);copied.textContent='Address copied. Use Arbitrum One for ETH or ANT.';}catch(e){copied.textContent='Copy the address shown above.';}};
      }catch(e){box.textContent=(e&&e.message)||'Open your existing bzDiD wallet and connect your .b name to show its funding address.';}
    };
    function progress(step){document.querySelectorAll('[data-ant-step]').forEach(function(el){if(el.dataset.antStep===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});}
    function walletState(){return window.BNRPAY&&BNRPAY.antStorageState?BNRPAY.antStorageState():{connected:false,hasName:false,coreReady:false};}
    // The isolated keychain (keys.skaists.dev) pays when it is open: its key never enters this page.
    // It appears only when that origin answers; otherwise the wallet keychain pays as before.
    var isolated=null;
    function isolatedOpen(){return !!(isolated&&isolated.state&&isolated.state.state==='unlocked');}
    // An open isolated keychain must be pinned to the network this page pays on: the production
    // build (Arbitrum One) here, a TEST BUILD (chain 31337, the devnet's own token and vault) on
    // wallet.html?net=devnet. A mismatch is a refusal by name — never a silent fallback to the
    // wallet page's own keychain. Only when no isolated keychain is open does this page's keychain
    // pay, and the session line says so. A keychain that announces no pin is the production one.
    function pinProblem(testProfile){
      var p=(isolated&&isolated.state&&isolated.state.pin)||{chain:42161,test:false},same=function(a,b){return String(a).toLowerCase()===String(b).toLowerCase();};
      if(ANT_TEST){
        if(p.test!==true||p.chain!==31337)return 'Your isolated keychain is pinned to '+(p.chain===42161?'Arbitrum One':'chain '+p.chain)+' and cannot pay on the test network. Lock it to pay with this page’s own test keychain, or open a TEST BUILD keychain.';
        if(testProfile&&!(same(p.token,testProfile.payment.paymentTokenAddress)&&same(p.vault,testProfile.payment.paymentVaultAddress)))return 'Your TEST BUILD keychain is pinned to another test network’s token and vault than the one running now. Rebuild it for this network.';
        return null;
      }
      if(p.test===true||p.chain!==42161)return 'The open keychain is a TEST BUILD (chain '+p.chain+') and cannot pay on Arbitrum One. Lock it and open your production keychain at keys.skaists.dev.';
      return null;
    }
    function paySigner(testProfile){
      if(isolatedOpen()){var problem=pinProblem(testProfile);if(problem)throw new Error(problem);return isolated.signer();}
      if(!window.BNRPAY||!BNRPAY.antStorageSigner)throw new Error('The bzDiD storage signer is not ready; reload this wallet');
      return BNRPAY.antStorageSigner(ANT_TEST?{testnet:{token:testProfile.payment.paymentTokenAddress,vault:testProfile.payment.paymentVaultAddress}}:undefined);
    }
    function payerWords(){return isolatedOpen()?'your isolated '+(isolated.state.pin&&isolated.state.pin.test?'TEST BUILD ':'')+'keychain':'this page’s own '+(ANT_TEST?'test ':'')+'keychain';}
    var slot=document.getElementById('ant-buy-keychain');
    if(window.KeychainClient&&slot){
      // on the test network only the TEST BUILD keychain at its own origin is mounted; the production keychain is never asked to pay there
      if(!card._keychain)card._keychain=KeychainClient.mount(slot,ANT_TEST?{build:'devnet'}:undefined);
      card._keychain.then(function(c){isolated=c;if(!c)return;if(!slot.contains(c.frame))slot.append(c.frame);c.onstate(sessionState);sessionState();});
    }
    function sessionState(){
      var state=walletState(),message=document.getElementById('ant-session-message'),link=document.getElementById('ant-connect');
      if(!message)return;
      if(isolatedOpen()){
        var problem=pinProblem(null);
        if(problem){message.textContent=problem;link.hidden=true;start.disabled=true;start.hidden=false;return;}
        message.textContent='Your isolated '+(isolated.state.pin&&isolated.state.pin.test?'TEST BUILD ':'')+'keychain is open and pays from its own account. Ready to prepare an invoice. Paying account: '+isolated.state.evm+'.';
        link.hidden=true;start.disabled=!!active;start.hidden=false;return;
      }
      message.textContent=!state.connected?'First, open your existing wallet. Your file and fee limit stay here.':!state.hasName?'Wallet open. Connect your existing .b name to choose the paying account.':!state.coreReady?'Wallet open. Waiting for the Rust signing core.':'Wallet connected. Ready to prepare an invoice. '+(ANT_TEST?'This page’s own test keychain pays on the test network; no isolated keychain is open.':'This page’s own keychain pays; no isolated keychain is open.');
      link.hidden=state.connected&&state.hasName;
      link.href=state.connected?'#connect-sec':'#kc-sec';
      link.textContent=state.connected?'Connect your .b name':'Connect your bzDiD keychain';
      start.disabled=!!active||!state.connected||!state.hasName||!state.coreReady;
      start.hidden=!active&&(!state.connected||!state.hasName||!state.coreReady);
    }
    input.addEventListener('change',function(){var f=input.files[0];document.getElementById('ant-file-help').textContent=f?f.name+' · '+f.size.toLocaleString('en-US')+' bytes':'Choose the file you want to keep.';});
    sessionState();
    // Read session readiness without deriving a key or asking for a signature.
    var sessionObserver=new MutationObserver(sessionState);
    ['kc-stat','wstat','core-badge'].forEach(function(id){var el=document.getElementById(id);if(el)sessionObserver.observe(el,{childList:true,subtree:true,characterData:true});});
    if(card._purchaseCleanup)card._purchaseCleanup();
    card._purchaseCleanup=function(){sessionObserver.disconnect();};
    stop.onclick=function(){if(active)active.abort();view.replaceChildren();status.textContent='Stopped waiting. Any submitted payment may still settle; resume the same file to reconcile.';};
    start.onclick=async function(){
      if(active)return;
      var file=document.getElementById('ant-buy-file').files[0],gas=document.getElementById('ant-buy-gas').value.trim();
      if(!file||file.size<3||file.size>33554432){status.textContent='Choose a public file from 3 bytes to 32 MiB.';return;}
      if(!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(gas)){status.textContent='Enter a separate ETH fee limit with at most 18 decimal places.';return;}
      var parts=gas.split('.'),gasWei=(BigInt(parts[0])*10n**18n+BigInt((parts[1]||'').padEnd(18,'0'))).toString();
      if(gasWei==='0'){status.textContent='The ETH network-fee limit must be greater than zero.';return;}
      if(!navigator.locks||!window.AntPay){status.textContent='This browser cannot safely coordinate storage payments. No payment was requested.';return;}
      active=new AbortController();var signal=active.signal;start.disabled=true;input.disabled=true;fee.disabled=true;stop.hidden=false;progress('prepare');receipt.textContent='';document.getElementById('ant-buy-proof').hidden=true;document.getElementById('ant-buy-download').replaceChildren();if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}
      try{
        await navigator.locks.request('bnr-ant-purchase-v1',{mode:'exclusive',ifAvailable:true},async function(lock){
          if(!lock)throw new Error('Another tab is handling a storage purchase. Resume after it finishes.');
          var signer,testProfile=ANT_TEST?await devnetProfile(signal):null;
          // connect first: the kit refuses nodes whose authenticated handshake names another
          // chain, token or vault than this profile, so the pin below is the nodes' own
          if(ANT_TEST)await antSession(signal);
          signer=paySigner(testProfile); // named by its pin; a mismatch refused above, never a fallback
          await signer.address(); // Public identity only; no key or signature leaves the keychain.
          status.textContent='Hashing the original file and opening Autonomi…';
          var bytes=new Uint8Array(await file.arrayBuffer());
          var sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
          recordSha=sha;
          var session=await antSession(signal),defaults=ANT_TEST?{payment:testProfile.payment,rpcUrl:testProfile.rpcUrl}:await session.sdk.getNetworkDefaults({signal:signal});
          var requestId=0;
          // F3: the payment RPC is the named endpoint or nothing — a redirect is refused, never followed
          // A failed fetch of a SUBMISSION is not proof the endpoint received nothing: the signed bytes,
          // their hash and the reservation are already kept, and the outcome is UNKNOWN until the chain
          // is read (resume does that; identical bytes can only ever run once). Only a read that failed
          // can say nothing was sent. A refused redirect is a refusal of this request, not evidence either way.
          var rpc=async function(method,params){var r;try{r=await fetch(defaults.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',redirect:'error',body:JSON.stringify({jsonrpc:'2.0',id:++requestId,method:method,params:params})});}catch(e){if(method==='eth_sendRawTransaction'){var u=new Error('The payment RPC did not answer the submission (unreachable, or it answered with a redirect, which is refused). It may still have received it: the signed transaction, its hash and its reservation are kept, and the outcome is unknown until you resume and the chain is read. Nothing new was sent.');u.refusal='uncertain';throw u;}throw new Error('Payment RPC unreachable, or it answered with a redirect, which is refused; this read was not completed and nothing was sent');}if(!r.ok)throw new Error('Payment RPC unavailable');var j=await r.json();if(j.error)throw new Error('Payment RPC refused '+method);return j.result;};
          var payer=AntPay.createHosted({artifact:{name:file.name,sha256:sha,bytes:file.size},network:defaults.payment,storage:localStorage,rpc:rpc,signer:signer,testnet:ANT_TEST});
          await payer.retryUnpaid(signal);
          var prior=payer.snapshot();
          if(prior.gasCeilingWei&&prior.gasCeilingWei!==gasWei)throw new Error('Use this file’s original ETH limit: '+ant(prior.gasCeilingWei)+' ETH.');
          var tasks=[];
          var payment={
            pay:async function(network,quotes,context){
              var inv;
              try{inv=await payer.invoice(network,quotes,gasWei,signal);}
              catch(error){
                // These refusals occur after the adapter validates the quote and
                // network. Keep the price visible without creating a payable plan.
                if(['short-ant','no-gas','gas-ceiling'].includes(error&&error.refusal)&&Array.isArray(quotes)&&quotes.length&&quotes.every(q=>typeof q.amount==='string'&&/^(0|[1-9]\d*)$/.test(q.amount))){
                  view.replaceChildren();view.className='ant-bill';
                  var heading=document.createElement('h3');heading.textContent='Storage price · payment unavailable';view.append(heading);
                  var costs=document.createElement('dl');
                  [['ANT total · this quoted part',ant(quotes.reduce((s,q)=>s+BigInt(q.amount),0n).toString())+' ANT','ant-invoice-total'],['Proposed ETH ceiling · whole file',ant(gasWei)+' ETH','ant-invoice-eth']].forEach(function(row){var group=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd');label.textContent=row[0];value.textContent=row[1];value.id=row[2];group.append(label,value);costs.append(group);});view.append(costs);
                  var reason=document.createElement('div');reason.textContent=error.message+'. No payment was authorized or sent. This price is not a payable invoice; prepare again after resolving the funding or fee limit.';view.append(reason);
                }
                throw error;
              }
              if(inv.txs.every(t=>t.state==='confirmed'))return payer.provider(inv.id).recover(network,quotes,{},context);
              if(inv.txs.some(t=>t.state==='sending'||t.state==='submitted'||t.state==='failed'))return payer.provider(inv.id).recover(network,quotes,{},context);
              status.textContent='Review this invoice. Nothing new is signed until you confirm.';
              view.replaceChildren();
              progress('review');view.className='ant-bill';
              var title=document.createElement('h3');title.textContent='Review before you pay';view.append(title);
              var totals=document.createElement('dl');
              [['ANT total · this invoice',ant(inv.total)+' ANT','ant-invoice-total'],['ETH ceiling · whole file',ant(inv.gasCeilingWei)+' ETH','ant-invoice-eth']].forEach(function(row){var group=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd');label.textContent=row[0];value.textContent=row[1];value.id=row[2];group.append(label,value);totals.append(group);});view.append(totals);
              var text=document.createElement('div');text.className='ant-meta';text.textContent=file.name+' · '+file.size.toLocaleString('en-US')+' bytes · '+(ANT_TEST?'local test network':'Arbitrum One')+'. Paying account: '+inv.payer+'. '+inv.txs.filter(t=>t.state==='planned').length+' planned transactions. Expires '+new Date(inv.expiresAt).toLocaleTimeString()+'. This invoice covers this part of the file; any additional part needs separate approval. Current maximum gas exposure: '+ant(inv.txs.reduce((s,t)=>s+BigInt(t.actualWei||t.reservedWei),0n).toString())+' ETH.';view.append(text);
              var details=document.createElement('details'),summary=document.createElement('summary'),raw=document.createElement('pre');summary.textContent='Invoice and contract bindings';raw.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';raw.textContent=JSON.stringify({invoice:inv.id,sha256:sha,network:defaults.payment,quotes:inv.payments,transactions:inv.txs},null,2);details.append(summary,raw);view.append(details);
              await new Promise(function(resolve,reject){
                var done=false,button=document.createElement('button');button.type='button';button.textContent='Authorize this invoice and ask my wallet';
                function end(error){if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);button.remove();error?reject(error):resolve();}
                function abort(){end(new Error('Invoice cancelled. No new signature requested.'));}
                var timer=setTimeout(()=>end(new Error('Invoice expired. No new signature requested.')),Math.max(0,inv.expiresAt-Date.now()));
                signal.addEventListener('abort',abort,{once:true});
                button.onclick=function(){try{if(signal.aborted)return abort();payer.authorize(inv);end();}catch(e){end(e);}};
                view.append(button);view.focus();if(signal.aborted)abort();
              });
              status.textContent=signer.isolated?'Confirm each payment in your isolated keychain, then wait for chain confirmation. Keep this page open.':'Signing with your bzDiD keychain and waiting for chain confirmation. Keep this page open.';
              return payer.provider(inv.id).pay(network,quotes,context);
            },
            recover:function(network,quotes,attempt,context){return payer.provider(null).recover(network,quotes,attempt,context);}
          };
          var originalPay=payment.pay;
          payment.pay=function(){var task=originalPay.apply(payment,arguments);tasks.push(task);return task;};
          var result=prior.result;
          if(!result){
            try{
            status.textContent='Preparing public storage; your wallet has not been asked to sign.';
            result=await session.client.upload(file,{visibility:'public',paymentMode:'single',payment:payment,signal:signal,checkpoint:prior.checkpoint||undefined,retainOnFailure:false,onCheckpoint:value=>payer.checkpoint(value)});
            payer.uploaded(result);
            }finally{await Promise.allSettled(tasks);}
          }
          progress('verify');status.textContent='Retrieving the stored file and checking its original SHA-256…';
          var downloaded=await session.client.download(result.file,{signal:signal});
          var reconciled=await payer.reconcile(downloaded.bytes);
          receipt.textContent=JSON.stringify(reconciled,null,2);document.getElementById('ant-buy-proof').hidden=false;
          downloadUrl=URL.createObjectURL(new Blob([downloaded.bytes],{type:file.type||'application/octet-stream'}));
          var download=document.createElement('a');download.href=downloadUrl;download.download=file.name;download.textContent='Download verified file';document.getElementById('ant-buy-download').append(download);
          view.replaceChildren();status.textContent='Stored and retrieved: all '+reconciled.retrievedBytes+' bytes match the original SHA-256. Receipt reconciled.';
        });
      }catch(error){status.textContent='Storage stopped: '+(error&&error.message||error)+'. Keep this browser’s saved data and resume the same file; do not start a second payment elsewhere.'+(recordSha&&localStorage.getItem(JOURNAL+recordSha)?' To continue on another browser, save this file’s payment record under “Limits & resuming”.':'');}
      finally{active=null;input.disabled=false;fee.disabled=false;stop.hidden=true;sessionState();refreshRecord();}
    };
    // ── the payment record for the chosen file ──
    // What this page already journals before every consequential step (invoice identity and
    // scope, the signed envelope and its hash, gas and quote reservations, the upload checkpoint
    // and the retrieval reference) can be carried to another browser as a file. Opened there, the
    // same file resumes from the kept record: confirmed payments are reused, an unknown broadcast
    // is reconciled from the chain, and nothing new is signed without a fresh authorization. The
    // record never carries a key. It is state transport for the existing payer, not another executor.
    var RECORD='bpay.ant.journal/1',recordSha=null,JOURNAL=ANT_TEST?'bnr.ant.purchase.test.v1:':'bnr.ant.purchase.v1:',CLAIMS_KEY=ANT_TEST?'bnr.ant.quote-claims.test.v1':'bnr.ant.quote-claims.v1';
    async function shaOf(file){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),function(b){return b.toString(16).padStart(2,'0');}).join('');}
    function refreshRecord(){
      var a=document.getElementById('ant-buy-record');if(!a)return;
      if(a.href&&a.href.indexOf('blob:')===0)URL.revokeObjectURL(a.href);
      var raw=recordSha&&localStorage.getItem(JOURNAL+recordSha);
      if(!raw){a.hidden=true;a.removeAttribute('href');a.removeAttribute('download');return;}
      var ledger=JSON.parse(raw),claims=JSON.parse(localStorage.getItem(CLAIMS_KEY)||'{}'),mine={};
      Object.keys(claims).forEach(function(q){if(claims[q]===recordSha)mine[q]=claims[q];});
      var record={schema:RECORD,testnet:ANT_TEST,exportedAt:new Date().toISOString(),artifact:ledger.artifact,network:ledger.network,ledger:ledger,claims:mine};
      a.href=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
      a.download='ant-payment-record-'+recordSha.slice(0,16)+(ANT_TEST?'-testnet':'')+'.json';a.hidden=false;
    }
    input.addEventListener('change',function(){var f=input.files[0];recordSha=null;refreshRecord();if(f)shaOf(f).then(function(h){if(input.files[0]===f){recordSha=h;refreshRecord();}});});
    // A record is EVIDENCE from another browser, not permission. Before anything is installed, the
    // whole ledger is checked for shape and consistency (artifact, network, one payer, chain id, every
    // transaction's fields), every kept envelope is independently decoded and its sender recovered
    // (AntPay._envelope.check, the same check that gates a broadcast), and the quote claims are derived
    // from the record's own plans — never taken from the file — and refused if another file here already
    // holds one of them. Asserted states (submitted, confirmed) are kept only as claims to re-verify:
    // resume re-reads every non-planned transaction from the chain (ant-pay.js observe) before any
    // receipt, and what the chain does not confirm stays UNKNOWN with its exposure held. Installation is
    // all-or-nothing under the same Web Lock a purchase takes, so a running purchase, a quota error or a
    // malformed claims store never leaves half a record or erases existing reservations.
    var isAddr=function(v){return /^0x[0-9a-fA-F]{40}$/.test(String(v));},isH32=function(v){return /^0x[0-9a-fA-F]{64}$/.test(String(v));},isDec=function(v){return typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v);},isQty=function(v){return typeof v==='string'&&/^0x[0-9a-fA-F]+$/.test(v);};
    var TX_STATES=['planned','sending','submitted','confirmed','failed','dropped'];
    function checkedRecord(record,sha,size){
      var bad=function(what){throw new Error(what);};
      if(!record||typeof record!=='object'||record.schema!==RECORD)bad('That is not a payment record this wallet wrote');
      if(record.testnet!==ANT_TEST)bad(record.testnet===true?'That record is from the test network; open it on wallet.html?net=devnet':'That record is for Arbitrum One, not the test network');
      var L=record.ledger,chainId=ANT_TEST?31337:42161;
      if(!L||typeof L!=='object'||L.v!==1||!Array.isArray(L.plans)||!L.artifact||!L.network||typeof L.artifact!=='object'||typeof L.network!=='object')bad('That record is malformed (no v1 ledger with a list of plans)');
      if(!record.artifact||JSON.stringify(L.artifact)!==JSON.stringify(record.artifact)||L.artifact.sha256!==sha||L.artifact.bytes!==size)bad('That record belongs to a different file than the one chosen');
      if(L.network.chainId!==chainId||!isAddr(L.network.paymentTokenAddress)||!isAddr(L.network.paymentVaultAddress)||(record.network&&JSON.stringify(record.network)!==JSON.stringify(L.network)))bad('That record names another payment network');
      if(L.gasCeilingWei!==undefined&&!isDec(L.gasCeilingWei))bad('That record has an unreadable ETH limit');
      ['checkpoint','result','receipt'].forEach(function(k){if(L[k]!==undefined&&L[k]!==null&&typeof L[k]!=='object')bad('That record is malformed ('+k+')');});
      if(L.receipt&&(L.receipt.retrievedSha256!==sha||L.receipt.schema!=='bpay.ant.reconciled/1'))bad('That record carries a receipt for other bytes');
      var verify=window.AntPay&&AntPay._envelope&&window.BnrSign?AntPay._envelope.nobleVerifier(window.BnrSign):null;
      if(!verify)bad('The independent envelope verifier did not load; reload this wallet');
      var payer=null,claims={},seenIds={};
      L.plans.forEach(function(p,i){
        var where='plan '+(i+1);
        if(!p||typeof p!=='object'||!isH32('0x'+String(p.id))&&!/^[0-9a-f]{64}$/.test(String(p.id))||!/^[0-9a-f]{64}$/.test(String(p.binding))||!/^[0-9a-f]{64}$/.test(String(p.scope)))bad('That record is malformed ('+where+' identity)');
        if(seenIds[p.id])bad('That record is malformed (a plan repeats)');seenIds[p.id]=true;
        if(!isAddr(p.payer)||(payer&&String(p.payer).toLowerCase()!==payer))bad('That record names more than one paying account');payer=String(p.payer).toLowerCase();
        if(!Array.isArray(p.payments)||!p.payments.length||!isDec(p.total)||!Number.isSafeInteger(p.expiresAt)||!isDec(p.gasCeilingWei)||!Array.isArray(p.txs)||!p.txs.length)bad('That record is malformed ('+where+')');
        var total=0n;p.payments.forEach(function(q){if(!q||!isH32(q.quote_hash)||!isAddr(q.rewards_address)||!isDec(q.amount_atto))bad('That record is malformed ('+where+' quotes)');total+=BigInt(q.amount_atto);});
        if(total!==BigInt(p.total))bad('That record is inconsistent ('+where+' total)');
        if(p.authorization!==null&&p.authorization!==undefined){var a=p.authorization;if(typeof a!=='object'||a.invoice!==p.id||a.scope!==p.scope||String(a.payer).toLowerCase()!==payer||a.artifactSha256!==sha||a.expiresAt!==p.expiresAt||a.gasCeilingWei!==p.gasCeilingWei)bad('That record is inconsistent ('+where+' authorization)');}
        var live=false;
        p.txs.forEach(function(t,j){
          var at=where+' transaction '+(j+1);
          if(!t||typeof t!=='object'||['approval','payment'].indexOf(t.kind)<0||TX_STATES.indexOf(t.state)<0||!isAddr(t.to)||!/^0x[0-9a-fA-F]{8}([0-9a-fA-F]{64})*$/.test(String(t.data))||!isQty(t.gas)||!isQty(t.maxFeePerGas)||!isQty(t.maxPriorityFeePerGas)||!isDec(t.reservedWei))bad('That record is malformed ('+at+')');
          if(t.kind==='approval'&&String(t.to).toLowerCase()!==String(L.network.paymentTokenAddress).toLowerCase())bad('That record is inconsistent ('+at+' approves another contract)');
          if(t.kind==='payment'&&(String(t.to).toLowerCase()!==String(L.network.paymentVaultAddress).toLowerCase()||String(t.data).toLowerCase()!==AntPay._wire.encodePayForQuotes(p.payments).toLowerCase()))bad('That record is inconsistent ('+at+' pays other quotes)');
          if(t.actualWei!==undefined&&!isDec(t.actualWei))bad('That record is malformed ('+at+' gas)');
          if(t.state==='planned'){if(t.raw!==undefined||t.hash!==undefined)bad('That record is inconsistent ('+at+' planned yet signed)');return;}
          // every kept envelope is checked here by code that did not sign it: fields, chain id, and the recovered sender
          if(!isQty(t.nonce)||!isH32(t.hash)||typeof t.raw!=='string')bad('That record is inconsistent ('+at+' sent without its signed bytes)');
          AntPay._envelope.check({raw:t.raw,hash:t.hash},{to:t.to,data:t.data,nonce:t.nonce,gas:t.gas,maxFeePerGas:t.maxFeePerGas,maxPriorityFeePerGas:t.maxPriorityFeePerGas},payer,verify,chainId);
          if(t.receipt!==undefined&&(t.receipt===null||typeof t.receipt!=='object'||String(t.receipt.transactionHash).toLowerCase()!==String(t.hash).toLowerCase()))bad('That record is inconsistent ('+at+' receipt)');
          if(t.state!=='dropped')live=true;
        });
        if(live&&!p.superseded)p.payments.forEach(function(q){claims[String(q.quote_hash).toLowerCase()]=sha;});
      });
      return {ledger:L,claims:claims,payer:payer};
    }
    document.getElementById('ant-buy-record-in').addEventListener('change',async function(){
      var say=document.getElementById('ant-buy-record-status'),rf=this.files[0];this.value='';if(!rf)return;
      try{
        var file=input.files[0];if(!file)throw new Error('Choose the same public file first, then open its payment record');
        if(active)throw new Error('A storage purchase is running in this page; wait for it to finish');
        if(!navigator.locks)throw new Error('This browser cannot safely coordinate storage payments');
        var record;try{record=JSON.parse(await rf.text());}catch(e){throw new Error('That file is not a payment record');}
        var sha=await shaOf(file);
        var checked=checkedRecord(record,sha,file.size);
        await navigator.locks.request('bnr-ant-purchase-v1',{mode:'exclusive',ifAvailable:true},async function(lock){
          if(!lock)throw new Error('Another tab is handling a storage purchase. Open the record after it finishes');
          var key=JOURNAL+sha,prevJ=localStorage.getItem(key),prevC=localStorage.getItem(CLAIMS_KEY);
          if(prevJ){var h;try{h=JSON.parse(prevJ);}catch(e){h=null;}if(!h||!Array.isArray(h.plans)||h.plans.some(function(p){return (p.txs||[]).some(function(t){return t.state!=='planned';});}))throw new Error('This browser already holds a payment record for this file. Resume that one; nothing was replaced');}
          var claims;try{claims=JSON.parse(prevC||'{}');if(!claims||typeof claims!=='object'||Array.isArray(claims))throw 0;}catch(e){throw new Error('This browser’s quote claims are unreadable; nothing was replaced');}
          Object.keys(checked.claims).forEach(function(q){if(claims[q]&&claims[q]!==sha)throw new Error('A quote in that record is already claimed by another file in this browser; nothing was replaced');});
          Object.keys(checked.claims).forEach(function(q){claims[q]=sha;});
          // all or nothing: both writes, or both restored
          try{localStorage.setItem(key,JSON.stringify(checked.ledger));localStorage.setItem(CLAIMS_KEY,JSON.stringify(claims));}
          catch(e){
            try{if(prevJ===null)localStorage.removeItem(key);else localStorage.setItem(key,prevJ);}catch(x){}
            try{if(prevC===null)localStorage.removeItem(CLAIMS_KEY);else localStorage.setItem(CLAIMS_KEY,prevC);}catch(x){}
            throw new Error('This browser could not keep the record (storage refused the write); nothing was installed');
          }
        });
        recordSha=sha;refreshRecord();
        var kept=checked.ledger.plans.reduce(function(n,p){return n+p.txs.filter(function(t){return t.state!=='planned'&&t.state!=='dropped';}).length;},0);
        say.textContent='Payment record opened for '+file.name+' ('+kept+' kept transaction'+(kept===1?'':'s')+' from '+checked.payer+'). Resume with the same file and ETH limit: each kept transaction is re-read from the chain before it counts, what the chain does not confirm stays unknown, and nothing new is signed without your authorization.';
      }catch(e){say.textContent='Record not opened: '+(e&&e.message||e)+'.';}
    });
    refreshRecord();
  }

  function invoiceBlock(inv, current){
    var d = inv.domain || {}, a = d.artifact || {}, q = (d.quote || {}), g = (d.gas || {}), p = (d.policy || {}), aud = (p.audience || {});
    var line = (inv.lines||[]).filter(function(l){return l.asset==='ANT';})[0];
    if(!line) return '';
    var sum = line.quotes.reduce(function(s,x){ return s+BigInt(x.amount_atto); }, 0n).toString();
    if(sum !== line.amountAtto) return '<div style="color:var(--amber)">this price did not add up, so it is not shown.<span class="wl-cyd"> quote sum mismatch, refused: the carried quotes sum to ' + esc(sum) + ' atto, the line says ' + esc(line.amountAtto) + '</span></div>';
    var sha = a.sha256 || '';
    var h = '<div style="margin-top:14px;padding:10px;border:1px solid ' + (current?'#2c4a5a':'#1d4655') + ';border-radius:10px' + (current?'':';opacity:.8') + '">';
    h += '<div style="font-size:11px;letter-spacing:.08em;color:' + (current?'var(--cyan)':'var(--amber)') + '">' + (current
      ? T('wl.bpay.quote.current','Current storage quote: caused by your choice')
      : T('wl.bpay.quote.ref','Reference quote (not chosen by you)')) + '</div>';
    if (current) h += '<div style="font-size:12px;margin-top:4px">' + T('wl.bpay.youchose','You chose') + ' <b>🌐 ' + T('wl.bpay.aud.public','Public') + '</b>: ' + esc(aud.access || p.access || '') + '</div>';
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
    h += '<div style="font-size:10px;opacity:.65;margin-top:2px">' + T('wl.bpay.singleuse','single-use: re-quoted at payment time; this exact set is persisted on the keyless bridge') + '</div>';
    h += '<div style="font-size:10px;opacity:.65" ' + (current && d.trezor_ux && d.trezor_ux.expected_confirmations==null ? 'data-bpay-expected-confirmations=""' : '') + '>' + T('wl.bpay.shape','payment shape on record; device confirmations will be shown from the transaction plan produced by the payment adapter, never inferred from the quote count') + '</div>';
    h += '<div style="font-size:10px;font-family:monospace;opacity:.6;margin-top:2px;overflow-wrap:anywhere">' + T('wl.bpay.commit','commitment') + ' ' + esc((inv.commitment&&inv.commitment.digest)||'') + '</div>';
    if (current) h += '<div style="margin-top:8px;font-size:12px;font-weight:bold">' + T('wl.bpay.nothingpaid','Nothing has been paid.') + '</div>';
    h += '</div>';
    return h;
  }

  function applyInspection(){
    var want = document.body.dataset.reg === 'bee' ? 'newbee' : (document.body.dataset.reg || 'newbee');
    var order = { newbee:0, raver:1, cypherpunk:2 };
    card.querySelectorAll('[data-min-insp]').forEach(function(el){
      el.style.display = (order[(el.dataset.minInsp||'cypherpunk')] <= order[want]) ? '' : 'none';
    });
  }

  function render(){
    stopQuote();
    var h = renderChooser();
    if (refInvoice) h += '<details id="bpay-reference" data-min-insp="cypherpunk" style="display:none"><summary>Reference invoice</summary>'+invoiceBlock(refInvoice, false)+'</details>';
    h += '<div id="bpay-fresh"></div>';
    card.innerHTML = h;
    bindPurchase();
    applyInspection();
    // audience selection — the ONE available choice; unavailable rows are
    // plain prose with their reasons (never promised, never pressable)
    card.querySelectorAll('[data-audience]').forEach(function(b){
      b.addEventListener('click', function(){
        if (b.getAttribute('aria-disabled') === 'true') return;
        if (b.dataset.audience !== 'public') return; // unavailable modes are never selectable
        if (st.audience === 'public') return;        // already chosen: a second tap never drops a quote on its way
        st.audience = 'public'; st.selectedAt = new Date().toISOString();
        save({ audience: 'public', selectedAt: st.selectedAt }); // policy-owned merge write — service fields of other tabs survive
        render();
      });
    });
    var quoteButton=document.getElementById('ant-quote-go');if(quoteButton)quoteButton.onclick=quoteFile;
    var cancel=document.getElementById('ant-quote-cancel');if(cancel)cancel.onclick=function(){stopQuote();document.getElementById('ant-quote-status').textContent='Request stopped. Nothing was paid.';quoteControls(false);};
    var bridgeInput = document.getElementById('bpay-bridge');
    if (bridgeInput) bridgeInput.addEventListener('change', function(){ st.bridge = bridgeInput.value.trim() || BRIDGE_DEFAULT; save({ bridge: st.bridge }); });
    var go = document.getElementById('bpay-quote-go');
    if (go) go.addEventListener('click', freshQuote);
  }

  function quoteControls(busy){
    var button=document.getElementById('ant-quote-go'),input=document.getElementById('ant-quote-file'),cancel=document.getElementById('ant-quote-cancel');
    if(button)button.disabled=busy;if(input)input.disabled=busy;if(cancel)cancel.hidden=!busy;
  }
  function stopQuote(){var run=quoteRun;quoteRun=null;if(run)run.stop.abort(new DOMException('Quote stopped','AbortError'));}
  // One Autonomi connection per page, opened on the first quote and reused.
  async function antSession(signal){
    var sdk;
    try{ sdk=await (antKit||(antKit=import(ANT_KIT+'index.js'))); }
    catch(error){ var kit=new Error('Autonomi browser kit did not load',{cause:error}); kit.kit=true; throw kit; }
    if(antClient){ var open=await antClient.catch(function(){return null;}); if(open&&!open.closed)return {sdk:sdk,client:open}; antClient=null; }
    var connecting=ANT_TEST
      ? devnetProfile(signal).then(function(p){return sdk.AutonomiClient.connect({network:{id:p.id,seeds:p.seeds,payment:p.payment},expectedPaymentNetwork:p.payment,signal:signal});})
      : sdk.AutonomiClient.connect({signal:signal});
    antClient=connecting;
    try{ return {sdk:sdk,client:await connecting}; }
    catch(error){ if(antClient===connecting)antClient=null; if(error&&typeof error==='object')error.connect=true; throw error; }
  }
  function quoteError(error){
    if(error&&error.kit)return 'Quote unavailable: the Autonomi browser kit did not load. Reload and try again.';
    if(error&&error.connect)return 'Quote unavailable: could not reach Autonomi storage nodes from this browser. Nothing was paid.';
    if(error&&error.amount)return 'Quote unavailable: Autonomi returned an amount this page cannot read. Nothing was paid.';
    return 'Quote unavailable: Autonomi storage nodes did not return a price for this file. Nothing was paid.';
  }
  async function quoteFile(){
    var input=document.getElementById('ant-quote-file'),output=document.getElementById('ant-quote-status');
    if(quoteRun)return;
    var file=input.files&&input.files[0];output.textContent='';
    if(!antLimits){output.textContent='Quote unavailable: the Autonomi browser kit did not load. Reload and try again.';return;}
    // The kit's own limits gate the file before any Autonomi call.
    if(st.audience!=='public'||!file||!(file.size>=antLimits.minFileBytes&&file.size<=antLimits.maxFileBytes)){output.textContent='choose a file from '+sizeRange()+' to see its price.';return;}
    var run={stop:new AbortController()};quoteRun=run;quoteControls(true);
    output.textContent='Connecting to Autonomi storage nodes from this browser…';
    // The kit pauses every upload at the payment step and hands this page the
    // request; the page reads the price and cancels. request.pay() is never called.
    var asked=null,chunks=new Set(),total=0,windowed=false;
    try{
      var session=await antSession(run.stop.signal);if(quoteRun!==run)return;
      output.textContent='Asking Autonomi storage nodes for a price…';
      var payment=session.sdk.createManualPaymentProvider({onRequest:function(request){if(!asked)asked=request;request.cancel(new Error('Quote only: this page never pays'));}});
      var finished=await session.client.upload(file,{
        visibility:'public',payment:payment,retainOnFailure:false,signal:run.stop.signal,
        onCheckpoint:function(){}, // nothing is paid, so no payment journal is kept
        onProgress:function(event){
          // The kit reports each chunk it priced or found already stored as "<n>/<total>".
          var message=String(event&&event.message||''),record=/^(?:Quoted|Already present) record (\d+)\/(\d+)$/.exec(message);
          if(record){chunks.add(record[1]);total=Math.max(total,+record[2]);}
          else if(message.indexOf('Preparing storage for '+file.name+' records ')===0)windowed=true;
        }
      }).then(function(result){return result;},function(error){if(asked)return null;throw error;});
      if(quoteRun!==run)return;
      var when=new Date().toLocaleTimeString(),size=file.size.toLocaleString('en-US')+' bytes';
      if(!asked){
        // The upload finished without a payment request: every chunk is already held.
        if(!finished||finished.storageCostAtto!=='0')throw new Error('Autonomi finished without a price');
        output.textContent='0 ANT · '+size+' · checked '+when+' · Autonomi storage nodes already hold every chunk of this file. Nothing was stored or paid.';
        return;
      }
      var amount=String(asked.totalAmountAtto);
      if(!/^\d+$/.test(amount)){var bad=new Error('Autonomi returned an amount that is not a whole number');bad.amount=true;throw bad;}
      // A merkle batch is priced at its maximum; the paid amount can be lower.
      var price=(asked.merkle?'up to ':'')+ant(amount)+' ANT';
      // Autonomi can ask for payment in parts (64-chunk payment waves, merkle
      // batches, browser storage windows); later parts are priced only after the
      // earlier part is paid. The price is whole only when every chunk was seen.
      var whole=!windowed&&total>0&&chunks.size>=total;
      output.textContent=whole
        ? price+' · '+size+' · quoted '+when+' · from Autonomi storage nodes. ETH network fees are separate. Quote only; nothing was stored on Autonomi or paid.'
        : price+' for '+chunks.size+(!windowed&&total>chunks.size?' of '+total:'')+' chunks of this file · '+size+' · quoted '+when+' · from Autonomi storage nodes. The rest is priced only after that part is paid, so the full price is not known here. ETH network fees are separate. Quote only; nothing was stored on Autonomi or paid.';
    }catch(error){if(quoteRun===run){try{console.warn('Autonomi quote:',error);}catch(e){}output.textContent=quoteError(error);}}
    finally{if(quoteRun===run){quoteRun=null;quoteControls(false);}}
  }
  window.addEventListener('pagehide',function(){
    stopQuote();
    var open=antClient;antClient=null;
    if(open)open.then(function(client){client.close();},function(){});
  });

  function freshQuote(){
    var stat = document.getElementById('bpay-quote-stat');
    var fresh = document.getElementById('bpay-fresh');
    if (!st.bridge) { if(stat) stat.textContent = 'no reference quote service is set; get Autonomi quote prices your own file.'; return; }
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

  new MutationObserver(function(){
    st.inspection = document.body.dataset.reg === 'bee' ? 'newbee' : document.body.dataset.reg;
    save({ inspection: st.inspection });
    applyInspection();
  }).observe(document.body, { attributes:true, attributeFilter:['data-reg'] });

  var invoiceLoad = fetch('bpay-invoice.json').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
   .then(function(inv){ refInvoice = inv; PIN = inv.domain && inv.domain.artifact && inv.domain.artifact.sha256; }, function(){});
  // first paint waits for the kit's limits so the file label never shows a guessed size
  Promise.all([invoiceLoad, limitsLoad]).then(render);
})();
