// hexart3-corpus.js — 2 export/import keys ×29 ⚙
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('surfaces/lang-corpus.json', 'utf8'));
const T = {
'hexart.exportObj':{en:'⬡ export .hexart.json',ru:'⬡ экспорт .hexart.json',lv:'⬡ eksports .hexart.json',th:'⬡ ส่งออก .hexart.json',gd:'⬡ às-port .hexart.json',tt:'⬡ экспорт .hexart.json',uk:'⬡ експорт .hexart.json',cs:'⬡ export .hexart.json',zh:'⬡ 导出 .hexart.json',ko:'⬡ 내보내기 .hexart.json',ar:'⬡ تصدير .hexart.json',nl:'⬡ exporteer .hexart.json','nl-be':'⬡ exporteer .hexart.json',es:'⬡ exportar .hexart.json',de:'⬡ exportiere .hexart.json',fr:'⬡ exporter .hexart.json',he:'⬡ ייצוא .hexart.json',hi:'⬡ निर्यात .hexart.json',bn:'⬡ রপ্তানি .hexart.json',fa:'⬡ برون‌بری .hexart.json',ur:'⬡ برآمد .hexart.json',ja:'⬡ 書き出し .hexart.json',da:'⬡ eksportér .hexart.json',nb:'⬡ eksporter .hexart.json',sv:'⬡ exportera .hexart.json',fi:'⬡ vie .hexart.json',tr:'⬡ dışa aktar .hexart.json',hu:'⬡ exportálás .hexart.json',sa:'⬡ निर्यातम् .hexart.json'},
'hexart.importObj':{en:'import piece',ru:'импорт работы',lv:'imports darbu',th:'นำเข้าชิ้นงาน',gd:'ion-port obair',tt:'эшне импортлау',uk:'імпорт роботи',cs:'import díla',zh:'导入作品',ko:'작품 가져오기',ar:'استيراد عمل',nl:'stuk importeren','nl-be':'stuk importeren',es:'importar pieza',de:'Werk importieren',fr:'importer une pièce',he:'ייבוא יצירה',hi:'रचना आयात करें',bn:'কাজ আমদানি',fa:'وارد کردن اثر',ur:'کام درآمد کریں',ja:'作品を読み込む',da:'importér værk',nb:'importer verk',sv:'importera verk',fi:'tuo teos',tr:'eser içe aktar',hu:'mű importálása',sa:'कृतिं आनय'}
};
let added = 0;
for (const [key, cells] of Object.entries(T)) {
  if (c.strings[key]) continue;
  const row = {};
  for (const lang of ['en', ...c._meta.langs]) {
    if (cells[lang] === undefined) { console.error('MISSING', lang, key); process.exit(1); }
    row[lang] = cells[lang];
  }
  c.strings[key] = row; added++;
}
c._meta.drafted += ' · hexart round-3 2026-09-16 (zCode): 2 portability keys ×29 ⚙';
fs.writeFileSync('surfaces/lang-corpus.json', JSON.stringify(c, null, 1) + '\n');
console.log('+' + added + ' portability keys; total ' + Object.keys(c.strings).length);
