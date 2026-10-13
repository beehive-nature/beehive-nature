// lab.mjs: the byte checks of the keys-edge lab (lab.sh). Node only: no docker, no network.
// Every expectation comes from the release the lab made with tools/keychain-release; every
// observation is a file the lab fetched over TLS. Exit 1 on any mismatch, 2 on misuse.
//
//   get PATH [FILE]                        a JSON value (dotted PATH) from FILE or stdin
//   ant-body PACK OUT                      {"data":"<base64>"}: what an antd door answers for PACK
//   tamper ENVELOPE OUT forged|mismatched  one record digest changed; forged re-binds sig.file to
//                                          the new bytes (only ML-DSA can refuse it), mismatched
//                                          leaves it (the §3b file binding refuses it)
//   render-toml IN OUT key=value...        IN with each `key = ...` line replaced, each exactly once
//   check-files RECORD DIR                 DIR/<path>.body for every file the record names: size,
//                                          SHA-256 and SHA3-256 against the decoded digests
//   check-envelope EXPECTED GOT RECORD     GOT is EXPECTED byte for byte and carries RECORD
//   check-headers FILE                     a 200 response's headers: no Server, no Alt-Svc; HSTS,
//                                          nosniff, Referrer-Policy as Caddyfile.keys sets them
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
  'check-files'([recordFile, dir]) {
    const r = parseStrict(readFileSync(recordFile));
    for (const f of r.files) {
      const p = join(dir, ...f.path.split('/')) + '.body';
      if (!existsSync(p)) { fail(`${f.path}: not fetched`); continue; }
      const b = readFileSync(p);
      const ok = b.length === f.size
        && hash('sha256', b).equals(digest(f.sha256, `${f.path}.sha256`))
        && hash('sha3-256', b).equals(digest(f.sha3, `${f.path}.sha3`));
      if (ok) console.log(`PASS ${f.path}: ${b.length} bytes, sha256 ${f.sha256}, sha3 ${f.sha3}`);
      else fail(`${f.path}: ${b.length} bytes, sha256 ${b64u(hash('sha256', b))}; the record names ${f.size} bytes, sha256 ${f.sha256}`);
    }
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
    const blocks = readFileSync(file, 'latin1').split(/\r?\n\r?\n/).filter(s => s.trim());
    const head = blocks[blocks.length - 1].split(/\r?\n/);
    const h = name => head.filter(l => l.toLowerCase().startsWith(`${name.toLowerCase()}:`)).map(l => l.slice(name.length + 1).trim());
    if (!/^HTTP\/\S+ 200\b/.test(head[0])) fail(`${file}: status line ${head[0]}`);
    for (const absent of ['Server', 'Alt-Svc']) if (h(absent).length) fail(`${file}: ${absent}: ${h(absent).join(', ')}`);
    const want = {'Strict-Transport-Security': 'max-age=63072000', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
    for (const [k, v] of Object.entries(want)) if (h(k).join(',') !== v) fail(`${file}: ${k} is [${h(k).join(', ')}], want ${v}`);
    if (!process.exitCode) console.log(`PASS ${file}: no Server, no Alt-Svc; HSTS, nosniff, Referrer-Policy as set`);
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
