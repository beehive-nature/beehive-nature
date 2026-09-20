// Lane M beat 2 — music.html truthing + corpus surgery (fails loudly on any anchor miss)
import { readFileSync, writeFileSync } from 'node:fs';

// ---------- 1. music.html ----------
const P = 'surfaces/music.html';
let h = readFileSync(P, 'utf8');
const rep = (before, after) => {
  const i = h.indexOf(before);
  if (i < 0 || h.indexOf(before, i + 1) >= 0) throw new Error('anchor not unique/found: ' + before.slice(0, 60));
  h = h.slice(0, i) + after + h.slice(i + before.length);
};
// hero: bee lead moves to a music-only key (beeLead itself stays in the corpus untouched — it feeds Watch's inline bundle)
rep('data-i18n="music.beeLead">A calm room. The music is already playing.</p>',
    'data-i18n="music.roomPreviewLead">A calm room. Nothing plays here yet - the ways to listen are just below.</p>');
// hero: beeIntro honest default (corpus cells rewritten below)
rep('data-i18n="music.beeIntro">This room plays from a shared, verified manifest.',
    'data-i18n="music.beeIntro">This room reads from a shared, verified manifest - no track is attached, nothing plays here.');
// artist note: drop the "Play here lights up" promise, keep the attach path
rep('rides it, <b>Play here</b> lights up.', 'rides it, this panel will say so here.');
// comment block: no more ready promise
rep('Play here exists only when an\n     authorized audio file is attached (see ROOM_SOURCE in the module);',
    'Play here stays disabled - no authorized audio file\n     is attached and none is promised;');
// CSS: drop the ready-state styling (both registers)
rep('  #play-here:disabled { cursor:not-allowed; }\n  #play-here.ready { color:#140B1E; background:var(--biomass); border-style:solid; border-color:var(--biomass); }\n',
    '  #play-here:disabled { cursor:not-allowed; }\n');
rep('  body[data-reg="raver"] .source-panel { border-color:rgba(201,167,245,.35); }\n  body[data-reg="raver"] #play-here.ready { background:var(--biomass); color:#0A140B; box-shadow:0 6px 24px rgba(134,204,114,.3); }\n',
    '  body[data-reg="raver"] .source-panel { border-color:rgba(201,167,245,.35); }\n');
// dead rule for the removed <b> emphasis
rep('  .artist-note b { color:var(--biomass); }\n', '');
// script: remove the ROOM_SOURCE config + ready-branch renderer, keep the honest default state
const rsStart = h.indexOf('const ROOM_SOURCE = {');
if (rsStart < 0) throw new Error('ROOM_SOURCE block not found');
const rsEndMark = "ROOM_SOURCE.audio = null;            /* explicit: no authorized audio today */";
const rsEnd = h.indexOf(rsEndMark);
if (rsEnd < 0) throw new Error('ROOM_SOURCE end not found');
const honestComment = `/* the source panel states the truth and only the truth: no authorized
     audio file is attached, Play here stays disabled with its reason, and
     external watching rides named new-tab links. The day an authorized
     file arrives, it arrives through the shared room manifest - never a
     URL pointed from this page - and the panel says so here. */`;
h = h.slice(0, rsStart) + honestComment + h.slice(rsEnd + rsEndMark.length);
// remove the trailing call
rep('syncMotion(); draw(); renderSourcePanel();', 'syncMotion(); draw();');
writeFileSync(P, h);
console.log('music.html: 8 edits applied');

// ---------- 2. corpus ----------
const CP = 'surfaces/lang-corpus.json';
const c = JSON.parse(readFileSync(CP, 'utf8'));
const S = c.strings;
const LANGS = Object.keys(S['music.beeLead']); // 29 cells, same shape as the untouched sibling key
if (LANGS.length !== 29) throw new Error('expected 29 langs, got ' + LANGS.length);

const lead = {
  en: 'A calm room. Nothing plays here yet - the ways to listen are just below.',
  ru: 'Спокойная комната. Пока здесь ничего не играет - способы послушать чуть ниже.',
  lv: 'Mierīga istaba. Šeit vēl nekas skan - klausīšanās veidi nedaudz zemāk.',
  th: 'ห้องที่สงบ ตอนนี้ยังไม่มีเสียงเล่น - ทางฟังอยู่ด้านล่าง',
  gd: "Seòmar sìtheil. Chan eil dad 'cluich an seo fhathast - na slighean èisteachd dìreach gu h-ìosal.",
  tt: 'Тыныч бүлмә. Әлегә монда берни дә яңгырамый - тыңлау юллары түбәнрәк.',
  uk: 'Спокійна кімната. Поки тут нічого не грає - способи послухати трохи нижче.',
  cs: 'Klidný pokoj. Zatím tu nic nehraje - způsoby, jak poslouchat, jsou o kousek níž.',
  zh: '一间安静的房间。这里现在还没有声音 - 聆听方式就在下方。',
  ko: '차분한 방. 지금은 아무것도 재생되지 않아요 - 들을 수 있는 방법은 바로 아래에 있어요.',
  ar: 'غرفة هادئة. لا شيء يعمل هنا بعد - طرق الاستماع أدناه مباشرة.',
  'nl-be': 'Een kalm kamertje. Nu speelt er nog niks - de manieren om te luisteren staan net onderaan.',
  es: 'Una sala tranquila. Todavía no suena nada aquí - las formas de escuchar están justo abajo.',
  nl: 'Een rustige kamer. Er speelt nog niets - de manieren om te luisteren staan net onderaan.',
  de: 'Ein ruhiger Raum. Hier spielt noch nichts - die Wege zum Zuhören stehen direkt darunter.',
  fr: 'Une salle calme. Rien ne joue ici pour l\'instant - les façons d\'écouter sont juste en dessous.',
  he: 'חדר שקט. עדיין שום דבר לא מתנגן כאן - הדרכים להאזין נמצאות ממש למטה.',
  hi: 'एक शांत कक्ष। अभी यहाँ कुछ भी नहीं बज रहा - सुनने के तरीके ठीक नीचे हैं।',
  bn: 'একটি শান্ত ঘর। এখনও এখানে কিছুই বাজছে না - শোনার উপায়গুলো ঠিক নিচেই।',
  fa: 'اتاقی آرام. هنوز چیزی اینجا پخش نمی‌شود - راه‌های شنیدن درست پایین‌تر است.',
  ur: 'ایک پرسکون کمرہ۔ ابھی یہاں کچھ بھی نہیں چل رہا - سننے کے راستے بالکل نیچے ہیں۔',
  ja: '静かな部屋。今はまだ何も再生されていません - 聞き方はすぐ下にあります。',
  da: 'Et roligt rum. Der spiller endnu intet her - måderne at lytte på står lige nedenfor.',
  nb: 'Et stille rom. Ingenting spiller her ennå - måtene å lytte på står like nedenfor.',
  sv: 'Ett lugnt rum. Inget spelar här ännu - sätten att lyssna står strax nedanför.',
  fi: 'Rauhallinen huone. Täällä ei vielä soi mitään - kuuntelutavat ovat aivan alempana.',
  tr: 'Sakin bir oda. Burada henüz bir şey çalmıyor - dinleme yolları hemen aşağıda.',
  hu: 'Nyugodt szoba. Még semmi sem szól itt - a hallgatási módok kissé lejjebb vannak.',
  sa: 'शान्तः कक्षः। अद्यापि अत्र किमपि न वाद्यते - श्रवणमार्गाः अधः एव सन्ति।'
};
const intro = {
  en: 'This room reads from a shared, verified manifest - no track is attached, nothing plays here. Nothing to sign, nothing to pay - look around, then step in when it feels right.',
  ru: 'Эта комната читается из общего проверенного манифеста - трек не прикреплён, здесь ничего не играет. Ничего подписывать, ничего платить - осмотритесь и заходите, когда будет удобно.',
  lv: 'Šī istaba nolasās no kopīga, pārbaudīta manifesta - cels nav pievienots, šeit nekas skan. Nekas jāparaksta, nekas jāmaksā - apskaties un ieiet, kad tas šķiet pareizi.',
  th: 'ห้องนี้อ่านจากแมนิเฟสต์ที่แชร์กันและตรวจแล้ว - ยังไม่มีแทร็ก ไม่มีเสียงเล่นที่นี่ ไม่ต้องลงนาม ไม่ต้องจ่าย - มองรอบก่อน แล้วค่อยเข้ามาเมื่อพร้อม',
  gd: "Leughas an seòmar seo à manifest coitcheann air a dhearbhadh - chan eil traca ceangailte, chan eil càil 'cluich an seo. Rud sam bith air a shoidhnigh, rud sam bith air a phàigheadh - coimhead mun cuairt, agus gearr a-steach nuair a bhios e ceart.",
  tt: 'Бу бүлмә уртак, тикшерелгән манифесттан укый - трек куелмаган, монда берни дә яңгырамый. Имзаларга да, түләргә дә кирәк түгел - карап алыгыз, әзер булгач керегез.',
  uk: 'Ця кімната читається зі спільного перевіреного маніфесту - трек не додано, тут нічого не грає. Нічого підписувати, нічого платити - роздивіться й заходьте, коли буде зручно.',
  cs: 'Tento pokoj se čte ze sdíleného ověřeného manifestu - žádná stopa není připojena, nic tu nehraje. Nic k podpisu, nic k platbě - rozhlédněte se a vstupte, až vám to bude vyhovovat.',
  zh: '这个房间从一个共享且已验证的清单读取 - 没有附加曲目，这里没有任何播放。无需注册，无需付费 - 先四处看看，觉得合适再进来。',
  ko: '이 방은 공유되고 검증된 매니페스트에서 읽힙니다 - 첨부된 트랙이 없고 여기서는 아무것도 재생되지 않아요. 서명할 것도, 지불할 것도 없어요 - 둘러보시다가 마음에 들 때 들어오세요.',
  ar: 'تُقرأ هذه الغرفة من بيان مشترك موثّق - لا مقطع مرفق ولا شيء يعمل هنا. لا توقيع ولا دفع - تفقّد المكان ثم ادخل حين تشعر بالارتياح.',
  'nl-be': 'Dit kamertje leest uit een gedeelde, gecontroleerde manifest - geen nummer aangehangen, er speelt hier niks. Niks te tekenen, niks te betalen - kijk rond en stap in als het juist voelt.',
  es: 'Esta sala se lee desde un manifiesto compartido y verificado - no hay pista adjunta, nada suena aquí. Nada que firmar, nada que pagar - mira alrededor y entra cuando te sientas a gusto.',
  nl: 'Deze kamer leest uit een gedeelde, gecontroleerde manifest - geen nummer aangehangen, er speelt hier niets. Niets te tekenen, niets te betalen - kijk rond en stap in als het goed voelt.',
  de: 'Dieser Raum liest aus einem geteilten, geprüften Manifest - kein Track angehängt, hier spielt nichts. Nichts zu unterschreiben, nichts zu zahlen - schau dich um und tritt ein, wenn es sich richtig anfühlt.',
  fr: "Cette salle se lit depuis un manifeste partagé et vérifié - aucune piste attachée, rien ne joue ici. Rien à signer, rien à payer - regardez autour, entrez quand cela vous convient.",
  he: 'החדר הזה נקרא ממניפסט משותף ומאומת - אין טראק מחובר, שום דבר לא מתנגן כאן. אין מה לחתום, אין מה לשלם - הסתכלו סביב והיכנסו כשמרגיש נכון.',
  hi: 'यह कक्ष एक साझा, सत्यापित मैनिफेस्ट से पढ़ी जाती है - कोई ट्रैक संलग्न नहीं है, यहाँ कुछ भी नहीं बज रहा। कुछ भी साइन नहीं, कुछ भी भुगतान नहीं - इधर-उधर देखिए, जब ठीक लगे तभी भीतर आइए।',
  bn: 'এই ঘরটি একটি ভাগ করা, যাচাইকৃত ম্যানিফেস্ট থেকে পড়া হয় - কোনো ট্র্যাক যুক্ত নেই, এখানে কিছুই বাজছে না। সাইন করার কিছু নেই, দেওয়ার কিছু নেই - চারপাশ দেখে নিন, ঠিক লাগলে ঢুকে পড়ুন।',
  fa: 'این اتاق از یک مانیفست مشترک و تأییدشده خوانده می‌شود - هیچ قطعه‌ای پیوست نیست و اینجا چیزی پخش نمی‌شود. چیزی برای امضا نیست، چیزی برای پرداخت نیست - کمی بگردید و وقتی احساس راحتی کردید وارد شوید.',
  ur: 'یہ کمرہ ایک مشترکہ، تصدیق شدہ مینیفسٹ سے پڑھا جاتا ہے - کوئی ٹریک منسلک نہیں، یہاں کچھ بھی نہیں چل رہا۔ کچھ بھی سائن نہیں، کچھ بھی ادا نہیں - دیکھیے اور جب ٹھیک لگے اندر آ جائیے۔',
  ja: 'この部屋は共有され検証されたマニフェストから読み込まれます - トラックは添付されておらず、ここでは何も再生されていません。署名も支払いも不要です - ご覧いただき、良さそうなときにお入りください。',
  da: 'Dette rum læser fra en delt, verificeret manifest - intet spor hæftet, intet spiller her. Intet at underskrive, intet at betale - se dig om og træd ind, når det føles rigtigt.',
  nb: 'Dette rommet leser fra en delt, verifisert manifest - ingen låt festet, ingenting spiller her. Ingenting å signere, ingenting å betale - se deg rundt og stig inn når det føles riktig.',
  sv: 'Detta rum läser från en delad, verifierad manifest - ingen låt bifogad, inget spelar här. Inget att signera, inget att betala - titta runt och kliv in när det känns rätt.',
  fi: 'Tämä huone lukee jaetusta, vahvistetusta manifestista - ei liitettyä raitaa, täällä ei soi mikään. Ei allekirjoitettavaa, ei maksettavaa - katso ympärillesi ja astu sisään, kun tuntuu oikealta.',
  tr: 'Bu oda paylaşılmış, doğrulanmış bir manifestten okunur - ekli parça yok, burada bir şey çalmıyor. İmzalanacak bir şey yok, ödenecek bir şey yok - etrafına bak, doğru geldiğinde içeri gir.',
  hu: 'Ez a szoba egy megosztott, ellenőrzött manifestből olvasódik - nincs csatolt szám, itt semmi sem szól. Nincs aláírandó, nincs fizetendő - nézz körül, és lépj be, amikor jónak érzed.',
  sa: 'एषः कक्षः साझात् सिद्धप्रमाणपत्रात् पठ्यते - न कश्चित् गीतांशः संलग्नः, अत्र किमपि न वाद्यते। न किमपि समाकुर्वन्तु न किमपि ददतु - पश्यन्तु यदा उचितं तदा प्रविशन्तु।'
};
const artist = {
  en: 'A work joins this room through the shared room manifest - today it carries encrypted references only. The day an authorized audio file rides it, this panel will say so here.',
  ru: 'Работа попадает в эту комнату через общий манифест комнаты - сегодня он несёт только зашифрованные ссылки. В день, когда по нему поедет авторизованный аудиофайл, эта панель прямо здесь об этом скажет.',
  lv: 'Darbs pievienojas šai istabai caur kopīgo istabas manifestu - šodien tas nes tikai šifrētas atsauces. Dienā, kad tajā brauks pilnvarots audio fails, šis panelis to šeit pateiks.',
  th: 'ผลงานเข้าร่วมห้องนี้ผ่านแมนิเฟสต์ของห้องที่แชร์กัน - วันนี้มีเพียงการอ้างอิงที่เข้ารหัส วันที่ไฟล์เสียงที่ได้รับอนุญาตมากับมัน แผงนี้จะบอกตรงนี้',
  gd: 'Thig obair a-steach dhan t-seòmar seo tro manifest coitcheann an t-seòmair - an-diugh chan eil ach iomraidhean crioptaige ann. An latha a ruithas faidhle fuaime ùghdaraichte tro, canaidh am panell seo e an-seo.',
  tt: 'Әсәр бу бүлмәгә уртак бүлмә манифесты аша керә - бүген ул фәкать шифрланган сылтамалар ташый. Рөхсәтле аудио файл аның белән килгәч, бу панель монда әйтәчәк.',
  uk: 'Твір потрапляє до цієї кімнати через спільний маніфест кімнати - сьогодні він несе лише зашифровані посилання. Коли авторизований аудіофайл прибуде ним, ця панель скаже про це тут.',
  cs: 'Dílo se do tohoto pokoje dostává přes sdílený manifest pokoje - dnes nese jen šifrované odkazy. Až se s ním sveze autorizovaný zvukový soubor, tento panel to zde oznámí.',
  zh: '作品通过共享的房间清单加入这个房间 - 今天它只携带加密引用。当获得授权的音频文件随它而来时，此面板会在这里说明。',
  ko: '작품은 공유된 방 매니페스트를 통해 이 방에 들어와요 - 지금은 암호화된 참조만 실려 있어요. 언젠가 승인된 오디오 파일이 그것과 함께 오면, 이 패널이 바로 여기에 알릴 거예요.',
  ar: 'تنضم الأعمال إلى هذه الغرفة عبر بيان الغرفة المشترك - اليوم يحمل مراجع مشفرة فقط. وفي اليوم الذي يركب فيه ملف صوتي مُصرَّح به، ستقول هذه اللوحة ذلك هنا.',
  'nl-be': 'Een werk sluit aan bij dit kamertje via het gedeelde kamermanifest - vandaag draagt het enkel versleutelde verwijzingen. De dag dat een geautoriseerd audiobestand meerijdt, zegt dit paneel het hier.',
  es: 'Una obra se une a esta sala a través del manifiesto compartido de la sala - hoy solo lleva referencias cifradas. El día en que un archivo de audio autorizado viaje en él, este panel lo dirá aquí.',
  nl: 'Een werk sluit aan bij deze kamer via het gedeelde kamermanifest - vandaag draagt het alleen versleutelde verwijzingen. De dag dat een geautoriseerd audiobestand meerijdt, zegt dit paneel het hier.',
  de: 'Ein Werk kommt über das geteilte Raum-Manifest in diesen Raum - heute trägt es nur verschlüsselte Verweise. An dem Tag, an dem eine autorisierte Audiodatei mitreist, sagt dieses Panel es hier.',
  fr: "Une œuvre rejoint cette salle via le manifeste partagé de la salle - aujourd'hui il ne porte que des références chiffrées. Le jour où un fichier audio autorisé y voyage, ce panneau le dira ici.",
  he: 'יצירה מצטרפת לחדר הזה דרך מניפסט החדר המשותף - היום הוא נושא רק הפניות מוצפנות. ביום שבו תיסע בו קובץ שמע מורשה, הפאנל הזה יגיד זאת כאן.',
  hi: 'कोई रचना इस कक्ष में साझा कक्ष-मैनिफेस्ट के ज़रिए जुड़ती है - आज वह केवल एन्क्रिप्टेड संदर्भ ले जाता है। जिस दिन कोई अधिकृत ऑडियो फ़ाइल इसके साथ आएगी, यह पैनल यहीं बता देगा।',
  bn: 'কোনো কাজ ভাগ করা ঘরের ম্যানিফেস্টের মাধ্যমে এই ঘরে যোগ দেয় - আজ এটি শুধু এনক্রিপ্ট করা রেফারেন্স বহন করে। যেদিন কোনো অনুমোদিত অডিও ফাইল এর সঙ্গে আসবে, এই প্যানেল এখানেই জানাবে।',
  fa: 'اثری از طریق مانیفست مشترک اتاق به این اتاق می‌پیوندد - امروز تنها مراجع رمزگذاری‌شده حمل می‌کند. روزی که یک فایل صوتی مجاز همراه آن بیاید، این پنل همین‌جا خواهد گفت.',
  ur: 'کوئی کام مشترکہ کمرے کے مینیفسٹ کے ذریعے اس کمرے میں شامل ہوتا ہے - آج یہ صرف مرموز کردہ حوالے لے جاتا ہے۔ جس دن کوئی مجاز آڈیو فائل اس کے ساتھ آئے گی، یہ پینل یہیں بتا دے گا۔',
  ja: '作品は共有された部屋のマニフェストを通じてこの部屋に加わります - 今日それは暗号化された参照だけを運んでいます。許可されたオーディオファイルがそれに乗る日が来れば、このパネルがここに示します。',
  da: 'Et værk tilslutter sig dette rum via rummets delte manifest - i dag bærer det kun krypterede referencer. Den dag en autoriseret lydfil rider med, siger dette panel det her.',
  nb: 'Et verk slutter seg til dette rommet via rommets delte manifest - i dag bærer det kun krypterte referanser. Den dagen en autorisert lydfil følger med, sier dette panelet det her.',
  sv: 'Ett verk ansluter till detta rum via rummets delade manifest - idag bär det bara krypterade referenser. Den dag en auktoriserad ljudfil följer med, säger den här panelen det här.',
  fi: 'Teos liittyy tähän huoneeseen huoneen jaetun manifestin kautta - tänään se kantaa vain salattuja viittauksia. Sinä päivänä, kun valtuutettu äänitiedosto saapuu sen mukana, tämä paneeli kertoo sen tässä.',
  tr: 'Bir eser bu odaya paylaşılan oda manifesti üzerinden katılır - bugün yalnızca şifrelenmiş başvurular taşır. Yetkili bir ses dosyası onunla geldiği gün, bu panel burada söyleyecek.',
  hu: 'Egy mű ezen a szobán a szoba megosztott manifestjén keresztül csatlakozik - ma csak titkosított hivatkozásokat hordoz. Amint egy engedélyezett hangfájl utazik vele, ez a panel itt jelzi.',
  sa: 'कृतिः अस्य कक्षस्य साझाप्रमाणपत्रेण अस्मिन् कक्षे युज्यते - अद्य तु केवलाः गूढलेखाः एव वहन्ति। यस्मिन् दिने अनुज्ञातः श्रवणफाइल् अनेन सह आगच्छति इदं पट्टिका अत्र एव वक्ष्यति।'
};
for (const [obj, target] of [[lead, 'music.roomPreviewLead'], [intro, 'music.beeIntro'], [artist, 'music.artistNote']]) {
  const missing = LANGS.filter(l => !obj[l]);
  if (missing.length) throw new Error(target + ' missing cells: ' + missing.join(','));
  S[target] = {}; for (const l of LANGS) S[target][l] = obj[l];
}
// withdraw the keys the unsupported ready branch used
delete S['music.playHereReady'];
delete S['music.stateAttached'];
// drafted provenance (append, matching the narrative convention; F1's 2026-09-13 anchor untouched)
c._meta.drafted += ' · 2026-09-19 music.* beat 2 (Lane M truthing, zCode seat): music.roomPreviewLead added and music.beeIntro + music.artistNote rewritten in all 29 cells - no playback claim without playback; music.beeLead untouched by law (feeds the Watch inline bundle); music.playHereReady + music.stateAttached withdrawn with the unsupported ready branch; the recovered 2026-09-13 panel keys (music.sourceTitle sourceSub stateNone noTrack noTrackHelp playHere playHereNo watchExternal youtubeNone waysTitle, PR #78 @ 5b9164af) recorded as machine-drafted on recovery - no human attestation claimed, all ⚙';
writeFileSync(CP, JSON.stringify(c, null, 2) + '\n');
console.log('corpus: roomPreviewLead added (29), beeIntro + artistNote rewritten (29 ea), 2 keys withdrawn, drafted appended');
console.log('music.* keys now:', Object.keys(S).filter(k => k.startsWith('music.')).length);
