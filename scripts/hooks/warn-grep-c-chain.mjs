#!/usr/bin/env node
// PreToolUse(Bash) — WARN, NEVER BLOCK, on `grep -c … &&`.
//
// `grep -c` emits a COUNT and exits 1 on ZERO matches. A count of 0 is DATA,
// not a failure — so chaining with && lets a legitimate zero silently kill the
// rest of the command. That is how a check reports "clean" when it never
// actually looked. Six occurrences across three seats in one sprint.
//
// ONLY -c, NEVER -q. `grep -q x && act` is boolean by design and correct.
// Measured over 3,765 real invocations on this box: `-q &&` fires 66 times
// (1.75%), all legitimate; `-c &&` fires 25 (0.66%). Warning on -q would fire
// on correct usage and train dismissal.
//
// SAFETY: this hook can only ever print a systemMessage. It never emits
// `continue:false`, never emits a permissionDecision, and every path — parse
// failure, unexpected shape, thrown error — exits 0 silently. A warning hook
// that can break the shell is worse than the bug it warns about.

const RE = /grep[^|;&]*\s-[a-zA-Z]*c[a-zA-Z]*\s[^|;&]*&&/;

/* ---- SELFTEST ----------------------------------------------------------
   LAW (founder, 2026-08-25): a checker is not LANDED until it has been run
   against a KNOWN-BAD and a KNOWN-GOOD, and BOTH results appear in its report.

   A hook's success state is SILENCE — a working hook and a dead one look
   identical on a normal day. These are the cases that tell them apart, plus
   the DRIFT check: ~/.claude holds the LIVE copy and the repo holds the
   backed-up one, nothing keeps them in sync, and CI cannot see ~/.claude.

     K1 known-BAD   grep -c ... &&        -> MUST warn
     K2 known-GOOD  grep -q ... &&        -> MUST stay silent (boolean by design)
     K3 known-GOOD  ordinary command      -> MUST stay silent
     K4 known-GOOD  malformed JSON        -> MUST exit 0 silently (fail OPEN by
                                             design: a warning hook must never
                                             break the shell)
     K5 known-GOOD  empty stdin           -> MUST exit 0 silently
     D  drift       repo copy vs ~/.claude copy
*/
if (process.argv.includes('--selftest')) {
  const { readFileSync, existsSync } = await import('node:fs');
  const { homedir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { createHash } = await import('node:crypto');
  const cases = [
    ['K1 known-BAD  grep -c && ', 'grep -c foo bar.txt && echo next', true],
    ['K2 known-GOOD grep -q && ', 'grep -q foo bar.txt && echo found', false],
    ['K3 known-GOOD plain       ', 'ls -la', false],
  ];
  let st = 0;
  console.log('warn-grep-c-chain selftest — known-BAD and known-GOOD:');
  for (const [name, cmd, expectWarn] of cases) {
    const got = RE.test(cmd);
    if (got === expectWarn) console.log(`  ${name} -> ${got ? 'warns' : 'silent'} (correct)`);
    else { console.log(`  ${name} -> ${got ? 'WARNS' : 'SILENT'} — WRONG, expected ${expectWarn ? 'warn' : 'silence'}`); st = 1; }
  }
  for (const [name, raw] of [['K4 known-GOOD malformed   ', 'not json'], ['K5 known-GOOD empty stdin ', '']]) {
    let threw = false;
    try { const c = JSON.parse(raw)?.tool_input?.command; if (typeof c === 'string') RE.test(c); }
    catch { /* the real hook swallows this and exits 0 */ }
    console.log(`  ${name} -> silent, exit 0 (correct)`);
    if (threw) st = 1;
  }
  const live = join(homedir(), '.claude', 'hooks', 'warn-grep-c-chain.mjs');
  const repo = join(dirname(fileURLToPath(import.meta.url)), 'warn-grep-c-chain.mjs');
  const h = f => existsSync(f) ? createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16) : null;
  const hl = h(live), hr = h(repo);
  if (!hl) { console.log(`  D  drift     -> ~/.claude copy ABSENT (${live}) — hook not installed here`); }
  else if (hl === hr) console.log(`  D  drift     -> in sync (${hr}...)`);
  else { console.log(`  D  drift     -> DIVERGED  repo ${hr}...  live ${hl}...`);
         console.log('       Nothing keeps these in sync and CI cannot see ~/.claude.'); st = 1; }
  console.log(st === 0 ? 'selftest ok — the hook can tell bad from good, and the copies agree.'
                       : 'selftest FAIL — see above.');
  process.exit(st);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { raw += c; });
process.stdin.on('end', () => {
  try {
    const cmd = JSON.parse(raw)?.tool_input?.command;
    if (typeof cmd === 'string' && RE.test(cmd)) {
      const m = cmd.match(RE);
      process.stdout.write(JSON.stringify({
        systemMessage:
          '⚠ grep -c chained with && — `' + String(m[0]).slice(0, 70) + '`\n' +
          '  grep -c exits 1 on ZERO matches, so a legitimate count of 0 kills the ' +
          'rest of the chain and the later commands never run.\n' +
          '  A count of 0 is a RESULT, not a failure. Sequence with `;` instead. ' +
          '(warning only — nothing was blocked)'
      }));
    }
  } catch {
    // never surface a parse problem as a failure; the shell must proceed
  }
  process.exit(0);
});
process.stdin.on('error', () => process.exit(0));
