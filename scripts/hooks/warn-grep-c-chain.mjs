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
