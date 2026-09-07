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
const newBee = extractById(directory, 'new-bee');
const peopleAgents = extractById(directory, 'people-agents');

test('the social door New bee strip chooses the hive, people-agents and home', () => {
  const links = hrefs(startHere);
  assert.ok(links.includes('../buzz-directory.html'), 'Meet the hive → buzz-directory');
  assert.ok(links.includes('../buzz-directory.html#people-agents'), 'People and agents → directory fragment');
  assert.ok(links.includes('../index.html'), 'Home → hub');
  assert.match(startHere, /<a class="start-link act people" href="\.\.\/buzz-directory\.html"/);
  assert.match(startHere, /<strong>Meet the hive<\/strong>/);
  assert.match(startHere, /<strong>People and agents<\/strong>/);
  assert.match(startHere, /<strong>Home<\/strong>/);
  assert.match(startHere, /class="start-help"/);
});

test('the social door keeps a Buzz-app primary path and a this-browser-only room', () => {
  assert.match(startHere, /Buzz app/i);
  assert.match(startHere, /not this HTML page/i);
  assert.match(social, /<a class="act secondary" href="\.\.\/forge\/room\.html"/);
  assert.match(social, /<em>this browser only<\/em>/);
  assert.match(social, /LIVE on this door means the page is published/);
  assert.match(startHere, /LIVE here means published pages/);
});

test('the directory New bee intro chooses OUR HIVES, people-agents and Home', () => {
  const links = hrefs(newBee);
  assert.ok(links.includes('#our-hives'), 'OUR HIVES fragment');
  assert.ok(links.includes('#people-agents'), 'people-agents fragment');
  assert.ok(links.includes('index.html'), 'Home → hub');
  assert.match(newBee, /<h2>Find your people<\/h2>/);
  assert.match(newBee, /This page lists doors/);
  assert.match(newBee, /Buzz app/i);
  assert.match(newBee, /class="home-controls"/);
  assert.ok(extractById(directory, 'our-hives').includes('data-i18n="bd.hives.h2"'));
});

test('PEOPLE / AGENTS labels humans and machine seats without a live-room claim', () => {
  assert.match(peopleAgents, /PEOPLE\s*\/\s*AGENTS/);
  assert.match(peopleAgents, /<span class="who">human<\/span>/);
  assert.match(peopleAgents, /<span class="who">machine seat<\/span>/);
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
  assert.match(directory, /<summary>If the door does not open<\/summary>/);
  assert.match(directory, /<details class="door-help">/);
});

test('neither landing claims a message was sent or delivered', () => {
  assertNoDeliveryClaims(social, 'bnature-social');
  assertNoDeliveryClaims(directory, 'buzz-directory');
  assertNoDeliveryClaims(startHere, '#start-here');
  assertNoDeliveryClaims(newBee, '#new-bee');
  assertNoDeliveryClaims(peopleAgents, '#people-agents');
});

test('New bee blocks contain no numbered step instructions', () => {
  assertNoStepInstructions(startHere, '#start-here');
  assertNoStepInstructions(newBee, '#new-bee');
  assert.doesNotMatch(startHere, /<ol[\s>]/i);
  assert.doesNotMatch(newBee, /<ol[\s>]/i);
});
