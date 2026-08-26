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
