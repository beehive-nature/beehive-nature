// args.mjs — an argv reader for the hand-run e2e instruments (used by myspace-stranger.mjs; the
// other harnesses keep their own inline readers, with their own rules, until their owners move).
//
//   const arg = argReader('usage: node x.mjs [--json out.json] [--reg a,b]', ['json', 'reg']);
//   const OUT = arg('json', '');          // --json out.json  or  --json=out.json
//
// A flag given without a value (`--json` as the last word, `--json --reg`, `--json=`, `--json ""`)
// is a mistake, not a request for the default, and so is a flag the script does not know
// (`--regs`, `--out`): the reader throws a UsageError carrying the usage line, and the script
// decides what to close and how to exit (a shared helper never exits the process itself).
export class UsageError extends Error { constructor(message, usage) { super(`${message}\n${usage}`); this.name = 'UsageError'; this.usage = usage; } }

export function argReader(usage, known = null, argv = process.argv) {
  if (known) { const bad = argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')[0]).filter(f => !known.includes(f)); if (bad.length) throw new UsageError(`unknown flag(s): ${bad.map(f => '--' + f).join(', ')}`, usage); }
  return (k, d) => {
    const eq = argv.find(a => a.startsWith('--' + k + '='));
    if (eq) { const v = eq.slice(k.length + 3); if (!v) throw new UsageError(`--${k} needs a value`, usage); return v; }
    const i = argv.indexOf('--' + k); if (i < 0) return d;
    const v = argv[i + 1]; if (v === undefined || v === '' || v.startsWith('--')) throw new UsageError(`--${k} needs a value`, usage); // an empty token is a missing value too
    return v;
  };
}
