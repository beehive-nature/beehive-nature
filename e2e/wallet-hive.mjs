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
        const tab = () => route.request().frame().page();
        const switchTo = n => tab().evaluate(v => { document.getElementById('wq').value = v; document.getElementById('wgo').click(); }, n);
        if (b.method === 'condenser_api.get_key_references') return R([b.params[0][0] === DEV_STM || b.params[0][0] === state.ownerStm ? ['loviswater'] : []]);
        if (b.method === 'condenser_api.get_accounts') return R(b.params[0].filter(n => n === 'loviswater').map(n => ({ name: n, balance: '12.345 HIVE', hbd_balance: '1.000 HBD', vesting_shares: '1000.000000 VESTS', reputation: '0',
          active: { weight_threshold: 1, key_auths: [[DEV_STM, 1]].concat(state.ownerStm ? [[state.ownerStm, 1]] : []), account_auths: [] },
          owner: { weight_threshold: 1, key_auths: state.ownerStm ? [[state.ownerStm, 1]] : [], account_auths: [] } })));
        if (b.method === 'condenser_api.get_dynamic_global_properties' && state.switchOnDgp) { const n = state.switchOnDgp; state.switchOnDgp = null; await switchTo(n); }
        if (b.method === 'condenser_api.get_dynamic_global_properties') return R({ head_block_number: 100000, head_block_id: '000186a0aabbccdd11223344556677889900aabb', time: '2026-10-05T12:00:00', total_vesting_fund_hive: '180000.000 HIVE', total_vesting_shares: '360000000.000000 VESTS' });
        if (b.method === 'condenser_api.broadcast_transaction') {
          state.broadcasts.push(b.params[0]);
          if (state.peek) { state.peek = false; state.peeked = await tab().evaluate(() => localStorage.getItem('bnr_hive_pending:gatesoul')); }
          if (state.failNext > 0) { state.failNext--; return route.abort('connectionfailed'); }
          if (state.refuse) return json({ jsonrpc: '2.0', id: b.id, error: { code: -32000, message: state.refuse } });
          state.landed = true; return R({});
        }
        if (b.method === 'transaction_status_api.find_transaction') {
          if (state.hold && tab() === state.hold) { state.held = true; await state.holdP; }
          if (state.switchOnStatus) { const n = state.switchOnStatus; state.switchOnStatus = null; await switchTo(n); }
        }
        if (b.method === 'transaction_status_api.find_transaction') return R({ status: state.status || (state.landed ? 'within_irreversible_block' : 'unknown') });
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
    // 1000 VESTS at the chain's rate (180000 HIVE / 360000000 VESTS) is 0.500 Hive Power, never "1000 HP"; the raw figures stay for cypherpunk
    const info = await page.evaluate(() => { const e = document.getElementById('h-info'), c = e.querySelector('.wl-cyd'); return { calm: [...e.childNodes].filter(n => !(n.classList && n.classList.contains('wl-cyd'))).map(n => n.textContent).join(''), cy: c ? c.textContent : '' }; });
    const hstat = await page.evaluate(() => [...document.getElementById('h-stat').childNodes].filter(n => !(n.classList && n.classList.contains('wl-cyd'))).map(n => n.textContent).join('').trim());
    ok('a read says when it was read, never a bare live mark (the live mark stays for cypherpunk)', /^read at \d/.test(hstat) && !/live/.test(hstat) && /✓ live · loviswater/.test(await page.textContent('#h-stat')), hstat);
    ok('Hive Power is vesting shares at the chain\'s rate, and the raw VESTS and reputation stay in the detail', info.calm === 'loviswater also holds 0.500 Hive Power and 1.000 HBD.' && /1000\.000000 VESTS/.test(info.cy) && /score 25/.test(info.cy), JSON.stringify(info));
    // one press to send: a whole number is written as Hive writes it
    const fill = (amt, memo) => page.evaluate(([a, m]) => { document.getElementById('tx-tab-h').click();
      document.getElementById('hs-to').value = 'someoneelse'; document.getElementById('hs-amt').value = a; document.getElementById('hs-sym').value = 'HIVE'; document.getElementById('hs-memo').value = m; }, [amt, memo]);
    await fill('1', 'here ' + DEV_WIF);
    await page.evaluate(() => document.getElementById('hs-go').click());
    ok('a memo holding a private key is refused (memos are public)', /looks like a private key/.test(await page.textContent('#hs-stat')) && state.broadcasts.length === 0);
    await fill('1', 'hi');
    await page.evaluate(() => document.getElementById('hs-go').click());
    await until(page, /^(done|it |your|hive|that|the )/i, 'hs-stat');
    ok('one press sends 1 HIVE, written 1.000 HIVE, and the chain confirms it in words', (await page.textContent('#hs-stat')) === 'done. 1.000 HIVE went to someoneelse, and the chain confirmed it.' && state.broadcasts.length === 1 && state.broadcasts[0].operations[0][1].amount === '1.000 HIVE', await page.textContent('#hs-stat'));
    ok('the node would recover loviswater\'s active key from the signature', await recovers(state.broadcasts[0]));
    ok('nothing is left waiting once the chain confirmed it', await page.evaluate(() => localStorage.getItem('bnr_hive_pending:gatesoul')) === null);
    if (reg === 'bee') {
      // the outbox law: a broadcast that drops is resent as the SAME bytes, never signed again
      state.landed = false; state.failNext = 2; state.broadcasts = [];
      await fill('0.5', 'again');
      await page.evaluate(() => document.getElementById('hs-go').click());
      await until(page, /^(done|it |your|hive|that|the )/i, 'hs-stat', 60000);
      const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('bnr_hive_pending:gatesoul') || 'null'));
      ok('a dropped broadcast is not called done, and its signed bytes are kept', /did not answer, so this wallet cannot tell yet whether it went out/.test(await page.textContent('#hs-stat')) && !!kept && kept.amount === '0.500', await page.textContent('#hs-stat'));
      // "use a different Hive account" never throws away an unsettled send or its sealed key
      await page.evaluate(() => { const b = document.getElementById('hv-other'); b.hidden = false; b.click(); });
      const held = await page.evaluate(() => ({ t: document.getElementById('hv-add-stat').innerText, acct: localStorage.getItem('bnr_hive_acct:gatesoul'), seal: !!localStorage.getItem('bnr_hive_seal:gatesoul'), pend: !!localStorage.getItem('bnr_hive_pending:gatesoul'), link: (document.querySelector('#hv-add-stat a') || {}).textContent }));
      ok('while a Hive send is unsettled, a different account is refused in words and nothing is forgotten', /has not settled yet, so loviswater stays here/.test(held.t) && held.link === 'see your last send' && held.acct === JSON.stringify({ acct: 'loviswater' }) && held.seal && held.pend, JSON.stringify(held));
      await fill('7', 'a different send');
      await page.evaluate(() => document.getElementById('hs-go').click());
      await until(page, /^(done|it |your|hive|that|the )/i, 'hs-stat', 60000);
      const sigs = new Set(state.broadcasts.map(b => b.signatures[0]));
      ok('the next press resends the kept bytes, signs nothing new, and says the last send went through', /^your last send went through: 0\.500 HIVE to someoneelse/.test(await page.textContent('#hs-stat')) && sigs.size === 1 && state.broadcasts.every(b => b.operations[0][1].amount === '0.500 HIVE'), (await page.textContent('#hs-stat')) + ' · ' + sigs.size);
      // with nothing pending, forgetting is said first and pressed once more; "keep it" keeps it
      await page.evaluate(() => document.getElementById('hv-other').click());
      const ask = await page.evaluate(() => ({ t: document.getElementById('hv-add-stat').innerText, btns: [...document.querySelectorAll('#hv-add-stat button.wl-act')].map(b => b.textContent), acct: localStorage.getItem('bnr_hive_acct:gatesoul') }));
      ok('a different Hive account first says it forgets the sealed key, and forgets nothing yet', /this forgets loviswater and its sealed key/.test(ask.t) && JSON.stringify(ask.btns) === JSON.stringify(['forget loviswater', 'keep it']) && !!ask.acct, JSON.stringify(ask));
      await page.evaluate(() => document.querySelectorAll('#hv-add-stat button.wl-act')[1].click());
      ok('keep it keeps the account and its seal', !!(await page.evaluate(() => localStorage.getItem('bnr_hive_acct:gatesoul') && localStorage.getItem('bnr_hive_seal:gatesoul'))));
      const press = () => page.evaluate(() => { document.getElementById('hs-stat').textContent = ''; document.getElementById('hs-go').click(); });
      const said = () => page.textContent('#hs-stat');
      const pend = () => page.evaluate(() => localStorage.getItem('bnr_hive_pending:gatesoul'));
      const hiveSum = () => page.evaluate(() => JSON.parse(localStorage.getItem('bnr-cap-ledger') || '[]').filter(e => e.u === 'HIVE').reduce((s, e) => s + e.a, 0));
      // a kept send that may already be out is READ before any refusal is believed: after its
      // window a node answers "expired", not "duplicate", and a landed send must never be cleared
      state.landed = false; state.failNext = 2; state.broadcasts = [];
      await fill('0.25', 'third'); await press();
      await until(page, /^(done|it |your|hive|that|the )/i, 'hs-stat', 60000);
      const form = await page.evaluate(() => ['hs-to', 'hs-amt', 'hs-memo'].map(i => document.getElementById(i).value).join(''));
      ok('once a send is signed the form is cleared, so a press can never sign it a second time', form === '' && !!(await pend()), form);
      state.refuse = 'transaction expired'; state.status = 'within_irreversible_block'; const nb = state.broadcasts.length;
      await press(); await until(page, /^(done|it |your|hive|that|the )/i, 'hs-stat', 60000);
      ok('the chain is read first: it shows the send, so it went through, no refusal is believed and nothing is re-signed',
        /^your last send went through: 0\.250 HIVE/.test(await said()) && state.broadcasts.length === nb && (await pend()) === null, (await said()) + ' · ' + (state.broadcasts.length - nb));
      // the cap: counted once signed, given back only on the chain's proof that it never ran
      delete state.refuse; delete state.status; state.landed = false; state.failNext = 2;
      const before = await hiveSum();
      await fill('2', 'fourth'); await press(); await until(page, /^(done|it |your|hive|that|the )/i, 'hs-stat', 60000);
      ok('a signed send counts against the daily cap at once, also when its answer is lost', Math.abs((await hiveSum()) - before - 2) < 1e-9, String((await hiveSum()) - before));
      state.status = 'expired_irreversible';
      await press(); await until(page, /^(done|it |your|hive|that|the )/i, 'hs-stat', 60000);
      ok('expired_irreversible is the chain\'s proof it never ran: the 2 HIVE come back to the cap and the lane is free',
        /did not land in time, so nothing was sent/.test(await said()) && Math.abs((await hiveSum()) - before) < 1e-9 && (await pend()) === null, (await said()) + ' · ' + ((await hiveSum()) - before));
      delete state.status; state.refuse = 'Account does not have sufficient funds for balance adjustment'; state.broadcasts = [];
      await fill('3', 'fifth'); await press(); await until(page, /^(done|it |your|hive|that|the )/i, 'hs-stat', 60000);
      ok('a sure refusal of a first broadcast is said, the cap is given back and the typing comes back',
        (await said()) === 'that account does not hold enough for this.' && Math.abs((await hiveSum()) - before) < 1e-9 && (await page.evaluate(() => document.getElementById('hs-amt').value)) === '3.000' && (await pend()) === null, await said());
      delete state.refuse;
      const settled = p => until(p, /^(done|it |you |your|[Hh]ive|that|the )/, 'hs-stat', 60000);   // until() drops regex flags: the capital is spelled out
      // a gateway's own error (not hived's verdict) proves nothing: the send stays kept and the chain is read back
      state.refuse = 'Internal Error'; state.status = 'within_irreversible_block'; state.broadcasts = [];
      const gw0 = await hiveSum();
      await fill('4', 'gateway'); await press(); await settled(page);
      ok('a gateway error is no refusal: every node is asked, the chain is read, it went through, the cap stays counted and nothing is typed back',
        (await said()) === 'done. 4.000 HIVE went to someoneelse, and the chain confirmed it.' && state.broadcasts.length === 2 && Math.abs((await hiveSum()) - gw0 - 4) < 1e-9 && (await page.evaluate(() => document.getElementById('hs-amt').value)) === '' && (await pend()) === null,
        (await said()) + ' · ' + state.broadcasts.length + ' · ' + ((await hiveSum()) - gw0));
      delete state.refuse; delete state.status;
      // a send loaded back from its slot is never fresh: it is marked as possibly out before a byte
      // leaves, and the next press reads the chain before an expiry answer is believed
      state.landed = false; state.failNext = 2; state.peek = true; state.broadcasts = [];
      const rl0 = await hiveSum();
      await fill('5', 'reload'); await press(); await settled(page);
      const peeked = JSON.parse(state.peeked || 'null');
      ok('the kept copy is marked as possibly out before the first byte leaves', !!peeked && peeked.out === true && peeked.amount === '5.000', state.peeked);
      await page.evaluate(() => { const k = 'bnr_hive_pending:gatesoul', p = JSON.parse(localStorage.getItem(k)); delete p.out; localStorage.setItem(k, JSON.stringify(p)); });
      state.refuse = 'Assert Exception:now < trx.expiration: '; state.status = 'within_irreversible_block'; const nb5 = state.broadcasts.length;
      await press(); await settled(page);
      ok('a stored send (even one never marked out) is read on chain first: it went through, no expiry answer is believed, nothing is given back',
        /^your last send went through: 5\.000 HIVE/.test(await said()) && state.broadcasts.length === nb5 && Math.abs((await hiveSum()) - rl0 - 5) < 1e-9 && (await pend()) === null,
        (await said()) + ' · ' + (state.broadcasts.length - nb5) + ' · ' + ((await hiveSum()) - rl0));
      delete state.refuse; delete state.status;
      // the slot is the signing soul's: another name connected mid-check never has its own kept send cleared
      const OTHER = JSON.stringify({ txid: 'ab'.repeat(20), exp: '2026-10-05T12:01:00', from: 'otherhive', to: 'someoneelse', amount: '9.000', sym: 'HIVE', tx: {} });
      const backTo = async n => { await page.evaluate(v => { document.getElementById('wq').value = v; document.getElementById('wgo').click(); }, n); };
      state.landed = false; state.failNext = 2;
      await fill('6', 'soul'); await press(); await settled(page);
      await page.evaluate(o => localStorage.setItem('bnr_hive_pending:othersoul', o), OTHER);
      state.switchOnStatus = 'othersoul'; state.status = 'within_irreversible_block';
      await press(); await settled(page);
      const sl = await page.evaluate(() => ({ g: localStorage.getItem('bnr_hive_pending:gatesoul'), o: localStorage.getItem('bnr_hive_pending:othersoul') }));
      ok('another name connected mid-check: the send settles in its own soul\'s slot, and that name\'s kept send is untouched',
        /^your last send went through: 6\.000 HIVE/.test(await said()) && sl.g === null && sl.o === OTHER, (await said()) + ' · ' + JSON.stringify(sl));
      delete state.status;
      await page.evaluate(() => localStorage.removeItem('bnr_hive_pending:othersoul'));
      await backTo('gatesoul'); await until(page, /✓ live · loviswater/, 'h-stat', 20000);
      // another name connected while a send is signing: dropped before any broadcast, kept nowhere, never counted
      state.switchOnDgp = 'othersoul'; state.broadcasts = [];
      const mv0 = await hiveSum();
      await fill('7', 'moved'); await press(); await settled(page);
      const mv = await page.evaluate(() => ({ g: localStorage.getItem('bnr_hive_pending:gatesoul'), o: localStorage.getItem('bnr_hive_pending:othersoul') }));
      ok('another name connected while a send signs: nothing is broadcast, kept or counted, and the line says so',
        /^you connected another name while this was signing, so nothing was sent/.test(await said()) && state.broadcasts.length === 0 && mv.g === null && mv.o === null && Math.abs((await hiveSum()) - mv0) < 1e-9,
        (await said()) + ' · ' + state.broadcasts.length + ' · ' + JSON.stringify(mv));
      await backTo('gatesoul'); await until(page, /✓ live · loviswater/, 'h-stat', 20000);
      // two tabs checking one kept send: the cap comes back once, never twice
      state.landed = false; state.failNext = 2; state.switchOnDgp = null;
      const tb0 = await hiveSum();
      await fill('8', 'two tabs'); await press(); await settled(page);
      const page2 = await ctx.newPage(); page2.on('pageerror', e => errors.push('tab 2: ' + e.message));
      await page2.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
      await page2.waitForFunction(() => window.BNRHIVE && window.BNRHIVE.bound() === 'loviswater', null, { timeout: 20000 });
      let release; state.holdP = new Promise(r => { release = r; }); state.hold = page2; state.held = false;
      state.status = 'expired_irreversible';
      await page2.evaluate(() => { document.getElementById('hs-stat').textContent = ''; document.getElementById('hs-go').click(); });
      await new Promise((r, j) => { const t0 = Date.now(), t = setInterval(() => { if (state.held || Date.now() - t0 > 20000) { clearInterval(t); state.held ? r() : j(new Error('tab 2 never asked the chain')); } }, 50); });
      await press(); await until(page, /did not land in time/, 'hs-stat', 60000);
      const once = await hiveSum();
      release(); state.hold = null;
      await settled(page2);
      const twice = await page2.evaluate(() => JSON.parse(localStorage.getItem('bnr-cap-ledger') || '[]').filter(e => e.u === 'HIVE').reduce((s, e) => s + e.a, 0));
      ok('two tabs checking one expired send: the 8 HIVE come back to the cap once, never twice',
        Math.abs(once - tb0) < 1e-9 && Math.abs(twice - tb0) < 1e-9 && (await pend()) === null && /did not land in time/.test(await page2.textContent('#hs-stat')),
        (once - tb0) + ' then ' + (twice - tb0) + ' · ' + (await page2.textContent('#hs-stat')));
      await page2.close(); delete state.status;
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
