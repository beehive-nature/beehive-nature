// bheraldry-corpus.mjs — corpus writer for the bHERALDRY surface shell (bher.* keys).
// Idempotent: inserts or refreshes ONLY bher.* keys in surfaces/lang-corpus.json; every
// other key is preserved byte-for-byte (the file round-trips through JSON.stringify(,null,1),
// verified stable — the stack-dataflow-corpus.mjs precedent). Every key MUST carry all
// 28 docked tongues or the writer refuses — the corpus law.
//
// SCOPE LAW (order bHERALDRY-003): corpus keys cover the PAGE CHROME only — the
// surface's own voice. Record-derived content (the blazon, motto, sources, disputes)
// never machine-swaps: its language claims are the record's own typed translations
// with their bLANGUAGEdock attestation tiers, rendered from bheraldry-records.json.
// All cells are ⚙ machine drafts (GLM-5.3, 2026-10-10) per the corpus law; proper
// nouns, file names, digests and the law reference Чл. 3 (2) stay untranslated
// (the pointer principle).
//
//   node scripts/bheraldry-corpus.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = join(ROOT, 'surfaces/lang-corpus.json');
const LANGS = ['ru','lv','th','gd','tt','uk','cs','zh','ko','ar','nl-be','es','nl','de','fr','he','hi','bn','fa','ur','ja','da','nb','sv','fi','tr','hu','sa'];

const TBL = {
'bher.banner.h': {
 en:'Standing boundary',
 ru:'Действующая граница',
 lv:'Pastāvošā robeža',
 th:'ขอบเขตที่ยึดถือ',
 gd:'Crìoch na sheasamh',
 tt:'Торышлы чика',
 uk:'Чинна межа',
 cs:'Stojící hranice',
 zh:'常设边界',
 ko:'상시 경계',
 ar:'الحدّ القائم',
 'nl-be':'Blijvende grens',
 es:'Límite vigente',
 nl:'Blijvende grens',
 de:'Geltende Grenze',
 fr:'Limite en vigueur',
 he:'הגבול הקבוע',
 hi:'स्थायी सीमा',
 bn:'বহাল সীমা',
 fa:'مرز برقرار',
 ur:'قائم حد',
 ja:'常設の境界',
 da:'Gældende grænse',
 nb:'Gjeldende grense',
 sv:'Gällande gräns',
 fi:'Voimassa oleva raja',
 tr:'Yürürlükteki sınır',
 hu:'Álló határ',
 sa:'स्थिता-सीमा'
},
'bher.lede.what': {
 en:"A symbol is evidence, not artwork. These records carry a symbol's meaning, grammar, sources, uses and translations as separate, typed claims \u2014 the four truths: source authenticity, historical interpretation, language equivalence, authority.",
 ru:'Символ \u2014 это улика, а не картинка. Эти записи несут значение символа, его грамматику, источники, употребления и переводы как отдельные типизированные утверждения \u2014 четыре истины: подлинность источника, историческая интерпретация, языковая эквивалентность, полномочие.',
 lv:'Simbols ir pierādījums, ne mākslas darbs. Šie ieraksti nes simbola nozīmi, gramatiku, avotus, lietojumus un tulkojumus kā atsevišķus, tipizētus apgalvojumus \u2014 četras patiesības: avota autentiskumu, vēsturisko interpretāciju, valodas ekvivalenci, pilnvaru.',
 th:'สัญลักษณ์คือหลักฐาน ไม่ใช่งานศิลป์ บันทึกเหล่านี้แยกความหมาย ลำดับพุทธศัพท์ แหล่งที่มา การใช้ และคำแปลของสัญลักษณ์ออกเป็นข้ออ้างที่จัดชนิดชัดเจน \u2014 สี่ความจริง: สาระแท้ของแหล่งที่มา ความเข้าใจเชิงประวัติศาสตร์ ความเท่ากันทางภาษา และอำนาจตามกฎหมาย',
 gd:'Tha samhla ’na fhianais, chan e obair-ealain. Tha na clàran seo a’ giùlan ciall na samhla, a gràmair, a tùsan, a cleachdadh agus a eadar-theangachaidhean mar thagraidhean sgarraichte, sòlraichte \u2014 na ceithir fìrinn: fìoranas an tùis, measadh eachdraidheil, co-ionannachd cànain, ùghdarras.',
 tt:'Символ \u2014 дәлил, рәсем түгел. Бу язмалар символның мәгънәсен, грамматикасын, чыганакларын, кулланылышын һәм тәрҗемәләрен аерым, типлаштырылган расламалар буларак ташый \u2014 дүрт хакыйкать: чыганакның ассылыгы, тарихи аңлатма, тел тигезлеге, вәкаләт.',
 uk:'Символ \u2014 це доказ, а не мистецтво. Ці записи несуть значення символу, його граматику, джерела, вжитки та переклади як окремі типізовані твердження \u2014 чотири істини: справжність джерела, історична інтерпретація, мовна еквівалентність, повноваження.',
 cs:'Symbol je důkaz, ne umělecké dílo. Tyto záznamy nesou význam symbolu, jeho gramatiku, prameny, užití a překlady jako oddělené, typované výroky \u2014 čtyři pravdy: pravost pramene, historická interpretace, jazyková rovnocennost, pravomoc.',
 zh:'符号是证据，不是艺术品。这些记录将符号的含义、语法、来源、用途与译本作为彼此独立、各有类型的断言来承载 \u2014 四种真实：来源真实性、历史解释、语言等价、法定权限。',
 ko:'기호는 증거이며 예술 작품이 아닙니다. 이 기록은 기호의 의미·문법·출처·용례·번역을 서로 분리된 유형화된 주장으로 담습니다 \u2014 네 가지 진실: 출처 진위성, 역사적 해석, 언어적 등가, 권한.',
 ar:'الرمز دليل، لا عمل فني. تحمل هذه السجلات معنى الرمز وقواعده ومصادره واستعمالاتها وترجماته كدعاوى منفصلة مصنَّفة \u2014 أربع حقائق: أصالة المصدر، والتفسير التاريخي، والتكافؤ اللغوي، والسلطة.',
 'nl-be':'Een symbool is bewijs, geen kunstwerk. Deze records dragen de betekenis, grammatica, bronnen, gebruiken en vertalingen van een symbool als afzonderlijke, getypeerde beweringen \u2014 de vier waarheden: bronauthenticiteit, historische interpretatie, taalequivalentie, bevoegdheid.',
 es:'Un símbolo es evidencia, no obra de arte. Estos registros llevan el significado de un símbolo, su gramática, fuentes, usos y traducciones como afirmaciones separadas y tipificadas \u2014 las cuatro verdades: autenticidad de la fuente, interpretación histórica, equivalencia lingüística, autoridad.',
 nl:'Een symbool is bewijs, geen kunstwerk. Deze records dragen de betekenis, grammatica, bronnen, gebruiken en vertalingen van een symbool als afzonderlijke, getypeerde beweringen \u2014 de vier waarheden: bronauthenticiteit, historische interpretatie, taalequivalentie, bevoegdheid.',
 de:'Ein Symbol ist ein Beweisstück, kein Kunstwerk. Diese Datensätze tragen Bedeutung, Grammatik, Quellen, Verwendungen und Übersetzungen eines Symbols als getrennte, typisierte Behauptungen \u2014 die vier Wahrheiten: Quellechtheit, historische Interpretation, Sprachäquivalenz, Befugnis.',
 fr:'Un symbole est une pièce à conviction, pas une \u0153uvre d\u2019art. Ces enregistrements portent le sens d\u2019un symbole, sa grammaire, ses sources, ses usages et ses traductions comme des affirmations distinctes et typées \u2014 les quatre vérités : authenticité de la source, interprétation historique, équivalence linguistique, autorité.',
 he:'סמל הוא ראיה, לא יצירת אמנות. הרשומות האלה נושאות את משמעות הסמל, הדקדוק שלו, המקורות, השימושים והתרגומים כטענות נפרדות ומסווגות \u2014 ארבע אמיתות: אותנטיות המקור, פרשנות היסטורית, שקילות לשונית, סמכות.',
 hi:'प्रतीक साक्ष्य है, कलाकृति नहीं। ये अभिलेख प्रतीक का अर्थ, व्याकरण, स्रोत, प्रयोग और अनुवादों को पृथक, वर्गीकृत दावों के रूप में वहन करते हैं \u2014 चार सत्य: स्रोत की प्रामाणिकता, ऐतिहासिक व्याख्या, भाषिक तुल्यता, प्राधिकार।',
 bn:'প্রতীক একটি প্রমাণ, শিল্পকর্ম নয়। এই নথিগুলি প্রতীকের অর্থ, ব্যাকরণ, উৎস, ব্যবহার ও অনুবাদকে পৃথক, শ্রেণিবদ্ধ দাবি হিসেবে বহন করে \u2014 চার সত্য: উৎসের প্রামাণিকতা, ঐতিহাসিক ব্যাখ্যা, ভাষাগত সমতুল্যতা, কর্তৃত্ব।',
 fa:'نماد یک مدرک است، نه اثر هنری. این رکوردها معنای نماد، دستور زبان، منابع، کاربردها و برگردان‌هایش را به‌صورت ادعاهای جدا و گونه‌بندی‌شده حمل می‌کنند \u2014 چهار حقیقت: اصالت منبع، تفسیر تاریخی، برابری زبانی، اقتدار.',
 ur:'نشان ایک ثبوت ہے، فن پارہ نہیں۔ یہ ریکارڈ نشان کے معنی، قواعد، ذرائع، استعمال اور ترجموں کو الگ، درجہ‌بند دعووں کے طور پر رکھتے کرتے ہیں \u2014 چار سچائیاں: ماخذ کی اصالت، تاریخی تعبیر، لسانی مساوات، اختیار۔',
 ja:'記章は証拠であって芸術品ではない。これらの記録は、記章の意味・文法・出典・用途・訳を、分離された型付きの主張として運ぶ \u2014 四つの真実：出典の真正性、歴史的解釈、言語的等価、権限。',
 da:'Et symbol er et bevis, ikke et kunstværk. Disse poster bærer et symbols betydning, grammatik, kilder, anvendelser og oversættelser som adskilte, typificerede påstande \u2014 de fire sandheder: kildeægthed, historisk fortolkning, sproglig ækvivalens, myndighed.',
 nb:'Et symbol er et bevis, ikke et kunstverk. Disse postene bærer et symbols betydning, grammatikk, kilder, bruksområder og oversettelser som adskilte, typifiserte påstander \u2014 de fire sannhetene: kildeekthet, historisk tolkning, språklig ekvivalens, myndighet.',
 sv:'En symbol är ett bevis, inte en konstverk. Dessa poster bär en symbols betydelse, grammatik, källor, användningar och översättningar som åtskilda, typifierade påståenden \u2014 de fyra sanningarna: källäkthet, historisk tolkning, språklig ekvivalens, behörighet.',
 fi:'Symboli on todiste, ei taideteos. Nämä tietueet kantavat symbolin merkityksen, kieliopin, lähteet, käyttötarkoitukset ja käännökset erillisinä, tyypitettyinä väitteinä \u2014 neljä totuutta: lähteen aitous, historiallinen tulkinta, kielellinen vastaavuus, valta.',
 tr:'Bir sembol kanıttır, sanat eseri değil. Bu kayıtlar bir sembolün anlamını, dil bilgisini, kaynaklarını, kullanımlarını ve çevirilerini ayrı, tiplendirilmiş savlar olarak taşır \u2014 dört gerçek: kaynak özgünlüğü, tarihsel yorum, dil denkliği, yetki.',
 hu:'A szimbólum bizonyíték, nem műalkotás. Ezek a bejegyzések a szimbólum jelentését, nyelvtanát, forrásait, használatát és fordításait külön, tipizált állításként hordozzák \u2014 négy igazság: a forrás hitelessége, történelmi értelmezés, nyelvi egyenértékűség, hatáskör.',
 sa:'प्रतीकः प्रमाणम् अस्ति, कलाकृतिः न। एते अभिलेखाः प्रतीकस्य अर्थं, व्याकरणम्, स्रोतानि, प्रयोगान्, अनुवादान् च पृथक् वर्गीकृतवदानि इति वहन्ति \u2014 चत्वारि सत्यानि: स्रोतस्य प्रामाणिकता, ऐतिहासिकव्याख्या, भाषासमता, प्राधिकारः।'
},
'bher.lede.data': {
 en:'Read-only. The data is bheraldry-records.json, generated from crates/bheraldry and digest-pinned to the code.',
 ru:'Только чтение. Данные \u2014 bheraldry-records.json, сгенерированные из crates/bheraldry и привязанные к коду дайджестом.',
 lv:'Tikai lasāms. Dati ir bheraldry-records.json, ģenerēti no crates/bheraldry un ar īssavilkumu piesaistīti kodam.',
 th:'อ่านอย่างเดียว ข้อมูลคือ bheraldry-records.json สร้างจาก crates/bheraldry และตรึงด้วยไดเจสต์กับโค้ด',
 gd:'Leughadh a-mhàin. ’S e bheraldry-records.json a th’ anns an dàta, air a ghintinn bho crates/bheraldry agus air a cheangal ris a’ chòd le gearradh-inneach.',
 tt:'Уку гына. Мәгълүмат \u2014 bheraldry-records.json, crates/bheraldry дан ясалган һәм дайджест белән кодка бәйләнгән.',
 uk:'Лише читання. Дані \u2014 bheraldry-records.json, згенеровані з crates/bheraldry і прив’язані до коду дайджестом.',
 cs:'Pouze ke čtení. Data jsou bheraldry-records.json, vygenerovaná z crates/bheraldry a připnutá ke kódu otiskem.',
 zh:'只读。数据是 bheraldry-records.json，由 crates/bheraldry 生成，并以摘要钉定到代码。',
 ko:'읽기 전용. 데이터는 bheraldry-records.json이며 crates/bheraldry에서 생성되어 다이제스트로 코드에 고정됩니다.',
 ar:'للقراءة فقط. البيانات هي bheraldry-records.json، مولَّدة من crates/bheraldry ومثبَّتة بالشيفرة عبر البصمة.',
 'nl-be':'Alleen lezen. De data is bheraldry-records.json, gegenereerd uit crates/bheraldry en met een digest aan de code vastgepind.',
 es:'Solo lectura. Los datos son bheraldry-records.json, generados desde crates/bheraldry y fijados al código por su resumen.',
 nl:'Alleen lezen. De data is bheraldry-records.json, gegenereerd uit crates/bheraldry en met een digest aan de code vastgepind.',
 de:'Nur Lesen. Die Daten sind bheraldry-records.json, erzeugt aus crates/bheraldry und per Prüfhash an den Code geheftet.',
 fr:'Lecture seule. Les données sont bheraldry-records.json, générées depuis crates/bheraldry et épinglées au code par leur condensat.',
 he:'קריאה בלבד. הנתונים הם bheraldry-records.json, שנוצרו מ\u2011crates/bheraldry ומוצמדים לקוד באמצעות תמצית.',
 hi:'केवल पठन। डेटा bheraldry-records.json है, crates/bheraldry से जनित और डाइजेस्ट द्वारा कोड से पिन किया हुआ।',
 bn:'শুধু পাঠযোগ্য। তথ্য হলো bheraldry-records.json, crates/bheraldry থেকে উৎপন্ন এবং ডাইজেস্ট দিয়ে কোডের সঙ্গে আবদ্ধ।',
 fa:'فقط‌خواندنی. داده‌ها bheraldry-records.json است، تولیدشده از crates/bheraldry و با چکیده به کد سنجاق شده.',
 ur:'صرف پڑھنے کے لیے۔ ڈیٹا bheraldry-records.json ہے، crates/bheraldry سے تیار شدہ اور ڈائجسٹ کے ذریعے کوڈ سے پن شدہ۔',
 ja:'読み取り専用。データは bheraldry-records.json で、crates/bheraldry から生成され、ダイジェストによりコードに固定されている。',
 da:'Kun læsning. Data er bheraldry-records.json, genereret fra crates/bheraldry og digest-fastgjort til koden.',
 nb:'Kun lesing. Dataene er bheraldry-records.json, generert fra crates/bheraldry og digest-festet til koden.',
 sv:'Endast läsning. Data är bheraldry-records.json, genererad från crates/bheraldry och digestfästad vid koden.',
 fi:'Vain luku. Data on bheraldry-records.json, luotu kohteesta crates/bheraldry ja kiinnitetty tiivisteellä koodiin.',
 tr:'Salt okunur. Veri, crates/bheraldry kaynağından üretilen ve özetle koda sabitlenen bheraldry-records.json dosyasıdır.',
 hu:'Csak olvasás. Az adat a bheraldry-records.json, a crates/bheraldryból előállítva és kivonattal a kódhoz rögzítve.',
 sa:'केवलं पठनम्। दत्तांशः bheraldry-records.json अस्ति, crates/bheraldry तः उत्पन्नः, डाइजेस्ट्\u2011द्वारा सङ्केतस्य प्रति अधिपितः।'
},
'bher.banner.p': {
 en:'A research and conformance specimen. Not government endorsement. Not reproduction rights: reproducing elements of the Bulgarian arms requires an act of the Council of Ministers (Чл.&nbsp;3&nbsp;(2)). Unofficial translations are visibly marked machine drafts (⚙, unattested). No living person is named \u2014 living subjects are pseudonyms by law.',
 ru:'Исследовательский образец для проверки соответствия. Не государственная поддержка. Не права на воспроизведение: воспроизведение элементов болгарского герба требует акта Совета министров (Чл. 3 (2)). Неофициальные переводы видимо помечены как машинные черновики (⚙, не заверены). Имена живых людей не называются \u2014 живые субъекты по закону псевдонимы.',
 lv:'Pētniecības un atbilstības paraugs. Ne valdības atbalstījums. Ne atražošanas tiesības: Bulgārijas ģerboņa elementu atražošanai vajadzīgs Ministru kabineta akts (Чл. 3 (2)). Neoficiālie tulkojumi redzami atzīmēti kā mašīnraksta melnraksti (⚙, nepārbaudīti). Neviens dzīvs cilvēks netiek nosaukts \u2014 dzīvi subjekti pēc likuma ir pseidonīmi.',
 th:'ตัวอย่างเพื่อการวิจัยและการตรวจสอบการปฏิบัติตาม ไม่ใช่การรับรองจากรัฐบาล ไม่ใช่สิทธิ์ในการทำซ้ำ: การทำซ้ำองค์ประกอบของตราแผ่นดินบัลแกเรียต้องมีมติคณะรัฐมนตรี (Чл. 3 (2)) คำแปลที่ไม่เป็นทางการถูกทำเครื่องหมายอย่างเห็นได้ว่าเป็นฉบับร่างจากเครื่อง (⚙ ไม่ผ่านการรับรอง) ไม่มีการระบุชื่อบุคคลที่ยังมีชีวิต \u2014 ผู้ที่ยังมีชีวิตใช้นามแฝงตามกฎหมาย',
 gd:'Sampl rannsachaidh agus co-fhreagairt. Chan aontachadh riaghaltas. Chan còir ath-ghin: feumairt gnìomh bho Chomhairle nam Ministearan gus earrannan de chòir-ghràis na Bulgaire ath-ghin (Чл. 3 (2)). Tha eadar-theangachaidhean neo-oifigeil comharraichte gu follais mar dhràobhairean inneil (⚙, gun dearbhadh). Chan eil duine beò air ainmeachadh \u2014 ’s e sloinnidhean a th’ ann an còmhraidhean beò a-rèir an lagh.',
 tt:'Тикшерү һәм туры килү үрнәге. Хөкүмәт хуплавы түгел. Яңадан чыгару хокукы түгел: Болгар гербы элементларын яңадан чыгару өчен Министрлар Кабинеты акты кирәк (Чл. 3 (2)). Рәсми булмаган тәрҗемәләр күренеп тора торган машина караламалары дип билгеләнгән (⚙, расланмаган). Тере кеше исеме аталмый \u2014 тере затлар закон буенча псевдонимнар.',
 uk:'Дослідний зразок для перевірки відповідності. Не схвалення уряду. Не права на відтворення: відтворення елементів болгарського герба потребує акта Ради міністрів (Чл. 3 (2)). Неофіційні переклади видимо позначені як машинні чернетки (⚙, не засвідчені). Жодна жива особа не названа \u2014 живі суб’єкти за законом є псевдонімами.',
 cs:'Výzkumný a konformní vzorek. Ne schválení vládou. Ne práva k rozmnožování: rozmnožování prvků bulgarského znaku vyžaduje akt Rady ministrů (Чл. 3 (2)). Neoficiální překlady jsou viditelně označeny jako strojové koncepty (⚙, neověřeno). Žádná žijící osoba není jmenována \u2014 žijící subjekty jsou ze zákona pseudonymy.',
 zh:'研究与合规验证的样本。并非政府背书。并非复制权：复制保加利亚国徽的元素需要部长会议的法令（Чл. 3 (2)）。非官方译本均醒目标注为机译草稿（⚙，未经证明）。不点名任何在世者 \u2014 依法律，在世主体一律使用化名。',
 ko:'연구 및 적합성 견본입니다. 정부의 승인이 아닙니다. 복제권이 아닙니다: 불가리아 국장의 요소를 복제하려면 각료회의의 결정이 필요합니다(Чл. 3 (2)). 비공식 번역은 기계 초안(⚙, 미입증)으로 눈에 띄게 표시됩니다. 생존자는 이름을 밝히지 않습니다 \u2014 법에 따라 생존 주체는 가명입니다.',
 ar:'نموذج بحثي ولمطابقة المواصفات. ليس تأييدًا حكوميًا. وليس حق إعادة الإنتاج: إعادة إنتاج عناصر شعار بلغاريا تتطلب قرارًا من مجلس الوزراء (Чл. 3 (2)). الترجمات غير الرسمية معلَّمة بشكل مرئي كمسودات آلية (⚙، غير موثَّقة). لا يُذكر اسم أي شخص حي \u2014 فالأحياء أسماء مستعارة بحكم القانون.',
 'nl-be':'Een onderzoeks- en conformiteitsspecimen. Geen regeringsgoedkeuring. Geen reproductierechten: het reproduceren van elementen van het Bulgaarse wapen vereist een akte van de Ministerraad (Чл. 3 (2)). Niet-officiële vertalingen zijn zichtbaar gemarkeerd als machineteksten (⚙, niet-geattesteerd). Er wordt geen levende persoon genoemd \u2014 levende subjects zijn bij wet pseudoniemen.',
 es:'Un espécimen de investigación y conformidad. No es aval gubernamental. No son derechos de reproducción: reproducir elementos del escudo búlgaro requiere un acto del Consejo de Ministros (Чл. 3 (2)). Las traducciones no oficiales están visiblemente marcadas como borradores de máquina (⚙, sin atestar). No se nombra a ninguna persona viva \u2014 los sujetos vivos son seudónimos por ley.',
 nl:'Een onderzoeks- en conformiteitsspecimen. Geen regeringsgoedkeuring. Geen reproductierechten: het reproduceren van elementen van het Bulgaarse wapen vereist een akte van de Ministerraad (Чл. 3 (2)). Niet-officiële vertalingen zijn zichtbaar gemarkeerd als machineteksten (⚙, niet-geattesteerd). Er wordt geen levende persoon genoemd \u2014 levende subjecten zijn bij wet pseudoniemen.',
 de:'Ein Forschungs- und Konformitätsmuster. Keine staatliche Billigung. Keine Vervielfältigungsrechte: Die Vervielfältigung von Elementen des bulgarischen Wappens erfordert einen Akt des Ministerrats (Чл. 3 (2)). Inoffizielle Übersetzungen sind sichtbar als Maschinenentwürfe markiert (⚙, unbezeugt). Keine lebende Person wird namentlich genannt \u2014 lebende Subjekte sind per Gesetz Pseudonyme.',
 fr:'Un spécimen de recherche et de conformité. Ni approbation gouvernementale, ni droits de reproduction : reproduire des éléments des armes bulgares exige un acte du Conseil des ministres (Чл. 3 (2)). Les traductions non officielles sont visiblement marquées comme brouillons machine (⚙, non attestés). Aucune personne vivante n\u2019est nommée \u2014 les sujets vivants sont des pseudonymes par la loi.',
 he:'פריט מחקר והתאמה. אינו תמיכה ממשלתית. אינו זכויות שעתוק: שעתוק יסודות סמל בולגריה דורש החלטה של מועצת השרים (Чл. 3 (2)). תרגומים בלתי־רשמיים מסומנים באופן נראה כטיוטות מכונה (⚙, ללא אישוש). שום אדם חי אינו נקרא בשם \u2014 סובייקטים חיים הם פסבדונימים על פי חוק.',
 hi:'एक शोध एवं अनुरूपता नमूना। यह सरकारी समर्थन नहीं है। यह पुनरुत्पादन अधिकार नहीं है: बुल्गारियाई राजचिह्न के तत्वों का पुनरुत्पादन मंत्रिपरिषद के अधिनियम की अपेक्षा रखता है (Чл. 3 (2))। अनौपचारिक अनुवाद स्पष्ट रूप से मशीनी ड्राफ्ट (⚙, अप्रमाणित) चिह्नित हैं। किसी जीवित व्यक्ति का नाम नहीं लिया गया \u2014 विधि से जीवित विषय छद्मनाम हैं।',
 bn:'একটি গবেষণা ও সঙ্গতিমূলক নমুনা। এটি সরকারি সমর্থন নয়। এটি পুনরুৎপাদনের অধিকার নয়: বুলগেরিয়ার কোট-অব-আর্মসের উপাদান পুনরুৎপাদনে মন্ত্রিপরিষদের একটি আইন প্রয়োজন (Чл. 3 (2))। অনানুষ্ঠানিক অনুবাদগুলি দৃশ্যমানভাবে যন্ত্র-খসড়া (⚙, অপ্রমাণিত) হিসেবে চিহ্নিত। কোনো জীবিত ব্যক্তির নাম নেই \u2014 আইন অনুযায়ী জীবিত বিষয় ছদ্মনাম।',
 fa:'نمونه‌ای پژوهشی و انطباق. نه تأیید دولتی. نه حق تکثیر: تکثیر عناصر نشان بلغارستان نیازمند مصوبه شورای وزیران است (Чл. 3 (2)). برگردان‌های غیررسمی به‌روشنی به‌عنوان پیش‌نویس ماشینی (⚙، بی‌گواه) نشانه‌گذاری شده‌اند. نام هیچ فرد زنده‌ای ذکر نمی‌شود \u2014 بر پایه قانون، اشخاص زنده نام‌مستعارند.',
 ur:'تحقیق اور مطابقت کا نمونہ۔ حکومتی توثیق نہیں۔ تولید کا حق نہیں: بلغاریائی شعار کے عناصر کی نقل کے لیے کابینہِ وزراء کا فعل درکار ہے (Чл. 3 (2))۔ غیرسرکاری ترجمے نمایاں طور پر مشینی مسودے (⚙، غیرتصدیق شدہ) کے طور پر نشان زد ہیں۔ کسی زندہ شخص کا نام نہیں لیا گیا \u2014 قانون کے تحت زندہ اشخاص نام۔',
 ja:'研究および適合性の標本である。政府の承認ではない。複製権でもない：ブルガリアの国章の要素を複製するには閣議の決定が必要である（Чл. 3 (2)）。非公式の翻訳は機械翻訳の草稿（⚙、未検証）として目に見える形で表示される。存命の個人を名指ししない \u2014 存命の主体は法律上仮名である。',
 da:'En forsknings- og konformitetsspecimen. Ikke statslig tilslutning. Ikke gengivelsesrettigheder: gengivelse af elementer fra Bulgariens våben kræver en handling fra Ministerrådet (Чл. 3 (2)). Uofficielle oversættelser er synligt markeret som maskineudkast (⚙, uattesteret). Ingen levende person nævnes \u2014 levende subjekter er ifølge loven pseudonymer.',
 nb:'Et forsknings- og konformitetsspecimen. Ikke statlig godkjenning. Ikke gjengivelsesrettigheter: gjengivelse av elementer fra Bulgarias våpen krever et vedtak fra Ministerrådet (Чл. 3 (2)). Uoffisielle oversettelser er synlig merket som maskinutkast (⚙, uattestert). Ingen levende person navngis \u2014 levende subjekter er ifølge loven pseudonymer.',
 sv:'Ett forsknings- och konformitetsspecimen. Inte ett statligt godkännande. Inte reproduktionsrättigheter: reproduktion av element från Bulgariens vapen kräver ett beslut från ministerrådet (Чл. 3 (2)). Inofficiella översättningar är synligt markerade som maskinutkast (⚙, oattesterade). Ingen levande person nämns \u2014 levande subjekt är enligt lag pseudonymer.',
 fi:'Tutkimus- ja vaatimustenmukaisuusnäyte. Ei valtion hyväksyntä. Ei jäljentämisoikeuksia: Bulgarian vaakunan elementtien jäljentäminen vaatii ministerineuvoston päätöksen (Чл. 3 (2)). Epäviralliset käännökset on näkyvästi merkitty koneluonnoksiksi (⚙, todentamattomiksi). Yhtään elossa olevaa henkilöä ei mainita nimeltä \u2014 elävät henkilöt ovat lain mukaan peitenimiä.',
 tr:'Bir araştırma ve uygunluk örneği. Hükûmet onayı değildir. Çoğaltma hakkı değildir: Bulgar armasının öğelerinin çoğaltılması Bakanlar Kurulu kararı gerektirir (Чл. 3 (2)). Resmî olmayan çeviriler görünür biçimde makine taslağı (⚙, doğrulanmamış) olarak işaretlenmiştir. Hiçbir yaşayan kişi adıyla anılmaz \u2014 yasaya göre yaşayan kişiler takma adlıdır.',
 hu:'Kutatási és megfelelőségi minta. Nem kormányzati jóváhagyás. Nem sokszorozási jogok: a bolgár címer elemeinek sokszorozása a Minisztertanács aktust igényel (Чл. 3 (2)). A nem hivatalos fordítások láthatóan gépi vázlatként (⚙, tanúsítatlan) vannak jelölve. Élő személyt nem nevezünk meg \u2014 az élő alanyok jog szerint álnévvel szerepelnek.',
 sa:'अनुसन्धान\u2011अनुरूपता\u2011निदर्शनम्। न सर्वकारसमर्थनम्। न पुनरुत्पादन\u2011अधिकारः: बल्गेरियालिङ्गचिह्नस्य तत्त्वानां पुनरुत्पादनाय मन्त्रिपरिषद्कृत्यम् अपेक्ष्यते (Чл. 3 (2))। अनाधिकृतानुवादाः दृश्यतः यन्त्रलेखनानि (⚙, असम्प्रमाणितानि) इति चिह्नितानि। न कस्यापि जीवतः नाम उच्यते \u2014 विधिना जीवन्तः विषयाः छद्मनामानि सन्ति।'
},
'bher.footer.p': {
 en:"External links (lex.bg, government.bg, Wikipedia, dv.parliament.bg) open in a new tab; same-estate pages stay in this one. Record digests are sha256(bheraldry/record/1 \u2016 canonical bytes) \u2014 verify before trusting. Integrity of these renderings lives in the crate's tests, not in this page's paint.",
 ru:'Внешние ссылки (lex.bg, government.bg, Wikipedia, dv.parliament.bg) открываются в новой вкладке; страницы поместья остаются в этой. Дайджесты записей \u2014 sha256(bheraldry/record/1 \u2016 канонические байты) \u2014 проверяйте, прежде чем доверять. Целостность этих отрисовок живёт в тестах контейнера, а не в краске этой страницы.',
 lv:'Ārējās saites (lex.bg, government.bg, Wikipedia, dv.parliament.bg) atveras jaunā cilnē; tā paša īpašuma lapas paliek šajā. Ierakstu īssavilkumi ir sha256(bheraldry/record/1 \u2016 kanoniskie baiti) \u2014 pārbaudiet pirms uzticēšanās. Šo attēlojumu integritāte mīt crate testos, nevis šīs lapas krāsā.',
 th:'ลิงก์ภายนอก (lex.bg, government.bg, Wikipedia, dv.parliament.bg) เปิดในแท็บใหม่ หน้าของเอสเตทเดียวกันอยู่ในแท็บนี้ ไดเจสต์ของระเบียนคือ sha256(bheraldry/record/1 \u2016 canonical bytes) \u2014 ตรวจสอบก่อนเชื่อถือ ความถูกต้องของการแสดงผลเหล่านี้อยู่ในการทดสอบของ crate ไม่ใช่ในหน้านี้',
 gd:'Fosgail ceanglaichean air an taobh a-muigh (lex.bg, government.bg, Wikipedia, dv.parliament.bg) ann an taba ùr; thig duilleagan an eastàit fhèin fhathast san tè seo. ’S e sha256(bheraldry/record/1 \u2016 bytes cananach) a th’ ann an gearraidhean-inneach nan clàr \u2014 dearbhaich mus earb thu. Tha slàineachd nan riochdachaidhean seo ann an deuchainnean a’ chràit, chan ann am peant na duilleige seo.',
 tt:'Тышкы сылтамалар (lex.bg, government.bg, Wikipedia, dv.parliament.bg) яңа өстәмә ачыла; шул ук утар битләре монда кала. Язма дайджестлары \u2014 sha256(bheraldry/record/1 \u2016 каноник байтлар) \u2014 ышаныч алдыннан тикшерегез. Бу күрсәтүләрнең бөтенлеге crate тестларында яши, бу бит буяуларында түгел.',
 uk:'Зовнішні посилання (lex.bg, government.bg, Wikipedia, dv.parliament.bg) відкриваються в новій вкладці; сторінки маєтку лишаються в цій. Дайджести записів \u2014 sha256(bheraldry/record/1 \u2016 канонічні байти) \u2014 перевіряйте, перш ніж довірити. Цілісність цих відображень живе в тестах контейнера, а не у фарбі цієї сторінки.',
 cs:'Externí odkazy (lex.bg, government.bg, Wikipedia, dv.parliament.bg) se otevírají v nové kartě; stránky stejného panství zůstávají v této. Otisky záznamů jsou sha256(bheraldry/record/1 \u2016 kanonické bajty) \u2014 ověřte, než věříte. Integrita těchto vykreslení žije v testech crate, ne v barvě této stránky.',
 zh:'外部链接（lex.bg、government.bg、Wikipedia、dv.parliament.bg）在新标签页打开；同园区的页面留在本页。记录摘要为 sha256(bheraldry/record/1 \u2016 规范字节) \u2014 信任之前请先验证。这些渲染的完整性存活于 crate 的测试之中，而非本页的绘制。',
 ko:'외부 링크(lex.bg, government.bg, Wikipedia, dv.parliament.bg)는 새 탭에서 열리고, 같은 에스테이트의 페이지는 이 탭에 남습니다. 기록 다이제스트는 sha256(bheraldry/record/1 \u2016 정규 바이트)입니다 \u2014 신뢰하기 전에 검증하십시오. 이 렌더링의 무결성은 이 페이지의 칠이 아니라 crate의 테스트에 삽니다.',
 ar:'تفتح الروابط الخارجية (lex.bg، government.bg، Wikipedia، dv.parliament.bg) في تبويب جديد؛ وتبقى صفحات الإيستيت نفسها في هذا التبويب. بصمات السجلات هي sha256(bheraldry/record/1 \u2016 بايتات قياسية) \u2014 تحقَّق قبل الثقة. سلامة هذه العروض تعيش في اختبارات الصندوق، لا في طلاء هذه الصفحة.',
 'nl-be':'Externe links (lex.bg, government.bg, Wikipedia, dv.parliament.bg) openen in een nieuw tabblad; pagina\u2019s van hetzelfde domein blijven in dit tabblad. Recorddigests zijn sha256(bheraldry/record/1 \u2016 canonieke bytes) \u2014 verifieer vóór je vertrouwt. De integriteit van deze weergaven leeft in de tests van de crate, niet in de verf van deze pagina.',
 es:'Los enlaces externos (lex.bg, government.bg, Wikipedia, dv.parliament.bg) se abren en una pestaña nueva; las páginas del mismo dominio permanecen en esta. Los resúmenes de los registros son sha256(bheraldry/record/1 \u2016 bytes canónicos) \u2014 verifica antes de confiar. La integridad de estas representaciones vive en las pruebas del crate, no en la pintura de esta página.',
 nl:'Externe links (lex.bg, government.bg, Wikipedia, dv.parliament.bg) openen in een nieuw tabblad; pagina\u2019s van hetzelfde domein blijven in dit tabblad. Recorddigests zijn sha256(bheraldry/record/1 \u2016 canonieke bytes) \u2014 verifieer vóór je vertrouwt. De integriteit van deze weergaven leeft in de tests van de crate, niet in de verf van deze pagina.',
 de:'Externe Links (lex.bg, government.bg, Wikipedia, dv.parliament.bg) öffnen sich in einem neuen Tab; Seiten desselben Anwesens bleiben in diesem. Datensatz-Prüfhashes sind sha256(bheraldry/record/1 \u2016 kanonische Bytes) \u2014 prüfe, bevor du vertraust. Die Integrität dieser Darstellungen lebt in den Tests des Crates, nicht im Anstrich dieser Seite.',
 fr:'Les liens externes (lex.bg, government.bg, Wikipedia, dv.parliament.bg) s\u2019ouvrent dans un nouvel onglet ; les pages du même domaine restent dans celui-ci. Les condensats des enregistrements sont sha256(bheraldry/record/1 \u2016 octets canoniques) \u2014 vérifiez avant de faire confiance. L\u2019intégrité de ces rendus vit dans les tests du crate, pas dans la peinture de cette page.',
 he:'קישורים חיצוניים (lex.bg, government.bg, Wikipedia, dv.parliament.bg) נפתחים בלשונית חדשה; עמודי אותו מתחם נשארים בזו. תמציות הרשומות הן sha256(bheraldry/record/1 \u2016 בתים קנוניים) \u2014 אמת לפני שאתה סומך. שלמות התצוגות האלה חיה בבדיקות ה\u2011crate, לא בצבע של הדף הזה.',
 hi:'बाहरी कड़ियाँ (lex.bg, government.bg, Wikipedia, dv.parliament.bg) नए टैब में खुलती हैं; उसी एस्टेट के पृष्ठ इसी टैब में रहते हैं। अभिलेख डाइजेस्ट हैं sha256(bheraldry/record/1 \u2016 कैननिकल बाइट्स) \u2014 भरोसा करने से पहले सत्यापित करें। इन प्रतिपादनों की अखंडता crate के परीक्षणों में बसती है, इस पृष्ठ के रंग में नहीं।',
 bn:'বাহ্যিক লিংকগুলি (lex.bg, government.bg, Wikipedia, dv.parliament.bg) নতুন ট্যাবে খোলে; একই এস্টেটের পাতাগুলি এই ট্যাবেই থাকে। নথির ডাইজেস্ট হলো sha256(bheraldry/record/1 \u2016 ক্যাননিক্যাল বাইট) \u2014 বিশ্বাস করার আগে যাচাই করুন। এই উপস্থাপনাগুলির অখণ্ডতা crate-এর পরীক্ষায় বাস করে, এই পাতার রঙে নয়।',
 fa:'پیوندهای بیرونی (lex.bg، government.bg، Wikipedia، dv.parliament.bg) در برگهٔ تازه باز می‌شوند؛ صفحه‌های همان ملک در همین برگه می‌مانند. چکیدهٔ رکوردها sha256(bheraldry/record/1 \u2016 بایت‌های قاعده‌مند) است \u2014 پیش از اعتماد بسنجید. همه‌چیزِ این نمایش‌ها در آزمون‌های crate زیست می‌کند، نه در رنگ این صفحه.',
 ur:'بیرونی روابط (lex.bg، government.bg، Wikipedia، dv.parliament.bg) نئے ٹیب میں کھلتے ہیں؛ اسی اسٹیٹ کے صفحات اسی ٹیب میں رہتے ہیں۔ ریکارڈ کے ڈائجسٹس sha256(bheraldry/record/1 \u2016 معیاری بائٹس) ہیں \u2014 بھروسے سے پہلے تصدیق کریں۔ ان عکسیوں کی سالمیت crate کے ٹیسٹوں میں رہتی ہے، اس صفحے کی رنگت میں نہیں۔',
 ja:'外部リンク（lex.bg、government.bg、Wikipedia、dv.parliament.bg）は新しいタブで開く。同じエステートのページはこのタブに留まる。記録のダイジェストは sha256(bheraldry/record/1 \u2016 正規バイト列) \u2014 信頼する前に検証せよ。これらの描画の完全性はこのページの描画ではなく、crateのテストに宿る。',
 da:'Eksterne links (lex.bg, government.bg, Wikipedia, dv.parliament.bg) åbner i et nyt faneblad; sider fra samme domæne bliver i dette. Post-digests er sha256(bheraldry/record/1 \u2016 kanoniske bytes) \u2014 verificér, før du stoler på dem. Disse gengivelsers integritet lever i cratens tests, ikke i denne sides maling.',
 nb:'Eksterne lenker (lex.bg, government.bg, Wikipedia, dv.parliament.bg) åpnes i en ny fane; sider fra samme domene blir i denne. Post-digester er sha256(bheraldry/record/1 \u2016 kanoniske bytes) \u2014 verifiser før du stoler på dem. Disse fremstillingenes integritet lever i cratens tester, ikke i denne sidens maling.',
 sv:'Externa länkar (lex.bg, government.bg, Wikipedia, dv.parliament.bg) öppnas i en ny flik; sidor från samma domän blir kvar i denna. Post-digests är sha256(bheraldry/record/1 \u2016 kanoniska bytes) \u2014 verifiera innan du litar på dem. Dessa återgivningars integritet lever i cratens tester, inte i denna sidas färg.',
 fi:'Ulkoiset linkit (lex.bg, government.bg, Wikipedia, dv.parliament.bg) avautuvat uuteen välilehteen; saman tilin sivut pysyvät tässä. Tietueiden tiivisteet ovat sha256(bheraldry/record/1 \u2016 kanoniset tavut) \u2014 varmista ennen luottamista. Näiden esitysten eheys elää craten testeissä, ei tämän sivun maalissa.',
 tr:'Dış bağlantılar (lex.bg, government.bg, Wikipedia, dv.parliament.bg) yeni sekmede açılır; aynı mâlkın sayfaları bu sekmede kalır. Kayıt özetleri sha256(bheraldry/record/1 \u2016 kurallı baytlar) biçimindedir \u2014 güvenmeden önce doğrulayın. Bu gösterimlerin bütünlüğü bu sayfanın boyasında değil, crate\u2019in testlerinde yaşar.',
 hu:'A külső hivatkozások (lex.bg, government.bg, Wikipedia, dv.parliament.bg) új lapon nyílnak meg; ugyanazon birtok oldalai ezen a lapon maradnak. A bejegyzések kivonatai sha256(bheraldry/record/1 \u2016 kanonikus bájtok) \u2014 ellenőrizzen, mielőtt bízik. E megjelenítések épsége a crate tesztjeiben él, nem e lap festékében.',
 sa:'बाह्यसम्बन्धाः (lex.bg, government.bg, Wikipedia, dv.parliament.bg) नवे ट्याब्\u2011मध्ये उद्घाट्यन्ते; एतस्यैव एस्टेट्\u2011पृष्ठानि अत्रैव तिष्ठन्ति। अभिलेखस्य डाइजेस्ट् \u2014 sha256(bheraldry/record/1 \u2016 सुविहितबैट्स्) \u2014 विश्वासात् पूर्वं परीक्षस्व। एतेषां प्रतिपादनानां अखण्डता crate\u2011परीक्षासु वसति, अस्य पृष्ठस्य रञ्जने न।'
}
};

// ── the writer ─────────────────────────────────────────────────────────────────
const corpus = JSON.parse(readFileSync(CORPUS, 'utf8'));
const strings = corpus.strings;

for (const key of Object.keys(TBL)) {
  const cells = TBL[key];
  const missing = LANGS.filter(l => typeof cells[l] !== 'string' || !cells[l].trim());
  if (missing.length) {
    console.error(`REFUSING: key ${key} misses docked tongues: ${missing.join(',')}`);
    process.exit(1);
  }
  if (typeof cells.en !== 'string' || !cells.en.trim()) {
    console.error(`REFUSING: key ${key} misses the English source cell`);
    process.exit(1);
  }
}

let touched = 0;
for (const [key, cells] of Object.entries(TBL)) {
  if (!strings[key] || JSON.stringify(strings[key]) !== JSON.stringify(cells)) touched++;
  strings[key] = cells;
}

const out = JSON.stringify(corpus, null, 1) + '\n';
writeFileSync(CORPUS, out, 'utf8');
console.log(`bheraldry-corpus: ${Object.keys(TBL).length} keys × ${LANGS.length + 1} tongues checked; ${touched} inserted/refreshed; all other keys preserved.`);
