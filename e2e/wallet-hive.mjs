// wallet-hive.mjs — Hive is a real chain here, like every rail: one paste adds the account
// the active key controls (the key names its own account; it is sealed under the keychain,
// per soul, never stored in the clear, never sent); balances read for THAT account, never
// the soul's name; sending HIVE/HBD is one press and follows the outbox law (the signed
// transaction is kept before broadcast; a retry resends those bytes, never signs again).
// Part 0 pins the wallet's bytes and digest to Hive's own library (@hiveio/dhive 1.3.6,
// vector computed once and stored below). Every Hive node is a mock. Run: node e2e/wallet-hive.mjs
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://skaists.dev';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const HIVE_RE = /^https:\/\/(api\.hive\.blog|api\.openhive\.network)(\/|$)/;
const VAULTA_RE = /^https:\/\/(eos\.api\.eosnation\.io|eos\.greymass\.com)(\/|$)/;
const DEV_WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'; // TESTNET-ONLY: eosio's documented dev key, chain-significant nowhere
const DEV_STM = 'STM6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'; // PUBLIC-CONSTANT: the dev key's public half, Hive prefix
const OWNER_WIF = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ'; // TESTNET-ONLY: the published Bitcoin wiki WIF example
// @hiveio/dhive 1.3.6: Types.Transaction bytes and sha256(chain_id ‖ bytes) for this exact transaction
const REF = {
  tx: { ref_block_num: 12345, ref_block_prefix: 3123456789, expiration: 1791201600, ops: [
    { from: 'loviswater', to: 'someoneelse', amount: '1.234', sym: 'HIVE', memo: 'hi ✓' },
    { from: 'loviswater', to: 'someoneelse', amount: '0.5', sym: 'HBD', memo: '' }] },
  bytes: '3930152b2cba4091c36a02020a6c6f76697377617465720b736f6d656f6e65656c7365d20400000000000003535445454d000006686920e29c93020a6c6f76697377617465720b736f6d656f6e65656c7365f40100000000000003534244000000000000', // PUBLIC-CONSTANT: dhive reference bytes
  digest: 'cf26cd0fcc28d3d586d35c2a17bf953539c7c8ba4fbbdce9daf7a48349267278' // PUBLIC-CONSTANT: dhive reference digest
};

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`); }
};
const until = (page, re, id, ms = 40000) => page.waitForFunction(([r, i]) => new RegExp(r).test(document.getElementById(i).textContent), [re.source, id], { timeout: ms });

const browser = await chromium.launch();
try {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    console.log(`A · Hive, ${reg}:`);
    const state = { calls: [], broadcasts: [], landed: false, failNext: 0, ownerStm: null };
    const ctx = await browser.newContext({ viewport: { width: 390, height: 860 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await ctx.addInitScript(r => { try { if (!sessionStorage.getItem('__s')) { localStorage.setItem('bregister', r); localStorage.setItem('bnr_soul', 'gatesoul'); sessionStorage.setItem('__s', '1'); } } catch (e) {}
      if (navigator.credentials) navigator.credentials.get = navigator.credentials.create = async () => { throw new DOMException('test', 'NotAllowedError'); }; }, reg);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
    await ctx.route('**/*', async route => {
      const url = route.request().url(), u = new URL(url);
      const json = o => route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
      if (route.request().method() === 'OPTIONS' && (HIVE_RE.test(url) || VAULTA_RE.test(url))) return route.fulfill({ status: 204, headers: cors });
      if (HIVE_RE.test(url)) {
        const b = JSON.parse(route.request().postData() || '{}'); state.calls.push([b.method, JSON.stringify(b.params)]);
        const R = v => json({ jsonrpc: '2.0', id: b.id, result: v });
        if (b.method === 'condenser_api.get_key_references') return R([b.params[0][0] === DEV_STM || b.params[0][0] === state.ownerStm ? ['loviswater'] : []]);
        if (b.method === 'condenser_api.get_accounts') return R(b.params[0].filter(n => n === 'loviswater').map(n => ({ name: n, balance: '12.345 HIVE', hbd_balance: '1.000 HBD', vesting_shares: '1000.000000 VESTS', reputation: '0',
          active: { weight_threshold: 1, key_auths: [[DEV_STM, 1]].concat(state.ownerStm ? [[state.ownerStm, 1]] : []), account_auths: [] },
          owner: { weight_threshold: 1, key_auths: state.ownerStm ? [[state.ownerStm, 1]] : [], account_auths: [] } })));
        if (b.method === 'condenser_api.get_dynamic_global_properties') return R({ head_block_number: 100000, head_block_id: '000186a0aabbccdd11223344556677889900aabb', time: '2026-10-05T12:00:00' });
        if (b.method === 'condenser_api.broadcast_transaction') {
          state.broadcasts.push(b.params[0]);
          if (state.failNext > 0) { state.failNext--; return route.abort('connectionfailed'); }
          state.landed = true; return R({});
        }
        if (b.method === 'transaction_status_api.find_transaction') return R({ status: state.landed ? 'within_irreversible_block' : 'unknown' });
        return R(null);
      }
      if (VAULTA_RE.test(url)) {
        if (u.pathname.endsWith('/get_table_rows')) return json({ rows: [], more: false, next_key: '' });
        if (u.pathname.endsWith('/get_currency_balance')) return json(['0.0000 A']);
        return json({ account_name: 'gatesoul', core_liquid_balance: '0.0000 EOS', permissions: [] });
      }
      if (u.origin !== ORIGIN) return route.abort();
      const path = resolve(ROOT, '.' + decodeURIComponent(u.pathname));
      if (!path.startsWith(ROOT + sep)) return route.abort();
      try { return route.fulfill({ body: await readFile(path), contentType: MIME[extname(path)] || 'application/octet-stream' }); }
      catch { return route.fulfill({ status: 404, body: 'not found' }); }
    });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BNRHIVE && window.BZDIDKEY && window.BnrSign, null, { timeout: 20000 });
    const recovers = (bt) => page.evaluate(([b, wif]) => {
      const H = window.BNRHIVE, B = window.BnrSign, hex = a => Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
      const op = b.operations[0][1], m = op.amount.split(' ');
      const bytes = H.ser({ ref_block_num: b.ref_block_num, ref_block_prefix: b.ref_block_prefix, expiration: Math.floor(Date.parse(b.expiration + 'Z') / 1000), ops: [{ from: op.from, to: op.to, amount: m[0], sym: m[1], memo: op.memo }] });
      const d = Uint8Array.from(H.digest(bytes).match(/../g).map(h => parseInt(h, 16)));
      const sb = Uint8Array.from(b.signatures[0].match(/../g).map(h => parseInt(h, 16)));
      const rec = hex(B.secp.Signature.fromCompact(sb.slice(1)).addRecoveryBit(sb[0] - 31).recoverPublicKey(d).toRawBytes(true));
      return rec === hex(B.secp.getPublicKey(B.Numeric.base58ToBinary(37, wif).slice(1, 33), true));
    }, [bt, DEV_WIF]);

    if (reg === 'bee') {
      // 0 · bytes, digest and signature against Hive's own library ("0.5" is written 0.500, as Hive does)
      const v = await page.evaluate(([R, wif]) => {
        const H = window.BNRHIVE, B = window.BnrSign, hex = a => Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
        const bytes = H.ser(R.tx), digest = H.digest(bytes), sig = H.sign(wif, bytes);
        const sb = Uint8Array.from(sig.match(/../g).map(h => parseInt(h, 16)));
        const S = B.secp.Signature.fromCompact(sb.slice(1)).addRecoveryBit(sb[0] - 31);
        const d = Uint8Array.from(digest.match(/../g).map(h => parseInt(h, 16)));
        const rec = hex(S.recoverPublicKey(d).toRawBytes(true));
        const want = hex(B.secp.getPublicKey(B.Numeric.base58ToBinary(37, wif).slice(1, 33), true));
        const c = sb.slice(1), canonical = !(c[0] & 0x80) && !(c[0] === 0 && !(c[1] & 0x80)) && !(c[32] & 0x80) && !(c[32] === 0 && !(c[33] & 0x80));
        return { bytes: hex(bytes), digest, recOk: rec === want, canonical, head: sb[0], pub: H.pubOf(wif), amounts: ['1', '0.5', '2.25', '01.000', '0', '1.2345', '9223372036854775.807', '9223372036854775.808'].map(H.amount) };
      }, [REF, DEV_WIF]);
      ok('transaction bytes equal Hive\'s own library (HIVE as STEEM, HBD as SBD, UTF-8 memo)', v.bytes === REF.bytes, v.bytes.slice(0, 80));
      ok('the digest equals Hive\'s own library (sha256 of chain id and bytes)', v.digest === REF.digest, v.digest);
      ok('the signature is canonical and recovers the signing key', v.canonical && v.recOk && v.head >= 31 && v.head <= 34, JSON.stringify(v).slice(0, 160));
      ok('the key\'s Hive public key reads STM…', v.pub === DEV_STM, v.pub);
      ok('one amount form: 1 → 1.000, 0.5 → 0.500, 2.25 → 2.250; the int64 ceiling kept; zero, four decimals and overflow refused', JSON.stringify(v.amounts) === JSON.stringify(['1.000', '0.500', '2.250', '1.000', null, null, '9223372036854775.807', null]), JSON.stringify(v.amounts));
    }

    await page.waitForFunction(() => !document.getElementById('hv-add').hidden, null, { timeout: 15000 });
    ok('before the paste, the Hive card asks for one thing and reads no stranger', /add your Hive account: paste its active key/.test(await page.textContent('#h-stat')) && !state.calls.some(c => c[0] === 'condenser_api.get_accounts' && /gatesoul/.test(c[1])), await page.textContent('#h-stat'));
    await page.evaluate(() => { const sc = document.getElementById('kc-rec-scaffold'); if (sc) sc.open = true;
      document.getElementById('kc-rec').value = window.BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(0x2a)); document.getElementById('kc-recgo').click(); });
    await page.waitForFunction(() => /keychain live/.test(document.getElementById('kc-stat').textContent), null, { timeout: 15000 });
    await page.evaluate(() => { document.getElementById('hv-key').value = 'not a key'; document.getElementById('hv-add-go').click(); });
    ok('a wrong paste is one calm sentence and nothing is kept', (await page.textContent('#hv-add-stat')) === 'That is not a Hive private key. Paste the account’s active key.' && !(await page.evaluate(() => localStorage.getItem('bnr_hive_acct:gatesoul'))));
    if (reg === 'bee') {
      // an owner key is refused, even when it is also an active key
      state.ownerStm = await page.evaluate(w => window.BNRHIVE.pubOf(w), OWNER_WIF);
      await page.evaluate(w => { document.getElementById('hv-key').value = w; document.getElementById('hv-add-go').click(); }, OWNER_WIF);
      await until(page, /owner/, 'hv-add-stat', 20000);
      ok('an owner key is refused (also when it sits on active) and nothing is kept', /owner key stays offline/.test(await page.textContent('#hv-add-stat')) && !(await page.evaluate(() => localStorage.getItem('bnr_hive_acct:gatesoul') || localStorage.getItem('bnr_hive_seal:gatesoul'))), await page.textContent('#hv-add-stat'));
      state.ownerStm = null;
    }
    await page.evaluate(w => { document.getElementById('hv-key').value = w; document.getElementById('hv-add-go').click(); }, DEV_WIF);
    await until(page, /^Done\.|No Hive|owner|not its active|did not answer/, 'hv-add-stat', 20000);
    await page.evaluate(() => { location.hash = '#ch-hive'; }); await page.waitForTimeout(500);   // the card lives in the have task: a link lands there
    const said = await page.evaluate(() => { const e = document.getElementById('hv-add-stat'); return { t: e.textContent, shown: e.getClientRects().length > 0 }; });
    ok('one paste: the key names its own account, and the confirmation is on screen', /^Done\. loviswater is your Hive account here/.test(said.t) && said.shown, JSON.stringify(said));
    const store = await page.evaluate(() => ({ bind: localStorage.getItem('bnr_hive_acct:gatesoul'), seal: localStorage.getItem('bnr_hive_seal:gatesoul'), field: document.getElementById('hv-key').value, all: JSON.stringify(localStorage) }));
    ok('the key is sealed per soul, never kept in the clear, and the field is empty', store.bind === JSON.stringify({ acct: 'loviswater' }) && /"ct":"/.test(store.seal || '') && !store.all.includes(DEV_WIF) && store.field === '', store.bind);
    await until(page, /✓ live · loviswater/, 'h-stat', 15000);
    ok('balances read for loviswater', /12\.345/.test(await page.textContent('#h-bal')) && /loviswater/.test(await page.textContent('#h-info')), await page.textContent('#h-bal'));
    // one press to send: a whole number is written as Hive writes it
    const fill = (amt, memo) => page.evaluate(([a, m]) => { document.getElementById('tx-tab-h').click();
      document.getElementById('hs-to').value = 'someoneelse'; document.getElementById('hs-amt').value = a; document.getElementById('hs-sym').value = 'HIVE'; document.getElementById('hs-memo').value = m; }, [amt, memo]);
    await fill('1', 'here ' + DEV_WIF);
    await page.evaluate(() => document.getElementById('hs-go').click());
    ok('a memo holding a private key is refused (memos are public)', /looks like a private key/.test(await page.textContent('#hs-stat')) && state.broadcasts.length === 0);
    await fill('1', 'hi');
    await page.evaluate(() => document.getElementById('hs-go').click());
    await until(page, /^(Done|It |Your|Hive|That|The )/, 'hs-stat');
    ok('one press sends 1 HIVE, written 1.000 HIVE, and the chain confirms it in words', (await page.textContent('#hs-stat')) === 'Done. 1.000 HIVE went to someoneelse. The chain confirmed it.' && state.broadcasts.length === 1 && state.broadcasts[0].operations[0][1].amount === '1.000 HIVE', await page.textContent('#hs-stat'));
    ok('the node would recover loviswater\'s active key from the signature', await recovers(state.broadcasts[0]));
    ok('nothing is left waiting once the chain confirmed it', await page.evaluate(() => localStorage.getItem('bnr_hive_pending:gatesoul')) === null);
    if (reg === 'bee') {
      // the outbox law: a broadcast that drops is resent as the SAME bytes, never signed again
      state.landed = false; state.failNext = 2; state.broadcasts = [];
      await fill('0.5', 'again');
      await page.evaluate(() => document.getElementById('hs-go').click());
      await until(page, /^(Done|It |Your|Hive|That|The )/, 'hs-stat', 60000);
      const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('bnr_hive_pending:gatesoul') || 'null'));
      ok('a dropped broadcast is not called done, and its signed bytes are kept', /has not shown it yet/.test(await page.textContent('#hs-stat')) && !!kept && kept.amount === '0.500', await page.textContent('#hs-stat'));
      await fill('7', 'a different send');
      await page.evaluate(() => document.getElementById('hs-go').click());
      await until(page, /^(Done|It |Your|Hive|That|The )/, 'hs-stat', 60000);
      const sigs = new Set(state.broadcasts.map(b => b.signatures[0]));
      ok('the next press resends the kept bytes, signs nothing new, and says the last send went through', /^Your last send went through: 0\.500 HIVE to someoneelse/.test(await page.textContent('#hs-stat')) && sigs.size === 1 && state.broadcasts.every(b => b.operations[0][1].amount === '0.500 HIVE'), (await page.textContent('#hs-stat')) + ' · ' + sigs.size);
      // a second soul does not see or erase the first soul's Hive account
      await page.evaluate(() => { localStorage.setItem('bnr_soul', 'othersoul'); });
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.BNRHIVE && !document.getElementById('hv-add').hidden, null, { timeout: 20000 });
      ok('another soul starts with its own empty Hive card, and the first soul\'s binding is untouched', /add your Hive account/.test(await page.textContent('#h-stat')) && !/loviswater/.test(await page.textContent('#h-info')) && (await page.evaluate(() => localStorage.getItem('bnr_hive_acct:gatesoul'))) === JSON.stringify({ acct: 'loviswater' }));
    }
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(`\nwallet hive: ${pass} pass, ${fail} fail`);
if (fail) process.exit(1);
