// args.mjs — one argv reader for the hand-run e2e instruments.
//
//   const arg = argReader('usage: node x.mjs [--json out.json] [--reg a,b]');
//   const OUT = arg('json', '');          // --json out.json  or  --json=out.json
//
// A flag given without a value (`--json` as the last word, `--json --reg`, `--json=`) is a
// mistake, not a request for the default: it prints the usage line and exits 2.
export function argReader(usage, argv = process.argv) {
  return (k, d) => {
    const eq = argv.find(a => a.startsWith('--' + k + '='));
    if (eq) { const v = eq.slice(k.length + 3); if (!v) { process.stderr.write(`--${k} needs a value\n${usage}\n`); process.exit(2); } return v; }
    const i = argv.indexOf('--' + k); if (i < 0) return d;
    const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) { process.stderr.write(`--${k} needs a value\n${usage}\n`); process.exit(2); }
    return v;
  };
}
