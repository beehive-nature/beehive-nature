// tree.js — the off-chain append-only Poseidon merkle tree (M5).
// Depth 20, matching payment.circom. Zero chain: zeros[0]=0,
// zeros[l]=Poseidon(zeros[l-1], zeros[l-1]); pathIndices bit=1 = right child.
// The root is maintained in the contract's law row via `setroot`
// (rehearsal: owner-maintained; on-chain derivation = named future lane).
// State persists in tree-state.json (leaf list). CLI:
//   node tree.js insert <commitment_dec> | prove <index> | root | emptyroot
// Library: const { buildTree } = require('./tree.js')  (NODE_PATH for circomlibjs)
const fs = require('fs');
const { buildPoseidonOpt } = require('circomlibjs');

const LEVELS = 20;
const STATE = 'tree-state.json';

async function buildTree() {
  const poseidon = await buildPoseidonOpt();
  const H = (a, b) => poseidon.F.toString(poseidon([a, b]));
  const zeros = ['0'];
  for (let i = 1; i <= LEVELS; i++) zeros.push(H(zeros[i - 1], zeros[i - 1]));
  const load = () => { try { return JSON.parse(fs.readFileSync(STATE)).leaves; } catch { return []; } };
  const save = leaves => fs.writeFileSync(STATE, JSON.stringify({ leaves }, null, 1));
  // fold a node list up one level, padding an odd tail with the zero hash
  const up = (nodes, level) => {
    const out = [];
    for (let i = 0; i < nodes.length; i += 2)
      out.push(i + 1 < nodes.length ? H(nodes[i], nodes[i + 1]) : H(nodes[i], zeros[level]));
    return out;
  };
  const rootOf = leaves => {
    if (leaves.length === 0) return zeros[LEVELS];
    let nodes = leaves.slice();
    // exactly LEVELS folds — a lone node keeps folding with the zero sibling
    for (let level = 0; level < LEVELS; level++) nodes = up(nodes, level);
    return nodes[0];
  };
  const proveAt = (leaves, idx) => {
    if (idx < 0 || idx >= leaves.length) throw new Error('no such leaf');
    let nodes = leaves.slice(), level = 0, i = idx;
    const pathElements = [], pathIndices = [];
    for (let l = 0; l < LEVELS; l++) {
      const sib = i ^ 1;
      pathElements.push(sib < nodes.length ? nodes[sib] : zeros[level]);
      pathIndices.push(i & 1);
      nodes = up(nodes, level); level++; i >>= 1;
    }
    if (nodes.length !== 1) throw new Error('tree fold invariant broken');
    return { root: nodes[0], pathElements, pathIndices };
  };
  return { H, zeros, LEVELS, load, save, rootOf, proveAt };
}

module.exports = { buildTree };

if (require.main === module) (async () => {
  const t = await buildTree();
  const cmd = process.argv[2];
  if (cmd === 'emptyroot') { console.log(t.zeros[t.LEVELS]); return; }
  if (cmd === 'insert') {
    const leaves = t.load();
    leaves.push(process.argv[3]);
    t.save(leaves);
    console.log(JSON.stringify({ index: leaves.length - 1, root: t.rootOf(leaves) }));
    return;
  }
  if (cmd === 'root') { console.log(t.rootOf(t.load())); return; }
  if (cmd === 'prove') {
    console.log(JSON.stringify(t.proveAt(t.load(), parseInt(process.argv[3], 10))));
    return;
  }
  throw new Error('usage: tree.js insert <dec> | prove <index> | root | emptyroot');
})();
