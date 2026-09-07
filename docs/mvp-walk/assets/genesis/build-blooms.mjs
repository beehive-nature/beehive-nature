#!/usr/bin/env node
/**
 * Write three provisional SVG reconstructions of the founder genesis marks.
 *
 * Geometry and color stops are chosen by this script so the review board can
 * show portable marks. They do NOT establish the exact founder originals.
 * The 2026-09-07 JPEG/PNG bytes were session attachments, absent from this
 * checkout and from origin history. Replace these SVGs with the founder
 * photographs when those files are recovered.
 *
 * Run: node docs/mvp-walk/assets/genesis/build-blooms.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SIZE = 720;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RINGS = 6;
const MAX_R = 318;

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function hexToRgb(h) {
  const n = h.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}
function rgbToHex([r, g, b]) {
  const h = (n) => Math.round(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
function sampleStops(stops, t) {
  if (t <= 0) return stops[0][1];
  if (t >= 1) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / (t1 - t0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return rgbToHex([lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]);
    }
  }
  return stops[stops.length - 1][1];
}
function hexPath(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * (Math.PI / 3);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

function bloomCells() {
  const cells = [];
  let radius = 8;
  for (let ring = 0; ring < RINGS; ring++) {
    const hexR = 11 + ring * 6.2;
    const count = ring === 0 ? 6 : 6 + ring * 4;
    const ringRadius = ring === 0 ? 26 : radius + hexR * 1.05;
    if (ringRadius + hexR > MAX_R) break;
    const rot = ring * 0.07;
    for (let i = 0; i < count; i++) {
      const a = rot + (i / count) * Math.PI * 2;
      cells.push({
        x: CX + ringRadius * Math.cos(a),
        y: CY + ringRadius * Math.sin(a),
        r: hexR,
        t: ring / (RINGS - 1),
        ring,
      });
    }
    radius = ringRadius + hexR * 0.68;
  }
  return cells;
}

function svgFor(id, title, fillFor, note) {
  const cells = bloomCells();
  const paths = cells
    .map((c) => {
      const fill = fillFor(c);
      return `<path d="${hexPath(c.x, c.y, c.r)}" fill="${fill}" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round"/>`;
    })
    .join("\n    ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-labelledby="t d">
  <title id="t">${title}</title>
  <desc id="d">${note}</desc>
  <rect width="${SIZE}" height="${SIZE}" fill="#ffffff"/>
  ${paths}
  <circle cx="${CX}" cy="${CY}" r="5.5" fill="#ffffff"/>
</svg>
`;
}

const skaistsStops = [
  [0.0, "#E01888"],
  [0.16, "#A02CC4"],
  [0.38, "#4A6EE8"],
  [0.58, "#2EC4E6"],
  [0.8, "#6EDC46"],
  [1.0, "#C8E62A"],
];
const natureStops = [
  [0.0, "#FFF4B0"],
  [0.12, "#D4EC3A"],
  [0.32, "#7ED84A"],
  [0.52, "#2EC8E0"],
  [0.72, "#3A88E0"],
  [0.88, "#D040B8"],
  [1.0, "#E02890"],
];

const marks = [
  {
    file: "skaists-purple-center.svg",
    id: "skaists",
    title: "skaists — purple-center hex bloom (provisional reconstruction; chosen stops)",
    note: "Provisional reconstruction. Geometry and color stops were chosen by this script. They do not establish the exact founder original. Magenta/fuchsia core through purple and cyan to a lime rim. Replace with the founder JPEG when recovered.",
    fill: (c) => sampleStops(skaistsStops, c.t),
  },
  {
    file: "beehive-biomass-solid-green.svg",
    id: "biomass",
    title: "beehive biomass — solid lime hex bloom (provisional reconstruction; chosen fill)",
    note: "Provisional reconstruction. Geometry and solid lime fill were chosen by this script. They do not establish the exact founder original. Replace with the founder JPEG when recovered.",
    fill: () => "#9AD62E",
  },
  {
    file: "beehive-nature-green-center.svg",
    id: "nature",
    title: "beehive nature — green-center hex bloom (provisional reconstruction; chosen stops)",
    note: "Provisional reconstruction. Geometry and color stops were chosen by this script. They do not establish the exact founder original. Pale-yellow/lime core through cyan to a magenta rim. Replace with the founder JPEG when recovered.",
    fill: (c) => sampleStops(natureStops, c.t),
  },
];

for (const m of marks) {
  const svg = svgFor(m.id, m.title, m.fill, m.note);
  const dest = join(here, m.file);
  writeFileSync(dest, svg);
  console.log("wrote", dest);
}
