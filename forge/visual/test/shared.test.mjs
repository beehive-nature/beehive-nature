// Yjs multiplayer slice — convergence, fork-law, and no-clobber tests over an in-memory wire.
// Receipt: npm install (dev-only, yjs MIT per Gate BS-1) then `node forge/visual/test/shared.test.mjs`.
import { createSharedPiece } from '../shared.js';
import * as Y from 'yjs';

let failed = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failed++; };

// The in-memory wire: each side's send lands in the other's inbox; flush delivers.
// This is the same contract a LiveKit data channel or BroadcastChannel implements.
function room() {
  const inboxA = [], inboxB = [];
  const A = createSharedPiece({ Y, transport: { send: b => inboxB.push(b) } });
  const B = createSharedPiece({ Y, transport: { send: b => inboxA.push(b) } });
  const flush = () => {
    for (const b of inboxA.splice(0)) A.receive(b);
    for (const b of inboxB.splice(0)) B.receive(b);
  };
  return { A, B, flush };
}

// 1. Convergence: a seed set on one side reaches the other.
{
  const { A, B, flush } = room();
  A.setSeed('hive-77');
  flush();
  ok('convergence: seed reaches the other participant', B.state().seed === 'hive-77');
}

// 2. Fork law, multiplayer: B rolls a different seed; both converge on the child state.
{
  const { A, B, flush } = room();
  A.setSeed('parent-1');
  flush();
  B.setSeed('child-of-parent-1');
  flush();
  ok('fork law: room converges on the child seed', A.state().seed === 'child-of-parent-1' && B.state().seed === 'child-of-parent-1');
}

// 3. No clobber: concurrent edits to DIFFERENT params merge — nobody's knob erases anyone's.
{
  const { A, B, flush } = room();
  A.setSeed('shared-piece');
  A.setParam('density', 11);
  B.setParam('hueBase', 300);
  flush();
  const sa = JSON.stringify(A.state()), sb = JSON.stringify(B.state());
  ok('no-clobber: different params merge on both sides', sa === sb && A.state().params.density === 11 && A.state().params.hueBase === 300);
}

// 4. Deterministic conflict: same param edited on both sides — Yjs resolves
//    last-writer-wins identically on BOTH peers (no split-brain).
{
  const { A, B, flush } = room();
  A.setSeed('duel');
  flush();
  A.setParam('k', 5);
  B.setParam('k', 9);
  flush();
  ok('conflict resolves identically on both sides (no split-brain)', JSON.stringify(A.state()) === JSON.stringify(B.state()));
}

// 5. onUpdate fires and unsubscribe works (the studio UI hook).
{
  const { A, B, flush } = room();
  let n = 0;
  const off = B.onUpdate(() => n++);
  A.setSeed('notify');
  flush();
  off();
  A.setSeed('notify-2');
  flush();
  ok('onUpdate fires once per delivered change; unsubscribe holds', n === 1);
}

// 6. The art contract still holds: shared state → identical buildArt input on both sides.
{
  const { A, B, flush } = room();
  A.setSeed('1000'); A.setParam('rings', 6);
  flush();
  ok('shared state is identical art input on every participant', JSON.stringify(A.state()) === JSON.stringify(B.state()) && B.state().params.rings === 6);
}

// 7. Bad injection is rejected loudly (a transport without send is a config bug, not a mystery).
{
  let threw = false;
  try { createSharedPiece({ Y, transport: {} }); } catch (e) { threw = true; }
  ok('misconfigured transport rejected loudly', threw);
}

console.log(failed === 0 ? '\nALL MULTIPLAYER TESTS PASS' : `\n${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
