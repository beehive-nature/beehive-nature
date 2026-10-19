// calc-s7.js: SPEC-BUZZ-PQ-1 arithmetic (ARITH). Run: node calc-s7.js
// Every input is an ASSUMPTION unless the spec cites it. Prices are one-date receipts.
'use strict';
const N = 1e10, DAY = 86400, YR = 365.25;
const b64u = n => Math.ceil(n * 4 / 3), X = n => 'x'.repeat(n), r0 = x => Math.round(x), f = (x, d = 1) => x.toFixed(d);
const ev = (kind, tags, clen) => JSON.stringify({id: X(64), pubkey: X(64), created_at: 1760000000, kind, tags, content: X(clen), sig: X(128)}).length;
const H = X(64), HID = X(36), CH = X(52), BID = X(63);
const out = (...a) => console.log(...a);

// ---------- T2 object sizes (bytes) ----------
const MSG = ev(9, [['h', HID]], 200);                                    // today's kind 9 with 200 B of text
const MSGC = ev(9, [['h', HID], ['bzp', H, '1234567']], 200);           // plus the per-cell chain tag
const CP_FIX = ev(47101, [['v', '1'], ['c', CH], ['h', HID], ['seq', '1234567'], ['prev', H], ['range', '1760000000', '1760604800'], ['bind', H], ['cs', '12345']], 0);
const CP = n => CP_FIX + b64u(32 * n);                                   // K_CP listing n ids
const st = full => JSON.stringify(Object.assign({bpq: 1, kind: 'nostr-event', id: BID, event: H}, full ? {dsa: X(b64u(1952)), succ: X(b64u(32))} : {}, {sig: X(b64u(3309))}));
const ATT_FULL = ev(47102, [['e', H]], JSON.stringify(st(true)).length - 2);
const ATT = ev(47102, [['e', H]], JSON.stringify(st(false)).length - 2); // card-reference form
const SLOT = JSON.stringify({to: 'x-wing', ct: X(b64u(1120)), w: X(b64u(48))}).length + 1;
const GSLOT = JSON.stringify({to: 'group', e: X(b64u(8)), w: X(b64u(48))}).length + 1;
const CORE = 187;
const INNER = ev(14, [['p', H], ['bzp', H, '1234567']], 432);          // signed kind 14: 400 B envelope + 32 B suite advertisement
const sealed = (slots, plain) => 8 + 16 + CORE + (2 + slots) + (plain + 16);
const P5DM = r => ev(1059, [['p', H]], b64u(sealed(r * SLOT, INNER)));
const P6DM = ev(1059, [['p', H]], b64u(sealed(GSLOT, INNER)));
const PQG = ev(47103, [['h', HID]], b64u(sealed(GSLOT, INNER)));
const SCP = n => ev(47103, [['h', HID]], b64u(sealed(GSLOT, CP(n) + 2 * 64 + 6 * 46))); // sealed digest list, private-head ref, Merkle path
const PHEAD = ev(47101, [['v', '1'], ['c', CH], ['seq', '1234567'], ['prev', H], ['bind', H], ['cs', '12345']], b64u(32)); // weekly public private head
const WRAP = ev(47103, [['h', HID], ['p', H]], b64u(8 + 16 + CORE + 2 + SLOT + 32 + 16));
const PREKEY = ev(47105, [['c', CH]], JSON.stringify({card: BID, wk: '2026-W42', exp: 1760000000, xw: X(b64u(1216))}).length);
const CARD = JSON.stringify({bpq: 1, id: BID, dsa: X(b64u(1952)), kem: X(b64u(1216)), succ: X(b64u(32)), sig: X(b64u(3309))}).length;
const CARDEV = ev(47108, [], CARD);
const bindBody = (D, full) => JSON.stringify({v: 2, cards: Array(D).fill(full ? X(CARD) : {d: 1, id: BID, h: X(43)}), recovery: full ? X(CARD) : {id: BID, h: X(43)}, ed25519: X(43), inbox: {npub: H, roads: [X(40), X(40)]}, fresh_until: 1760000000}).length;
const BIND = (D, full) => ev(47100, [['c', CH], ['seq', '1234567'], ['prev', H]], bindBody(D, full));
const REC = 512, SEAL = 4096, SEAL_SLH = Math.ceil((3537 - 3309 + 7856) / 512) * 512, STEP = Math.ceil(2336 / 512) * 512;
let slotCap = 0; for (let r = 1; r < 80; r++) if (P5DM(r) + 12 <= 65536) slotCap = r;
let cpMax = 0; for (let n = 1; n < 3000; n++) if (CP(n) + 12 <= 65536) cpMax = n;
out(`T2 MSG ${MSG} MSGC ${MSGC} CP(1) ${CP(1)} CP(8) ${CP(8)} cpMax ${cpMax} ATT_FULL ${ATT_FULL} ATT ${ATT}`);
out(`T2 P5DM slots 1/3/7: ${P5DM(1)}/${P5DM(3)}/${P5DM(7)} slotCap ${slotCap} P6DM ${P6DM} PQG ${PQG} SCP(1) ${SCP(1)} SCP(8) ${SCP(8)} PHEAD ${PHEAD} WRAP ${WRAP}`);
out(`T2 PREKEY ${PREKEY} CARD ${CARD} CARDEV ${CARDEV} SEAL_SLH ${SEAL_SLH} STEP ${STEP}`);
out(`T2 BIND full D=1..4 ${[1, 2, 3, 4].map(d => BIND(d, true)).join('/')} card-ref ${[1, 2, 3, 4].map(d => BIND(d, false)).join('/')}`);

// ---------- T7.1 workload (ASSUMPTION) ----------
const share = {dm: 0.6, gr: 0.35, ch: 0.05};      // human sent mix
const ashare = {dm: 0.2, gr: 0.3, ch: 0.5};       // agent sent mix
const GROUP = 6, MA = 10, F_OD = 0.02;            // group recipients; agent messages per day; on-demand K_ATT fetch share
const cells = {1: {dm: 2, gr: 1, ch: 1}, 10: {dm: 5, gr: 3, ch: 1}, 100: {dm: 12, gr: 6, ch: 3}};
const HT = [[100, 0.80], [1000, 0.17], [10000, 0.03]], R100 = [[100, 1]]; // channel posts by channel size (humans)
const lam = (M, t) => M * share[t] / cells[M][t];                          // ids per persona-cell-day
const nW = (M, t) => Math.max(1, 7 * lam(M, t));                           // ids per 7-day attestation window
const nD = (M, t) => { const l = lam(M, t); return l / (1 - Math.exp(-l)); }; // ids per daily K_CP (Poisson posting days)
const nP = M => Math.max(1, 7 * M * (share.dm + share.gr));                 // private ids per persona-week under one private head
const privSettle = (M, t) => SCP(nW(M, t)) / nW(M, t) + (PHEAD + ATT) / nP(M); // sender settlement per private message
const copies = (t, D, a, R) => t === 'dm' ? 2 * D - 1 : t === 'gr' ? GROUP * D + D - 1 : R * (D + a) + 1;
const Ec = (t, D, a, dist) => t === 'ch' ? dist.reduce((s, [R, p]) => s + p * copies('ch', D, a, R), 0) : copies(t, D, a);
for (const M of [1, 10, 100]) out(`T3.4 M=${M} nW dm ${f(nW(M, 'dm'), 2)} gr ${f(nW(M, 'gr'), 2)} ch ${f(nW(M, 'ch'), 2)} nD ch ${f(nD(M, 'ch'), 2)}; sender settlement B/msg ch ${r0(CP(nD(M, 'ch')) / nD(M, 'ch'))}+${r0(ATT / nW(M, 'ch'))} dm ${r0(privSettle(M, 'dm'))} gr ${r0(privSettle(M, 'gr'))} (private ids per week ${f(nP(M), 2)})`);

// ---------- T7.2 per-copy bytes and traffic ----------
function perCopy(M, D, g) {
  const n = {dm: nW(M, 'dm'), gr: nW(M, 'gr'), ch: nW(M, 'ch')}, nd = nD(M, 'ch');
  const wrap = t => (cells[M][t] * D * WRAP / 7) / (M * share[t] * copies(t, D, 0)); // weekly rekey wraps per copy
  const p = 1 - Math.exp(-lam(M, 'dm')), step = STEP * p / lam(M, 'dm');             // P7 ratchet steps per DM message
  if (g === 'classical') return {dm: MSG, gr: MSG, ch: MSG};
  if (g === 'live') return {dm: P6DM + SCP(n.dm) / n.dm + wrap('dm') + F_OD * ATT / n.dm, gr: PQG + SCP(n.gr) / n.gr + wrap('gr') + F_OD * ATT / n.gr, ch: MSGC + CP(nd) / nd + F_OD * ATT / n.ch};
  if (g === 'interim') return {dm: P6DM + ATT + wrap('dm'), gr: PQG + ATT + wrap('gr'), ch: MSGC + ATT};
  if (g === 'nativeLazy') return {dm: REC + step, gr: REC + wrap('gr'), ch: REC};
  if (g === 'nativeBreak') return {dm: REC + step + SEAL / n.dm, gr: REC + wrap('gr') + SEAL / n.gr, ch: REC + SEAL / n.ch};
}
const RG = ['classical', 'live', 'interim', 'nativeLazy', 'nativeBreak'];
for (const M of [1, 10, 100]) out(`T7.2a M=${M} ` + RG.map(g => { const p = perCopy(M, 2, g); return `${g} ${r0(p.dm)}/${r0(p.gr)}/${r0(p.ch)}`; }).join(' | '));
for (const M of [1, 10, 100]) out(`T7.2a M=${M} weekly rekey wraps per copy: DM ${r0((cells[M].dm * 2 * WRAP / 7) / (M * share.dm * copies('dm', 2, 0)))} group ${r0((cells[M].gr * 2 * WRAP / 7) / (M * share.gr * copies('gr', 2, 0)))}`);
function traffic(M, D, a, dist, g) {
  const p = perCopy(M, D, g); let B = 0, C = 0;
  for (const t of ['dm', 'gr', 'ch']) { const c = Ec(t, D, a, dist); B += N * (M * share[t] + a * MA * ashare[t]) * c * p[t]; C += N * (M * share[t] + a * MA * ashare[t]) * c; }
  return {gbps: B * 8 / DAY / 1e9, perCopy: B / C, copiesPerMsg: C / (N * (M + a * MA))};
}
const CASES = [['A', 0, R100], ['B', 0, HT], ['C', 0.1, HT], ['D', 1, HT], ['E', 5, HT]];
for (const [lab, a, dist] of CASES) for (const M of [1, 10, 100]) out(`T7.2b ${lab} M=${M} copies/msg ${f(traffic(M, 2, a, dist, 'live').copiesPerMsg)} ` + RG.map(g => { const t = traffic(M, 2, a, dist, g); return `${g} ${f(t.gbps, 1)}G/${r0(t.perCopy)}B/x${f(t.perCopy / MSG, 2)}`; }).join(' '));
for (const M of [1, 10, 100]) { const ing = (g) => { const p = perCopy(M, 2, g); return N * M * (share.dm * (g === 'live' ? P6DM + privSettle(M, 'dm') : p.dm) + share.gr * (g === 'live' ? PQG + privSettle(M, 'gr') : p.gr) + share.ch * (g === 'live' ? MSGC + CP(nD(M, 'ch')) / nD(M, 'ch') + ATT / nW(M, 'ch') : p.ch)) * 8 / DAY / 1e9; }; out(`T7.2c ingress per relay copy (humans) M=${M}: classical ${f(ing('classical'), 1)} live ${f(ing('live'), 1)} nativeBreak ${f(ing('nativeBreak'), 1)} Gbps; x2 for rho=2`); }

// ---------- T7.3 channel-size sensitivity (M=10, live lane, humans posting, push reads) ----------
const BOX = 1e5, BOXUSD = 101 * 12, U1G = 0.7;
function sens(D, a, R, M = 10) { const p = perCopy(M, D, 'live'); let B = 0, cp = 0; for (const t of ['dm', 'gr', 'ch']) { const c = copies(t, D, a, R); B += N * M * share[t] * c * p[t]; cp += share[t] * c; } const avg = B * 8 / DAY / 1e9; return {cp, peak: 3 * avg, bw: 3 * avg / U1G, conn: (N * D * 1.5 * 0.1 + N * a) / BOX}; }
for (const R of [100, 1000, 10000]) out(`T7.3 R=${R} ` + [1, 2, 4].map(D => { const s = sens(D, 0, R); return `D=${D} copies ${f(s.cp)} peak ${f(s.peak / 1000, 2)}T bw ${r0(s.bw)} conn ${r0(s.conn)} ${s.bw > s.conn ? 'BW' : 'CONN'}`; }).join(' | '));
{ const s = sens(2, 5, 10000); out(`T7.3 community-wide channel, 10K humans + 50K agents: copies ${f(s.cp)} peak ${f(s.peak / 1000, 2)}T bw ${r0(s.bw)} conn ${r0(s.conn)}`); }
for (const D of [1, 2, 4]) { let lo = 10, hi = 1e5; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; const s = sens(D, 0, m); if (s.bw > s.conn) hi = m; else lo = m; } out(`T7.3 crossover R_ch at D=${D}: ${r0(lo)}`); }
for (const fr of [1, 0.25]) for (const a of [0, 1]) { const p = perCopy(10, 2, 'live'); let B = 0; for (const t of ['dm', 'gr', 'ch']) { const c = t === 'ch' ? HT.reduce((s, [R, q]) => s + q * copies('ch', 2, a, R) * (R >= 1000 ? fr : 1), 0) : copies(t, 2, a); B += N * 10 * share[t] * c * p[t]; } const peak = 3 * B * 8 / DAY / 1e9; out(`T7.3 heavy tail, humans posting, agents reading a=${a}, f_read=${fr}: peak ${f(peak / 1000, 2)}T bw ${r0(peak / U1G)} conn ${r0((N * 2 * 1.5 * 0.1 + N * a) / BOX)}`); }

// ---------- T7.4 connections and one cost basis ----------
for (const rho of [1, 2]) for (const C of [1, 1.5, 3]) out(`T7.4 rho=${rho} C=${C}: ` + [0.05, 0.10, 0.30].map(c => `${c * 100}%: ` + [0.1, 1, 5].map(a => r0((N * 2 * C * rho * c + N * a * rho) / BOX / 1000) + 'k').join('/')).join(' | '));
for (const [lab, rho, a] of [['humans', 1, 0], ['humans rho2', 2, 0], ['a0.1', 1, 0.1], ['a1', 1, 1], ['a5', 1, 5]]) { const b = (N * 2 * 1.5 * rho * 0.1 + N * a * rho) / BOX; out(`T7.4 basis D=2 C=1.5 conc=10% ${lab}: ${r0(b)} boxes $${f(b * BOXUSD / 1e6, 1)}M/yr $${f(b * BOXUSD / N, 4)}/human-yr`); }
out(`T7.4 humans D=1/2/4: ${[1, 2, 4].map(D => r0(N * D * 1.5 * 0.1 / BOX)).join('/')} boxes`);
out(`T7.4 inbox per-user sessions: relay ${r0(N * 1.5 / BOX)} inbox ${r0((N * 2 * 0.1 + N * 1.5) / BOX)}; multiplexed: relay ~0 inbox ${r0(N * 2 * 0.1 / BOX)}`);
out(`T7.4 community 10K humans + 50K agents: ${10000 * 2 * 0.1 + 50000} connections = ${f((10000 * 2 * 0.1 + 50000) / BOX, 2)} box; dedicated box $${f(1212 / 10000, 3)}/member-yr`);

// ---------- T7.5 verify budgets in break mode ----------
function recv(M, D, a, dist) { const devs = N * D + N * a, r = {}; for (const t of ['dm', 'gr', 'ch']) r[t] = N * (M * share[t] + a * MA * ashare[t]) * Ec(t, D, a, dist) / devs; return r; }
function vstats(M, a, dist) { const r = recv(M, 2, a, dist); let tot = 0, v = 0; for (const t of ['dm', 'gr', 'ch']) { tot += r[t]; v += r[t] / nW(M, t); } return {tot, v, nb: tot / v}; }
for (const [lab, a, dist] of [['A', 0, R100], ['B', 0, HT], ['D', 1, HT]]) for (const M of [1, 10, 100]) { const s = vstats(M, a, dist); out(`T7.5 ${lab} M=${M}: recv/device-day ${f(s.tot)} verifies ${f(s.v)} nbar ${f(s.nb, 2)} tv<= dm ${f(0.5 * nW(M, 'dm'), 2)} gr ${f(0.5 * nW(M, 'gr'), 2)} ch ${f(0.5 * nW(M, 'ch'), 2)} mixed ${f(0.5 * s.nb, 2)} ms; 10s/day cap ${f(10000 / s.v, 1)} ms; interim verifies/day ${r0(s.tot)}`); }
for (const sd of [6, 24, 96]) { const s = (N * 2 * 1.5 * sd + N * 1) / DAY; out(`T7.5 K_PQAUTH ${sd} sessions/device-day: ${f(s / 1e6, 2)}e6 verifies/s, ${r0(s / 130000)}/s per box (130k), ${r0(s * ATT * 8 / 1e9)} Gbps`); }
for (const [lab, a, dist] of [['A', 0, R100], ['B', 0, HT], ['D', 1, HT]]) for (const M of [1, 10, 100]) { const r = recv(M, 2, a, dist), p = perCopy(M, 2, 'live'); out(`T7.4m ${lab} M=${M}: phone receives ${f((r.dm * p.dm + r.gr * p.gr + r.ch * p.ch) / 1e3, 1)} KB/day on the live lane`); }

// ---------- T7.7 break-mode transition ----------
for (const [lab, a, dist] of [['A', 0, R100], ['B', 0, HT], ['D', 1, HT]]) for (const M of [1, 10, 100]) { const s = vstats(M, a, dist), e7 = s.tot * 7 / s.nb * ATT, e90 = s.tot * 90 / s.nb * ATT, devs = N * 2 + N * a; out(`T7.7 ${lab} M=${M}: 7-day eager ${r0(s.tot * 7 / s.nb)} attestations ${f(e7 / 1e6, 1)} MB/device (90-day ${f(e90 / 1e6, 1)} MB); global 7-day drain ${f(e7 * devs * 8 / (7 * DAY) / 1e12, 2)} Tbps`); }

// ---------- T7.8 identity, prekeys and churn ----------
const D = 2, C = 1.5, newDev = 2 * N / (3 * YR);
out(`T7.8 new devices/day ${newDev.toExponential(4)}; prekey+att per device-community-week ${PREKEY + ATT}; ingress ${f((PREKEY + ATT) * N * D * C / (7 * DAY) * 8 / 1e9, 2)} Gbps`);
for (const M of [1, 10, 100]) { const rd = (cells[M].dm + cells[M].gr * GROUP) * D; const full = (BIND(D, true) + 2 * ATT) * (C + rd), ref = (BIND(D, false) + 2 * ATT + CARDEV) * (C + rd); const rk = (cells[M].dm * 2 * D + cells[M].gr * 7 * D) * WRAP; const res = recv(M, 2, 0, R100), rec = (res.dm + res.gr + res.ch) * 90; const pc = perCopy(M, 2, 'live'); const resB = 90 * (res.dm * pc.dm + res.gr * pc.gr + res.ch * pc.ch); out(`T7.8 M=${M} eager readers ${rd}: prekey fetch ${f((PREKEY + ATT) * rd * N * D / (7 * DAY) * 8 / 1e9, 1)} Gbps; bind churn full ${f(newDev * full * 8 / DAY / 1e9, 2)} card-ref ${f(newDev * ref * 8 / DAY / 1e9, 2)} Gbps; rekeys per device change ${rk} B -> ${f(newDev * 2 * rk * 8 / DAY / 1e9, 2)} Gbps; 90-day resync ${f(resB / 1e6, 1)} MB/device -> ${f(newDev * resB * 8 / DAY / 1e9, 1)} Gbps (case A)`); }
out(`T4.3 group rekey wraps: 256 devices ${256 * WRAP} B; all-slots O(n^2) ${f(256 * 256 * b64u(SLOT) / 1e9, 3)} GB at 256, ${f(1e6 * b64u(SLOT) / 1e9, 2)} GB at 1000; weekly 7-member D=2 group ${14 * WRAP} B`);
out(`T3.5 SLH-DSA-SHAKE-128s seal ${3537 - 3309 + 7856} B padded ${SEAL_SLH}; per msg n=1/8/64 ${[1, 8, 64].map(n => r0(512 + SEAL_SLH / n)).join('/')} vs ML-DSA ${[1, 8, 64].map(n => r0(512 + SEAL / n)).join('/')}`);

// ---------- T6.5 archive, flush rule, payments ----------
const CHUNK = 4190208, ANTC = 0.084802, ANTUSD = 0.04137896, ETHUSD = 2519.20, GASETH = 3.35e-6, CIRC = 341.57e6, VOLDAY = 341118;
function archYear(M, ER) { const own = M * (share.dm * (INNER + (PHEAD + ATT) / nP(M) + 46) + share.gr * (INNER + (PHEAD + ATT) / nP(M) + 46) + share.ch * (MSGC + CP(nD(M, 'ch')) / nD(M, 'ch') + ATT / nW(M, 'ch'))); const rec = M * (share.dm * 1 * (INNER + 46) + share.gr * GROUP * (INNER + 46) + share.ch * ER * (MSGC + CP(nD(M, 'ch')) / nD(M, 'ch'))); return (own + rec) * YR; }
function flush(yb) { const mb = yb / 12, three = 3 * CHUNK; if (yb < three) return {files: 1, chunks: 3}; if (mb >= three) { const per = Math.ceil(mb / CHUNK); return {files: 12 * Math.ceil(per / 63), chunks: 12 * per}; } return {files: yb / three, chunks: Math.ceil(yb / CHUNK)}; }
for (const [lab, ER] of [['R=100', 100], ['heavy E[R]=550', 550]]) for (const M of [1, 10, 100]) { const yb = archYear(M, ER), fl = flush(yb), mo = 12 * Math.max(3, Math.ceil(yb / 12 / CHUNK)); const ant = fl.chunks * ANTC * ANTUSD, gas = fl.files * GASETH * ETHUSD, antYr = fl.chunks * N * ANTC; out(`T6.5 ${lab} M=${M}: ${f(yb / 1e6)} MB/yr files ${f(fl.files, 2)} chunks ${fl.chunks} (monthly ${mo}) ANT $${f(ant, 3)} gas $${f(gas, 3)} gas share ${f(100 * gas / (ant + gas))}% payments/s ${r0(fl.files * N / (YR * DAY))}; RailC ${(fl.chunks * N).toExponential(2)} chunks/yr = ${f(antYr / CIRC)}x circulating = ${r0(antYr * ANTUSD / (VOLDAY * YR))} yr of ANT volume`); }
{ const fl = flush(archYear(10, 100)); out(`T8.7 users whose M=10 archive fits 1% of circulating ANT per year: ${(0.01 * CIRC / (fl.chunks * ANTC)).toExponential(3)}`); }

// ---------- T8.4 vouchers ----------
const FEE = GASETH * ETHUSD, MINTOP = FEE / 0.05;
for (const [lab, b] of [['humans', 30000], ['humans rho2', 60000], ['a=1', 130000], ['a=5', 530000]]) { const perYr = b * BOXUSD / N; out(`T8.4 ${lab}: relay cost $${f(perYr, 4)}/human-yr; min top-up $${f(MINTOP, 3)} (fee $${f(FEE, 4)}, fee/value 5%) lasts ${f(MINTOP / perYr, 1)} yr; top-ups/s at 1e10 ${f(N * perYr / MINTOP / (YR * DAY), 1)}`); }
out(`T8.4 draft check: yearly ${f(N / (YR * DAY), 1)}/s monthly ${f(12 * N / (YR * DAY), 1)}/s`);

// ---------- T8.5 seeds ----------
const cold = 2 * N / (3 * 365) + 0.01 * 2 * N;
out(`T8.5 cold-start fetches/day ${cold.toExponential(4)} = ${f(cold * 4096 / 1e12, 3)} TB/day, ${f(cold * 4096 * 8 / DAY / 1e6)} Mbps; cap 1e7/day = ${f(1e7 * 4096 / 1e9)} GB/day, ${f(1e7 * 4096 * 8 / DAY / 1e6, 2)} Mbps, ${r0(1e7 * 4096 * 8 / 1e9)} s of a 1 Gbps link; binds at ${(1e7 / (1 / (3 * 365) + 0.01)).toExponential(4)} devices; refused share at 1e10 ${f(100 * (1 - 1e7 / cold))}%`);

// ---------- T10.4 renewal ----------
const ARL1 = 0.0049, ARGIB = 32.56;
out(`T10.4 per-user L1 renewal $${f(N * ARL1 / 1e6, 1)}M/era; per-user 2 KB bundled $${r0(N * 2048 / 2 ** 30 * ARGIB)}/era; epoch-root renewal 52 roots/yr x $${ARL1} = $${f(52 * ARL1, 3)}/yr; Merkle path ${Math.ceil(Math.log2(N))} levels = ${Math.ceil(Math.log2(N)) * 32} B per user`);

// ---------- T-misc figures used in the text ----------
out(`TM handover event ${Math.ceil((49856 + 1952 + 64 + 2000) * 4 / 3) + 500} B, x150 contacts ${f((Math.ceil((49856 + 1952 + 64 + 2000) * 4 / 3) + 500) * 150 / 1e6, 2)} MB; OTS headers ${f(80 * 144 * YR / 1e6, 2)} MB/yr; card-ref saving ${f(100 * (1 - ATT / ATT_FULL), 1)}%`);
out(`TM E21 shares ${f(100 * 12718760 / N, 3)}% to ${f(100 * 29994617 / N, 3)}%; ANT/chunk $${f(ANTC * ANTUSD, 4)}; live quote 0.2145 ANT / 3 chunks = ${f(0.2145 / 3, 4)} ANT/chunk; 115,741 check ${f(N / DAY, 1)}`);
{ const p = perCopy(10, 2, 'live'); const ingB = (0.6 * (P6DM + privSettle(10, 'dm')) + 0.35 * (PQG + privSettle(10, 'gr')) + 0.05 * (MSGC + CP(nD(10, 'ch')) / nD(10, 'ch') + ATT / nW(10, 'ch'))); const t = traffic(10, 2, 0, R100, 'live'); out(`TM 10K-member community, case A, M=10: ${f(1e4 * 10 * 16.4 * t.perCopy * 8 / DAY / 1e6, 2)} Mbps avg, ${f(3 * 1e4 * 10 * 16.4 * t.perCopy * 8 / DAY / 1e6, 2)} peak; relay cache ${f(ingB * 10 * 90 / 1e6, 2)} MB per member over 90 days; stored bytes per message ${r0(ingB)}`); }

out(`TM one message from each of 1,000 authors: ${f(1000 * ATT / 1e6, 2)} MB of attestations when checked; BESIDE eager ${f(1000 * 8229 / 1e6, 2)} MB`);
out(`TM native archive, records only (512 B each), case A: ${[1, 10, 100].map(M => f(YR * M * (1 + 0.6 * 1 + 0.35 * GROUP + 0.05 * 100) * REC / 1e6, 1)).join(' / ')} MB/yr`);
for (const [lab, a, dist] of [['A', 0, R100], ['B', 0, HT], ['D', 1, HT]]) out(`TM break-mode verifies per second, all devices, case ${lab}: ${[1, 10, 100].map(M => (vstats(M, a, dist).v * (N * 2 + N * a) / DAY / 1e6).toFixed(2) + 'e6').join(' / ')}`);

// ---------- T16 reproductions of attacked draft figures ----------
const dn = [512 + 4096 / 9, 512 + 4096 / 10.5, 512 + 4096 / 1.5];
out(`T16 F6 draft-n native ${f((1.8 * dn[0] + 4.55 * dn[1] + 10.05 * dn[2]) / 16.4)}; F12 ${f(1751 / 586, 2)}/${f(1598 / 586, 2)}/${f(1319 / 586, 2)}; F4 ${f(1.8 + 4.55 + 0.05 * 2001)}/${f(1.8 + 4.55 + 0.05 * 20001)}; F10 ${f(1.826e7 * 41500 * 246 * 8 / DAY / 1e9)} Gbps; F7 ${f(5000 / (10000 / (7.7 / 3.6)), 2)} ms; ECO-2 ${f(3.6e11 * 0.0848 / CIRC)}x; PQ-2 ${f(7103 * 2e10 / 604800 * 8 / 1e9, 2)} Gbps`);
