/* atlas-tree.mjs — Austras koks, the Latvian tree of life, drawn FROM the registry.
   One truth, three readings (the register canon: same facts, never different
   numbers). Every honeycomb cell is one counted surface; every bough is one
   family; every colour class is one org house — and the numbers are passed in
   from estate.json by build-atlas.mjs, never typed here.
     new bee     the fir of the house crest: eight boughs bearing comb
     raver       the same boughs spun into a wheel of light
     cypherpunk  the same tree as a graph you can check: root → org → family
   The bough is the crest's own curve, copied point for point from
   assets/brand (achievement.svg): M0,4 C-26,-4 -58,-22 -84,-54, with its inner
   curl M-46,-20 C-54,-30 -57,-41 -54,-52. The ground line is Māra's water.
   Pictures only: nothing here is a control, so nothing here needs a 44px floor.
   Colour never carries meaning alone — the caption beside the picture names
   every house and count in words. */
const BRANCH = [[0, 4], [-26, -4], [-58, -22], [-84, -54]];
const SPUR = [[-46, -20], [-54, -30], [-57, -41], [-54, -52]];
const r2 = n => Math.round(n * 100) / 100;
const cubic = P => `M${r2(P[0][0])},${r2(P[0][1])} C${r2(P[1][0])},${r2(P[1][1])} ${r2(P[2][0])},${r2(P[2][1])} ${r2(P[3][0])},${r2(P[3][1])}`;
/* scale → rotate (degrees, clockwise on screen) → translate */
const xf = (P, sx, sy, tx, ty, rot = 0) => {
  const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
  return P.map(([px, py]) => { const x = px * sx, y = py * sy; return [x * c - y * s + tx, x * s + y * c + ty]; });
};
const hex = (cx, cy, R) => Array.from({ length: 6 }, (_, k) => {
  const a = (90 + 60 * k) * Math.PI / 180; return r2(cx + R * Math.cos(a)) + ',' + r2(cy - R * Math.sin(a));
}).join(' ');
/* the comb: n cells laid in a hexagonal spiral from the centre outward */
const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const spiral = n => {
  const out = [[0, 0]];
  for (let k = 1; out.length < n; k++) {
    let q = 0, r = -k;                                   /* start at the top of ring k */
    for (let side = 0; side < 6; side++) for (let step = 0; step < k; step++) {
      if (out.length < n) out.push([q, r]); q += DIRS[side][0]; r += DIRS[side][1];
    }
  }
  return out.slice(0, n);
};
const rings = n => { let k = 0; while (1 + 3 * k * (k + 1) < n) k++; return k; };
const combRadius = (n, R) => (rings(Math.max(1, n)) * Math.sqrt(3) + 1) * R;
const comb = (cx, cy, fam, R) => fam.n
  ? spiral(fam.n).map(([q, r]) => `<polygon class="et-cell ${fam.mark}" points="${hex(cx + R * Math.sqrt(3) * (q + r / 2), cy + R * 1.5 * r, R - 0.55)}"/>`).join('')
  : `<polygon class="et-cell et-open" points="${hex(cx, cy, R + 1)}"/>`;      /* an open seat: a place kept, nothing in it yet */
const svg = (cls, w, h, body) => `<svg class="estate-tree ${cls}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="tree-caption" focusable="false">${body}</svg>`;
const byCount = fams => [...fams].sort((a, b) => a.n - b.n || a.id.localeCompare(b.id));

/* new bee — the fir. smallest families at the crown, widest boughs at the foot. */
export function treeBee(fams) {
  const F = byCount(fams), cx = 220, Y = [84, 138, 200, 274], S = [0.55, 0.9, 1.3, 1.85], R = 5, GROUND = 344, els = [];
  /* the tree stands at the water's edge: Māra's water is the ground line, the roots run beneath it */
  els.push(`<path class="et-water" d="M66,${GROUND + 4} ${'l14,-7.5 l14,7.5 '.repeat(11).trim()}"/>`);
  for (const [dy, s] of [[2, 0.85], [14, 0.45]]) for (const m of [1, -1]) {
    els.push(`<path class="et-root" d="${cubic(xf(BRANCH, m * s, -s, cx, GROUND + dy))}"/>`, `<path class="et-root" d="${cubic(xf(SPUR, m * s, -s, cx, GROUND + dy))}"/>`);
  }
  els.push(`<path class="et-trunk" d="M${cx},42 L${cx},${GROUND + 18}"/>`);
  for (let k = 0; k < 4; k++) {
    const pair = [F[2 * k], F[2 * k + 1]].filter(Boolean); if (k % 2) pair.reverse();   /* alternate the heavier side so the fir stands straight */
    pair.forEach((fam, i) => {
      const m = i === 0 ? 1 : -1, P = xf(BRANCH, m * S[k], S[k], cx, Y[k]), tip = P[3], reach = combRadius(fam.n, R) * 0.62;
      els.push(`<path class="et-branch" d="${cubic(P)}"/>`, `<path class="et-branch et-spur" d="${cubic(xf(SPUR, m * S[k], S[k], cx, Y[k]))}"/>`);
      els.push(`<g data-tree-family="${fam.id}" data-tree-count="${fam.n}">${comb(tip[0] - m * 0.63 * reach, tip[1] - 0.776 * reach, fam, R)}</g>`);
    });
  }
  els.push(`<polygon class="et-crown" points="${hex(cx, 30, 12)}"/>`);
  return svg('et-bee', 440, 400, els.join(''));
}

/* raver — the wheel. the same eight boughs, spun; largest families sit opposite so it turns true. */
export function treeRaver(fams) {
  const F = byCount(fams).reverse(), SLOT = [0, 4, 2, 6, 1, 5, 3, 7], c = 200, R = 4, els = [];
  els.push(`<g class="et-spin"><ellipse class="et-orbit" cx="${c}" cy="${c}" rx="188" ry="77" transform="rotate(-31 ${c} ${c})"/><ellipse class="et-orbit" cx="${c}" cy="${c}" rx="188" ry="77" transform="rotate(31 ${c} ${c})"/><circle class="et-rim" cx="${c}" cy="${c}" r="180"/></g>`);
  F.forEach((fam, i) => {
    const ang = SLOT[i] * 45, rad = ang * Math.PI / 180, ux = Math.sin(rad), uy = -Math.cos(rad), bx = c + 74 * ux, by = c + 74 * uy;
    els.push(`<path class="et-stem ${fam.mark}" d="M${c},${c} L${r2(bx)},${r2(by)}"/>`);
    for (const m of [1, -1]) els.push(`<path class="et-curl ${fam.mark}" d="${cubic(xf(BRANCH, m * 0.5, 0.5, bx, by, ang))}"/>`, `<path class="et-curl et-spur ${fam.mark}" d="${cubic(xf(SPUR, m * 0.5, 0.5, bx, by, ang))}"/>`);
    els.push(`<g data-tree-family="${fam.id}" data-tree-count="${fam.n}">${comb(c + 130 * ux, c + 130 * uy, fam, R)}</g>`);
  });
  for (let i = 0; i < 16; i++) { const a = i * 22.5 * Math.PI / 180; els.push(`<path class="et-ray" d="M${r2(c + 15 * Math.cos(a))},${r2(c + 15 * Math.sin(a))} L${r2(c + 24 * Math.cos(a))},${r2(c + 24 * Math.sin(a))}"/>`); }
  els.push(`<polygon class="et-crown" points="${hex(c, c, 11)}"/>`);
  return svg('et-raver', 400, 400, els.join(''));
}

/* cypherpunk — the graph. root → org → family, straight chords, every count in the open. */
export function treeCypher(fams, orgs, total, rootLabel) {
  const ROW = 32, TOP = 24, W = 340, XR = 14, XO = 92, XF = 164, XL = 178, els = [], max = Math.max(1, ...fams.map(f => f.n));
  const rows = []; orgs.forEach(o => fams.filter(f => f.org === o.id).forEach(f => rows.push(f)));
  const H = TOP + ROW * rows.length + 4, yOf = f => TOP + ROW * rows.indexOf(f), rootY = r2(TOP + ROW * (rows.length - 1) / 2);
  const edges = [], marks = [];
  orgs.forEach(o => {
    const mine = rows.filter(f => f.org === o.id); if (!mine.length) return;
    const oy = r2((yOf(mine[0]) + yOf(mine[mine.length - 1])) / 2);
    edges.push(`<path class="et-edge" d="M${XR},${rootY} L${XO},${oy}"/>`, ...mine.map(f => `<path class="et-edge" d="M${XO},${oy} L${XF},${yOf(f)}"/>`));
    marks.push(`<polygon class="et-node ${o.mark}" points="${hex(XO, oy, 7)}"/>`, `<text class="et-label" x="${XO - 11}" y="${r2(oy - 9)}" text-anchor="end">${o.mark} ${o.n}</text>`);
  });
  rows.forEach(f => {
    const y = yOf(f);
    marks.push(`<g data-tree-family="${f.id}" data-tree-count="${f.n}"><polygon class="et-node ${f.mark}${f.n ? '' : ' et-open'}" points="${hex(XF, y, 5.5)}"/><text class="et-label" x="${XL}" y="${y + 4}">${f.id}</text><text class="et-count" x="${W - 4}" y="${y + 4}" text-anchor="end">${f.n}</text><path class="et-bar ${f.mark}" d="M${XL},${y + 11} h${r2(Math.max(f.n ? 2 : 0, 110 * f.n / max))}"/></g>`);
  });
  els.push(...edges, ...marks, `<polygon class="et-crown" points="${hex(XR, rootY, 8)}"/>`, `<text class="et-label" x="4" y="${r2(rootY - 16)}">${rootLabel}</text>`, `<text class="et-count" x="4" y="${r2(rootY + 27)}">${total}</text>`);
  return svg('et-cypher', W, H, els.join(''));
}
