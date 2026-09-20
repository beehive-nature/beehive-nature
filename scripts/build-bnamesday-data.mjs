#!/usr/bin/env node
/* build-bnamesday-data.mjs — the Latvian name-day calendar, from the State
   Language Centre's own two CSVs (data.gov.lv, CC0-1.0), folded into the one
   payload surfaces/bnamesday.html reads.

   usage: node scripts/build-bnamesday-data.mjs <traditional.csv> <extended.csv> <retrieved YYYY-MM-DD>

   The Centre revises the calendar about every three years (2018 · 2022 · 2025),
   so this is a re-runnable receipt, not a one-off. It refuses loudly instead of
   writing a half-true file: every assertion below is a fact the page relies on.

   What it does NOT do: guess. Gender is not in the source, so it is not in the
   payload — the page derives it from the ending and says so. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [, , tradPath, extPath, retrieved] = process.argv;
const fail = (m) => { console.error('FAIL build-bnamesday-data: ' + m); process.exit(1); };
if (!tradPath || !extPath || !/^\d{4}-\d\d-\d\d$/.test(retrieved || '')) fail('usage: <traditional.csv> <extended.csv> <retrieved YYYY-MM-DD>');

const NOTE_LV = 'Visu neparasto un kalendāros neierakstīto vārdu diena';
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const rowsOf = (buf) => {
  const lines = buf.toString('utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
  if (lines[0] !== 'datums,vardadienas') fail('unexpected header: ' + lines[0]);
  return lines.slice(1).map((l) => {
    const m = l.match(/^(\d\d)\.(\d\d)\.,(.*)$/);
    if (!m) fail('unreadable row: ' + l.slice(0, 60));
    return { key: m[2] + '-' + m[1], raw: m[3].trim().replace(/^"|"$/g, '') };
  });
};

const tradBuf = readFileSync(tradPath), extBuf = readFileSync(extPath);
const trad = rowsOf(tradBuf), ext = rowsOf(extBuf);
if (trad.length !== 366 || ext.length !== 366) fail('expected 366 days in each list, got ' + trad.length + ' / ' + ext.length);

const days = {}, ltg = {}, notes = {};
const stripNote = (key, raw) => {
  if (!raw.includes(NOTE_LV)) return raw;
  notes[key] = { lv: NOTE_LV, en: 'The day of every unusual name no calendar has written down' };
  return raw.replace('. ' + NOTE_LV, ' ').replace(NOTE_LV, ' ');
};

for (const r of trad) {
  const raw = stripNote(r.key, r.raw);
  days[r.key] = { t: raw === '–' ? [] : raw.split(',').map((s) => s.trim()).filter(Boolean), x: [] };
}
for (const r of ext) {
  if (!days[r.key]) fail('extended list has a day the traditional list lacks: ' + r.key);
  let raw = stripNote(r.key, r.raw);
  /* Latgalian written forms ride in brackets after the name they belong to */
  raw = raw.replace(/(\S+)\s+\(LTG:\s*([^)]+)\)/g, (_, name, form) => { ltg[name] = form.trim(); return name; });
  if (/[()]/.test(raw)) fail('unparsed bracket on ' + r.key + ': ' + raw.slice(0, 80));
  const names = raw === '–' ? [] : raw.split(/\s+/).filter(Boolean);
  const t = new Set(days[r.key].t);
  for (const n of t) if (!names.includes(n)) fail('traditional name ' + n + ' missing from the extended row of ' + r.key);
  days[r.key].x = names.filter((n) => !t.has(n));
}

/* the facts the page states out loud — recomputed here so no hand number survives */
const allT = Object.values(days).flatMap((d) => d.t), allX = Object.values(days).flatMap((d) => d.x);
if (new Set(allT).size !== allT.length) fail('a traditional name appears on two days');
for (const [k, d] of Object.entries(days)) {
  if (k === '02-29') { if (d.t.length || d.x.length) fail('29 February is no longer empty — the page says it is'); }
  else if (!d.t.length) fail('a day lost its traditional names: ' + k);
  for (const n of [...d.t, ...d.x]) if (!/^\p{Lu}[\p{L}'’-]*$/u.test(n)) fail('not a name on ' + k + ': ' + JSON.stringify(n));
}
if (!notes['05-22']) fail('22 May lost its note — the page tells that story');

const out = {
  v: 1,
  _meta: {
    what: 'Latvian name-day calendar: traditional list (t) and the extended list beyond it (x), keyed MM-DD.',
    publisher: 'Valsts valodas centrs (State Language Centre of Latvia), Kalendārvārdu ekspertu komisija',
    source: 'https://data.gov.lv/dati/lv/dataset/latviesu-tradicionalais-un-paplasinatais-kalendarvardu-saraksts',
    licence: 'CC0-1.0',
    retrieved,
    source_files: {
      'traditional_sha256_PUBLIC-CONSTANT': sha(tradBuf),
      'extended_sha256_PUBLIC-CONSTANT': sha(extBuf),
    },
    caveat: 'The portal files are dated 2025-05-16. The Centre added 9 traditional and 56 extended names with effect from 2026-01-01; they are NOT in these files and so not here.',
    gender: 'Not in the source, so not in this payload. The page infers it from the ending and labels it an inference.',
    counts: { days: 366, traditional: allT.length, extended_only: allX.length, extended_unique: new Set(allX).size, latgalian_forms: Object.keys(ltg).length },
    built_by: 'scripts/build-bnamesday-data.mjs',
  },
  notes,
  ltg,
  days: '@@DAYS@@',
};
/* one day per line: a three-yearly revision then reads as a clean diff */
const body = Object.keys(days).sort().map((k) => ' ' + JSON.stringify(k) + ':' + JSON.stringify(days[k])).join(',\n');
const json = JSON.stringify(out, null, 1).replace('"@@DAYS@@"', '{\n' + body + '\n }') + '\n';
JSON.parse(json);
writeFileSync('surfaces/bnamesday-data.json', json);
console.log('ok surfaces/bnamesday-data.json ' + Buffer.byteLength(json) + ' bytes · ' + JSON.stringify(out._meta.counts));
