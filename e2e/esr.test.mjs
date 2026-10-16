// esr.test.mjs: the wallet's EOSIO Signing Request encoder (EEP-7), the "or sign it in Anchor" link on the
// #sign-action sheet. The encoder is the shipped text in surfaces/wallet.html (between "ESR:" and "end ESR"),
// run here with the page's own b64url. This test decodes the published example requests with its own
// decoder (node zlib, nothing from the page), rebuilds each request with the encoder, and compares the
// uncompressed payload bytes. Deflate output is not canonical across zlib builds, so compressed strings are
// never compared; inflated payloads are. A registry request round-trips through the wallet's own ABI
// serializer (the vendored eosjs, as the page loads it). No network. Run: node --test e2e/esr.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const html = read('../surfaces/wallet.html');
const b64 = html.match(/  function b64r\(bytes\)\{[\s\S]*?\n  \}\n  function b64url\(bytes\)\{[\s\S]*?\n  \}\n/);
const block = html.match(/  \/\* ── ESR: [\s\S]*?\/\* ── end ESR ── \*\//);
assert.ok(b64 && block, 'the page carries b64url and the ESR block');
const load = (compress = true) => new Function('CompressionStream', 'Response', 'TextEncoder', 'btoa',
  b64[0] + block[0] + '\nreturn {ESR_SIGNER, esrName, esrPayload, esrEncode};')(compress ? globalThis.CompressionStream : undefined, Response, TextEncoder, btoa);
const E = load();

// the wallet's own serializer, as the page loads it (globalThis.BnrSign)
vm.runInThisContext(read('../surfaces/onboarding/vendor/bnr-sign.js'));
const BN = globalThis.BnrSign;

/* ── this test's own decoder (EEP-7 "Encoding", the ABI as wharfkit/signing-request src/abi.ts carries it) ── */
const CHARMAP = '.12345abcdefghijklmnopqrstuvwxyz';
function nameOf(v) {   // u64 to an Antelope name, as eosio::name::to_string does
  let s = '';
  for (let i = 0; i <= 12; i++) { s = CHARMAP[Number(v & (i === 0 ? 0x0fn : 0x1fn))] + s; v >>= i === 0 ? 4n : 5n; }
  return s.replace(/\.+$/, '');
}
function decode(link) {
  const m = /^esr:(?:\/\/)?([A-Za-z0-9_-]+)$/.exec(link);
  assert.ok(m, 'an esr: link with a base64url body: ' + link);
  const all = Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const header = all[0], version = header & 0x7f, compressed = (header & 0x80) !== 0, body = all.subarray(1);
  const p = compressed ? inflateRawSync(body) : Buffer.from(body);
  let i = 0;
  const u8 = () => p[i++];
  const varu = () => { let v = 0, sh = 0, b; do { b = p[i++]; v |= (b & 127) << sh; sh += 7; } while (b & 128); return v >>> 0; };
  const nm = () => { const v = p.readBigUInt64LE(i); i += 8; return nameOf(v); };
  const bytes = () => { const n = varu(); const b = p.subarray(i, i + n); i += n; return Buffer.from(b); };
  const id32 = () => { const b = p.subarray(i, i + 32); i += 32; return Buffer.from(b).toString('hex'); };
  const chainVariant = u8(), chain = chainVariant === 0 ? { alias: u8() } : { id: id32() };
  const reqVariant = u8();
  assert.ok(reqVariant === 0 || reqVariant === 1, 'an action or action[] request');
  const count = reqVariant === 1 ? varu() : 1, actions = [];
  for (let k = 0; k < count; k++) {
    const account = nm(), name = nm(), n = varu(), authorization = [];
    for (let j = 0; j < n; j++) authorization.push({ actor: nm(), permission: nm() });
    actions.push({ account, name, authorization, data: bytes() });
  }
  const flags = u8(), callback = bytes().toString('utf8'), infoN = varu(), info = [];
  for (let k = 0; k < infoN; k++) info.push({ key: bytes().toString('utf8'), value: bytes() });
  assert.equal(i, p.length, 'nothing trails the request');
  return { header, version, compressed, body, payload: p, chain, req: reqVariant === 1 ? 'action[]' : 'action', actions, flags, callback, info };
}
const hex = b => Buffer.from(b).toString('hex');
const asRequest = d => ({ actions: d.actions.map(a => ({ ...a, data: new Uint8Array(a.data) })), list: d.req === 'action[]', flags: d.flags, callback: d.callback });

/* the published requests the research lists (paths-research.json, the esr topic, checked 2026-10-05) */
// EEP-7 example 1 (eep-7.md line 98): eosio::voteproducer, action[] with one action, flags 1
const EEP7 = 'esr:gmNgZGRkAIFXBqEFopc6760yugsVYWCA0YIwxgKjuxLSL6-mgmQA';
const EEP7_PAYLOAD = '000101010000000000ea30557015d289deaa32dd0101000000000000000100000000000000110100000000000000a032dd181be9d56500010000'; // PUBLIC-CONSTANT: EEP-7 example 1, inflated payload
// wharfkit/signing-request test/request.ts line 342: eosio.token::transfer, one action, flags 3 (broadcast and background)
const WHARF = 'esr://gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGMBoExgDAjRi4fwAVz93ICUckpGYl12skJZfpFCSkaqQllmcwczAAAA';
const WHARF_PAYLOAD = '00010000a6823403ea3055000000572d3ccdcd0101000000000000000100000000000000340100000000000000000000000000285d01000000000000000050454e47000000135468616e6b7320666f72207468652066697368030000'; // PUBLIC-CONSTANT: wharfkit test vector, inflated payload

test('EEP-7 example 1 decodes to what the spec says it carries', () => {
  const d = decode(EEP7);
  assert.equal(d.header, 0x82); assert.equal(d.version, 2); assert.ok(d.compressed);
  assert.equal(hex(d.payload), EEP7_PAYLOAD);
  assert.deepEqual(d.chain, { alias: 1 });
  assert.equal(d.req, 'action[]');
  assert.equal(d.actions.length, 1);
  assert.equal(d.actions[0].account, 'eosio'); assert.equal(d.actions[0].name, 'voteproducer');
  assert.deepEqual(d.actions[0].authorization, [{ actor: '............1', permission: '............1' }]);
  assert.equal(hex(d.actions[0].data), '0100000000000000a032dd181be9d56500');
  assert.equal(d.flags, 1); assert.equal(d.callback, ''); assert.deepEqual(d.info, []);
});

test('the encoder writes EEP-7 example 1 byte for byte (uncompressed payload)', async () => {
  const d = decode(EEP7);
  assert.equal(hex(E.esrPayload(asRequest(d))), EEP7_PAYLOAD);
  const e = await E.esrEncode(asRequest(d));
  assert.match(e.link, /^esr:[A-Za-z0-9_-]+$/, 'esr: with no slashes, base64url with no padding');
  const back = decode(e.link);
  assert.equal(back.version, 2);
  assert.equal(hex(back.payload), EEP7_PAYLOAD);
  if (back.compressed) assert.ok(back.body.length < back.payload.length, 'deflated only when that is shorter');
});

test('the wharfkit vector decodes and the encoder writes it byte for byte (uncompressed payload)', async () => {
  const d = decode(WHARF);
  assert.equal(d.header, 0x82); assert.equal(hex(d.payload), WHARF_PAYLOAD);
  assert.equal(d.req, 'action');
  assert.equal(d.actions[0].account, 'eosio.token'); assert.equal(d.actions[0].name, 'transfer');
  assert.deepEqual(d.actions[0].authorization, [{ actor: '............1', permission: '............1' }]);
  assert.equal(d.flags, 3); assert.equal(d.callback, ''); assert.deepEqual(d.info, []);
  assert.equal(hex(E.esrPayload(asRequest(d))), WHARF_PAYLOAD);
  const back = decode((await E.esrEncode(asRequest(d))).link);
  assert.equal(hex(back.payload), WHARF_PAYLOAD);
});

test('names: the encoder agrees with the wallet\'s own serializer, placeholders included, and refuses what is not a name', () => {
  for (const n of ['eosio', 'eosio.token', 'kingbeelovis', 'registeracc', 'active', 'voteproducer', 'greymassvote', 'core.vaulta', 'a', '1', 'zzzzzzzzzzzzj', E.ESR_SIGNER, '............2']) {
    const sb = new BN.Serialize.SerialBuffer({ textEncoder: new TextEncoder(), textDecoder: new TextDecoder() });
    sb.pushName(n);
    assert.equal(hex(E.esrName(n)), hex(sb.asUint8Array()), n);
    assert.equal(nameOf(Buffer.from(E.esrName(n)).readBigUInt64LE(0)), n, 'decodes back: ' + n);
  }
  assert.equal(hex(E.esrName(E.ESR_SIGNER)), '0100000000000000');
  for (const bad of ['King', 'toolongname1234', 'kingbeelovis6', 'abcdefghijklz', 'a b', 'king-b']) assert.throws(() => E.esrName(bad), /not an Antelope name/, bad);
});

/* the round trip the sheet makes: kingbeelovis::registeracc {registrant: kingbeelovis, domain_name: "k", target: kingbeelovis} */
const REGISTRY_ABI = { version: 'eosio::abi/1.2', types: [], actions: [{ name: 'registeracc', type: 'registeracc' }],
  structs: [{ name: 'registeracc', base: '', fields: [{ name: 'registrant', type: 'name' }, { name: 'domain_name', type: 'string' }, { name: 'target', type: 'name' }] }] };
const REG_DATA = { registrant: 'kingbeelovis', domain_name: 'k', target: 'kingbeelovis' };
function serialized() {   // the wallet's vaultaSerialize, minus its get_abi read
  const types = BN.Serialize.getTypesFromAbi(BN.Serialize.createInitialTypes(), REGISTRY_ABI), amap = new Map();
  for (const a of REGISTRY_ABI.actions) amap.set(a.name, BN.Serialize.getType(types, a.type));
  return { types, act: BN.Serialize.serializeAction({ types, actions: amap }, 'kingbeelovis', 'registeracc', [{ actor: 'kingbeelovis', permission: 'active' }], REG_DATA, new TextEncoder(), new TextDecoder()) };
}
// an Antelope name as its 8 little-endian bytes, the way the sheet's e2e fixture computes it (a third implementation)
const nameHex = n => { let v = 0n; for (let i = 0; i <= 12; i++) { const ch = n[i] || '.', c = ch === '.' ? 0 : ch >= 'a' ? ch.charCodeAt(0) - 91 : ch.charCodeAt(0) - 48;
  v |= i < 12 ? BigInt(c & 0x1f) << BigInt(64 - 5 * (i + 1)) : BigInt(c & 0x0f); } return Buffer.from(new BigUint64Array([v]).buffer).toString('hex'); };

test('a registry request round-trips: the link decodes to exactly the action, on Vaulta, to be broadcast', async () => {
  const { types, act } = serialized();
  const e = await E.esrEncode({ actions: [act] });
  const d = decode(e.link);
  assert.equal(d.version, 2);
  assert.equal(d.header, d.compressed ? 0x82 : 0x02);
  if (d.compressed) assert.ok(d.body.length < d.payload.length, 'deflated only when that is shorter');
  else assert.equal(hex(d.body), hex(d.payload));
  assert.deepEqual(d.chain, { alias: 1 }, 'chain alias 1: EOS, now Vaulta');
  assert.equal(d.req, 'action', 'one action is variant 0');
  assert.equal(d.actions.length, 1);
  assert.equal(d.actions[0].account, 'kingbeelovis'); assert.equal(d.actions[0].name, 'registeracc');
  assert.deepEqual(d.actions[0].authorization, [{ actor: 'kingbeelovis', permission: 'active' }]);
  assert.equal(hex(d.actions[0].data), act.data.toLowerCase());
  const back = types.get('registeracc').deserialize(new BN.Serialize.SerialBuffer({ array: new Uint8Array(d.actions[0].data), textEncoder: new TextEncoder(), textDecoder: new TextDecoder() }));
  assert.deepEqual({ ...back }, REG_DATA, 'the data reads back as the same fields');
  assert.equal(d.flags, 1, 'broadcast, and nothing else');
  assert.equal(d.callback, ''); assert.deepEqual(d.info, []);
  // the payload written out by hand from the layout
  const data = nameHex('kingbeelovis') + '01' + hex(Buffer.from('k')) + nameHex('kingbeelovis');
  assert.equal(hex(d.payload), '0001' + '00' + nameHex('kingbeelovis') + nameHex('registeracc') + '01' + nameHex('kingbeelovis') + nameHex('active') + '12' + data + '01' + '00' + '00');
});

test('several actions are an action[] request; with no CompressionStream the link is written uncompressed (0x02)', async () => {
  const { act } = serialized();
  const d = decode((await E.esrEncode({ actions: [act, act] })).link);
  assert.equal(d.req, 'action[]'); assert.equal(d.actions.length, 2);
  const p = decode((await load(false).esrEncode({ actions: [act] })).link);
  assert.equal(p.header, 0x02); assert.equal(p.compressed, false);
  assert.equal(hex(p.payload), hex(decode((await E.esrEncode({ actions: [act] })).link).payload), 'the same payload either way');
});

test('the encoder refuses a request it cannot write', () => {
  assert.throws(() => E.esrPayload({ actions: [] }), /needs an action/);
  const { act } = serialized();
  assert.throws(() => E.esrPayload({ actions: [act], flags: 256 }), /one byte/);
  assert.throws(() => E.esrPayload({ actions: [{ ...act, data: 'zz' }] }), /not hex/);
});
