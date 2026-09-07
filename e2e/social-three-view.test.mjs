/* Presentation differences for bee vs cypherpunk on Grok social paths.
   Destinations and honesty stay shared. These are source checks, not a
   rendered screenshot or a live Buzz conversation receipt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const social = read('surfaces/doors/bnature-social.html');
const directory = read('surfaces/buzz-directory.html');
const gallery = read('surfaces/blight/gallery.html');
const studio = read('surfaces/blight/studio-music.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');

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
}

const hives = extractById(directory, 'our-hives');
const people = extractById(directory, 'people-agents');
const newBee = extractById(directory, 'new-bee');
const startHere = extractById(social, 'start-here');

test('New bee directory canvas is one continuous light room, not a light island on black', () => {
  assert.match(directory, /body\[data-reg="bee"\]\{[^}]*background:#f6f7f2/);
  assert.match(directory, /body\[data-reg="bee"\] section,body\[data-reg="bee"\] #new-bee,body\[data-reg="bee"\] #our-hives,body\[data-reg="bee"\] #people-agents\{background:#fff/);
  assert.match(directory, /body\[data-reg="bee"\] #new-bee\{background:#fff/);
  assert.match(directory, /body\[data-reg="bee"\] #tbar\{background:#f6f7f2!important/);
  assert.equal((directory.match(/#new-bee\{background:#f6f7f2/g) || []).length, 1,
    'choose-cards remain the New bee island token; the page body now shares that canvas');
});

test('cypherpunk directory keeps a dark terminal room including the choose-cards', () => {
  assert.match(directory, /body\[data-reg="cypherpunk"\]\{color-scheme:dark\}/);
  assert.match(directory, /body\[data-reg="cypherpunk"\] #new-bee\{background:var\(--panel\)/);
  assert.match(directory, /body\[data-reg="cypherpunk"\] #new-bee h2\{[^}]*ui-monospace/);
});

test('estate hive cards show a join action; relay-host density sits in details.density', () => {
  assert.match(hives, /<span class="chip ok"><i><\/i>estate hive<\/span>/);
  assert.doesNotMatch(hives, /data-reg="bee"><i><\/i>estate hive/);
  assert.match(hives, /<b>status:<\/b> dual-homed/);
  assert.match(hives, /beehivenature\.buzz — the science hive/);
  assert.match(hives, /Join this community in the Buzz app/);
  assert.match(hives, /<a class="a-link" href="https:\/\/relay\.skaists\.dev\/">Open the web door<\/a>/);
  assert.match(hives, /<a class="a-link" href="https:\/\/relay2\.skaists\.dev\/">Open the web door<\/a>/);
  assert.match(hives, /<details class="density">/);
  assert.match(hives, /<b>relay host:<\/b> wss:\/\/skaists\.buzz/);
  assert.match(hives, /<b>fallback:<\/b> wss:\/\/relay\.skaists\.dev/);
  assert.match(hives, /<b>web door:<\/b>/);
  assert.match(hives, /<b>relay host:<\/b> wss:\/\/beehivenature\.buzz/);
  assert.match(hives, /<b>fallback:<\/b> wss:\/\/relay2\.skaists\.dev/);
  assert.match(hives, /join via the Buzz app/);
  const density = hives.match(/<details class="density">[\s\S]*?<b>relay host:<\/b>/);
  assert.ok(density, 'relay host is inside density details, not the New bee card face');
});

test('density sync opens relay details for cypherpunk and raver, not the New bee default', () => {
  assert.match(directory, /d\.open = r==='cypherpunk' \|\| r==='raver'/);
  assert.match(social, /d\.open = r==='cypherpunk' \|\| r==='raver'/);
  assert.match(directory, /details\.density/);
  assert.match(directory, /id="public-directory-box"/);
  assert.match(directory, /<summary>More communities — public directory<\/summary>/);
});

test('people-agents keep human/machine honesty and the published roster names', () => {
  assert.match(people, /PEOPLE\s*\/\s*AGENTS/);
  assert.match(people, /<span class="who">human<\/span>/);
  assert.match(people, /<span class="who">machine seat<\/span>/);
  assert.match(people, /bQueenBee/);
  assert.match(people, /loVis waTer/);
  assert.match(people, /not a live roster|not proof that anyone is in a Buzz room/i);
  assert.match(people, /Buzz app/i);
  assert.match(people, /data-reg="bee"/);
  assert.match(people, /data-reg="cypherpunk"/);
});

test('social door New bee chrome matches the light island; cypherpunk keeps scanline density', () => {
  assert.match(social, /body\[data-reg="bee"\]\{[^}]*background:#f6f7f2/);
  assert.match(social, /body\[data-reg="bee"\] #start-here\{background:#fff/);
  assert.match(social, /body\[data-reg="bee"\] #veil,body\[data-reg="bee"\] #bandwrap\{display:none\}/);
  assert.match(social, /body\[data-reg="bee"\] #tbar\{background:#f6f7f2!important/);
  assert.match(social, /body\[data-reg="cypherpunk"\]\{color-scheme:dark\}/);
  assert.match(social, /body\[data-reg="cypherpunk"\] #start-here\{background:var\(--panel\)/);
  assert.match(social, /data-reg="bee" data-i18n="d.social.who"/);
  assert.match(social, /data-reg="bee" data-i18n="d.social.what"/);
  assert.match(social, /<summary>Everything behind this door<\/summary>/);
});

test('choose-click destinations and this-browser-only honesty are unchanged', () => {
  const startLinks = hrefs(startHere);
  assert.ok(startLinks.includes('../buzz-directory.html'));
  assert.ok(startLinks.includes('../buzz-directory.html#people-agents'));
  assert.ok(startLinks.includes('../index.html'));
  const beeLinks = hrefs(newBee);
  assert.ok(beeLinks.includes('#our-hives'));
  assert.ok(beeLinks.includes('#people-agents'));
  assert.ok(beeLinks.includes('index.html'));
  assert.match(social, /<a class="act secondary" href="\.\.\/forge\/room\.html"/);
  assert.match(social, /<em>this browser only<\/em>/);
  assert.match(social, /LIVE on this door means the page is published/);
  assert.match(social, /does not send or deliver messages/);
  assert.match(directory, /<summary>If the door does not open<\/summary>/);
  assert.match(hives, /href="https:\/\/relay\.skaists\.dev\/"/);
  assert.match(directory, /buzz:\/\/join\?relay=wss%3A%2F%2Fbuzzbuild/);
});

test('New bee blocks still contain no numbered step instructions', () => {
  assertNoStepInstructions(startHere, '#start-here');
  assertNoStepInstructions(newBee, '#new-bee');
  assertNoStepInstructions(extractById(directory, 'our-hives').replace(/<details class="density">[\s\S]*?<\/details>/g, ''), '#our-hives card face');
});

test('this lane does not rewrite the Astra gallery/studio pages or the shared shell', () => {
  assert.doesNotMatch(gallery, /body\[data-reg="bee"\] #tbar/);
  assert.doesNotMatch(studio, /body\[data-reg="bee"\] #tbar/);
  assert.equal(register.includes('data-bee-adapter="directory"'), true);
  assert.match(tour, /register\.js\?v=8/);
});
