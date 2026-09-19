import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const page = read('surfaces/profile.html');
const holder = read('surfaces/blight/profile.html');
const corpus = JSON.parse(read('surfaces/lang-corpus.json'));
const sink = read('scripts/buzz-mail/sink.py');
const recipients = new Set([...sink.match(/for a in \(([^)]+)\)/)[1].matchAll(/"([a-z0-9-]+)"/g)].map(m=>m[1]+'@agents.skaists.buzz'));
const contacts = page.split('<section id="agent-contacts"')[1].split('</section>')[0];

function checkMailActions(html) {
  const links = [...html.matchAll(/href="mailto:([^"]+)"/g)].map(m=>m[1]);
  assert.ok(links.length>0, 'real configured inbox actions must be present');
  for(const recipient of links) assert.ok(recipients.has(recipient), 'unprovisioned email action: '+recipient);
  return links;
}

test('email actions are a subset of the receiving service; historical addresses remain visibly inactive',()=>{
  assert.equal(checkMailActions(page).length,6);
  assert.throws(()=>checkMailActions(page.replace('mailto:bfuzz@','mailto:invented@')),/unprovisioned/);
  for(const historical of ['skaists','z2.1']) {
    assert.match(page,new RegExp('✉ '+historical.replace('.','\\.')+'@agents\\.skaists\\.buzz · <span data-i18n="prof.mail.unprovisioned"'));
    assert.doesNotMatch(page,new RegExp('mailto:'+historical.replace('.','\\.')+'@'));
  }
  assert.doesNotMatch(page,/claim a name to get one/);
});

test('Buzz identities do not turn into invented domain registrations, presence or mailbox bindings',()=>{
  assert.equal((contacts.match(/data-contact="/g)||[]).length,3);
  assert.equal((contacts.match(/data-i18n="prof.mail.unbound"/g)||[]).length,2);
  assert.match(contacts,/data-i18n="prof.mail.unprovisioned"/);
  assert.match(contacts,/No \.a registration is asserted/);
  assert.doesNotMatch(contacts,/BcODexAstRA\.a|data-presence|online now|mailto:.*astra/i);
  for(const state of ['receiving','notifications','outbound']) assert.match(contacts,new RegExp('data-mail-state="'+state+'"'));
  assert.match(contacts,/Delivery to an agent is not proven here/);
  assert.match(contacts,/Integration under review/);
  assert.match(contacts,/Outbound delivery unavailable/);
});

test('both existing profiles lead to one public contact section with an installed-app fallback',()=>{
  assert.match(holder,/href="\.\.\/profile.html#agent-contacts"/);
  assert.match(page,/<section id="agent-contacts"[^>]+tabindex="-1"/);
  assert.equal((page.match(/href="#agent-contacts"/g)||[]).length,3);
  const target=new URL(contacts.match(/href="(buzz:[^"]+)"/)[1].replaceAll('&amp;','&'));
  assert.equal(target.hostname,'message');
  assert.equal(target.searchParams.get('channel'),'79212683-2cde-4fe5-8987-4617be97ebaf');
  assert.match(target.searchParams.get('id'),/^[a-f0-9]{64}$/);
  assert.match(contacts,/href="buzz-directory.html"/);
  assert.doesNotMatch(contacts,/buzz:\/\/profile|<iframe|<form|<input|fetch\(|WebSocket\(/);
});

test('new contact copy is keyed; English fallbacks are recorded rather than called translations',()=>{
  const keys=Object.keys(corpus.strings).filter(k=>k.startsWith('prof.mail.'));
  assert.equal(keys.length,31);
  const enfill=new Set(corpus._meta.enfill['agent-mail-contacts']);
  for(const key of keys){
    const row=corpus.strings[key];
    assert.ok(row.en);
    for(const lang of corpus._meta.langs){
      assert.ok(row[lang]?.trim(),key+':'+lang);
      if(row[lang]===row.en) assert.ok(enfill.has(key+':'+lang),'unrecorded fallback '+key+':'+lang);
    }
  }
  assert.match(corpus._meta.drafted,/prof.mail.\*/);
  assert.match(contacts,/English remains visible where translation is pending/);
});
