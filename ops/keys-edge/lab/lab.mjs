// lab.mjs: the byte checks of the keys-edge lab (lab.sh). Node only: no docker, no network.
// Every expectation comes from the release the lab made with tools/keychain-release (or, in
// lab.sh host, the ruled envelope); every observation is a file the lab fetched or inspected.
// Exit 1 on any mismatch, 2 on misuse.
//
//   get PATH [FILE]                        a JSON value (dotted PATH) from FILE or stdin
//   ant-body PACK OUT                      {"data":"<base64>"}: what an antd door answers for PACK
//   tamper ENVELOPE OUT forged|mismatched  one record digest changed; forged re-binds sig.file to
//                                          the new bytes (only ML-DSA can refuse it), mismatched
//                                          leaves it (the §3b file binding refuses it)
//   render-toml IN OUT key=value...        IN with each `key = ...` line replaced, each exactly once
//   envelope-record ENVELOPE OUT           the record bytes an envelope carries, to OUT; prints
//                                          {"seq","sha3"}
//   check-files RECORD DIR                 DIR/<path>.body for every file the record names: size,
//                                          SHA-256 and SHA3-256 against the decoded digests
//   check-pack RECORD PACK                 PACK against the record: size, SHA-256 and SHA3-256, then
//                                          every file's slice of it
//   check-envelope EXPECTED GOT RECORD     GOT is EXPECTED byte for byte and carries RECORD
//   check-headers FILE                     a 200 response through Caddy: no Server, no Alt-Svc; HSTS,
//                                          nosniff, Referrer-Policy as Caddyfile.keys sets them
//   check-direct-headers FILE              a 200 response from keys-door itself (no Caddy): nosniff,
//                                          and no HSTS, Referrer-Policy, Server or Alt-Svc, so the
//                                          HSTS and Referrer-Policy seen through Caddy are Caddy's
//   check-405 HEADERS BODY caddy|keys-door caddy: 405 with no Allow header and an empty body (what
//                                          `respond @notRead 405` sends); keys-door: 405 with
//                                          Allow: GET, HEAD and its own body
//   check-hardening INSPECT                `docker inspect keys-door` JSON: compose.yml's hardening
//   equivocation-is null | SEQ A B         health JSON on stdin: no fork, or exactly {seq: SEQ,
//                                          records: [A, B] in byte order}
//   same-bytes A B
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const {canon, parseStrict} = await import(pathToFileURL(join(ROOT, 'tools', 'keychain-release', 'release.mjs')).href);

const hash = (alg, b) => createHash(alg).update(b).digest();
const b64u = b => Buffer.from(b).toString('base64url');
// A record digest is 32 bytes of base64url without padding; decode it, and refuse one that does
// not re-encode to itself, so a comparison is between bytes, never between spellings.
function digest(s, where) {
  const d = Buffer.from(String(s), 'base64url');
  if (d.length !== 32 || b64u(d) !== s) throw new Error(`${where}: ${s} is not a canonical base64url SHA digest`);
  return d;
}
const fail = msg => { console.log(`FAIL ${msg}`); process.exitCode = 1; };
const matches = (b, d, where) => hash('sha256', b).equals(digest(d.sha256, `${where}.sha256`))
  && hash('sha3-256', b).equals(digest(d.sha3, `${where}.sha3`)) && b.length === d.size;

// the last header block curl -D wrote (a 1xx or a proxy block may precede it), as lines
function headBlock(file) {
  const blocks = readFileSync(file, 'latin1').split(/\r?\n\r?\n/).filter(s => s.trim());
  return blocks[blocks.length - 1].split(/\r?\n/);
}
const values = (head, name) => head.slice(1)
  .filter(l => l.toLowerCase().startsWith(`${name.toLowerCase()}:`))
  .map(l => l.slice(name.length + 1).trim());

const cmds = {
  get([path, file]) {
    let v = JSON.parse(readFileSync(file ?? 0, 'utf8'));
    for (const k of path.split('.')) v = v == null ? undefined : v[k];
    if (v === undefined) throw new Error(`no ${path}`);
    process.stdout.write(typeof v === 'string' ? v : JSON.stringify(v));
  },
  'ant-body'([pack, out]) {
    writeFileSync(out, JSON.stringify({data: readFileSync(pack).toString('base64')}));
  },
  tamper([input, out, mode]) {
    if (!['forged', 'mismatched'].includes(mode)) throw new Error('mode is forged or mismatched');
    const env = parseStrict(readFileSync(input));
    const r = parseStrict(Buffer.from(env.record, 'base64url'));
    const was = r.files[0].sha256;
    r.files[0].sha256 = (was[0] === 'A' ? 'B' : 'A') + was.slice(1);
    const rec = Buffer.from(canon(r), 'latin1');
    env.record = b64u(rec);
    if (mode === 'forged') env.sig.file = {sha3: b64u(hash('sha3-256', rec)), size: rec.length};
    writeFileSync(out, canon(env));
    console.log(`${mode}: files[0] (${r.files[0].path}) sha256 ${was} -> ${r.files[0].sha256}; sig.file ${mode === 'forged' ? 're-bound to the new record bytes' : 'left naming the signed bytes'}`);
  },
  'render-toml'([input, out, ...pairs]) {
    const lines = readFileSync(input, 'utf8').split('\n');
    for (const p of pairs) {
      const eq = p.indexOf('='), key = p.slice(0, eq), value = p.slice(eq + 1);
      if (eq < 1) throw new Error(`${p} is not key=value`);
      const at = lines.flatMap((l, i) => (l.startsWith(`${key} = `) ? [i] : []));
      if (at.length !== 1) throw new Error(`${key}: ${at.length} lines in ${input}, want exactly 1`);
      lines[at[0]] = `${key} = ${value}`;
    }
    writeFileSync(out, lines.join('\n'));
  },
  'envelope-record'([envelope, out]) {
    const env = parseStrict(readFileSync(envelope));
    if (env.bnr !== 'keychain-release-envelope/1' || typeof env.record !== 'string') throw new Error(`${envelope} is not a keychain-release-envelope/1`);
    const rec = Buffer.from(env.record, 'base64url');
    if (b64u(rec) !== env.record) throw new Error(`${envelope}: record is not canonical base64url`);
    const r = parseStrict(rec);
    writeFileSync(out, rec);
    console.log(JSON.stringify({seq: r.seq, sha3: b64u(hash('sha3-256', rec))}));
  },
  'check-files'([recordFile, dir]) {
    const r = parseStrict(readFileSync(recordFile));
    for (const f of r.files) {
      const p = join(dir, ...f.path.split('/')) + '.body';
      if (!existsSync(p)) { fail(`${f.path}: not fetched`); continue; }
      const b = readFileSync(p);
      if (matches(b, f, f.path)) console.log(`PASS ${f.path}: ${b.length} bytes, sha256 ${f.sha256}, sha3 ${f.sha3}`);
      else fail(`${f.path}: ${b.length} bytes, sha256 ${b64u(hash('sha256', b))}; the record names ${f.size} bytes, sha256 ${f.sha256}`);
    }
  },
  'check-pack'([recordFile, packFile]) {
    const r = parseStrict(readFileSync(recordFile)), pack = readFileSync(packFile);
    if (!matches(pack, r.pack, 'pack')) return fail(`${packFile}: ${pack.length} bytes, sha256 ${b64u(hash('sha256', pack))}; the record's pack is ${r.pack.size} bytes, sha256 ${r.pack.sha256}`);
    let off = 0;
    for (const f of r.files) {
      if (!matches(pack.subarray(off, off + f.size), f, f.path)) fail(`${packFile}: the slice at ${off} is not ${f.path}`);
      off += f.size;
    }
    if (!process.exitCode) console.log(`PASS ${packFile}: ${pack.length} bytes, sha256 ${r.pack.sha256}, sha3 ${r.pack.sha3}; all ${r.files.length} file slices match`);
  },
  'check-envelope'([expected, got, recordFile]) {
    const e = readFileSync(expected), g = readFileSync(got), rec = readFileSync(recordFile);
    if (!g.equals(e)) return fail(`${got}: ${g.length} bytes, not the expected envelope (${e.length} bytes)`);
    const env = parseStrict(g), inner = Buffer.from(env.record, 'base64url');
    if (!inner.equals(rec)) return fail(`${got}: its record is not ${recordFile}`);
    const r = parseStrict(inner);
    console.log(`PASS envelope byte-identical (${g.length} bytes); record seq ${r.seq}, sha3 ${b64u(hash('sha3-256', inner))}, signer ${env.sig.id}`);
  },
  'check-headers'([file]) {
    const head = headBlock(file);
    if (!/^HTTP\/\S+ 200\b/.test(head[0])) fail(`${file}: status line ${head[0]}`);
    for (const absent of ['Server', 'Alt-Svc']) if (values(head, absent).length) fail(`${file}: ${absent}: ${values(head, absent).join(', ')}`);
    const want = {'Strict-Transport-Security': 'max-age=63072000', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
    for (const [k, v] of Object.entries(want)) if (values(head, k).join(',') !== v) fail(`${file}: ${k} is [${values(head, k).join(', ')}], want ${v}`);
    if (!process.exitCode) console.log(`PASS ${file}: no Server, no Alt-Svc; HSTS, nosniff, Referrer-Policy as set (nosniff is set by keys-door too)`);
  },
  'check-direct-headers'([file]) {
    const head = headBlock(file);
    if (!/^HTTP\/\S+ 200\b/.test(head[0])) fail(`${file}: status line ${head[0]}`);
    if (values(head, 'X-Content-Type-Options').join(',') !== 'nosniff') fail(`${file}: keys-door itself does not send nosniff`);
    for (const absent of ['Strict-Transport-Security', 'Referrer-Policy', 'Server', 'Alt-Svc']) {
      if (values(head, absent).length) fail(`${file}: keys-door itself sends ${absent}: ${values(head, absent).join(', ')}, so seeing it through Caddy proves nothing about Caddyfile.keys`);
    }
    if (!process.exitCode) console.log(`PASS ${file}: keys-door alone sends nosniff and no HSTS, Referrer-Policy, Server or Alt-Svc`);
  },
  'check-405'([file, bodyFile, who]) {
    const head = headBlock(file), body = readFileSync(bodyFile), allow = values(head, 'Allow');
    if (!/^HTTP\/\S+ 405\b/.test(head[0])) fail(`${file}: status line ${head[0]}`);
    if (who === 'caddy') {
      if (allow.length) fail(`${file}: Allow: ${allow.join(', ')}; keys-door's 405 carries Allow, Caddy's respond does not: this request reached keys-door`);
      if (body.length) fail(`${bodyFile}: ${body.length} bytes; Caddy's respond @notRead 405 sends no body`);
    } else if (who === 'keys-door') {
      if (allow.join(',') !== 'GET, HEAD') fail(`${file}: Allow is [${allow.join(', ')}], want GET, HEAD`);
      if (body.toString('latin1') !== 'method not allowed\n') fail(`${bodyFile}: ${JSON.stringify(body.toString('latin1'))}`);
    } else throw new Error('check-405 takes caddy or keys-door');
    if (!process.exitCode) console.log(`PASS ${file}: ${who === 'caddy' ? '405, no Allow, empty body: Caddy answered' : '405, Allow: GET, HEAD, its own body: keys-door answered'}`);
  },
  'check-hardening'([file]) {
    const [c] = JSON.parse(readFileSync(file, 'utf8'));
    const hc = c.HostConfig, mounts = Object.fromEntries((c.Mounts ?? []).map(m => [m.Destination, m]));
    const want = [
      ['user', c.Config.User, '10096:10096'],
      ['read_only', hc.ReadonlyRootfs, true],
      ['privileged', hc.Privileged, false],
      ['cap_drop', JSON.stringify(hc.CapDrop), '["ALL"]'],
      ['cap_add', JSON.stringify(hc.CapAdd ?? []), '[]'],
      ['security_opt', JSON.stringify(hc.SecurityOpt), '["no-new-privileges:true"]'],
      ['pids_limit', hc.PidsLimit, 128],
      ['mem_limit', hc.Memory, 256 * 1024 * 1024],
      ['published ports', JSON.stringify(Object.keys(hc.PortBindings ?? {})), '[]'],
      ['state volume RW', mounts['/var/lib/keys-door/state']?.RW, true],
      ['inbox RW', mounts['/var/lib/keys-door/inbox']?.RW, false],
      ['config RW', mounts['/etc/keys-door/edge.toml']?.RW, false]
    ];
    for (const [name, got, w] of want) {
      if (got === w) console.log(`PASS ${name}: ${JSON.stringify(got)}`);
      else fail(`${name}: ${JSON.stringify(got)}, want ${JSON.stringify(w)}`);
    }
  },
  'equivocation-is'([seq, ...records]) {
    const e = JSON.parse(readFileSync(0, 'utf8')).equivocation;
    if (seq === 'null') {
      if (e !== null) return fail(`equivocation is ${JSON.stringify(e)}, want null`);
      return console.log('PASS equivocation: null');
    }
    const want = {seq: Number(seq), records: [...records].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))};
    if (JSON.stringify(e) !== JSON.stringify(want)) return fail(`equivocation is ${JSON.stringify(e)}, want ${JSON.stringify(want)}`);
    console.log(`PASS equivocation: ${JSON.stringify(e)}`);
  },
  'same-bytes'([a, b]) {
    const x = readFileSync(a), y = readFileSync(b);
    if (!x.equals(y)) return fail(`${b} (${y.length} bytes) is not ${a} (${x.length} bytes)`);
    console.log(`PASS ${b} is ${a} byte for byte (${x.length} bytes, sha256 ${b64u(hash('sha256', x))})`);
  }
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmds[cmd]) { console.error(`usage: lab.mjs ${Object.keys(cmds).join('|')} ...`); process.exit(2); }
try { cmds[cmd](rest); } catch (e) { console.error(`${cmd}: ${e.message}`); process.exit(2); }
