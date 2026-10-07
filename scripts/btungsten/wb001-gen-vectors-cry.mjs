// wb001-gen-vectors-cry.mjs — generate wb001-cryptol/Vectors.cry from the
// pinned wb001-vectors.json. The generated module makes CI EXECUTE the
// sampled-agreement half of the bridge: every pinned positive envelope
// reproduced by the Cryptol model — meaningful length word, every
// meaningful byte, zero tail — so a model/runtime packing divergence
// (the Beat 3 B1 defect class) goes RED instead of living in comments.
// Regenerate after an INTENTIONAL wb001-vectors.json change only.
import { readFileSync, writeFileSync } from 'node:fs';

const v = JSON.parse(readFileSync(new URL('./wb001-vectors.json', import.meta.url), 'utf8'));
const MARK = '// PUBLIC-CONSTANT: pinned bT-WB001 vector bytes (deterministic encoding of a public test intent)';

const fieldHex = (row, name) => {
  const val = name === 'nonce' || name === 'action' || name === 'payload' ? row[name] : Buffer.from(row[name], 'utf8').toString('hex');
  const len = name === 'nonce' || name === 'action' ? 32 : val.length / 2;
  return { len, hex: val };
};

const lines = [];
lines.push('// GENERATED from wb001-vectors.json by wb001-gen-vectors-cry.mjs — DO NOT EDIT.');
lines.push('// The CI formal job :check-s these rows every push: the model must');
lines.push('// reproduce each pinned envelope exactly (length word, every meaningful');
lines.push('// byte, zero tail past envLen). A red here names a wire-packing');
lines.push('// divergence between the Cryptol model and the runtime canonical().');
lines.push('import BTungstenWB001');
lines.push('');
v.positives.forEach((p, k) => {
  const envBits = p.length * 8;
  lines.push(`v${k} : Intent`);
  lines.push(`v${k} =`);
  const fields = [
    ['domain', fieldHex(p, 'domain')], ['nonce', fieldHex(p, 'nonce')], ['epoch', null],
    ['action', fieldHex(p, 'action')], ['destination', fieldHex(p, 'destination')],
    ['capability', fieldHex(p, 'capability')], ['amount', null], ['expiry', null],
    ['payer', fieldHex(p, 'payer')], ['payload', fieldHex(p, 'payload')],
  ];
  fields.forEach(([name, f], idx) => {
    const lead = idx === 0 ? '  {' : '  ,';
    if (f === null) {
      lines.push(`${lead} ${name.padEnd(11)} = ${p[name]}`);
    } else {
      const lit = f.len === 0 ? '(zero : [0][8])' : `(split (0x${f.hex} : [${f.len * 8}]))`;
      const tail = f.len === 0 ? '' : ` ${MARK}`;
      lines.push(`${lead} ${name.padEnd(11)} = mkB ${lit} ${f.len}${tail}`);
    }
  });
  lines.push('  }');
  lines.push('');
  lines.push(`row${k} : Bit`);
  lines.push(`property row${k} =`);
  lines.push(`    (envLen v${k} == ${p.length})`);
  lines.push(` && (wire v${k} == take\`{MaxEnv} ((split (0x${p.envelope} : [${envBits}])) # (zero : [MaxEnv][8]))) ${MARK}`);
  lines.push('');
});
lines.push('vectorsHold : Bit');
lines.push(`property vectorsHold = ${v.positives.map((_, k) => `row${k}`).join('\n  && ')}`);
lines.push('');
writeFileSync(new URL('./wb001-cryptol/Vectors.cry', import.meta.url), lines.join('\n'));
console.log(`bT-WB001: Vectors.cry generated 0 -> ${v.positives.length} rows`);
