// bdata-enfill-close.mjs — closes the bData A+ rebuild's K3 English fill (2026-09-19).
// Two late keys shipped en-filled in all 28 tongues and were recorded in
// _meta.enfill['bdata-aplus-2026-09-18']. This edition gives each its own
// rendering (machine-drafted ⚙, unattested — the corpus law), using each
// tongue's existing bData vocabulary (quote service / asking / price), and
// removes the closed cells from the enfill record. Run once from the repo root:
//   node scripts/tmp/bdata-enfill-close.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'surfaces/lang-corpus.json';
const c = JSON.parse(readFileSync(f, 'utf8'));
const BATCH = 'bdata-aplus-2026-09-18';
const A = 'bd.price.unreachable.allow', E = 'bd.price.elsewhere';
const T = {
  ru: ['Если браузер спросил, можно ли странице обратиться к ней, разрешите это.', 'Другая вкладка уже спрашивает — цена появится и здесь.'],
  lv: ['Ja pārlūks jautāja, vai lapa drīkst tam piekļūt, atļaujiet to.', 'Cita cilne jau jautā — cena parādīsies arī šeit.'],
  th: ['หากเบราว์เซอร์นี้ถามว่าหน้านี้เข้าถึงบริการได้หรือไม่ ให้อนุญาต', 'อีกแท็บหนึ่งกำลังถามอยู่แล้ว — ราคาจะปรากฏที่นี่ด้วย'],
  gd: ['Ma dh’fhaighnich am brabhsair seo am faod an duilleag a ruigsinn, ceadaich sin.', 'Tha taba eile ’ga iarraidh mu thràth — nochdaidh a’ phrìs an seo cuideachd.'],
  tt: ['Әгәр браузер биткә аңа мөрәҗәгать итәргә ярыймы дип сораса, рөхсәт итегез.', 'Башка кыстыргыч инде сорый — бәя монда да күренәчәк.'],
  uk: ['Якщо браузер запитав, чи може сторінка звернутися до неї, дозвольте це.', 'Інша вкладка вже питає — ціна з’явиться і тут.'],
  cs: ['Pokud se prohlížeč zeptal, zda se k ní stránka smí připojit, povolte to.', 'Jiná karta se už ptá — cena se objeví i zde.'],
  zh: ['如果浏览器询问是否允许此页面访问它，请允许。', '另一个标签页已在询问 — 价格也会显示在这里。'],
  ko: ['브라우저가 이 페이지의 접근을 허용할지 물었다면 허용하세요.', '다른 탭에서 이미 묻는 중입니다 — 가격은 여기에도 표시됩니다.'],
  ar: ['إذا سأل هذا المتصفح عمّا إذا كان يُسمح للصفحة بالوصول إليها، فاسمح بذلك.', 'علامة تبويب أخرى تسأل بالفعل — سيظهر السعر هنا أيضًا.'],
  'nl-be': ['Als deze browser vroeg of de pagina de dienst mag bereiken, sta dat toe.', 'Een ander tabblad vraagt het al — de prijs verschijnt ook hier.'],
  es: ['Si este navegador preguntó si la página puede acceder a él, permítalo.', 'Otra pestaña ya está preguntando — el precio aparecerá aquí también.'],
  nl: ['Als deze browser vroeg of de pagina de dienst mag bereiken, sta dat toe.', 'Een ander tabblad vraagt het al — de prijs verschijnt ook hier.'],
  de: ['Falls dieser Browser gefragt hat, ob die Seite ihn erreichen darf, erlauben Sie das.', 'Ein anderer Tab fragt bereits — der Preis erscheint auch hier.'],
  fr: ['Si ce navigateur a demandé si la page peut y accéder, autorisez-le.', 'Un autre onglet interroge déjà — le prix apparaîtra ici aussi.'],
  he: ['אם הדפדפן שאל אם מותר לדף לגשת אליו, אשרו זאת.', 'לשונית אחרת כבר שואלת — המחיר יופיע גם כאן.'],
  hi: ['यदि इस ब्राउज़र ने पूछा कि पेज उस तक पहुँच सकता है या नहीं, तो अनुमति दें।', 'दूसरा टैब पहले से पूछ रहा है — कीमत यहाँ भी दिखेगी।'],
  bn: ['এই ব্রাউজার যদি জিজ্ঞাসা করে থাকে পেজটি সেখানে পৌঁছাতে পারবে কি না, তবে অনুমতি দিন।', 'অন্য একটি ট্যাব ইতিমধ্যে জিজ্ঞাসা করছে — দাম এখানেও দেখা যাবে।'],
  fa: ['اگر این مرورگر پرسید که آیا صفحه اجازه دارد به آن دسترسی پیدا کند، اجازه دهید.', 'زبانهٔ دیگری در حال پرسیدن است — قیمت اینجا هم نمایش داده می‌شود.'],
  ur: ['اگر اس براؤزر نے پوچھا کہ صفحہ اس تک پہنچ سکتا ہے یا نہیں، تو اجازت دیں۔', 'ایک اور ٹیب پہلے ہی پوچھ رہا ہے — قیمت یہاں بھی ظاہر ہوگی۔'],
  ja: ['ブラウザーがこのページからの接続を許可するか尋ねた場合は、許可してください。', '別のタブがすでに問い合わせ中です — 価格はここにも表示されます。'],
  da: ['Hvis browseren spurgte, om siden må nå den, så tillad det.', 'En anden fane spørger allerede — prisen vises også her.'],
  nb: ['Hvis nettleseren spurte om siden får nå den, tillat det.', 'En annen fane spør allerede — prisen vises også her.'],
  sv: ['Om webbläsaren frågade om sidan får nå den, tillåt det.', 'En annan flik frågar redan — priset visas även här.'],
  fi: ['Jos selain kysyi, saako sivu ottaa siihen yhteyden, salli se.', 'Toinen välilehti kysyy jo — hinta näkyy myös täällä.'],
  tr: ['Bu tarayıcı sayfanın ona erişip erişemeyeceğini sorduysa izin verin.', 'Başka bir sekme zaten soruyor — fiyat burada da görünecek.'],
  hu: ['Ha a böngésző megkérdezte, hogy az oldal elérheti-e, engedélyezze.', 'Egy másik lap már kérdez — az ár itt is megjelenik.'],
  sa: ['यदि अयं ब्राउज़र् अपृच्छत् — किं पृष्ठं तां सेवां प्राप्तुम् अर्हति — तर्हि अनुमन्यताम्।', 'अन्यः टैब् पूर्वमेव पृच्छति — मूल्यम् अत्रापि दृश्येत।'],
};

const langs = c._meta.langs;
const missing = langs.filter(L => !T[L]);
if (missing.length) throw new Error('no rendering for: ' + missing.join(','));
let cells = 0;
for (const L of langs) for (const [i, key] of [A, E].entries()) {
  if (c.strings[key][L] !== c.strings[key].en) throw new Error(`${key}:${L} is not an English fill — refusing to overwrite a real rendering`);
  c.strings[key][L] = T[L][i]; cells++;
}
const before = c._meta.enfill[BATCH].length;
c._meta.enfill[BATCH] = c._meta.enfill[BATCH].filter(x => x.indexOf(A + ':') !== 0 && x.indexOf(E + ':') !== 0);
if (!c._meta.enfill[BATCH].length) delete c._meta.enfill[BATCH];
writeFileSync(f, JSON.stringify(c, null, 1) + '\n');
console.log(`closed ${cells} cells (2 keys × ${langs.length} tongues) · enfill record ${before} → ${(c._meta.enfill[BATCH] || []).length}`);
