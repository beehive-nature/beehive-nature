// surface-source.mjs — the source-reading helpers the views tests share.
// read(path) loads a repo file relative to the repo root; extractById slices
// the element carrying id="…" through its matching close tag (tag-depth
// counted), asserting the id exists. Page-specific script slicing (inline())
// stays in each test: its variants measure different things.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

export function extractById(html, id) {
  const open = html.match(new RegExp(`<(?<tag>[a-z][a-z0-9]*)([^>]*\\sid="${id}"[^>]*)>`, 'i'));
  assert.ok(open, '#'+id+' must exist');
  const tag = open.groups.tag;
  const start = open.index;
  let depth = 1, cursor = start + open[0].length;
  const finder = new RegExp('<'+tag+'\\b[^>]*>|</'+tag+'>', 'gi');
  finder.lastIndex = cursor;
  let next;
  while ((next = finder.exec(html))) {
    if (next[0].startsWith('</')) depth--;
    else depth++;
    if (depth === 0) return html.slice(start, next.index + next[0].length);
  }
  return html.slice(start);
}
