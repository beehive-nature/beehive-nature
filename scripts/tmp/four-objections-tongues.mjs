// four-objections-tongues.mjs — real LV + RU translations over the en-fill
// (the K3 birth convention: key tongues authored, the rest honest en-fill).
// Author-reviewable strings; the estate-source gate pins EN to the page bytes.
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'surfaces/lang-corpus.json';
const c = JSON.parse(readFileSync(f, 'utf8'));

const LV = {
  'hub.four.kicker': 'četri iebildumi, atbildēti jau uzbūvē',
  'hub.four.title': 'kas attur cilvēkus — un ko mēs uzbūvējām par to',
  'hub.four.intro': 'pašas autonomi kopienā nosauca četrus iemeslus, kāpēc cilvēki vilcinās. imeniešu atbilde uz katru ir uzbūve, nevis solījums — un atbildes rakstītas uz durvīm.',
  'hub.four.q1': 'vai es gribu, lai tas paliek mūžīgi?',
  'hub.four.a1': 'arweave saglabā to, ko izvēlies mūžīgi; autonomi glabā to, ko izvēlies, privāti — un izdzēšami. divas glabātavas, tavs lēmums par katru ierakstu.',
  'hub.four.a1.bee': 'tava aģenta dzimšanas apliecība dzīvo arweave — mūžīga pēc fizikas, nevis solījuma. tavi ikdienas faili dzīvo autonomi — privāti, un pazūd dienā, kad tos dzēš.',
  'hub.four.a1.raver': 'ieraksts, ko gribi mūžīgi, paliek mūžīgi. pašportrēti, ko negribi? pazūd, kad spiež dzēst. neviena glabātava neaiztur abus ķīlā.',
  'hub.four.a1.cypher': 'mūžīgums ir katra ieraksta īpašība: arweave — tavai kvītij, autonomi — mainīgajai sevis daļai. ieslodzījums prasa nemainīgumu — dzēšana paliek pilnvērtīgs darbības vārds.',
  'hub.four.q2': 'vai uzticētu viņam savus persondatus?',
  'hub.four.a2': 'šifrēts ar TAVU atslēgu vēl ierīcē — savienība glabā aizslēgtas kastītes, nevis atslēgas.',
  'hub.four.a2.bee': 'tavi faili tiek aizslēgti ar TAVU atslēgu pirms došanas ceļā. savienība tos var glabāt; atvērt — nekad.',
  'hub.four.a2.raver': 'mēs uzbūvējām skapīti. tavas atslēgas kopijas mums nekad nav bijis. tāpēc skapītis vispār ir.',
  'hub.four.a2.cypher': 'šifrēšana klienta pusē ar atslēgām, kuras savienība neredz; glabātavā ir šifrs un minimālas norādes. uzticēšanās nav vajadzīga — pārbaudāmība ir.',
  'hub.four.q3': 'mans telefons jau bez maksas veido rezerves kopijas — kur pieteikšanās no jebkuras ierīces?',
  'hub.four.a3': 'viena uzstādīšana, tavs pats vārds (.b), jebkura ierīce — tavs seko vārdam, ne mašīnai.',
  'hub.four.a3.bee': 'uzstādi vienreiz, paņem savu .b vārdu, pieraksties ar to jebkur. jauns telefons? tas pats vārds — viss vēl tavs.',
  'hub.four.a3.raver': 'tavs vārds ir tava pieteikšanās — tā pati istaba, tā pati komanda, tie paši faili no jebkura telefona. nekā jauna konta katrai lietotnei.',
  'hub.four.a3.cypher': '.b vārds ir suverēna norāde: atslēgas tevī, vārds tavs, sesijas visur — ieeja no jebkur bez identitātes starpnieka.',
  'hub.four.q4': 'grāmatot katru kripto darījumu nodokļiem ir moka.',
  'hub.four.a4': 'mērītājs izsniedz kvīti katrai tēriņarei — un nodokļa daļu atliek tevis labā pa ceļam.',
  'hub.four.a4.bee': 'katra tēriņa uzdrukā savu kvīti, un nodokļa daļa tiek atlikta automātiski. aprīļa tu pateiksies.',
  'hub.four.a4.raver': 'nekādu tabelīšu elli. māja vada grāmatas un atliek nodokļa daļu, kamēr tu tērē.',
  'hub.four.a4.cypher': 'mērītājs izdod parakstītas kvītis resursu vienībās par katru tēriņu; saistība uzkrājas rezervē brīdī, kad tērē — pārbaudāmība bez grāmatveža ciešanām.'
};

const RU = {
  'hub.four.kicker': 'четыре возражения — ответы заложены в конструкцию',
  'hub.four.title': 'что останавливает людей — и что мы для этого построили',
  'hub.four.intro': 'само сообщество autonomi назвало четыре причины сомнений. имение отвечает на каждую устройством, а не обещанием — и пишет ответы на двери.',
  'hub.four.q1': 'хочу ли я, чтобы это осталось навсегда?',
  'hub.four.a1': 'arweave хранит выбранное навсегда; autonomi хранит выбранное приватно — и стираемо. два хранилища, решаешь ты для каждой записи.',
  'hub.four.a1.bee': 'свидетельство о рождении агента живёт в arweave — навсегда по физике, а не по обещанию. повседневные файлы живут в autonomi — приватно, и исчезают в день удаления.',
  'hub.four.a1.raver': 'микстейп, который хочешь навсегда, останется навсегда. селфи, которые не нужны, исчезают по кнопке. ни одно хранилище не держит оба в заложниках.',
  'hub.four.a1.cypher': 'неизменяемость — свойство отдельной записи: arweave для квитанции о тебе, autonomi для меняющейся себя. плен требует неизменности — удаление остаётся полноценным глаголом.',
  'hub.four.q2': 'доверяю ли я ему личные данные?',
  'hub.four.a2': 'шифруется твоим ключом ещё на устройстве — имение хранит закрытые ящики, но не ключи.',
  'hub.four.a2.bee': 'файлы запираются ТВОИМ ключом до того, как уйдут в путь. имение может их хранить — открыть не может.',
  'hub.four.a2.raver': 'мы построили ящик. копии ключа у нас никогда не было. в этом весь смысл ящика.',
  'hub.four.a2.cypher': 'клиентское шифрование ключами, которых имение не видит; хранилище держит шифротекст и минимум указателей. доверие не нужно — нужна проверяемость.',
  'hub.four.q3': 'мой телефон и так бесплатно делает резервные копии — где вход откуда угодно?',
  'hub.four.a3': 'одна установка, твоё собственное имя (.b), любое устройство — твоё следует за именем, а не за машиной.',
  'hub.four.a3.bee': 'установи один раз, займи имя .b, входи с ним где угодно. новый телефон? то же имя — всё по-прежнему твоё.',
  'hub.four.a3.raver': 'имя и есть логин — та же комната, та же команда, те же файлы с любого телефона. никакого нового аккаунта на каждое приложение.',
  'hub.four.a3.cypher': 'имя .b — самодержавный указатель: ключи у тебя, имя твоё, сессии где угодно — вход откуда угодно без провайдера личности.',
  'hub.four.q4': 'отслеживать каждую крипто-транзакцию ради налогов — мучение.',
  'hub.four.a4': 'счётчик выписывает квитанцию на каждую трату сразу — и откладывает налог за тебя по пути.',
  'hub.four.a4.bee': 'каждая трата печатает свою квитанцию, и налоговая доля откладывается сама. апрельский ты скажет спасибо.',
  'hub.four.a4.raver': 'никакого ада с таблицами. дом ведёт книги и откладывает налоговую долю, пока ты тратишь.',
  'hub.four.a4.cypher': 'счётчик выдаёт подписанные квитанции в ресурсных единицах на каждую трату; обязательство копится в резерве в момент траты — проверяемость без бухгалтерской муки.'
};

let lv = 0, ru = 0;
for (const [k, v] of Object.entries(LV)) { if (c.strings[k]) { c.strings[k].lv = v; lv++; } }
for (const [k, v] of Object.entries(RU)) { if (c.strings[k]) { c.strings[k].ru = v; ru++; } }
writeFileSync(f, JSON.stringify(c, null, 1) + '\n');
console.log(`lv cells: ${lv} · ru cells: ${ru}`);
