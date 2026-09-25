# RAMESSES II LINEAGE FORENSIC AUDIT — 101-GENERATION ASSERTED PATH

**Date:** 2026-09-24 · **Seat:** zCode Turbo 5.3 (bGenealogy lane) · **Mode:** READ-ONLY audit (no corpus edits, no commits, no pushes)
**Corpus:** `assets/profile-archive/lineage/remington-bloodline.json` (schema `skaists.lineage/2`, generated 2026-09-16, source: FamilySearch walk)
**Canonical copy audited:** worktree copy, sha256 `2fa31d761aa007c50f8f69b236b9f4a22c863124581c43625d54d1bf7188c30a` <!-- PUBLIC-CONSTANT: sha256 file checksum pinning the audited lineage-corpus copy, not a key --> (7,190,746 bytes; two byte-identical worktree copies exist — `friendly-mclean-e83996` read, `brave-wiles-4fc88b` identical hash). The file is NOT present on the main tree.

---

## 1. EXECUTIVE FINDING

The corpus **does** assert a continuous 101-edge parentward path from the founder anchor to Ramesses II (internal `pd69d747cb1`, FS `LZVD-NRP`), and this audit independently reproduced it from the corpus's own `edges[]` map. The path is effectively unique: 8 shortest routes exist, all exactly 101 edges, differing only at three couples where either parent may be followed; all variants re-join within 1–5 generations.

**The continuous descent is NOT defensible beyond generation 11.** Working backward from the founder, edges g1→g10 are ordinary documented American genealogy (B/A). At **g11→g12 — John Randall I of Westerly, RI (b. c. 1640) ← Margaret Trevisa (b. 1613, Cornwall)** — reliable support materially fails: no primary record names the immigrant's parents; the traditional claim ("son of Matthew Randall, Mayor of Bath") is itself unverified, and the corpus's route through Margaret Trevisa (wife of Rev. Matthew Randall II) to the Cornwall Courtenays is provider-tree growth. Everything beyond that gate is inherited assertion, individually audited below.

Of the 101 edges: roughly **28 are A-grade** (attested royal/pharaonic filiations: the de Ros chain verified edge-by-edge against Complete Peerage with charter evidence — the 1378–9 fine, the Chronicle of Melrose, the Rievaulx foundation manuscript and the 1291–92 Great Cause — the Scots line, the Saite core, the 22nd Dynasty core, Psusennes I, the Pharnacid satraps), **~17 B-grade** (accepted reconstructions), **~10 C-grade** (disputed), **~13 D-grade** (traditional/legendary), **~33 E-grade** (provider assertion only), and **6 are X (contradicted)**: Artabazos I←Darius I, Darius I←Rhodah, Necho II's node assignment, Tefnakht I←Osorkon C, Barsine←Artabazos II (by the corpus's own dates), and Isis-Nofret II←Ramesses II (wife-as-daughter).

**Three propositions, kept separate:** (P1) Ramesses II existed; his documented relationships are supported — TRUE. (P2) FamilySearch contains a continuous founder→Ramesses parent path; the corpus imports it — TRUE. (P3) The founder is demonstrably descended from Ramesses II — NOT ESTABLISHED; the asserted path contains a break at g11→g12 and multiple contradicted edges deeper in. P1+P2 do not make P3.

---

## 2. COMPLETE 101-EDGE MATRIX

Verdicts classify the EDGE, not the persons. `founder` and `liv-1/liv-2` are redacted living stubs (privacy preserved; no data shown).

| gen | internal ID | person | lifespan (corpus) | FS ID | corpus class | EDGE verdict |
|---|---|---|---|---|---|---|
| 0 | founder | Living (redacted anchor) | — | — | living | anchor |
| 1 | liv-1 | Living (redacted) | — | — | living | LIVING-STUB |
| 2 | p7b1078c886 | Donna Ruth Lawton | 1925–1988 | KWCL-VNB | recorded | **A-** founder-attested; US vital records |
| 3 | p0c5834f6de | Rollin Eugene Lawton | 1894–1974 | KWCL-VJS | recorded | **A-** |
| 4 | pd1b6a3210b | Rufus Elijah Lawton | 1872–1954 | L7FD-PWH | recorded | **B+** census-era |
| 5 | pa022511737 | Harriet Phylena Fuller | 1844–1899 | K236-YQ7 | colonial | **B** |
| 6 | p799319273f | Eunice L. Maxson | 1812–1873 | K6HN-GB2 | colonial | **B** Maxson genealogy published |
| 7 | p97c8521f42 | Jared Maxson | 1764–1850 | 27SL-4N5 | colonial | **B** |
| 8 | pce24960ffa | Stephen Maxson | 1735–1794 | L81C-KDG | colonial | **B** |
| 9 | p75f1bde1d6 | Thankful Betty Randall | 1702–1785 | LHSC-D94 | colonial | **B** |
| 10 | pfb46de5293 | Matthew Randall | 1671–1735 | LBK8-D9L | colonial | **B** documented son of John I (d. 1684/85) |
| 11 | pa8bccbbb7b | John Randall I (Westerly RI) | 1640–1684 | L1X1-9X3 | colonial | **B** (documented immigrant; parentage unproven — see next edge) |
| 12 | pce963846da | Margaret Trevisa | 1613–1668 | LBMX-YP1 | colonial | **E — BREAKPOINT** (parentage of John I undocumented; traditional Bath claim unverified; corpus bridge tree-grown) |
| 13 | p27bf44b9a3 | Margaret Courtenay | 1574–1658 | LH1L-28L | colonial | **B-** m. John Trevisa of Crocadon, mar. lic. 1 Dec 1596; Vivian's Visitations |
| 14 | p92ba2aa5b1 | Peter Courtenay of Landrake | 1536–1606 | L1WB-WJJ | medieval | **B** Vivian pp. 117–18 + his will (16 Dec 1605, proved 28 May 1606, Archdeacon's Ct. Cornw.) + IPM of Margaret Tretherff (18 Eliz.) |
| 15 | p610d6508bb | Edward Courtenay II of Landrake | 1495–1539 | LBCS-24P | medieval | **B** 1620 Visitation: "son and heir, and heir to his mother"; death "1539" unverified (certainly dead by 1576, widow's IPM 18 Eliz.) |
| 16 | p0d15c51378 | Edward de Courtenay I of Powderham | 1451–1510 | LHK1-F1W | medieval | **B** Vivian explicit: "2 son of Sr. Wn. Cortney of Powderham and Margaret Bonville … brass effigy in Landrake Church" (label note: really of Wotton-in-Landrake jure uxoris — see anomaly 14) |
| 17 | pb1926b9174 | Lady Margaret Bonville | 1425–1487 | K1KM-T5N | medieval | **A-** daughter of William Bonville, 1st Lord Bonville + Margaret Grey (Richardson, MCA; Wikipedia 1st Baron Bonville) |
| 18 | p7201d67fcd | Lady Margaret Grey | 1380–1427 | GNYV-XJ6 | medieval | **A** CP Vol. VI "Grey of Ruthin" + the 1378–9 fine naming "Margaret, da. of Thomas de Roos of Hamelake" (CP explicitly refutes Dugdale/Glover's William-Lord-Roos version; corpus follows the correction). Date note: born c. 1397, not 1380 |
| 19 | p138c83e91e | Margaret de Ros | 1360–1414 | GD7C-9XG | medieval | **A** daughter of Thomas de Ros + Beatrice Stafford (CP; MCA III 453–5) |
| 20 | pdd85710140 | Thomas de Ros, 4th Baron of Helmsley | 1336–1384 | L83H-NSR | medieval | **A** CP (son of William 2nd Baron + Margery Badlesmere; succeeded elder brother William 3rd Baron d. 1352) |
| 21 | pa70e06d4da | William de Ros, 2nd Baron Helmsley | 1285–1343 | LYLZ-R8T | medieval | **A** CP XI 95–97 |
| 22 | p8e4e9afc68 | William de Ros, 1st Baron Helmsley | 1255–1316 | LBJC-C2N | medieval | **A** CP XI 95–97 (m. Maud de Vaux before 1287) |
| 23 | p48a4cf0dd0 | Robert de Ros, 1st Baron (of Helmsley and Belvoir jure uxoris) | 1230–1285 | LY96-J4K | medieval | **A** CP/DNB (m. before 17 May 1244 Isabel d'Aubigny, heiress of Belvoir; buried Kirkham Priory) |
| 24 | pb0a8264f88 | Sir William de Ros of Helmsley | 1191–1264 | 9HZG-9Q4 | medieval | **A-** son of the Magna Carta surety Robert de Ros (d. 1226/7) + Isabel mac William; Rievaulx foundation MS names her sons "Willielmum de Roos et Robertum"; CP 1st ed. d.1258 vs 2nd ed. c. 1264/5 (corpus follows current view) |
| 25 | pd4686624db | Isabel mac William | 1175–1242 | 9CMJ-BLF | medieval | **A** daughter of William the Lion: Chronicle of Melrose 1191 marriage; Rievaulx MS "Isabellam filiam regis Scotiæ"; the 1291–92 Great Cause claim of her great-grandson (dismissed FOR her illegitimacy) proves both filiation and illegitimate status. Death 1242 is tree tradition |
| 26 | pb5c93766d3 | William 'The Lion', King of Scots | 1143–1214 | L8YY-5PB | medieval | **A** (MedLands Scotland; CP VI 402–3) |
| 27 | pc70ef176db | Henry of Scotland, Earl of Huntingdon | 1114–1152 | LZB4-2C7 | medieval | **A** |
| 28 | pe9b57fc237 | Matilda of Huntingdon | 1074–1130 | L8M6-YWJ | medieval | **A** daughter of Waltheof (maternal edge via Judith is legitimate) |
| 29 | p97345143ca | Judith de Lens | 1054–1090 | LDSS-ZMD | medieval | **A-** daughter of Lambert de Lens + Adelaide of Normandy |
| 30 | p5fba27cc4e | Lambert II de Boulogne, comte de Lens | 1022–1054 | LRHH-9JN | medieval | **A-** son of Eustace I + Mathilde of Leuven |
| 31 | p25d99a6672 | Mathilde, gravin van Leuven | 1006–1049 | LDSS-KHY | medieval | **B** daughter of Lambert I |
| 32 | p4433635ac6 | Lambert I met de Baard, graaf van Leuven | 0952–1015 | LYCY-PN6 | saga (label artifact) | **B** Cawley, Medieval Lands: "son of Reginar III & his wife Adela" |
| 33 | p025f611091 | Régnier III comte de Hainaut | 0920–0973 | LDSS-26H | saga | **B-/C** maternal edge via Adelaide of Burgundy; corpus skips father Reginar II (legitimate but thin) |
| 34 | p7b9ab9fb80 | Adélaïde de Bourgogne | 0895–Deceased | GLB2-PPV | saga | **B-/C** daughter of Richard the Justiciar + Adelaide of Auxerre (reconstruction) |
| 35 | p1a3d79935e | Adélaïde d'Auxerre | 0869–0929 | 9C44-MQP | saga | **C** daughter of Conrad II of Auxerre (reconstructive) |
| 36 | p0ba45e8ea9 | Konrad II, Graf von Auxerre | 0835–0876 | LHJC-WKM | saga | **C** |
| 37 | p5d0d56270f | Konrad I, Graf im Argen- und Linzgau | 0800–0862 | LZ2X-TJV | saga | **C** father of Conrad II (reconstructive) |
| 38 | p8a2f87f500 | Heilwig, abbesse de Chelles | 0778–0833 | 9HXY-TD8 | saga | **C/D** mother of Conrad I — speculative |
| 39 | pc791c7b964 | Isanbart, Graf im Thurgau | 0750–0806 | G9QS-9N3 | saga | **C/D** |
| 40 | p2ac67a05f3 | Warin, Comte de Alemannien | Deceased | L1XC-LH1 | unrecorded | **D** attested count, filiation uncertain |
| 41 | pb7d982dc29 | Saint Warnius Gueriin (= Warin of Poitiers, martyr 677) | 0638–0677 | 9762-KHX | unrecorded | **D/E** attested person; link to Warin-of-Alemannia tree-grown |
| 42 | pa91d791a72 | Bodilon Odon Warin de Poitiers et Trèves | 0600–0697 | KGMG-8TH | saga | **D** "supposed" husband of Sigrada; alternatives (Chlodulf) exist |
| 43 | p32c38344d2 | Garnier de Trèves II de Bourgogne | 0574–0642 | GXKF-LXS | saga | **D/E** no attestation of this filiation |
| 44 | p42bca073d6 | Ermengarde d'Austrasie Merovingen | 0550–0626 | P7B5-HGV | saga | **D/E** |
| 45 | pbee21c4b02 | Sigrya Menia de Bourgogne | 0520–0580 | GXM3-S6X | saga | **D/E + ANOMALY** = Sigrada (mother of Warin per Passio Leodegarii) demoted 4 generations and mis-dated a century early |
| 46 | p361225a06f | Arembert d'Aremberg | 0487–0555 | GPFD-VSN | saga | **E** |
| 47 | p2a5f13444a | Warnachaire d'Aremberg | 0465–0526 | G5C1-L9V | saga | **E + ANOMALY** name collision with Warnachar II (c. 570–626) |
| 48 | p5656808b2c | Agrippine Caratène de Narbonne | 0437–0506 | PZFS-CD2 | saga | **E** invented |
| 49 | p84cc401e51 | Agrippin de Narbonne | 0410–0463 | PZF3-XKW | saga | **E** invented |
| 50 | p7e7af9264b | Hermerico de los Suevos (Hermeric, king of Suebi) | 0372–0441 | PXXC-H15 | saga | **E** Hermeric attested; asserted son "Agrippin" invented (attested son: Rechila) |
| 51 | peabf8ac7fe | Bitheid de los Suevos | 0350–0401 | PXXC-61L | saga | **E** |
| 52 | p548b7fe17b | Ascyla de Toxandrie | 0323–Deceased | PXXC-QSF | saga | **E** |
| 53 | p43a2733eec | Asilia Hastila de Lombardía | 0310–0387 | P7Z3-JSH | saga | **E** |
| 54 | pf3d16101d5 | "King of the Lombards Aio Agio Ajonis Agilulf" | 0265–Deceased | P618-Z5K | saga | **D** Origo Gentis Langobardorum legend; corpus structure inverts it |
| 55 | pcdd4770247 | Co-King Ybor of the Lombards | 0220–Deceased | P3HT-XBG | saga | **D** Ibor is Agio's BROTHER in the legend, not father/son chain |
| 56 | pa204a04641 | Haquinus di Lombardi | 0130–Deceased | PM1Q-BY3 | saga | **E** invented middle link; ANOMALY: father aged 90 at son's birth |
| 57 | pbcda9963be | Gambara Des Winniles | 0109–0148 | G8C4-W4D | saga | **D** legend: Gambara is MOTHER of Ibor and Agio; corpus demotes her to grandmother; dates fabricated |
| 58 | pf353e28cce | Alubaya Eyad de Judée Arimathie | 61–Deceased | PS56-6FK | unrecorded | **E** pure bridge invention (1st-c. Judea → Lombard legend) |
| 59 | pe6dd7fdd54 | Anna I Enygeus bat Joseph of Arimathea | 1BC–76 | LZBZ-SW8 | saga | **E** grail romance (Robert de Boron c. 1200) turned into real genealogy; no tradition ties Enygeus to the Lombards |
| 60 | p426ef7df29 | Joseph of Arimathea | 38BC–82 | LJK2-DGY | saga | **D** NT figure (all four gospels); Enygeus-as-daughter = one romance tradition (sister in de Boron); his parentage = legend |
| 61 | p0d09eca0f8 | Rachel bint Eleazor | 74BC–28BC | L63D-JV1 | saga | **E** no source; ANOMALY: near-duplicate of Joseph's asserted wife "Anna Rachel bint Simon Eleazor ben Eliud ha David" |
| 62 | pc5710e7333 | Eleazar ben Eliud of Judea | 124BC–60BC | L6FC-3QN | saga | **D** Matthean chain (Matthew 1:14–15) as literal genealogy |
| 63 | p7c710c2d7b | Eliud ben Achim | 150BC–94BC | L2FK-1BW | saga | **D** Matthew 1:14 |
| 64 | pe423ead1cd | Achim ben Zadoc | 173BC–Deceased | 93BT-27Z | saga | **D** Matthew 1:14 |
| 65 | p6c737802ff | Sadok ben Azor | 199BC–149BC | 9CZZ-7F3 | saga | **D** Matthew 1:14 |
| 66 | p0df539fcd9 | Azor ben Eliakim | 225BC–180BC | 9C3N-55W | saga | **D** Matthew 1:13–14 |
| 67 | peaa0ac7062 | Eliakim ben Abiud ben Neariah | 270BC–200BC | 93ZK-WDJ | saga | **D** Matthew 1:13 |
| 68 | p22547f9947 | Princess Barsine of Macedon | 300BC–Deceased | G2NJ-J1D | saga | **X** vs corpus's own dates (father d. 328BC, "she" b. 300BC); the historical Barsine (dtr of Artabazus II) was b. c. 363BC and mistress of Alexander — no Judean marriage |
| 69 | p121f65e777 | Sátrapa Artabazos (II) ben Pharnabazus II | 389BC–328BC | 9WCX-JBJ | saga | **A-** Artabazus II son of Pharnabazus II (Xenophon/Diodorus/Briant) |
| 70 | p98e1c73c36 | Pharnabazus II | 435BC–373BC | M1TV-55Q | saga | **A** |
| 71 | pf90c11896b | Pharnaces II of Hellespontine Phrygia | 450BC–422BC | L2BD-B1D | saga | **A** |
| 72 | p37eab095bf | Pharnabazus I | 514BC–445BC | G1VF-LY4 | saga | **A** son of Artabazus I per Pharnacid stemma (corpus's own dates make father 11 yrs old — date error, edge right) |
| 73 | p307e2f6819 | Artabazos I, Satrap of Dascylium | 525BC–455BC | GYT2-PQJ | saga | **X** (as child of Darius I) — Artabazus I was son of PHARNACES, cousin of Darius I; Darius's son was Artabazanes (different man) |
| 74 | p2c86d05f71 | Darius I "The Great" of Persia | 550BC–486BC | LVSJ-KQW | saga | **X** (as son of Rhodah) — Behistun inscription: father Hystaspes, son of Arsames; the Gobryas connection is Darius's WIFE (mother of Artabazanes) — wife-as-mother inversion |
| 75 | p662abeb018 | Rhodah bint Gobryas | 573BC–Deceased | 94BJ-R91 | saga | **E** no attestation; name mixes "Rhodogune" with Gobryas patronymic |
| 76 | pc9c5e24fb7 | Niticris of Babylon, Priestess of Sin | Deceased | L2NH-FPD | unrecorded | **E** conflation: Herodotus's Babylonian queen Nitocris + Adad-guppi (actual priestess of Sin, mother of Nabonidus) |
| 77 | p352ac4ea9f | Nitocris Neitaqert D'Egypte | 600BC–Deceased | P458-GFW | saga | **X/C** (as daughter of Necho II) — the real Nitocris I, Divine Adoratrice, was daughter of PSAMTIK I (Adoption Stela) = Necho II's SISTER; corpus date 600BC vs attested installation 656BC |
| 78 | pc12bde3f7a | Nékao II Wehemibre, 26th Dyn | 660BC–595BC | L8RB-JQ9 | saga | **A** son of Psamtik I (attested; attested mother Mehytenweskhet — see anomaly register) |
| 79 | p977765dce8 | Psamtik I Wahibre, 26th Dyn | 684BC–610BC | LFJM-W6H | saga | **A** son of Necho I |
| 80 | p5f7669feca | Necho I Memkheperre, Proto-Saite | 710BC–664BC | LZVP-947 | saga | **C** father Tefnakht II = scholarly hypothesis (not attested) |
| 81 | p6491abfe34 | Tefnakt II Stephinates, Proto-Saite | 739BC–688BC | L527-C1G | saga | **D/E** known mainly from Manetho ("Stephinates"); son-of-Bakenranef has no evidence |
| 82 | p34e4050418 | Bakenranef (Bocchoris), 24th Dyn | 754BC–714BC | 94RN-6LY | saga | **A** son of Tefnakht I |
| 83 | pf277194603 | Tefnakht I Shepsere, 24th Dyn | 780BC–718BC | 94RF-WH8 | saga | **X** (as son of Osorkon C) — Tefnakht's own statue names his father GEMNEFSUTKAPU, a priest of Neith, and grandfather Basa |
| 84 | p2d1d53ccc7 | Osorkon "C" of Ma, Great Chief of Ma | 799BC–740BC | LZVP-9JG | saga | **E** Osorkon C attested but "his ancestors are unknown"; Pimay was merely a predecessor in the same Sais office |
| 85 | pe2d9618107 | Pimay ben Shoshenq III, Great Chief of the Ma | 830BC–767BC | 93T3-Q9M | saga | **A** attested son of Shoshenq III |
| 86 | p482c81bd77 | Sheshonq III, 22nd Dyn | 845BC–788BC | LBJC-847 | saga | **A** attested son of Osorkon II (Pasenhor line) |
| 87 | pc20c69706b | Osorkon II, 22nd Dyn ("6th" label wrong) | 905BC–837BC | LBJC-MTM | saga | **A** attested son of Takelot I |
| 88 | pf75bdba665 | Takélot I Méryemen, 22nd Dyn | 935BC–874BC | M1TK-BG5 | saga | **A** attested son of Osorkon I (mother: Tashedkhons, secondary wife) |
| 89 | pa39ae821ce | Osorkon I Sekhemkheperre Setepenre | 955BC–883BC | LXX7-J5V | saga | **A-** Stela of Pasenhor: son of Shoshenq I + Karomama A (corpus's maternal edge correct) |
| 90 | p0177a654ed | Karomama A | 985BC–Deceased | LBJC-HMM | saga | **C/E** (as daughter of Psusennes II) — her parentage is UNKNOWN; the attested Psusennes II daughter who married into Shoshenq I's family was MAATKARE B (m. Osorkon I); corpus substitutes Karomama |
| 91 | p55ff8e8419 | Psusennes II, 21st Dyn | 1000BC–943BC | LT6S-NZS | saga | **C** (as son of Pinedjem II) — one of two scholarly positions (other: son of Menkheperre + Isetemkheb C) |
| 92 | p9b72660de2 | Pinedjem II, High Priest of Amun | 1025BC–976BC | G71C-Q9Z | saga | **B** maternal edge via Istemkheb C legitimate (father: Menkheperre) |
| 93 | p4e939dfe47 | Istemkheb C of Lower Egypt | 1054BC–Deceased | L8RB-VZW | saga | **B** scholarly reconstruction: daughter of Psusennes I + Wiay; m. her uncle Menkheperre |
| 94 | p7b7a0416fe | Psusennes I Akheperre Setepenamun | "0991–1078" (corrupt) | GS7V-BH7 | saga | **A** (as son of Pinedjem I + Henuttawy) + DATA BUG: lifespan string lacks BC markers and is reversed |
| 95 | p1c3c4c5e51 | Pinedjem I, High Priest of Amun | 1094BC–1032BC | LK5W-635 | saga | **C/X** (as son of Hrere) — consensus: Pinedjem I was son of Herihor + Nodjmet; Hrere was Nodjmet's mother = his GRANDMOTHER (skip-generation) |
| 96 | pb93a72c265 | Hrēre de Egypt | 1130BC–Deceased | L5K6-9P4 | saga | **C** parentage tangled in the two-Hrere/two-Nodjmet debate (Broekman 2012 et al.) |
| 97 | p8c9ca1ddbb | Nedjemet d'Egypte | 1160BC–Deceased | GKH7-2YL | saga | **C/D** Nodjmet/Nedjmet as Ramesside princess = older-literature hypothesis (Ramesses IX); newer literature says Ramesses XI |
| 98 | pb62cea987f | Ramessés IX, 20th Dyn | 1175BC–1110BC | 9WCX-V8F | saga | **B-** (as son of Takhat) — "King's Mother" title in KV10; Settipani 1991; father probably Montuherkhopshef (son of Ramesses III) |
| 99 | p60555ff107 | Takhat of Egypt | Deceased | 9C3G-8F8 | unrecorded | **E** (as daughter of Isis-Nofret II) — no attestation; her connection to the 19th Dynasty is a genealogists' hypothesis only |
| 100 | p53e5e0fb81 | Reina Isis-Nefert II | 1270BC–Deceased | 9C4M-WHN | saga | **X/C** (as daughter of Ramesses II) — Isisnofret was Ramesses II's WIFE (FS's own LZVD-NRP profile: married Isis-Nefert c. 1280BC); an attested daughter named Isisnofret does not appear in the standard children lists |
| 101 | pd69d747cb1 | Ramesses II, 3rd Pharaoh of 19th Dynasty | 1302BC–1212BC | LZVD-NRP | saga | terminus |

**Verdict tally (101 edges):** A/A-: ~28 · B/B±: ~17 · C: ~10 · D: ~13 · E: ~33 · X: 6 · (2 living-stub edges unauditable)

**Segment audit note (g14–g28):** a dedicated deep pass over this segment verified every edge against primary/peer sources — Complete Peerage (1st & 2nd ed.) for the whole de Ros chain; the 1378–9 fine for Margaret de Ros; Chronicle of Melrose, Rievaulx foundation MS and the 1291–92 Great Cause for Isabel mac William; MedLands/ODNB (Stringer) for the Scots line; Vivian's *Visitations of Cornwall* (1887, pp. 117–18) + the 1620 Visitation + Peter Courtenay's will and the Landrake brass for the Cornish Courtenays. The three weakest edges in the whole segment are the Cornish ones (g14–g16, Visitation-grade rather than contemporary-record grade: B, nothing contradicting). Identity conflations checked and CLEARED: the corpus has the right Robert (not the Wark line), the right William (surety's son, not the surety), the right Isabel (not the Countess of Norfolk, not Isabel d'Aubigny), and no Bonville-generation compression.

---

## 3. BREAKPOINT REPORT

**LAST DEFENSIBLE EDGE (founder-backward):**
**g10 → g11 — Matthew Randall (1671–1735) ← John Randall I (c. 1640–1684), the immigrant of Westerly, RI.**
Randall family histories document John I's children (John b. 1666, Stephen c. 1668, Matthew 1671, Peter 1674, by wife Elizabeth), with Matthew's 1671 Westerly birth and 1735 Hopkinton death carried by Ancestry/RootsWeb records. Standard New-England-genealogy grade (B).

**FIRST UNSUPPORTED EDGE:**
**g11 → g12 — John Randall I ← Margaret Trevisa (1613–1668, Cornwall).**
Why this is the break:
1. No primary or published record names the parents of John Randall the immigrant. The circulating tradition ("son of Matthew Randall, Mayor of Bath, Somerset") is itself flagged as unverified/debated in Randall genealogy.
2. The corpus instead chains him through **Margaret Trevisa**, whom the trees make the wife of **Rev. Matthew Randall II** (m. 1635) and daughter of John Trevisa of Crocadon + Margaret Courtenay (mar. lic. 1 Dec 1596). Even if the Bath-Randall tradition were true, the corpus's specific claim — that the immigrant is a son of this particular Matthew-Trevisa couple — is tree-grown, with date conflicts inside the very trees that assert it (one tree gives Matthew b. 28 May 1629 Bath, impossible for a 1635 marriage).
3. Consequence: everything from g12 backward (Cornwall → medieval England → Scotland → Carolingian → legendary → Persian → Egypt) is provider-inherited. Later well-documented royal edges (the de Ros chain, the Saite pharaohs) cannot repair a continuous descent that has already broken at this gate.

**Transition-zone note:** even hypothetically bridging the gate, the next material weakening is g37–g41 (Heilwig/Isanbart/Warin — Carolingian reconstructions, C/D), then the legendary g42–g57 (D/E) and the fabricated g58–g68 bridges (E/X). There is no continuous defensible descent anywhere past the gate.

---

## 4. ANCIENT-EGYPT SUB-AUDIT (g77–g101, plus the Persian knot behind it)

**Supported (A):** Psamtik I ← Necho I; Necho II ← Psamtik I; Bakenranef ← Tefnakht I; Pimay ← Shoshenq III; Shoshenq III ← Osorkon II; Osorkon II ← Takelot I; Takelot I ← Osorkon I; Osorkon I ← Karomama A (Stela of Pasenhor); Psusennes I ← Pinedjem I.
**Supported reconstruction (B):** Istemkheb C ← Psusennes I (dtr of Psusennes I + Wiay); Pinedjem II ← Istemkheb C (mother; father Menkheperre); Ramesses IX ← Takhat ("King's Mother", KV10; Settipani).
**Disputed (C):** Psusennes II ← Pinedjem II (vs son-of-Menkheperre school); Necho I ← Tefnakht II (scholarly hypothesis, e.g. "King Necho I son of king Tefnakhte II"); Karomama A ← Psusennes II (C/E: her parentage unknown; the attested bridge daughter was Maatkare B m. Osorkon I); Hrere ← Nedjemet; Nedjemet ← Ramesses IX (older lit; newer: Ramesses XI).
**Unsupported (D/E):** Tefnakht II ← Bakenranef (no 24th-Dynasty → Proto-Saite link exists); Osorkon C ← Pimay (Osorkon C's ancestors unknown; same-office predecessor only); Takhat ← Isis-Nofret II (no attestation).
**Contradicted (X):**
1. **Tefnakht I ← Osorkon "C"** — Tefnakht's own Buto statue names his father Gemnefsutkapu and grandfather Basa, priests of Neith, i.e. NOT the Libyan Ma line. The corpus severs Tefnakht from his real family to attach him to the 22nd Dynasty.
2. **Nitocris ← Necho II** — the Adoption Stela makes Nitocris I the daughter of Psamtik I (Necho II's sister); Necho II's attested mother was Mehytenweskhet. The corpus's node is dated 600BC, vs Nitocris's attested installation as God's Wife in 656BC.
3. **Isis-Nofret II ← Ramesses II** — Isisnofret is attested as his WIFE (FS's own LZVD-NRP profile says "married Isis-Nefert about 1280 BC"); no attested daughter of that name in the standard children lists. The corpus dates her birth 1270BC — the wife's era, filed as a daughter.
4. **Pinedjem I ← Hrere** — skip-generation: consensus makes Pinedjem I the son of Herihor + Nodjmet; Hrere was Nodjmet's mother (or, in the two-Hrere reading, another generation still). The corpus also compresses Nodjmet/Nedjemet (same Egyptian name) into one "Nedjemet" node.
5. **The Persian knot feeding the Egyptian bridge:** Darius I ← Rhodah bint Gobryas (X — Behistun: father Hystaspes; Gobryas's daughter was his WIFE); Artabazos I ← Darius I (X — the satrap was son of Pharnaces; Darius's actual son Artabazanes is a different man); Barsine ← Artabazos II (X by the corpus's own dates: father d. 328BC, child b. 300BC; the historical Barsine was b. c. 363BC).

**Bottom line for the final five edges** (`Nedjemet → Ramesses IX → Takhat → Isis-Nofret II → Ramesses II`): the only scholarly-supported link is Ramesses IX ← Takhat (B-). Nedjemet ← Ramesses IX is a contested hypothesis (C/D), and Takhat ← Isis-Nofret II ← Ramesses II is unsupported and partially contradicted (E/X). The corpus does NOT terminate in an accepted Egyptological reconstruction.

---

## 5. RAMESSES II DOSSIER (vs FS LZVD-NRP and the imported node)

**Accepted chronology:** reign c. 1279–1213BC; birth c. 1303BC; died c. 1213BC aged ~90. (Corpus/FS: 1302BC–1212BC — one year off the standard on both ends, consistent with wiki-derived provider dating.) Chronological variants of ±1 year come from the lunar-date frameworks (Krauss & Warburton, Ancient Egyptian Chronology, Brill 2006; von Beckerath 1984).

**Documented family:**
- Parents: **Seti I** (father, predecessor) + **Tuya**. Grandfather Ramesses I.
- Principal wives: **Nefertari** (Great Royal Wife, Abu Simbel small temple, Valley of the Queens tomb QV66) and **Isisnofret/Isetnofret** (mother of his successor); plus Meritamen, Bintanath, Nebettawy, Henuttawy, Henutmire, Maathorneferure (Hittite princess) and others among his eight great royal wives; one wife attribution ("Takhat") is disputed in Egyptology (probably confused with Seti II's wife).
- Children: roughly 96 sons and 60 daughters attested in whole or part (Wikipedia's children list is the standard compiled source). Key sons: Ramesses (jr), **Khaemwaset** (High Priest of Ptah), **Merneptah** (successor, son of Isisnofret), Amenhirwonmef, Seti jr.
- Succession: Merneptah (13th son, by Isisnofret).

**Identity verdict:** the imported node is cleanly the historical Ramesses II — not a conflate. Its one parent-edge in the corpus (Isis-Nofret II as his daughter) is the conflation: history has Isisnofret as wife. FS LZVD-NRP itself shows the wife relationship correctly on its profile page; the descent branch into Takhat lives deeper in the collaborative tree and is unsourced.

**Uncertainty note:** similarly named individuals abound (Khaemwaset the 19th-Dyn prince vs Ramesses IX's original name Khaemwaset; two Takhats; two+ Nodjmet/Nedjemet; multiple Karomamas; two Nitocrises; Artabazanes vs Artabazus I). The corpus's route trips over nearly all of these.

---

## 6. ANOMALY REGISTER

1. **[X-CHRON] g69→g68** Artabazos II (d. 328BC) → "Barsine" (b. 300BC): father dead 28 years at child's birth; also a 89-year parent age. The historical Barsine (b. c. 363BC) was Artabazus II's daughter — the corpus's date is fabricated to fit a Judean bridge.
2. **[X-IDENT] g73→g74** "Artabazos I Satrap of Dascylium, son of Darius I": conflates Darius I's son **Artabazanes** (by Gobryas's daughter) with the satrap **Artabazus I** (son of Pharnaces, cousin of Darius I). The real link Pharnaces → Artabazus I is dropped.
3. **[X-INVERT] g74→g75** Darius I ← "Rhodah bint Gobryas": the Gobryas marriage was Darius's WIFE, not mother (Behistun). Wife-as-mother inversion.
4. **[X-IDENT] g77/g78** "Nitocris Neitaqert" as daughter of Necho II: she is attested (Adoption Stela) as daughter of Psamtik I — Necho II's sister. Corpus date 600BC contradicts attested installation 656BC. Followed by a "Niticris of Babylon, Priestess of Sin" node that merges Herodotus's Babylonian Nitocris with Adad-guppi.
5. **[X-IDENT] g83→g84** Tefnakht I ← Osorkon "C": contradicted by Tefnakht's Buto statue (father Gemnefsutkapu, grandfather Basa — a Neith-priestly family, not the Ma/Libyan line).
6. **[X-INVERT] g100→g101** Isis-Nofret II as daughter of Ramesses II: she was his wife. FS's own profile says wife.
7. **[X-SKIP] g95→g96** Pinedjem I ← Hrere: Hrere is his grandmother (mother of Nodjmet) under the consensus reconstruction; the corpus also merges the two Nodjmets into one "Nedjemet" and the two Hreres into one.
8. **[DATA BUG] g94** Psusennes I lifespan string `"0991–1078"`: no BC markers, reversed order; parses as AD 991–1078 (impossible). Even as BC it implies an 87-year life. Standard dating c. 1067–1001BC (or 1047–1001BC).
9. **[DUP-IDENT] g60/g61** Joseph of Arimathea's asserted mother "Rachel bint Eleazor" vs his asserted wife "Anna Rachel bint Simon Eleazor ben Eliud ha David" — near-identical names, same Matthean chain; likely one legend split into two women.
10. **[COLLISION+DATE] g45** "Sigrya Menia de Bourgogne" (520–580) = Sigrada, attested MOTHER of Warin of Poitiers (martyred 677) per the Passio Leodegarii — demoted to a 4-generations-earlier ancestress and mis-dated a century early.
11. **[COLLISION+DATE] g47** "Warnachaire d'Aremberg" (465–526): no such person; name collision with Warnachar II, Burgundian mayor of the palace (c. 570–626).
12. **[LEGEND-INVERT] g54–g57** The Lombard legend (Origo Gentis Langobardorum: Gambara mother of Ibor and Agio) is restructured into a father-son chain with an invented "Haquinus" (father aged 90 per corpus dates; Gambara given fabricated dates 109–148).
13. **[ERA-LABEL BUG] corpus-wide** The era heuristic labels all BC persons (g91–g101) "medieval" and AD 750–952 persons "saga" — the classifier is BC-unaware; era labels on the route are decorative, not evidential.
14. **[LABEL PRECISION, cosmetic only] g16** "Edward de Courtenay I of Powderham" was really Edward of **Wotton-in-Landrake (jure uxoris)** — Powderham passed to his elder brother Sir William (c. 1451–1512, m. Cecily Cheney), correctly absent from the path. Identity and kinship unaffected. Baronial ordinals g20–g23 ("4th", "2nd", "1st" Barons) and the "of Belvoir" styling for Robert de Ros (d. 1285, jure uxoris via Isabel d'Aubigny) were checked against Complete Peerage and are all CORRECT. Minor date artifacts, kinship unaffected: Margaret Grey born c. 1397 (corpus 1380); Margaret de Ros c. 1365; Edward II of Landrake's death "1539" unverified (dead by 1576); Isabel's death "1242" tree tradition.
15. **[GATE CONFLICT] g11→g12** Trees carrying the Trevisa marriage also carry a Matthew Randall b. 1629 (before the 1635 marriage) — internal date conflicts within the very provider trees the corpus inherited.
16. **[PARENTAGE UNPROVEN] g11** The immigrant John Randall's parentage is unproven; the "Mayor of Bath" tradition is itself unverified. (This is the breakpoint, restated.)

---

## 7. RESEARCH BACKLOG (priority order)

1. **g11→g12 John Randall I ← Margaret Trevisa — THE GATE.** Resolve with: Bath archives (St. James/Swantemple parish registers), Matthew Randall mayoral records (Bath corporation records), 17th-c. Somerset/Cornish emigration records, NEHGR articles on the Westerly Randalls. Any one contemporary record naming John's father either repairs or permanently severs the corridor. Highest value: this is the only edge whose resolution changes the whole audit's shape.
2. **g12→g13 / g13→g14 Trevisa–Courtenay of Landrake corridor.** ~~Verify via Vivian~~ — DONE by the segment deep pass: Vivian pp. 117–18 read directly (will 1605/6, IPMs, Landrake brass). REMAINING: the g12→g13 hop itself (Margaret Trevisa ← Margaret Courtenay) still rests on tree assertions + the 1596 marriage licence; pull the Cornish diocesan marriage-licence record and confirm which Courtenay father (Peter of Landrake vs a sibling) the pedigree gives.
3. **g95–g97 Herihorid tangle.** Target: Broekman, "The Theban High-Priestly Succession" (2012) and the two-Hrere papers; establish whether ANY published reconstruction connects the corpus's exact chain (Nedjemet → Hrere → Pinedjem I) or whether the skip-generation is fatal in every variant.
4. **g97→g98 Nedjemet/Ramesses-IX vs Ramesses-XI hypothesis.** Kitchen TIP §… (Herihor's family) + Bierbrier; decide which hypothesis the corpus's Nedjemet node matches.
5. **g99–g100 Takhat's ancestry.** Search for any published argument that Takhat (mother of Ramesses IX) descends from Khaemwaset/Isisnofret — currently only found as genealogists' hypothesis (KV10 reliefs; Hopper on Amenmesse/Seti II monuments).
6. **g91→g90 Karomama A's parentage.** Check Kitchen TIP + Dodson & Hilton family tree pages for any explicit statement (expected: unknown). Confirms the C/E verdict and the Maatkare-B substitution.
7. **g32–g37 Leuven→Auxerre filiations.** Read fmg.ac LEUVAIN and AUXERRE chapters directly (only summaries consulted) to pin Cawley's exact caution notes; downgrade/upgrade B↔C accordingly.
8. **g40–g42 Warin/Isanbart/Bodilon.** Medieval Lands' Swabia/Thurgau section; settle whether Heilwig-of-Chelles's descent from Isanbart has any source basis at all.
9. **g52 "Ascyla de Toxandrie".** Full-source sweep (Roman law corpus, Passio, Gallo-Roman prosopography) to determine if the person exists at all outside trees.
10. **FS corpus hygiene (for the NEXT import cycle, not this audit):** the `0991–1078` BC-marker bug, the era-classifier BC-blindness, and the duplicate Rachel/Anna-Rachel node are corpus defects worth filing for the source-contract lane — they are provider-data defects, not research findings.

---

## SOURCE LEDGER (external, consulted 2026-09-24)

- Wikipedia: Ramesses II; Ramesses IX; Isetnofret; List of children of Ramesses II; Osorkon I; Osorkon C; Tefnakht II; Mehytenweskhet; Margaret Grey; Robert de Ros (d.1285); Nodjmet; Herihor; Joseph of Arimathea; Takhat (20th dynasty).
- FamilySearch profile pages: `ancestors.familysearch.org/en/LZVD-NRP` (Ramesses II, m. Isis-Nefert c. 1280BC); Margaret Trevisa (1613–1668); Anna Enygeus; Bodilon.
- Christian Settipani, *Nos ancêtres de l'Antiquité* (1991) — via Ramesses IX article.
- Krauss & Warburton, *Ancient Egyptian Chronology* (Brill 2006); von Beckerath (1984) — via Ramesses IX article.
- Kitchen, *The Third Intermediate Period in Egypt* — via Shoshenq I/TIP summaries (Maatkare B m. Osorkon I; archive.org text).
- Dodson & Hilton, *The Complete Royal Families of Ancient Egypt* — via TIP genealogy summaries.
- Broekman (2012), "The Theban High-Priestly Succession" (JSTOR); Academia papers "Nodjmet A, Daughter of Amenhotep, Wife of Piankh"; "Herihor's Kingship and the High Priest of Amun Piankh" (ResearchGate).
- Charles Cawley, *Medieval Lands*, fmg.ac — BRABANT/LOUVAIN (Lambert I son of Reginar III + Adela).
- G.E. Cockayne, *Complete Peerage* (de Ros); Wikisource DNB "Robert de Ros"; Scots Peerage (William the Lion's children).
- J.L. Vivian, *The Visitations of Cornwall* (1887), pp. 117–18, archive.org/details/visitationsofcornwall1887; *The Visitation of the County of Cornwall, 1620* (Harl. MS 1162), archive.org/details/visitations-of-cornwall
- G.E. Cockayne, *Complete Peerage* 2nd ed. Vol. VI "Grey of Ruthin" pp. 157–9 (1378–9 fine; Dugdale refutation), archive.org/details/completepeerageo06coka_0; 1st ed. Vol. VI "Ros" pp. 402–3, 410, archive.org/details/completepeerage06cokahrish; 2nd ed. Vol. XI "Ros" pp. 95–97
- Charles Cawley, *Medieval Lands* (fmg.ac) — "SCOTLAND, KINGS" (Chronicle of Melrose; Rievaulx foundation MS; Liber Pluscardensis) and BRABANT/LOUVAIN (Lambert I son of Reginar III + Adela)
- Richardson, *Magna Carta Ancestry*, 2nd ed. (II p. 198 Isabel mac William; II 274/276, III 394 Grey of Ruthin; III 453–5 de Ros) — via CP-citing Wikipedia articles
- K.J. Stringer, "Henry, earl of Northumberland and Huntingdon", ODNB — via MedLands/ODNB summaries
- Livius.org "Artabazus (1)"; Encyclopaedia Iranica "Dascylium"; Briant, *From Cyrus to Alexander* (Pharnacid stemma).
- Behistun inscription (Darius I: father Hystaspes; wife dtr of Gobryas) — via standard translations.
- Adoption Stela of Nitocris (Nitocris I daughter of Psamtik I) — via Egyptology summaries.
- Robert de Boron, *Joseph d'Arimathie* (Enygeus/Bron) — via Arthurian scholarship summaries.
- WikiTree/Geni/RootsWeb/WeRelate — provider trees (used as leads only, never as independent support).
- Passio Leodegarii (Sigrada mother of Warin) — via scholarship summaries.
- Tefnakht's Buto statue (father Gemnefsutkapu, grandfather Basa) — via Egyptology summaries.
- Origo Gentis Langobardorum / Paul the Deacon (Gambara, Ibor, Agio) — via Lombard scholarship summaries.

All external findings above were located 2026-09-24 by web research; provider trees were treated as assertions, never as support. Negative findings are recorded as such. **MISSION READ-ONLY: no corpus file, no model/pipeline file, and no other tracked file was modified; nothing committed; nothing pushed.**
