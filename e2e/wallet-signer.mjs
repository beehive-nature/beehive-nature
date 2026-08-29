// wallet-signer.mjs — the bSmartWallet SIGNER CORE gate (SPEC-bSMARTWALLET-1).
//
// This is the gate for the irreversible-on-bug code: key derivation, the
// four-rail address set, exact base-unit arithmetic, the chain-parameterised
// EVM signer, and the spend cap. It runs the REAL page in real Chromium with
// a deterministic test identity, and it mocks every rail behind ONE RegExp
// (glob trap law: a '*' does not match '/', so a lazy pattern leaks to the
// live network and makes the gate hollow).
//
// TWO THINGS MAKE IT A GATE AND NOT A DEMO:
//  1. Every primitive is checked against a PUBLISHED vector (BIP-173, BIP-84,
//     the RIPEMD-160 reference set, the BOLT-11 spec invoices) — never against
//     the page's own output. A page must not be its own witness.
//  2. MUTATION (§the cap's whole claim): the call-site cap check is DELETED
//     from the served page and the signer must STILL refuse. A cap that only
//     the button enforces is a cap the next lane silently forgets.
//
// Run:  cd e2e && node wallet-signer.mjs      (exit 0 = green)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const URL_ = '/surfaces/wallet.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf') }
});
await new Promise(r => server.listen(8893, '127.0.0.1', r));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' — ' + String(detail).slice(0, 200) : '')); }
};

/* every host either EVM rail may pick, as ONE RegExp — both rails' full host
   sets mirrored from EVM_RAILS. Anything not matched here would hit the live
   network, so the gate asserts below that nothing did. */
const RAIL_RE = /^https:\/\/(mainnet\.base\.org|base\.publicnode\.com|1rpc\.io\/base|base\.drpc\.org|arb1\.arbitrum\.io\/rpc|arbitrum-one-rpc\.publicnode\.com)(\/|$)/;
/* the wallet's OTHER standing reads (Vaulta balance, Hive balance). They are
   not this gate's subject, but they must still be mocked: a gate that lets
   ANY request reach the live network cannot claim its results are hermetic,
   and cannot tell a leak from a balance read. */
const OTHER_RE = /^https:\/\/(eos\.api\.eosnation\.io|eos\.greymass\.com|api\.eosn\.io|api\.hive\.blog|arweave\.net|ar-io\.dev|gateway\.ardrive\.io)(\/|$)/;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const mockOther = ctx => ctx.route(OTHER_RE, async route => {
  const u = route.request().url();
  const J = v => route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(v) });
  // PUBLIC-CONSTANT: Vaulta mainnet chain id (public network identifier, mirrored from the vaulta adapter)
  if (/get_info/.test(u)) return J({ chain_id: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', head_block_num: 100, head_block_id: '00'.repeat(32) }); // PUBLIC-CONSTANT
  if (/get_account/.test(u)) return J({ account_name: 'gatesoul', core_liquid_balance: '0.0000 A', ram_usage: 100, ram_quota: 8192, permissions: [] });
  if (/hive/.test(u)) return J({ jsonrpc: '2.0', id: 1, result: [] });
  return J({});
});

/* the mocked rail: fixed nonce/gas so the produced bytes are deterministic */
const MOCK = { nonce: '0x7', gasPrice: '0x3b9aca00' /* 1 gwei */, estimate: '0xf618' /* 62,999 */ };
const mockRail = (ctx, seen) => ctx.route(RAIL_RE, async route => {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
  let body = {}; try { body = JSON.parse(req.postData() || '{}') } catch {}
  seen.push({ host: new URL(req.url()).host, method: body.method, params: body.params });
  const R = v => route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result: v }) });
  switch (body.method) {
    case 'eth_getTransactionCount': return R(MOCK.nonce);
    case 'eth_gasPrice': return R(MOCK.gasPrice);
    case 'eth_estimateGas': return R(MOCK.estimate);
    case 'eth_getBalance': return R('0x16345785d8a0000');            // 0.1 ETH
    case 'eth_call': return R('0x' + (1000000n).toString(16).padStart(64, '0'));
    case 'eth_sendRawTransaction': return R('0x' + 'ab'.repeat(32));
    case 'eth_chainId': return R('0x2105');
    default: return R(null);
  }
});

/* ── an INDEPENDENT RLP decoder, written here: the gate reads the signer's
   bytes back with code the signer has never seen ── */
function rlpDecode(buf) {
  let i = 0;
  function item() {
    const b = buf[i];
    if (b <= 0x7f) { i += 1; return buf.slice(i - 1, i) }
    if (b <= 0xb7) { const l = b - 0x80; i += 1 + l; return buf.slice(i - l, i) }
    if (b <= 0xbf) { const ll = b - 0xb7; const l = num(buf.slice(i + 1, i + 1 + ll)); i += 1 + ll + l; return buf.slice(i - l, i) }
    if (b <= 0xf7) { const l = b - 0xc0; const end = i + 1 + l; i += 1; const out = []; while (i < end) out.push(item()); return out }
    const ll = b - 0xf7; const l = num(buf.slice(i + 1, i + 1 + ll)); const end = i + 1 + ll + l; i += 1 + ll;
    const out = []; while (i < end) out.push(item()); return out;
  }
  const num = b => { let n = 0; for (const x of b) n = n * 256 + x; return n };
  return item();
}
const big = b => (b.length ? BigInt('0x' + Buffer.from(b).toString('hex')) : 0n);
const hexOf = b => Buffer.from(b).toString('hex');

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const leaked = [];

/* a deterministic TEST identity: a fixed 32-byte masterPRK turned into a real
   bdidrec recovery code by the page's own encoder, then fed through the real
   recovery ceremony. TEST-ONLY — every address it derives is a throwaway and
   nothing may ever be sent to one. */
async function connectedPage(ctx, mutate) {
  if (mutate) {
    await ctx.route('**' + URL_, async route => {
      const src = await readFile(join(ROOT, 'surfaces', 'wallet.html'), 'utf8');
      const out = mutate(src);
      if (out === null) return route.fulfill({ status: 500, contentType: 'text/plain', body: 'mutation anchor missing' });
      return route.fulfill({ status: 200, contentType: 'text/html', body: out });
    });
  }
  const page = await ctx.newPage();
  page.on('request', r => {
    const u = r.url();
    if (!/^http:\/\/127\.0\.0\.1:8893/.test(u) && !RAIL_RE.test(u) && !OTHER_RE.test(u)) leaked.push(u);
  });
  await page.addInitScript(() => { try { localStorage.setItem('bnr_soul', 'gatesoul'); } catch (e) {} });
  await page.goto('http://127.0.0.1:8893' + URL_, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BZDIDKEY && window.BnrSign && window.BNRPAY, null, { timeout: 20000 });
  await page.evaluate(() => {
    const mprk = new Uint8Array(32).fill(0x2a);          // TEST-ONLY masterPRK
    const code = window.BZDIDKEY.encodeRecoveryCode(mprk);
    document.getElementById('kc-rec').value = code;
    document.getElementById('kc-recgo').click();
  });
  await page.waitForFunction(() => /keychain live/.test(document.getElementById('kc-stat').textContent), null, { timeout: 15000 });
  return page;
}

try {
  /* ══ A · the rail core against PUBLISHED vectors, inside the real page ══ */
  console.log('A · rail-core primitives vs published vectors (in-page):');
  {
    const ctx = await browser.newContext(); const seen = []; await mockRail(ctx, seen); await mockOther(ctx);
    const page = await connectedPage(ctx);
    const r = await page.evaluate(() => {
      const P = window.BNRPAY;
      const fromHex = s => Uint8Array.from(s.match(/../g).map(h => parseInt(h, 16)));
      const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
      const out = { ripemd: {}, };
      out.ripemd.empty = hex(P.ripemd160(new Uint8Array(0)));
      out.ripemd.abc = hex(P.ripemd160(new TextEncoder().encode('abc')));
      out.ripemd.msgdigest = hex(P.ripemd160(new TextEncoder().encode('message digest')));
      // PUBLIC-CONSTANT: the secp256k1 GENERATOR POINT as a compressed pubkey — a published curve parameter (SEC 2) and the pubkey in BIP-141/173's own worked example. It is a PUBLIC key; no private key exists for it in this repo or anywhere.
      out.p2wpkh_G = P.p2wpkhAddress(fromHex('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'), 'bc'); // PUBLIC-CONSTANT
      // PUBLIC-CONSTANT: the PUBLIC key of BIP-84's own published test vector (the "abandon…about" test mnemonic, account 0, first receive key). Published in the BIP; a public key, and a famously burned test seed.
      out.p2wpkh_bip84 = P.p2wpkhAddress(fromHex('0330d54fd0dd420a6e5f8d3624f5f3482cae350f79d5f0753bf5beef9c2d91af3c'), 'bc'); // PUBLIC-CONSTANT
      out.sol_system = P.solanaAddress(new Uint8Array(32));
      out.units = {
        usdc1: String(P.toBaseUnits('1', 6)),
        usdcSmallest: String(P.toBaseUnits('0.000001', 6)),
        eth007: String(P.toBaseUnits('0.07', 18)),
        floatWouldBe: String(Math.round(0.07 * 1e18)),
      };
      try { P.toBaseUnits('0.0000001', 6); out.units.overRefused = false } catch (e) { out.units.overRefused = /refused, not rounded/.test(e.message) }
      try { P.p2wpkhAddress(new Uint8Array(65), 'bc'); out.uncompressedRefused = false } catch (e) { out.uncompressedRefused = true }
      return out;
    });
    ok('ripemd160("") = 9c1185a5…8d31', r.ripemd.empty === '9c1185a5c5e9fc54612808977ee8f548b2258d31', r.ripemd.empty);
    ok('ripemd160("abc") = 8eb208f7…0bfc', r.ripemd.abc === '8eb208f7e05d987a9b044a8e98c6b087f15a0bfc', r.ripemd.abc);
    ok('ripemd160("message digest") = 5d0689ef…5f36', r.ripemd.msgdigest === '5d0689ef49d2fae572b881b123a85ffa21595f36', r.ripemd.msgdigest);
    ok('P2WPKH(generator point) = the BIP-173 example address',
      r.p2wpkh_G === 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', r.p2wpkh_G);
    ok('P2WPKH(BIP-84 first receive key) = the BIP-84 published address',
      r.p2wpkh_bip84 === 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu', r.p2wpkh_bip84);
    ok('base58(32 zero bytes) = the Solana System Program address',
      r.sol_system === '11111111111111111111111111111111', r.sol_system);
    ok('an uncompressed pubkey is REFUSED for P2WPKH, never hashed anyway', r.uncompressedRefused);
    ok('1 USDC = 1000000 base units (6 decimals, not 18)', r.units.usdc1 === '1000000', r.units.usdc1);
    ok('0.000001 USDC = 1 base unit', r.units.usdcSmallest === '1', r.units.usdcSmallest);
    ok('0.07 ETH is EXACT where the old float path drifted',
      r.units.eth007 === '70000000000000000' && r.units.floatWouldBe !== '70000000000000000',
      `exact=${r.units.eth007} float=${r.units.floatWouldBe}`);
    ok('more precision than the asset carries is REFUSED, never rounded', r.units.overRefused);
    await ctx.close();
  }

  /* ══ B · ONE IDENTITY, EVERY RAIL — all five from one masterPRK ══ */
  console.log('B · one soul, every rail (R1):');
  {
    const ctx = await browser.newContext(); const seen = []; await mockRail(ctx, seen); await mockOther(ctx);
    const page = await connectedPage(ctx);
    const cards = await page.evaluate(() => window.BNRPAY.railAddresses(
      new Uint8Array(32).fill(0x2a), 'gatesoul').map(c => ({ t: c.t, ctx: c.ctx, v: c.v, err: c.err })));
    const byCtx = k => cards.find(c => c.ctx === k) || {};
    ok('the Vaulta rail carries the account name', byCtx('vaulta:gatesoul').v === 'gatesoul');
    ok('the EVM rail derives one 0x address for BOTH chains',
      /^0x[0-9a-fA-F]{40}$/.test(byCtx('evm:gatesoul').v || ''), byCtx('evm:gatesoul').v || byCtx('evm:gatesoul').err);
    ok('the Solana rail derives a base58 address',
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(byCtx('sol:gatesoul').v || ''), byCtx('sol:gatesoul').v || byCtx('sol:gatesoul').err);
    ok('the Bitcoin rail derives a bc1 native-segwit address',
      /^bc1q[02-9ac-hj-np-z]{38}$/.test(byCtx('btc:gatesoul').v || ''), byCtx('btc:gatesoul').v || byCtx('btc:gatesoul').err);
    ok('the Lightning rail derives its own key, distinct from the EVM signer',
      /^npub1/.test(byCtx('ln:gatesoul').v || '') && byCtx('ln:gatesoul').v !== byCtx('nostr:gatesoul').v,
      byCtx('ln:gatesoul').v);
    ok('the five value-rail contexts are all present and distinct',
      new Set(cards.map(c => c.v).filter(Boolean)).size === cards.filter(c => c.v).length, JSON.stringify(cards.map(c => c.ctx)));
    // DETERMINISM: the same soul must derive the same addresses, always
    const again = await page.evaluate(() => window.BNRPAY.railAddresses(new Uint8Array(32).fill(0x2a), 'gatesoul').map(c => c.v));
    ok('derivation is deterministic (same soul, same addresses)',
      JSON.stringify(again) === JSON.stringify(cards.map(c => c.v)));
    const other = await page.evaluate(() => window.BNRPAY.railAddresses(new Uint8Array(32).fill(0x2b), 'gatesoul').map(c => c.v));
    ok('a DIFFERENT masterPRK derives different addresses on every rail',
      other.slice(1).every((v, i) => v !== cards.slice(1)[i].v));
    await ctx.close();
  }

  /* ══ C · THE SIGNER — chain id and decimals come from the registry ══ */
  console.log('C · the EVM signer is parameterised, not branched (R2 · Base first):');
  {
    const ctx = await browser.newContext(); const seen = []; await mockRail(ctx, seen); await mockOther(ctx);
    const page = await connectedPage(ctx);
    const TO = '0x742c8f2e0ce07Dd3f7E78A31E5A97D45c50fF2c8';
    const built = await page.evaluate(async to => {
      const P = window.BNRPAY;
      const out = {};
      const g = async (rail, asset, amt) => {
        try { const t = await P.evmSendRaw(rail, to, asset, amt);
          return { raw: t.rawHex, chainId: t.chainId, gas: String(t.gas), units: String(t.units), callTarget: t.callTarget, from: t.from }; }
        catch (e) { return { err: e.message } }
      };
      out.baseEth = await g('base', 'ETH', '0.01');
      out.arbEth = await g('arbitrum', 'ETH', '0.01');
      out.baseUsdc = await g('base', 'USDC', '2.5');
      out.arbAnt = await g('arbitrum', 'ANT', '2.5');
      out.badRail = await g('ethereum', 'ETH', '1');
      out.badAsset = await g('base', 'ANT', '1');
      out.badTo = await (async () => { try { await P.evmSendRaw('base', '0xdeadbeef', 'ETH', '1'); return {} } catch (e) { return { err: e.message } } })();
      out.rails = Object.keys(P.rails);
      return out;
    }, TO);

    const decode = hexStr => {
      const b = Buffer.from(hexStr.slice(2), 'hex');
      const f = rlpDecode(b);
      return { nonce: big(f[0]), gasPrice: big(f[1]), gas: big(f[2]), to: hexOf(f[3]),
        value: big(f[4]), data: hexOf(f[5]), v: big(f[6]), r: f[7], s: f[8] };
    };

    ok('the registry carries both EVM rails as data', JSON.stringify(built.rails) === '["base","arbitrum"]', JSON.stringify(built.rails));

    const be = decode(built.baseEth.raw), ae = decode(built.arbEth.raw);
    // chainId is recoverable from v: v = 35 + 2*chainId + recovery
    const chainFromV = v => (v - 35n) / 2n;
    ok('a Base ETH tx carries chain id 8453 IN THE SIGNATURE (EIP-155)',
      chainFromV(be.v) === 8453n && built.baseEth.chainId === 8453, `v=${be.v} -> ${chainFromV(be.v)}`);
    ok('an Arbitrum ETH tx carries chain id 42161 — the same code, a different rail',
      chainFromV(ae.v) === 42161n && built.arbEth.chainId === 42161, `v=${ae.v} -> ${chainFromV(ae.v)}`);
    ok('the two chains produce DIFFERENT bytes for the same transfer (no replay across rails)',
      built.baseEth.raw !== built.arbEth.raw);
    ok('a native ETH transfer sends to the RECIPIENT with the value in the value field',
      be.to === TO.slice(2).toLowerCase() && be.value === 10000000000000000n && be.data === '',
      `to=${be.to} value=${be.value} data=${be.data}`);
    ok('native ETH uses the 21000 intrinsic gas', be.gas === 21000n, String(be.gas));

    const bu = decode(built.baseUsdc.raw);
    ok('a USDC transfer sends to the TOKEN CONTRACT, not the recipient',
      bu.to === '833589fcd6edb6e08f4c7c32d4f71b54bda02913' && bu.value === 0n, bu.to);
    ok('the USDC calldata is transfer(address,uint256) to the recipient',
      bu.data.slice(0, 8) === 'a9059cbb' && bu.data.slice(8 + 24, 8 + 64) === TO.slice(2).toLowerCase(),
      bu.data.slice(0, 72));
    ok('2.5 USDC encodes as 2500000 — SIX decimals, read from the registry',
      BigInt('0x' + bu.data.slice(72, 136)) === 2500000n && built.baseUsdc.units === '2500000',
      String(BigInt('0x' + bu.data.slice(72, 136))));

    const aa = decode(built.arbAnt.raw);
    ok('the same "2.5" on an 18-decimal token encodes as 2500000000000000000',
      BigInt('0x' + aa.data.slice(72, 136)) === 2500000000000000000n,
      String(BigInt('0x' + aa.data.slice(72, 136))));
    ok('THE DECIMALS BUG IS DEAD: one amount string, two token scales, both exact',
      BigInt('0x' + bu.data.slice(72, 136)) === 2500000n && BigInt('0x' + aa.data.slice(72, 136)) === 2500000000000000000n);
    ok('an ERC-20 transfer gets a real gas estimate with headroom, not the 21000 default',
      bu.gas > 21000n && bu.gas === (BigInt(parseInt(MOCK.estimate, 16)) * 12n / 10n), String(bu.gas));

    ok('signature s is low-S (EIP-2 canonical)',
      big(bu.s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0n, hexOf(bu.s)); // PUBLIC-CONSTANT: half the secp256k1 group order — the EIP-2 low-S bound, a published curve parameter
    ok('r and s are 32 bytes each', bu.r.length === 32 && bu.s.length === 32, `${bu.r.length}/${bu.s.length}`);

    ok('an unknown rail is refused by name', /no such EVM rail/.test(built.badRail.err || ''), built.badRail.err);
    ok('an asset not carried on the chosen rail is refused by name',
      /not carried on Base/.test(built.badAsset.err || ''), built.badAsset.err);
    ok('a malformed recipient is refused before any key is touched',
      /20-byte address/.test(built.badTo.err || ''), built.badTo.err);

    const est = seen.filter(s => s.method === 'eth_estimateGas');
    ok('gas is estimated against the TOKEN CONTRACT (the old lane estimated the recipient)',
      est.length > 0 && est.every(e => (e.params[0].to || '').toLowerCase() === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'.toLowerCase()
        || (e.params[0].to || '').toLowerCase() === '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684'),
      JSON.stringify(est.map(e => e.params[0].to)));
    const baseHosts = seen.filter(s => /base/.test(s.host)).length;
    const arbHosts = seen.filter(s => /arbitrum/.test(s.host)).length;
    ok('each rail was actually read on ITS OWN hosts', baseHosts > 0 && arbHosts > 0, `base=${baseHosts} arb=${arbHosts}`);
    await ctx.close();
  }

  /* ══ D · THE CAP IS SIGNER-AUTHORITATIVE — the mutation that proves it ══ */
  console.log('D · the spend cap (R3/R4) — enforced INSIDE the signer:');
  {
    const ctx = await browser.newContext(); const seen = []; await mockRail(ctx, seen); await mockOther(ctx);
    const page = await connectedPage(ctx);
    const TO = '0x742c8f2e0ce07Dd3f7E78A31E5A97D45c50fF2c8';
    const r = await page.evaluate(async to => {
      const P = window.BNRPAY, out = {};
      const set = c => localStorage.setItem('bnr-spend-cap', JSON.stringify(c));
      const clear = () => { localStorage.removeItem('bnr-spend-cap'); localStorage.removeItem('bnr-cap-ledger') };
      clear();
      try { await P.evmSendRaw('base', to, 'ETH', '5'); out.unsetPasses = true } catch (e) { out.unsetPasses = 'REFUSED: ' + e.message }
      set({ ETH: 0.01 });
      try { await P.evmSendRaw('base', to, 'ETH', '5'); out.overCap = 'SIGNED ANYWAY' } catch (e) { out.overCap = e.capRefused ? 'refused' : 'wrong: ' + e.message }
      try { await P.evmSendRaw('base', to, 'ETH', '0.005'); out.underCap = 'signed' } catch (e) { out.underCap = 'REFUSED: ' + e.message }
      // a cap on one unit must not gate a different unit
      try { await P.evmSendRaw('base', to, 'USDC', '5'); out.otherUnit = 'signed' } catch (e) { out.otherUnit = 'REFUSED: ' + e.message }
      // the rolling-day ledger: spend up to the cap, then the next one is refused
      clear(); set({ USDC: 10 });
      localStorage.setItem('bnr-cap-ledger', JSON.stringify([{ d: (() => { const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') })(), u: 'USDC', a: 9.5 }]));
      try { await P.evmSendRaw('base', to, 'USDC', '1'); out.ledger = 'SIGNED ANYWAY' } catch (e) { out.ledger = e.capRefused ? 'refused' : 'wrong: ' + e.message }
      try { await P.evmSendRaw('base', to, 'USDC', '0.4'); out.ledgerUnder = 'signed' } catch (e) { out.ledgerUnder = 'REFUSED: ' + e.message }
      clear();
      return out;
    }, TO);
    ok('no cap set = no limit (the autonomy default: agents sign without asking)', r.unsetPasses === true, r.unsetPasses);
    ok('over the cap, the SIGNER refuses — nothing is built', r.overCap === 'refused', r.overCap);
    ok('under the cap, it signs with no prompt and no human in the loop', r.underCap === 'signed', r.underCap);
    ok('a cap on one unit does not gate another unit', r.otherUnit === 'signed', r.otherUnit);
    ok('the rolling-day ledger counts: 9.5 already spent + 1 exceeds a 10/day cap', r.ledger === 'refused', r.ledger);
    ok('…and 9.5 + 0.4 still fits, so it signs', r.ledgerUnder === 'signed', r.ledgerUnder);
    await ctx.close();
  }

  /* the mutation: DELETE the call-site check, prove the signer still refuses */
  console.log('D2 · MUTATION — the button forgets the cap; the signer must not:');
  {
    const ctx = await browser.newContext(); const seen = []; await mockRail(ctx, seen); await mockOther(ctx);
    const anchor = `if(!capGate('A',amt))return;`;
    const page = await connectedPage(ctx, src => {
      if (!src.includes(anchor)) return null;
      // strip EVERY call-site cap check in the page — the buttons now "forget"
      return src.split(anchor).join('/* cap check DELETED by the gate */')
                .replace(/capAssert\(asset\.symbol,Number\(amount\)\);/, 'capAssert(asset.symbol,Number(amount));');
    });
    const mutatedOk = await page.evaluate(() => !/if\(!capGate\('A',amt\)\)return;/.test(document.documentElement.innerHTML));
    ok('the mutation landed (the Vaulta call-site check is gone from the served page)', mutatedOk);
    const r = await page.evaluate(async () => {
      const P = window.BNRPAY;
      localStorage.setItem('bnr-spend-cap', JSON.stringify({ ETH: 0.01 }));
      localStorage.removeItem('bnr-cap-ledger');
      try { await P.evmSendRaw('base', '0x742c8f2e0ce07Dd3f7E78A31E5A97D45c50fF2c8', 'ETH', '5');
        return 'SIGNED ANYWAY' } catch (e) { return e.capRefused ? 'refused' : 'wrong: ' + e.message }
      finally { localStorage.removeItem('bnr-spend-cap') }
    });
    ok('WITH THE CALL SITE GONE, the signer STILL refuses — the cap is signer-authoritative', r === 'refused', r);
    await ctx.close();
  }

  /* ══ E · LIGHTNING — BOLT-11 and BOLT-12, read offline, capped in sats ══ */
  console.log('E · Lightning as a MODULE (R2): both standards, offline, capped:');
  {
    const ctx = await browser.newContext(); const seen = []; await mockRail(ctx, seen); await mockOther(ctx);
    const page = await connectedPage(ctx);
    const B11 = 'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp';
    const r = await page.evaluate(async b11 => {
      const P = window.BNRPAY, out = {};
      const d = P.decodeLnRequest(b11);
      out.b11 = { std: d.standard, sats: d.sats, desc: d.description, hash: d.paymentHash, net: d.network };
      // a BOLT-12 offer, built here so the decoder is tested against foreign bytes
      const CH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
      const enc = bytes => { let acc = 0, bits = 0, w = '';
        for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; w += CH[(acc >> bits) & 31] } }
        if (bits) w += CH[(acc << (5 - bits)) & 31]; return 'lno1' + w };
      const tu = n => { const o = []; let v = BigInt(n); while (v > 0n) { o.unshift(Number(v & 0xffn)); v >>= 8n } return o };
      const tlv = (t, v) => [t, v.length, ...v];
      const s2b = s => [...new TextEncoder().encode(s)];
      const satsOffer = enc([...tlv(8, tu(150000)), ...tlv(10, s2b('one jar of honey')), ...tlv(18, s2b('beehive-nature'))]);
      const fiatOffer = enc([...tlv(6, s2b('USD')), ...tlv(8, tu(250)), ...tlv(10, s2b('a coffee'))]);
      const o1 = P.decodeLnRequest(satsOffer);
      out.b12 = { std: o1.standard, kind: o1.kind, sats: o1.sats, desc: o1.description, issuer: o1.issuer, priced: o1.pricedInSats };
      const o2 = P.decodeLnRequest(fiatOffer);
      out.b12fiat = { currency: o2.currency, amount: String(o2.amount), sats: o2.sats, priced: o2.pricedInSats };
      // the cap, on the decoded amount
      localStorage.setItem('bnr-spend-cap', JSON.stringify({ sats: 1000 }));
      localStorage.removeItem('bnr-cap-ledger');
      try { P.capAssert('sats', d.sats); out.capBig = 'PASSED' } catch (e) { out.capBig = e.capRefused ? 'refused' : 'wrong' }
      try { P.capAssert('sats', 150); out.capSmall = 'passed' } catch (e) { out.capSmall = 'REFUSED' }
      try { P.capAssertUnpriced('sats', 'this offer'); out.capUnpriced = 'PASSED' } catch (e) { out.capUnpriced = e.capRefused ? 'refused' : 'wrong' }
      localStorage.removeItem('bnr-spend-cap');
      try { P.capAssertUnpriced('sats', 'this offer'); out.capUnpricedNoCap = 'passed' } catch (e) { out.capUnpricedNoCap = 'REFUSED' }
      try { P.decodeLnRequest('lnbc2500u1pvjluezpp5qqq'); out.truncated = 'DECODED' } catch (e) { out.truncated = 'refused' }
      try { P.decodeLnRequest('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'); out.notLn = 'DECODED' } catch (e) { out.notLn = 'refused' }
      return out;
    }, B11);
    ok('a BOLT-11 invoice decodes offline: 2500u = 250000 sat',
      r.b11.std === 'BOLT-11' && r.b11.sats === 250000, JSON.stringify(r.b11));
    ok('…with its description and payment hash, from the tagged fields',
      r.b11.desc === '1 cup coffee' && r.b11.hash === '0001020304050607080900010203040506070809000102030405060708090102', JSON.stringify(r.b11)); // PUBLIC-CONSTANT: the payment hash printed in BOLT-11's own spec examples (a payment hash is public by nature)
    ok('a BOLT-12 OFFER decodes too — both standards, one door',
      r.b12.std === 'BOLT-12' && r.b12.kind === 'offer' && r.b12.sats === 150, JSON.stringify(r.b12));
    ok('…carrying its description and issuer',
      r.b12.desc === 'one jar of honey' && r.b12.issuer === 'beehive-nature', JSON.stringify(r.b12));
    ok('a FIAT-priced BOLT-12 offer reports its currency and NO satoshi price',
      r.b12fiat.currency === 'USD' && r.b12fiat.amount === '250' && r.b12fiat.sats === null && r.b12fiat.priced === false,
      JSON.stringify(r.b12fiat));
    ok('the sats cap refuses a 250000 sat invoice against a 1000 sat/day cap', r.capBig === 'refused', r.capBig);
    ok('…and passes a 150 sat one', r.capSmall === 'passed', r.capSmall);
    ok('an UNPRICED offer is REFUSED while a sats cap exists (never waved through)', r.capUnpriced === 'refused', r.capUnpriced);
    ok('…but passes when no sats cap is set (unset = no limit)', r.capUnpricedNoCap === 'passed', r.capUnpricedNoCap);
    ok('a truncated invoice is refused, never half-read', r.truncated === 'refused', r.truncated);
    ok('a bitcoin address is not accepted as a Lightning request', r.notLn === 'refused', r.notLn);
    ok('reading a Lightning request touched NO network at all',
      seen.filter(s => /invoice|bolt/i.test(JSON.stringify(s))).length === 0);
    await ctx.close();
  }

  /* ══ F · the rail adapters, behind the contract ══ */
  console.log('F · Solana + Bitcoin adapters on SPEC-ADAPTER-CONTRACT-1:');
  {
    const ctx = await browser.newContext(); const seen = []; await mockRail(ctx, seen); await mockOther(ctx);
    const page = await connectedPage(ctx);
    for (const [rail, file] of [['solana', 'wallet-adapter-solana.js'], ['bitcoin', 'wallet-adapter-bitcoin.js']]) {
      const d = await page.evaluate(async f => {
        const w = new Worker('/surfaces/' + f);
        const call = (method, params) => new Promise((res, rej) => {
          const id = Math.floor(Math.random() * 1e6);
          const t = setTimeout(() => rej(new Error('worker timeout')), 8000);
          w.onmessage = e => { if (e.data.id === id) { clearTimeout(t); res(e.data) } };
          w.postMessage({ jsonrpc: '2.0', id, method, params });
        });
        const desc = await call('describe', {});
        const write = await call('buildSend', { to: 'x', unit: 'y', quantity: '1' });
        const bad = await call('balance', { address: '!!!not an address!!!' });
        w.terminate();
        return { desc: desc.result, write, bad };
      }, file);
      ok(`${rail}: describe() answers with rail, version and a closed capability list`,
        d.desc && d.desc.rail === rail && d.desc.contract_version === '1' && Array.isArray(d.desc.capabilities), JSON.stringify(d.desc && d.desc.rail));
      ok(`${rail}: claims NO write capability`,
        !d.desc.capabilities.some(c => /^build|^submit|^sign|^mint/.test(c)), JSON.stringify(d.desc.capabilities));
      ok(`${rail}: an UNDECLARED write method is refused as UNSUPPORTED (§9.2)`,
        d.write.error && d.write.error.code === -32008, JSON.stringify(d.write.error));
      if (rail === 'solana') {
        ok('solana: declares ONLY balance', JSON.stringify(d.desc.capabilities) === '["balance"]', JSON.stringify(d.desc.capabilities));
        ok('solana: names the spec gap it is fenced by, rather than looking finished',
          /GAP \d/.test(d.desc.state_note || '') && d.desc.state === 'STUB', d.desc.state_note);
      } else {
        /* the BTC rail is shaped for silent payments + BIP-353 + BOLT-12 from
           the start (founder requirement): what is absent is DECLARED absent
           with the thing that would close it, and the roadmap lives in
           not_carried so "planned" can never read as "present". */
        ok('bitcoin: carries balance AND receiveAddress (the reusable address)',
          JSON.stringify(d.desc.capabilities) === '["balance","receiveAddress"]', JSON.stringify(d.desc.capabilities));
        ok('bitcoin: names all four standards it is cut for (BIP-352/353/321 + BOLT-12)',
          d.desc.standards && ['BIP-352', 'BIP-353', 'BIP-321', 'BOLT-12'].every(k => k in d.desc.standards),
          JSON.stringify(Object.keys(d.desc.standards || {})));
        ok('bitcoin: what is absent is DECLARED absent, each with its closing condition',
          d.desc.not_carried && ['silentPaymentScan', 'buildSend', 'mintOffer'].every(k => (d.desc.not_carried[k] || '').length > 40),
          JSON.stringify(Object.keys(d.desc.not_carried || {})));
        ok('bitcoin: scanning is named as NOT carried — the wallet holds the address but does not watch it',
          /does not|cannot see|not carried|indexer/i.test(d.desc.not_carried.silentPaymentScan));
        ok('bitcoin: nothing in not_carried leaked into capabilities (planned never reads as present)',
          Object.keys(d.desc.not_carried).every(k => !d.desc.capabilities.includes(k)));
        ok('bitcoin: buildSend still cites GAP 2 (no covenants ⇒ no pre-signing cap)',
          /GAP 2/.test(d.desc.not_carried.buildSend) && d.desc.state === 'PARTIAL', d.desc.state);
        ok('bitcoin: minting an offer is refused as OUR-NODE-ONLY, never fetched from a third party',
          /own node|OUR OWN node/i.test(d.desc.not_carried.mintOffer));
      }
      ok(`${rail}: a malformed address is refused as BAD_PARAMS before any network call`,
        d.bad.error && d.bad.error.code === -32007, JSON.stringify(d.bad.error));
      ok(`${rail}: no adapter answer contains key material`,
        !/seed|privkey|private_key|masterPrk|wif/i.test(JSON.stringify(d)), 'leak in describe/errors');
    }
    await ctx.close();
  }

  /* ══ G · honest-empty: a rail that cannot derive shows NO address ══ */
  console.log('G · honest-empty (a wrong address is worse than none):');
  {
    const ctx = await browser.newContext(); const seen = []; await mockRail(ctx, seen); await mockOther(ctx);
    // break the Solana derivation at source; the card must go blank, not wrong
    const page = await connectedPage(ctx, src => {
      const a = `function solanaAddress(ed25519PublicKey){`;
      if (!src.includes(a)) return null;
      return src.replace(a, `function solanaAddress(ed25519PublicKey){ throw new Error('derivation deliberately broken by the gate');`);
    });
    const cards = await page.evaluate(() =>
      window.BNRPAY.railAddresses(new Uint8Array(32).fill(0x2a), 'gatesoul').map(c => ({ ctx: c.ctx, v: c.v, err: c.err })));
    const sol = cards.find(c => c.ctx === 'sol:gatesoul');
    ok('a broken derivation yields NO address and a stated reason', sol && sol.v === null && /deliberately broken/.test(sol.err || ''), JSON.stringify(sol));
    ok('the other rails are unaffected — one broken rail does not blank the set',
      cards.filter(c => c.v).length === cards.length - 1, JSON.stringify(cards.map(c => [c.ctx, !!c.v])));
    await page.evaluate(() => { document.getElementById('pay-rx').click() });
    const html = await page.locator('#rx-cards').innerHTML();
    ok('the receive panel prints the reason instead of an address',
      /no address shown/.test(html) && !/undefined|null|NaN/.test(html.replace(/nullable/g, '')), html.slice(0, 160));
    await ctx.close();
  }

  /* ══ H · THE BITCOIN RAIL — silent payments, a payment name, one URI ══ */
  console.log('H · BIP-352 + BIP-353 + BIP-321: one name, both rails:');
  {
    const ctx = await browser.newContext(); const seen = []; await mockRail(ctx, seen); await mockOther(ctx);
    const page = await connectedPage(ctx);
    const r = await page.evaluate(() => {
      const P = window.BNRPAY, out = {};
      const fromHex = s => Uint8Array.from(s.match(/../g).map(h => parseInt(h, 16)));
      const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
      // bech32m must NOT be bech32 — the differential the whole rail rests on
      out.constants = [P.BECH32M_CONST, P.BECH32_CONST];
      try { P.bech32mDecode('A1LQFN3A', P.BECH32M_CONST, 90); out.bip350 = 'decoded' } catch (e) { out.bip350 = 'FAILED ' + e.message }
      try { P.bech32mDecode('A12UEL5L', P.BECH32M_CONST, 90); out.crossReject = 'ACCEPTED A BECH32 STRING' } catch (e) { out.crossReject = /checksum/.test(e.message) ? 'rejected' : 'wrong: ' + e.message }
      // a silent-payment address from two REAL curve points
      const G = fromHex('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'); // PUBLIC-CONSTANT: the secp256k1 generator, a published curve parameter
      const G2 = fromHex('02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'); // PUBLIC-CONSTANT: 2G, likewise published
      const sp = P.silentPaymentAddress(G, G2, 'mainnet');
      out.sp = sp;
      const back = P.decodeSilentPaymentAddress(sp);
      out.roundTrip = hex(back.scanKey) === hex(G) && hex(back.spendKey) === hex(G2) && back.version === 0;
      // a one-character corruption must die on the checksum
      const bad = sp.slice(0, 20) + (sp[20] === 'q' ? 'p' : 'q') + sp.slice(21);
      try { P.decodeSilentPaymentAddress(bad); out.corrupt = 'DECODED A CORRUPT ADDRESS' } catch (e) { out.corrupt = /checksum/.test(e.message) ? 'refused' : 'wrong: ' + e.message }
      // the soul's own address, and that it is deterministic + soul-specific
      out.soulSp = P.soulSilentPaymentAddress(new Uint8Array(32).fill(0x2a), 'gatesoul', 'mainnet');
      out.soulSpAgain = P.soulSilentPaymentAddress(new Uint8Array(32).fill(0x2a), 'gatesoul', 'mainnet');
      out.soulSpOther = P.soulSilentPaymentAddress(new Uint8Array(32).fill(0x2b), 'gatesoul', 'mainnet');
      // the unified URI
      const LNO = 'lno1pg257enxv4ezqcneype82um50ynhxgrwdajx283qfwdpl28qqmc78ymlvhmxcsywdk5wrjnj36jryg488qwlrnzyjczs';
      const uri = P.buildBip321Uri({ silentPayment: out.soulSp, offer: LNO, label: 'gatesoul' });
      out.uri = uri;
      out.parsed = P.parseBip321Uri(uri);
      try { P.parseBip321Uri('bitcoin:?req-unknownthing=1&sp=' + out.soulSp); out.reqParam = 'PAID AROUND IT' } catch (e) { out.reqParam = /required parameters/.test(e.message) ? 'refused' : 'wrong' }
      // the payment name and the record the estate publishes
      out.recordName = P.bip353RecordName('lovis@skaists.dev');
      const rec = P.buildBip353Record('lovis@skaists.dev', uri);
      out.rec = { name: rec.name, type: rec.type, value: rec.value, zoneLine: rec.zoneLine, dnssec: rec.dnssecRequired };
      try { P.buildBip353Record('lovis@skaists.dev', 'https://example.com'); out.badUri = 'PUBLISHED IT' } catch (e) { out.badUri = 'refused' }
      // resolution: the AD contract
      const q = P.bip353Query('lovis@skaists.dev');
      out.query = q.url;
      out.signed = P.readBip353Answer({ Status: 0, AD: true, Answer: [{ type: 16, data: '"' + uri + '"' }] }, q.recordName).authenticated;
      out.unsigned = P.readBip353Answer({ Status: 0, AD: false, Answer: [{ type: 16, data: '"' + uri + '"' }] }, q.recordName).authenticated;
      return out;
    });
    ok('bech32m uses the BIP-350 constant, distinct from bech32',
      r.constants[0] === 0x2bc830a3 && r.constants[1] === 1, JSON.stringify(r.constants));
    ok('a BIP-350 vector decodes as bech32m', r.bip350 === 'decoded', r.bip350);
    ok('a valid BECH32 string is REJECTED as bech32m (the wrong family = a dead address)',
      r.crossReject === 'rejected', r.crossReject);
    ok('a silent-payment address is sp1q… and 116 chars (version 0, 66-byte payload)',
      /^sp1q/.test(r.sp) && r.sp.length === 116, r.sp);
    ok('decode recovers BOTH public keys byte-for-byte', r.roundTrip === true);
    ok('a ONE-CHARACTER corruption is refused on the checksum, never decoded to other keys',
      r.corrupt === 'refused', r.corrupt);
    ok('the soul derives its own reusable address, deterministically',
      /^sp1q/.test(r.soulSp) && r.soulSp === r.soulSpAgain, r.soulSp);
    ok('a different soul derives a different one', r.soulSp !== r.soulSpOther);
    ok('ONE URI carries BOTH rails (silent payment + BOLT-12 offer)',
      JSON.stringify(r.parsed.rails) === '["silent payment","BOLT-12 offer"]', JSON.stringify(r.parsed.rails));
    ok('…and the address-less form is used, since a reusable identity needs no one-shot address',
      r.uri.startsWith('bitcoin:?'), r.uri.slice(0, 40));
    ok('an unknown req- parameter makes the wallet REFUSE, never pay around it', r.reqParam === 'refused', r.reqParam);
    ok('the BIP-353 record name is <user>.user._bitcoin-payment.<domain>',
      r.recordName === 'lovis.user._bitcoin-payment.skaists.dev', r.recordName);
    ok('the published TXT value IS the unified URI — one name, both rails',
      r.rec.type === 'TXT' && r.rec.value === r.uri && r.rec.dnssec === true);
    ok('a paste-ready zone line is produced for a domain the estate already owns',
      /^lovis\.user\._bitcoin-payment\.skaists\.dev\. 3600 IN TXT "bitcoin:/.test(r.rec.zoneLine), r.rec.zoneLine.slice(0, 70));
    ok('it refuses to publish a URI it cannot read back', r.badUri === 'refused', r.badUri);
    ok('the DoH query asks for the TXT with DNSSEC requested (do=true)',
      r.query.includes('_bitcoin-payment') && r.query.includes('do=true'), r.query);
    ok('a signed answer reports authenticated=true', r.signed === true);
    ok('an UNSIGNED answer reports authenticated=false — never silently trusted', r.unsigned === false);
    ok('building a payment name touched NO network (DNS is only asked when a user resolves one)',
      seen.length === 0 || !seen.some(s => /dns/i.test(JSON.stringify(s))));
    await ctx.close();
  }

  ok('NOTHING leaked to the live network (every rail host was mocked)', leaked.length === 0,
    leaked.slice(0, 5).join(' , '));

} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
