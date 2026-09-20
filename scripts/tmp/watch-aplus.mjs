#!/usr/bin/env node
/* watch-aplus.mjs — the W@tch room tells the truth about where it is standing.
   FOUNDER CATCH (2026-09-19, screenshot): on skaists.dev "Open chat" loaded /join/ —
   a GitHub Pages 404 inside the Conversation panel — and the room pass invited a
   number no host here could ever honour. This address is a static preview; no room
   host answers /live/health. The page now ASKS ONCE, and when no room host answers:
   the pass box and Open chat give way to one plain row with the reason (never a
   disabled button, never an iframe of someone's 404), the chip says Preview (not an
   error), and polling stops. On a real room host nothing changes. Asserted edits;
   a re-run changes nothing. One new key, en + 28 tongues, machine-drafted. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const KEY = 'watch.noRoom', CELLS = {
 en:'No room is hosted at this address yet. This page is a preview.', ru:'По этому адресу комната пока не размещена. Эта страница — предпросмотр.', lv:'Šajā adresē istaba vēl netiek uzturēta. Šī lapa ir priekšskatījums.', th:'ยังไม่มีห้องเปิดให้บริการที่ที่อยู่นี้ หน้านี้เป็นเพียงตัวอย่าง', gd:'Chan eil seòmar air aoigheachd aig an t-seòladh seo fhathast. ’S e ro-shealladh a tha san duilleig seo.', tt:'Бу адреста бүлмә әлегә урнаштырылмаган. Бу бит — алдан карау.', uk:'За цією адресою кімнату ще не розміщено. Ця сторінка — попередній перегляд.', cs:'Na této adrese zatím žádná místnost neběží. Tato stránka je náhled.', zh:'此地址尚未托管房间。本页面仅为预览。', ko:'이 주소에는 아직 호스팅된 방이 없습니다. 이 페이지는 미리보기입니다.', ar:'لا توجد غرفة مستضافة على هذا العنوان بعد. هذه الصفحة معاينة.', 'nl-be':'Op dit adres wordt nog geen kamer gehost. Deze pagina is een voorbeeld.', es:'Aún no hay ninguna sala alojada en esta dirección. Esta página es una vista previa.', nl:'Op dit adres wordt nog geen kamer gehost. Deze pagina is een voorbeeld.', de:'Unter dieser Adresse wird noch kein Raum gehostet. Diese Seite ist eine Vorschau.', fr:'Aucune salle n’est encore hébergée à cette adresse. Cette page est un aperçu.', he:'עדיין לא מתארח חדר בכתובת הזו. הדף הזה הוא תצוגה מקדימה.', hi:'इस पते पर अभी कोई कमरा होस्ट नहीं है। यह पृष्ठ एक पूर्वावलोकन है।', bn:'এই ঠিকানায় এখনও কোনো রুম হোস্ট করা হয়নি। এই পৃষ্ঠাটি একটি প্রিভিউ।', fa:'هنوز اتاقی در این نشانی میزبانی نمی‌شود. این صفحه یک پیش‌نمایش است.', ur:'اس پتے پر ابھی کوئی کمرہ ہوسٹ نہیں ہے۔ یہ صفحہ ایک پیش منظر ہے۔', ja:'このアドレスでは、まだルームがホストされていません。このページはプレビューです。', da:'Der hostes endnu ikke noget rum på denne adresse. Denne side er en forhåndsvisning.', nb:'Det er ennå ikke noe rom som hostes på denne adressen. Denne siden er en forhåndsvisning.', sv:'Inget rum hostas på den här adressen ännu. Den här sidan är en förhandsvisning.', fi:'Tässä osoitteessa ei vielä isännöidä huonetta. Tämä sivu on esikatselu.', tr:'Bu adreste henüz barındırılan bir oda yok. Bu sayfa bir önizlemedir.', hu:'Ezen a címen még nem fut szoba. Ez az oldal előnézet.', sa:'अस्मिन् सङ्केते अद्यापि कक्षः न आतिथ्यते। एतत् पृष्ठं पूर्वदर्शनम् अस्ति।' };
const CF = 'surfaces/lang-corpus.json', raw = readFileSync(CF, 'utf8'), corpus = JSON.parse(raw), langs = ['en', ...corpus._meta.langs];
for (const l of langs) if (!CELLS[l]) throw new Error('INCOMPLETE ' + l);
const row = corpus.strings[KEY] || (corpus.strings[KEY] = {}); let added = 0;
for (const l of langs) if (!row[l]) { row[l] = CELLS[l]; added++; }
if (added) writeFileSync(CF, JSON.stringify(corpus, null, /^\{\r?\n( +)"/.exec(raw)?.[1]?.length || undefined) + (raw.endsWith('\n') ? '\n' : ''));
const P = 'surfaces/watch.html'; let s = readFileSync(P, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const edit = (a, b) => { if (s.includes(b)) return; if (s.split(a).length !== 2) throw new Error('DRIFT: ' + a.slice(0, 70)); s = s.replace(a, b); };
/* 1 · the plain row with its reason, in the pass panel and in the conversation panel */
edit('<div class="row"><div class="field"><label for="sess"', '<p class="no-room" id="no-room-pass" data-i18n="watch.noRoom" hidden>' + CELLS.en + '</p><div class="row"><div class="field"><label for="sess"');
edit('<button id="open-room" data-i18n="watch.openChat">', '<p class="no-room" id="no-room-chat" data-i18n="watch.noRoom" hidden>' + CELLS.en + '</p><button id="open-room" data-i18n="watch.openChat">');
edit('.hidden,[hidden]{display:none!important}', '.hidden,[hidden]{display:none!important}.no-room{margin-top:16px;padding:14px 16px;border:1.5px dashed var(--muted);border-radius:12px;color:var(--ink);font-size:1rem;line-height:1.6}body[data-room="none"] :is(.pass-panel,#open-room,#room-privacy,#room-placeholder){display:none!important}');
/* 2 · ask once; a static address is a preview, not an error */
edit("const LOCAL_PREVIEW = location.protocol === 'file:';", "const LOCAL_PREVIEW = location.protocol === 'file:';\nlet ROOM_HOST = null;   /* null = not asked yet · true = a room host answered /live/health · false = static preview */");
edit("$('open-room').addEventListener('click',()=>{\n  if(LOCAL_PREVIEW) return;", "$('open-room').addEventListener('click',()=>{\n  if(LOCAL_PREVIEW || ROOM_HOST !== true) return;   /* never load /join/ where no room host answered */");
edit("async function pollHealth() {\n  if (LOCAL_PREVIEW) { connectionCopy('watch.local','Local preview'); return; }\n  try {\n    const r = await fetch('/live/health', { cache: 'no-store' });\n    const j = await r.json();",
     "function noRoomHere() {\n  ROOM_HOST = false; document.body.dataset.room = 'none';\n  $('no-room-pass').hidden = false; $('no-room-chat').hidden = false;\n  connectionCopy('watch.preview','Preview'); setCopy('screen-mode','watch.preview','Preview');\n}\nasync function pollHealth() {\n  if (LOCAL_PREVIEW) { connectionCopy('watch.local','Local preview'); return; }\n  if (ROOM_HOST === false) return;\n  try {\n    const r = await fetch('/live/health', { cache: 'no-store' });\n    if (!r.ok || !/json/i.test(r.headers.get('content-type') || '')) { noRoomHere(); return; }\n    const j = await r.json(); ROOM_HOST = true;");
/* 3 · the face: the one filled action is magenta in new bee; the brand mark follows the register's accent */
edit('body[data-reg="bee"]{--accent:#6e3fb8;--on-accent:#fff;', 'body[data-reg="bee"]{--accent:#6e3fb8;--primary:#a8238c;--on-accent:#fff;');
edit('.primary{background:var(--accent);border-color:var(--accent);', '.primary{background:var(--primary,var(--accent));border-color:var(--primary,var(--accent));');
edit("async function pollTicker() {\n  if (LOCAL_PREVIEW) return;", "async function pollTicker() {\n  if (LOCAL_PREVIEW || ROOM_HOST !== true) return;   /* no room host, no ticker to ask for */");
writeFileSync(P, crlf ? s.replace(/\n/g, '\r\n') : s);
/* 4 · the coverage floor counts VISIBLE keyed leaves; on a static address the pass panel (10 keyed leaves) now
   stays out of sight by design, so the floor follows the honest page: 55 → 45. Every visible leaf is still keyed. */
{ const F = 'e2e/lang-coverage-floors.json'; let f = readFileSync(F, 'utf8'); if (!f.includes('"watch.html": 45')) { if (f.split('"watch.html": 55').length !== 2) throw new Error('DRIFT: watch floor'); writeFileSync(F, f.replace('"watch.html": 55', '"watch.html": 45')); } }
execFileSync(process.execPath, ['scripts/build-watch-languages.mjs'], { stdio: 'inherit' });
console.log('watch a+: key cells added ' + added + ' · page edits asserted');
