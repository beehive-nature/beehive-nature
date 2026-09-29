// args.mjs — an argv reader for the hand-run e2e instruments (used by myspace-stranger.mjs; the
// other harnesses keep their own inline readers, with their own rules, until their owners move).
//
//   const arg = argReader('usage: node x.mjs [--json out.json] [--reg a,b]', ['json', 'reg']);
//   const OUT = arg('json', '');          // --json out.json  or  --json=out.json
//
// Built on node:util parseArgs in strict mode: an unknown flag, a stray positional, a flag given
// without a value (`--json` as the last word, `--json --reg`) and a repeated flag are all mistakes,
// not requests for the default, and so is an empty value (`--json=`, `--json ""`), which parseArgs
// accepts and this reader refuses. The reader throws a UsageError carrying the usage line; the
// script decides what to close and how to exit (a shared helper never exits the process itself).
import { parseArgs } from 'node:util';

export class UsageError extends Error { constructor(message, usage) { super(`${message}\n${usage}`); this.name = 'UsageError'; this.usage = usage; } }

export function argReader(usage, known, argv = process.argv.slice(2)) {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: Object.fromEntries(known.map(k => [k, { type: 'string' }])), strict: true, allowPositionals: false }));
  } catch (e) { throw new UsageError(e.message.replace(/\.?\s*To specify.*$/s, ''), usage); }
  for (const k of known) { const n = argv.filter(a => a === '--' + k || a.startsWith('--' + k + '=')).length; if (n > 1) throw new UsageError(`--${k} given ${n} times`, usage); }
  return (k, d) => { if (!(k in values)) return d; const v = values[k]; if (v === '') throw new UsageError(`--${k} needs a value`, usage); return v; };
}
