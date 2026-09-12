/* Fixture checks for the community → Buzz → home New bee journey.
   These prove destinations, honesty copy and the choose-click law in the
   committed HTML. They are not a live two-device conversation receipt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const social = read('surfaces/doors/bnature-social.html');
const directory = read('surfaces/buzz-directory.html');

function extractById(html, id) {
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

function hrefs(html) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m => m[1]);
}

function assertNoStepInstructions(block, name) {
  assert.doesNotMatch(block, /<ol[\s>]/i, name+' must not use a numbered procedure list');
  assert.doesNotMatch(block, /Three calm steps/i, name+' must not title a how-to');
  assert.doesNotMatch(block, /\b1\s*Pick\b/i, name+' must not number Pick');
  assert.doesNotMatch(block, /\b2\s*Join\b/i, name+' must not number Join');
  assert.doesNotMatch(block, /\b3\s*Talk\b/i, name+' must not number Talk');
  assert.doesNotMatch(block, /\b4\s*Return\b/i, name+' must not number Return');
  assert.doesNotMatch(block, /<(li|p|div)[^>]*>\s*\d+[\.\)]\s/i, name+' must not lead with step numbers');
}

function assertNoDeliveryClaims(html, name) {
  const stripped = html
    .replace(/does not send or deliver messages/gi, '')
    .replace(/does not send or deliver/gi, '');
  assert.doesNotMatch(stripped, /\b(sent|delivered)\b/i, name+' must not claim sent/delivered');
}

const startHere = extractById(social, 'start-here');
const newBee = extractById(directory, 'first-bee');
const peopleAgents = extractById(directory, 'people-agents');

test('the social door New bee strip chooses the hive, people-agents and home', () => {
  const links = hrefs(startHere);
  assert.ok(links.includes('../buzz-directory.html'), 'Meet the hive → buzz-directory');
  assert.ok(links.includes('../buzz-directory.html#people-agents'), 'People and agents → directory fragment');
  assert.ok(links.includes('../index.html'), 'Home → hub');
  assert.match(startHere, /<a class="start-link act people" href="\.\.\/buzz-directory\.html"/);
  assert.match(startHere, /<strong data-i18n="social.arrival.hive">Meet the hive<\/strong>/);
  assert.match(startHere, /<strong data-i18n="social.arrival.people">People and agents<\/strong>/);
  assert.match(startHere, /<strong data-i18n="social.arrival.home">Home<\/strong>/);
  assert.match(startHere, /class="start-help"/);
  assert.match(startHere, /data-i18n="social.arrival.kicker"/);
  assert.match(startHere, /data-i18n="social.arrival.honesty.body"/);
});

test('the social door keeps a Buzz-app primary path and a this-browser-only room', () => {
  assert.match(startHere, /Buzz app/i);
  assert.match(startHere, /not this HTML page/i);
  assert.match(social, /<a class="act secondary" href="\.\.\/forge\/room\.html"/);
  assert.match(social, /<em data-i18n="social.arrival.browserOnly">this browser only<\/em>/);
  assert.match(social, /LIVE on this door means the page is published/);
  assert.match(startHere, /LIVE here means published pages/);
});

test('the directory New bee intro chooses OUR HIVES, People and names and Go deeper', () => {
  const links = hrefs(newBee);
  assert.ok(links.includes('profile.html'), 'People and names → profile');
  assert.match(newBee, /data-dir-go="hives"/);
  assert.match(newBee, /data-i18n="social.arrival.dir.hives"/);
  // z1.a rider 2026-09-12: New bee leads with the visitor's purpose (welcome +
  // meet the hive); the receipts/online honesty lives support-sized — the intro
  // still says plainly the list cannot see who is online and does not pretend.
  assert.match(newBee, /Welcome\. This page is the estate's front porch/);
  assert.match(newBee, /Come meet the hive\./);
  assert.match(newBee, /This list cannot see who is online, and it does not pretend to/);
  assert.match(newBee, /data-i18n="review.bee.deeper"/);
  assert.doesNotMatch(newBee, /wss:\/\//);
  assert.doesNotMatch(newBee, /buzz:\/\//);
  assert.ok(extractById(directory, 'our-hives').includes('data-i18n="bd.hives.h2"'));
});

test('PEOPLE / AGENTS labels humans and machine seats without a live-room claim', () => {
  assert.match(peopleAgents, /PEOPLE\s*\/\s*AGENTS/);
  assert.match(peopleAgents, /data-i18n="social.arrival.who.human">human<\/span>/);
  assert.match(peopleAgents, /data-i18n="social.arrival.who.machine">machine seat<\/span>/);
  assert.match(peopleAgents, /bQueenBee/);
  assert.match(peopleAgents, /loVis waTer/);
  assert.match(peopleAgents, /not a live roster|not proof that anyone is in a Buzz room/i);
  assert.match(peopleAgents, /Buzz app/i);
});

test('hive door-lines stay honest and the closed door is a collapsed details', () => {
  const hives = extractById(directory, 'our-hives');
  assert.match(hives, /<b>relay host:<\/b>/);
  assert.match(hives, /<b>fallback:<\/b>/);
  assert.match(hives, /<b>web door:<\/b>/);
  assert.match(hives, /join via the Buzz app/);
  assert.match(directory, /<summary data-i18n="social.arrival.door.summary">If the door does not open<\/summary>/);
  assert.match(directory, /<details class="door-help">/);
});

test('neither landing claims a message was sent or delivered', () => {
  assertNoDeliveryClaims(social, 'bnature-social');
  assertNoDeliveryClaims(directory, 'buzz-directory');
  assertNoDeliveryClaims(startHere, '#start-here');
  assertNoDeliveryClaims(newBee, '#first-bee');
  assertNoDeliveryClaims(peopleAgents, '#people-agents');
});

test('New bee blocks contain no numbered step instructions', () => {
  assertNoStepInstructions(startHere, '#start-here');
  assertNoStepInstructions(newBee, '#first-bee');
  assert.doesNotMatch(startHere, /<ol[\s>]/i);
  assert.doesNotMatch(newBee, /<ol[\s>]/i);
});

test('additive social.arrival keys exist, are docked, and match page English', () => {
  const corpus = JSON.parse(read('surfaces/lang-corpus.json'));
  const langs = corpus._meta.langs;
  const pages = social + directory;
  const keys = [...new Set([...pages.matchAll(/data-i18n="(social\.arrival\.[^"]+)"/g)].map(m => m[1]))];
  assert.ok(keys.length >= 20, 'arrival pages must wire a social.arrival set, got '+keys.length);
  for (const key of keys) {
    const row = corpus.strings[key];
    assert.ok(row && typeof row.en === 'string' && row.en.trim(), key+' needs English');
    for (const L of langs) {
      assert.equal(typeof row[L], 'string', key+' missing docked cell '+L);
      assert.ok(row[L].trim(), key+' empty docked cell '+L);
    }
  }
  assert.equal(corpus._meta.langs.slice(0, 6).join(','), 'ru,lv,th,gd,tt,uk',
    'six-priority language order must stay first in _meta.langs');
  assert.deepEqual(corpus._meta.attested, {}, 'this slice must not add human attestation');
});
