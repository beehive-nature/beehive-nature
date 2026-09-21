/* myspace-adapter-ant.js — Autonomi (ANT) public storage as an adapter on
   SPEC-ADAPTER-CONTRACT-1, browser carrier (§2), behind one dedicated worker.

   MY SPACE rail 4 (bee-laborer, 2026-09-21 06:04Z; rulings 06:07Z, 06:24Z,
   06:27Z). A file on this rail is readable by anyone who has its address, lasts
   as long as the network does, can never be deleted, and is paid for by the
   visitor from their own wallet. Those four answers are the whole reason this
   rail exists, and they are declared below, not implied.

   THE KEY NEVER CROSSES (§4), AND HERE THERE ARE TWO KEYS. The device key signs
   nothing for this rail: it has no member list. The key that pays is an EVM key
   in the visitor's own injected wallet, and neither this worker nor the page
   ever holds, derives or stores it. Payment is three halves in the order §6
   fixes:

       x.preparePut  → the door self-encrypts and quotes; this adapter returns
                       the quote and the plan — NOTHING signed, nothing spent
       (page)        → shows the price, checks the wallet's own balance, and
                       only on the visitor's tap asks THEIR wallet to pay
       x.finalizePut → the door stores against the paid quotes

   THE DOOR. Every request here goes to the estate's door on relay.skaists.dev.
   MY SPACE is served from skaists.dev (GitHub Pages), which can never answer
   /ant/v1/*, so a relative path would be a door that does not exist (ZcODe,
   2026-09-21 06:34Z). The READ route is the one `ant-door-cors.html` already
   proved from skaists.dev — a cross-origin GET under the door's CORS read rule
   for https://skaists.dev (2026-09-04) — so this is not a second fetch path. The
   write routes below are the shape this adapter calls, written down so the
   door's builder has one to build against:

       GET  /ant/v1/upload/prepare      → 200 {max_bytes}       the door is open
       POST /ant/v1/upload/prepare      body = the file's bytes (never a path)
                                        → 200 {upload_id, payment_type,
                                               total_atto, chunks, quotes,
                                               data_map_address}
       POST /ant/v1/upload/finalize     {upload_id, txs: [{quote_hash, tx_hash}]}
                                        → 200 {data_map_address}

   Finalize names a payment PER QUOTE, not a bare list of transactions: ant-core's
   finalize takes a quote→tx map and refuses a non-zero quote with no entry
   (ZcODe, 06:39Z, from ant-cli-v0.3.7: file.rs:2274, batch.rs:296). A flat list
   has no honest mapping, so this adapter never sends one.
       GET  /ant/v1/data/public/<addr>  → 200 {data: base64}    (ant-door-cors.html)

   AS OF THIS SLICE THE WRITE DOOR DOES NOT EXIST. `ant-door.html` says of the
   door that is there: "GET-only, all other endpoints refused". So on the live
   estate the first GET above is refused and this rail answers
   "the estate's write door for this rail is not open" — BEFORE a single byte of
   the file is sent and before any price is shown. That sentence is retired by
   the merge that opens the door, and by nothing else (ruling 06:24Z).

   METHOD NAMES ARE `x.`-PREFIXED for the reason the Blossom adapter gives:
   contract v1 carries no method that moves bytes. */

var RAIL = 'ant';
var SCHEME = 'ant';
var DOOR = 'https://relay.skaists.dev/ant/v1';

var E = {
  RAIL_UNREACHABLE: -32001,
  BAD_PARAMS: -32007,
  METHOD_ABSENT: -32008,
  UNKNOWN_INTENT: -32021,
  RAIL_REFUSED: -32022,
  NOT_FOUND: -32024,
  /* The two refusals that happen BEFORE the file leaves the phone. The page
     reads these codes to know whether it may still say "nothing left this
     phone" — so an adapter that returns one of them after it has sent the
     bytes would make the page lie. Both are thrown only above the POST. */
  DOOR_CLOSED: -32030,
  TOO_LARGE: -32031
};

function fail(code, message) {
  var e = new Error(message);
  e.code = code;
  return e;
}

function isHex64(s) { return typeof s === 'string' && /^(0x)?[0-9a-fA-F]{64}$/.test(s); }
function bare(s) { return s.replace(/^0x/, '').toLowerCase(); }

/* ---------- intents ----------
   A prepared upload waiting for its payment. Dropped when its finalize
   SUCCEEDS; a failed finalize KEEPS it, because a finalize after an on-chain
   payment is the one call that must be resubmittable (SPEC-AUTONOMI-TREZOR-1
   §4, the stranded-payment rule) and the shell — not this adapter — decides
   whether to. */

var INTENTS = new Map();
var INTENT_TTL_MS = 30 * 60 * 1000;

function newIntent(rec) {
  var cut = Date.now() - INTENT_TTL_MS;
  INTENTS.forEach(function (v, k) { if (v.born < cut) INTENTS.delete(k); });
  var id = RAIL + ':' + Date.now().toString(36) + ':' + crypto.randomUUID().slice(0, 8);
  rec.born = Date.now();
  INTENTS.set(id, rec);
  return id;
}

/* ---------- the door ---------- */

async function doorCeiling() {
  var res;
  try {
    res = await fetch(DOOR + '/upload/prepare', { method: 'GET', cache: 'no-store' });
  } catch (e) {
    throw fail(E.DOOR_CLOSED, 'the estate\'s write door for this rail is not open');
  }
  if (!res.ok) throw fail(E.DOOR_CLOSED, 'the estate\'s write door for this rail is not open');
  var out = await res.json().catch(function () { return null; });
  var max = out && out.max_bytes;
  if (typeof max !== 'number' || !(max > 0)) {
    throw fail(E.DOOR_CLOSED, 'the estate\'s write door did not say how large a file it takes, so nothing was sent to it');
  }
  return max;
}

/* A plan the page will ask a wallet to pay is read strictly. A missing or
   malformed field is a refusal: a default here would be a price nobody quoted. */
function readPlan(out) {
  if (!out || typeof out !== 'object') return null;
  if (typeof out.upload_id !== 'string' || !out.upload_id) return null;
  if (typeof out.payment_type !== 'string' || !out.payment_type) return null;
  if (typeof out.total_atto !== 'string' || !/^\d+$/.test(out.total_atto)) return null;
  if (!isHex64(out.data_map_address)) return null;
  if (!Array.isArray(out.quotes) || !out.quotes.length) return null;
  /* Every quote well-formed, and the quotes ADD UP to the price the page will
     show. A total that is not the sum of what is being paid is a price nobody
     can check. */
  var sum = 0n;
  for (var i = 0; i < out.quotes.length; i++) {
    var q = out.quotes[i];
    if (!q || !isHex64(q.quote_hash) || typeof q.amount_atto !== 'string' || !/^\d+$/.test(q.amount_atto)) return null;
    if (typeof q.rewards_address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(q.rewards_address)) return null;
    sum += BigInt(q.amount_atto);
  }
  if (sum !== BigInt(out.total_atto)) return null;
  var chunks = out.chunks && typeof out.chunks.total === 'number' ? out.chunks.total : null;
  if (chunks === null) return null;
  return {
    upload_id: out.upload_id,
    payment_type: out.payment_type,
    total_atto: out.total_atto,
    chunks: chunks,
    quotes: out.quotes,
    data_map_address: bare(out.data_map_address)
  };
}

var METHODS = {
  describe: function () {
    return {
      rail: RAIL,
      adapter_version: '0.1.0',
      contract_version: '1',
      capabilities: ['x.preparePut', 'x.finalizePut', 'x.get'],
      /* Non-empty, and that is load-bearing: the shell routes no purpose but a
         network-allowed one to a rail that declares any network, so every
         keep-it-here purpose is refused here by construction. */
      networks: ['autonomi', 'arbitrum-one'],
      units: ['ANT', 'ETH'],
      /* The founder's four questions, answered for this rail.
         deletable:false — the network has no delete; there is no x.drop.
         readers:'everyone' — a public upload is read by anyone with its address,
           with no member list in front of it (ant-door.html reads it unsigned).
         lifetime:'permanent' — paid once, kept by the network, not by us.
         payer:'you' — CONSTITUTION.md:83 and :128: users fund the resources they
           consume and ANT is never subsidised (ruling 06:07Z). */
      x_terms: {
        deletable: false,
        readers: 'everyone',
        lifetime: 'permanent',
        survives_reload: true,
        payer: 'you'
      }
    };
  },

  'x.preparePut': async function (p) {
    if (!(p && p.bytes instanceof Uint8Array) || !p.bytes.length) throw fail(E.BAD_PARAMS, 'needs {bytes} as a non-empty Uint8Array');
    /* Both checks happen BEFORE the bytes are sent, which is what lets the page
       keep saying "nothing left this phone" when either refuses. */
    var max = await doorCeiling();
    if (p.bytes.length > max) {
      throw fail(E.TOO_LARGE, 'this file is ' + p.bytes.length + ' bytes and the estate\'s door takes at most ' + max + ', so nothing was sent to it');
    }
    var res = await fetch(DOOR + '/upload/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: p.bytes,
      cache: 'no-store'
    });
    var text = await res.text();
    if (!res.ok) throw fail(E.RAIL_REFUSED, 'the estate\'s door would not price this file (HTTP ' + res.status + ')');
    var plan = readPlan(JSON.parse(text || 'null'));
    if (!plan) throw fail(E.RAIL_REFUSED, 'the estate\'s door answered without a complete price, so there is nothing to pay');
    var intent = newIntent({ plan: plan, size: p.bytes.length });
    return {
      intent_id: intent,
      quote: { ant_atto: plan.total_atto, chunks: plan.chunks, payment_type: plan.payment_type },
      plan: plan
    };
  },

  'x.finalizePut': async function (p) {
    var rec = p && p.intent_id && INTENTS.get(p.intent_id);
    if (!rec) throw fail(E.UNKNOWN_INTENT, 'no open upload by that id');
    var txs = p.txs;
    if (!Array.isArray(txs) || !txs.length || !txs.every(function (x) { return x && isHex64(x.quote_hash) && isHex64(x.tx_hash); })) {
      throw fail(E.BAD_PARAMS, 'needs {txs} as a non-empty list of {quote_hash, tx_hash}');
    }
    /* Every quote that costs anything is paid, by exactly one entry, and no
       entry names a quote this door did not give. Checked here so a partial
       payment is refused by the page's own adapter, not only by the door. */
    var owed = rec.plan.quotes.filter(function (q) { return q.amount_atto !== '0'; }).map(function (q) { return bare(q.quote_hash); });
    var paid = txs.map(function (x) { return bare(x.quote_hash); });
    var known = rec.plan.quotes.map(function (q) { return bare(q.quote_hash); });
    if (owed.some(function (h) { return paid.indexOf(h) < 0; })) throw fail(E.BAD_PARAMS, 'a quote was not paid, so the door would refuse to store it (missing_quote_tx)');
    if (paid.some(function (h) { return known.indexOf(h) < 0; })) throw fail(E.BAD_PARAMS, 'a payment names a quote this door did not give');
    if (new Set(paid).size !== paid.length) throw fail(E.BAD_PARAMS, 'a quote was paid twice');
    var res = await fetch(DOOR + '/upload/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_id: rec.plan.upload_id, txs: txs }),
      cache: 'no-store'
    });
    var out = await res.json().catch(function () { return {}; });
    if (!res.ok) throw fail(E.RAIL_REFUSED, 'the network did not confirm storing it (HTTP ' + res.status + ')');
    if (!isHex64(out.data_map_address) || bare(out.data_map_address) !== rec.plan.data_map_address) {
      throw fail(E.RAIL_REFUSED, 'the door confirmed an address that is not the one it quoted');
    }
    INTENTS.delete(p.intent_id);
    return { scheme: SCHEME, address: rec.plan.data_map_address, size: rec.size };
  },

  /* The read path is ant-door-cors.html's, unsigned: the same origin, the same
     route, the same {data: base64} envelope. Not a second fetch path. */
  'x.get': async function (p) {
    if (!(p && isHex64(p.address))) throw fail(E.BAD_PARAMS, 'needs {address} as 64 hex');
    var res = await fetch(DOOR + '/data/public/' + bare(p.address), { cache: 'no-store' });
    if (res.status === 404) throw fail(E.NOT_FOUND, 'nothing is stored at that address');
    if (!res.ok) throw fail(E.RAIL_UNREACHABLE, 'the estate\'s door did not answer (HTTP ' + res.status + ')');
    var out = await res.json();
    if (!out || typeof out.data !== 'string') throw fail(E.RAIL_REFUSED, 'the door answered without the bytes');
    var bin = atob(out.data);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes: bytes };
  }
};

self.onmessage = async function (ev) {
  var m = ev.data;
  if (!m || m.jsonrpc !== '2.0' || typeof m.id !== 'number') return;
  var fn = METHODS[m.method];
  if (!fn) {
    postMessage({ jsonrpc: '2.0', id: m.id, error: { code: E.METHOD_ABSENT, message: 'method not on this adapter: ' + m.method } });
    return;
  }
  try {
    postMessage({ jsonrpc: '2.0', id: m.id, result: await fn(m.params || {}) });
  } catch (e) {
    var unreachable = /Failed to fetch|NetworkError|abort/i.test((e && e.message) || '');
    postMessage({
      jsonrpc: '2.0', id: m.id,
      error: {
        code: (e && e.code) || (unreachable ? E.RAIL_UNREACHABLE : -32000),
        message: (e && e.message) || String(e)
      }
    });
  }
};
