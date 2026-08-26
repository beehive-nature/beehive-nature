# RECEIPT — the blind round-trip: what a translation says to someone who only reads it

**From:** cc1 · **2026-08-26** · **Trigger:** founder order — *"the crucify near-miss shows
English-to-English gating cannot catch a wrong sense in a tongue nobody reads… One check, one
report. Do not build a translation QA system."*

## The hole

`e2e/estate-source.mjs` proves every key exists, every tongue is covered, and the corpus English
matches the page. All three are English-to-English. **None of them can see what the Hebrew actually
says.** The crucify draft — "cross it", the kandi crossing, rendered with the verb for crucifixion —
passed every gate this estate had. It was caught by an adversarial reviewer, not by a gate, and a
reviewer is not a receipt.

## The check, once

**Blind back-translation.** Ten agents, one per tongue, each handed only the target string from
`surfaces/lang-corpus.json` and asked what it says in plain English — **explicitly forbidden from
reading `strings[key].en`.** Consulting the English destroys the test: the point is to learn what the
text says to somebody who has only the text.

- keys: the ten highest-traffic — `hub.lede`, `kandi.bar`, `kandi.arms`, `d.plur.who`, `d.plur.act`,
  `d.skaists.who`, `d.bio.who`, `d.biomass.act`, `s.kandi.verblabel`, `s.dock.name`
- tongues: `he ar zh ja ko ru fi gd ur hu` — the scripts and the small languages, where a wrong sense
  is least likely to be noticed by anyone here
- readings: **100** · flagged with any oddity: **70** · wrong in SENSE, not merely register: **12**

## What it found

**A wrong sense, exactly the class the founder named:**

| key · tongue | the English | what the tongue actually says |
|---|---|---|
| `d.plur.who` · **ar** | for a raver | *"for a patron of **countryside** parties"* — "rave" mis-rendered as **الريف** (*rif*, the countryside) by sound. An Arabic reader was being invited to a barn dance. |
| `d.plur.who` · **gd** | for a raver | *"raibheir"* is **not a Gaelic word** — an ad-hoc phonetic respelling sitting close to *reubair*, **robber**. |
| `d.biomass.act` · **he fi gd hu** | Read the farm and the two treasuries | all four used the verb for reading **text**, so it says *"read the farm"* — nonsense in every one of them ("olvasni takes texts, not places"). Hebrew's *קופות* also says **cash tills**, not funding accounts. |

**False friends the English could never have predicted:**

- **fi** — `kandi` is the everyday Finnish clipping of *kandidaatti*: **a bachelor's degree**. "the
  kandi bar" reads as a graduation bar.
- **hu** — `kandi` is a real Hungarian adjective meaning **nosy, prying** (cf. *kandikál*, to peep).
  "a kandi bár" reads as *the nosy bar*.
- **ar** — bare **بار** standalone reads overwhelmingly as a **drinking** bar.
- **ko** — 레이버 is as readable as *labour* or a surname; not an established loan for rave-goers.
- **gd** — `d.skaists.who` depends on the accent in **fèis** (festival); unaccented *feis* is the
  copulation sense, and accents are routinely stripped in the wild.

The other 58 flags were register and idiom — worth having, not defects.

## Disposition

- **Corrected:** the six provably-wrong renderings above (`d.plur.who` ar + gd, `d.biomass.act` he fi
  gd hu), redrafted and merged.
- **Logged, not corrected:** the false-friend collisions on `kandi`. The name does not change — it is
  the estate's proper noun and translating it would be worse — and any fix is a wording judgement in a
  language no one here reads. **Named here so the next seat inherits the knowledge instead of
  rediscovering it.**
- **Not built:** a translation QA system. This was one check producing one report, per the order.

## The limit of this receipt, stated

A blind back-translation is a **smoke alarm, not a proof**. It finds a sense that travelled wrong; it
cannot certify one that travelled right, and the reader doing the reading is a machine like the one
that drafted it. Under the corpus law every line remains **⚙ machine-drafted until a human who speaks
the tongue attests it**, and nothing in this receipt upgrades that. What it changes is that the estate
now knows six of its strings were lying in five languages, which it did not know an hour ago.


---

# RUN 2 — every door key, every tongue

**2026-08-26, second pass.** Founder: *"ROUND-TRIP EVERY KEY THAT APPEARS ON A DOOR, IN EVERY TONGUE…
That's the arrival surface, it's bounded, and the twelve findings were already there."*

## Method, unchanged

Twenty-six agents, one per tongue, each handed **only** the target strings and forbidden from reading
`strings[key].en`. A reading counted as a defect only when the string **names a different thing** — a
wrong word, a false friend landing as an unrelated everyday word, a verb that makes the phrase
nonsense, or an unintended violent/religious/medical/sexual reading. Register and idiom preferences
were explicitly **not** defects; the first run's 70 flags were mostly those, and they drowned the
signal.

| | |
|---|---|
| keys round-tripped | **111** — every key rendered on any of the seven door pages |
| tongues | **26** |
| blind readings | **2880** |
| came back with a changed sense | **40** |
| corrected and merged | **37**, across 22 tongues |

Tongues corrected: ar · bn · da · de · es · fi · fr · gd · he · hi · ja · ko · lv · nb · nl · ru · sv · th · tr · uk · ur · zh

## The worst three, by how far the sense travelled

**1. `d.plur.actsub` · de**

- was: `Perlen auffädeln, ein Wort buchstabieren, sagen, für wen es ist — dann verschenk es, kreuz es, oder zeig es. E`
- now: `Perlen auffädeln, ein Wort buchstabieren, sagen, für wen es ist — dann verschenk es, biete es der Kreuzung an,`
- The old "kreuz es" was a bare imperative of kreuzen on an object, which in German says "cross-breed it" or "cross it out" rather than "cross it" in the sense of offering it to the crossing; the fix uses the same wording the companion string s.kandi.verb already uses for that mechanism ("biete es der

**2. `s.keys-addresses.name` · fr**

- was: `une âme, deux adresses postales`
- now: `une âme, deux adresses de réception`
- the old "deux adresses postales" said two physical post-office mailing addresses, sending a French reader to the letterbox instead of to the two chain addresses this keys-and-addresses surface derives; "adresses de réception" keeps the English's "address you receive at" sense with no postal qualifie

**3. `d.nature.what` · nl**

- was: `Een korf, geen bedrijf. Één organisme over nog vijf deuren — en de plek waar de galerijen wonen. Alles hier is`
- now: `Een korf, geen bedrijf. Één organisme over nog vijf deuren — en de plek waar de galerieën wonen. Alles hier is`
- The old 'galerijen' is the plural of 'galerij', the open-air walkway of an apartment block or a covered shopping arcade, so the line said the place where the apartment walkways live; 'galerieën' is the plural for art galleries.

## The unaudited remainder — on record, so it is not rediscovered

A round-trip is only worth what it covers, so what it does **not** cover is stated as a number rather
than left to be found later:

| | keys | key×tongue cells |
|---|---|---|
| corpus total | 354 | 9204 |
| audited by round-trip (door keys + run 1) | 114 | 2964 |
| **never round-tripped** | **240** | **6240** |

**68% of the corpus has never been read back.** The bulk of it
is the `h.*` heading set (164 keys) — the older estate surfaces — plus 11
`f.*`, 10 `plur.*` and a long tail. Those surfaces are not less important than
the doors; they are simply not what this run was scoped to, and the doors are the arrival surface where
a stranger lands first.

## What this still is not

A blind back-translation remains a **smoke alarm, not a proof**. It finds a sense that travelled wrong;
it cannot certify one that travelled right, and the reader is a machine like the drafter. Under the
corpus law every line stays **⚙ machine-drafted until a human who speaks the tongue attests it**, and
37 corrections do not change that. What changed is that 37 strings on the estate's
arrival surface stopped saying something other than what they meant, and 240 keys are now
*known* to be unexamined rather than assumed fine.
