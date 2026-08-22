// forge/visual/shared.js — the multiplayer layer for forge pieces (SPEC-BUZZFORGE-1 §6).
//
// WHAT IS SHARED (per the spec): the source of the piece — its seed and its params —
// lives in a Yjs document every participant can edit. WHAT IS LOCAL: the render.
// Each participant's machine re-renders from the shared state; nobody's brush is
// anyone else's brush. A "push build to room" later promotes a local artifact to the
// shared reference.
//
// DEPENDENCY-INJECTED BY DESIGN: `Y` (the Yjs module) and `transport` are passed in,
// so this file itself carries zero dependencies and runs anywhere — the studio's
// LiveKit data channel, a BroadcastChannel across two browser tabs, or the node
// convergence test's in-memory wire (forge/visual/test/shared.test.mjs).
//
// Doc shape: ymap 'piece' → { seed: string, 'param.<name>': number, … }
// Each param is its OWN CRDT key — two artists turning two different knobs
// concurrently merge; only same-knob edits resolve last-writer-wins (and
// identically on every participant).
// Protocol: Y.doc updates are sent as-is over transport.send(bytes); receivers call
// receive(bytes) which applies them with origin 'remote' so updates don't echo back.
//
// Transport contract (any medium implementing this can carry a forge room):
//   transport.send(uint8Array)  — broadcast my update to the room
//   wire receive() into:        — sharedPiece.receive(uint8Array) on every incoming update

export function createSharedPiece({ Y, transport }) {
  if (!Y || typeof Y.Doc !== 'function') throw new Error('shared.js: the Yjs module must be injected');
  if (!transport || typeof transport.send !== 'function') throw new Error('shared.js: transport.send(bytes) required');

  const doc = new Y.Doc();
  const piece = doc.getMap('piece');
  const listeners = new Set();

  doc.on('update', (update, origin) => {
    if (origin !== 'remote') transport.send(update);
  });

  const PARAM = name => 'param.' + String(name);

  function state() {
    const out = { seed: '', params: {} };
    if (typeof piece.get('seed') === 'string') out.seed = piece.get('seed');
    const keys = [...piece.keys()].filter(k => k.startsWith('param.')).sort();
    for (const key of keys) out.params[key.slice(6)] = piece.get(key);
    return out;
  }

  function emit() { for (const fn of listeners) fn(state()); }

  return {
    // The fork law, multiplayer edition: anyone in the room rolls the seed;
    // the parent's state is CRDT history — nothing is lost, everything merges.
    setSeed(seed) { piece.set('seed', String(seed)); emit(); },
    setParam(name, value) { piece.set(PARAM(name), Number(value)); emit(); },
    state,
    onUpdate(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    receive(update) { Y.applyUpdate(doc, update, 'remote'); emit(); },
    destroy() { listeners.clear(); doc.destroy(); },
  };
}
