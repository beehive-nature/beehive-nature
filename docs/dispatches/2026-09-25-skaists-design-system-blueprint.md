# skaists design system — the blueprint (canon capture)

> PROVENANCE: claude.ai artifact FAw4pbmMfrKNX6ffA1cDsj ("Design System", shared anyone-with-link),
> captured verbatim 2026-09-25 by the zCode seat via rendered-frame copy. the artifact was built
> from beehive-nature@f7465f4 plus the graded canvas "bData · three registers". see its own
> "not synced" section for what it deliberately does not carry from the repo.
> law of three: every surface reads as new bee, raver OR cypherpunk via the masthead RegisterToggle.
> a register changes voice, density and dress — never a number, a price, a limit, an address, or what a person may do.

---

skaists is the face of the beehive nature reserve: one set of facts, read three ways. it means beautiful in latvian, and it is lowercase.

build every surface so the same markup can be read as new bee, raver or cypherpunk — the three registers are the three themes of this system (bee, raver, cypherpunk), and the RegisterToggle in the masthead is how a person chooses. a register changes voice, density and dress. it never changes a number, a price, a limit, an address, or what a person may do.

the casing law
capitals are a signal channel here, the way colour is. they are never decoration.

write lowercase: headings, buttons, labels, sentences. "your family line". "keep it forever?" "living people stay out. always."
capitals belong only to people's names (Albert Perry Rockwood), to ANT, Autonomi, bDiD, bData, FamilySearch and other names that own theirs, and to the founder's own casing.
the founder's casing is payload. bGENEaLOGy, engLiSH, LoVis waTer, KinG bEe, bAsi, fLeeT — copy it character for character. never title-case it, never "correct" it, never let a style sheet do it for you: no text-transform anywhere.
set such a name with the Wordmark component. it renders capitals heavy and small letters light — the title is exactly bGENEaLOGy, GENE and LOG heavy, b · a · y light — and never changes the string.
placeholders for facts not yet known stay honest and bracketed: [price] ANT, [n] sources attached.
the three registers
the founder's definitions are the bar each register's copy is held to.

new bee — "the apple of the decentralized OSe eco." one question at a time. paper (bg), ink, human purple (sovereign), one magenta action (primary). reading text is bee-body, 16px, never smaller; bee-label, 14px, is for secondary labels only. controls are control-min or taller. the reference reader is the matriarch: familiar words, a few meaningful choices, a clear way home, and plain language that stays adult. "a library of the people you come from. it stays a family draft until you choose to keep it forever."
raver — "everything expressed through art, graphics, animation." the black ground (bg), you magenta, the purples as light. raver-display over raver-body. a family line is a fan chart; consent is four lit glyphs and a hold. every glyph keeps its word under it (raver-glyph). the voice is PLUR: it never gatekeeps, never herds, says literal things. "one payment · your hold is your consent".
cypherpunk — "everything a computer scientist/engineer will want." the same black, mono throughout, ai teal for every action, corners cut to radius-sm. the pipeline is the interface and every row is a fact a stranger can check. "anyone fetches ? hashes ? compares".
move the detail, never delete it: what cypherpunk shows open, new bee and raver keep one tap away (PlainRow's detail). reading level is a preference, never a tier — nobody proves anything to get the plain version.

colour
two axes, and both are law.

what a thing is made of (entity identity). sovereign purple is human — all souls; the more human a surface, the more purple it carries. you magenta is the one acting. ai teal is robots and the network. biomass green is life. info blue is system evidence, kept apart from ai. colour each product by its subject — genealogy is human, so its name and links are sovereign; a data tool leans ai; a living-systems door leans biomass. the family is the form, not the hue.

what a thing is doing (ui semantics). primary is the single filled action of a view. verified is settled, current, confirmed by test. guard is the system declining while nothing is broken.

guard is lilac and never red. living people held out of a family line, an automation refused, a limit reached: all guard on guard-wash, with the lock and plain words. there is no error-red token in this system; do not add one.
b-value honey is the colour of b, and only of b. b amounts, on b-chip, through BChip. never a heading, a border, a door accent or navigation. it reads 1.88:1 on paper, so it never touches a light ground.
a semantic colour is never repainted to fix contrast. change the text, step darker inside the same ramp, or invert to a chip. new bee's values are exactly that: the same hues stepped down until they read on bg.
colour never carries meaning alone. every colour-coded thing also has a word, and a mark or pattern where it helps. take the colour away and the surface must still read. the living ring is dashed and lilac and says "living · out".
rose is love given to the living — the garden red and the heart in the house hand. odd counts only (an even bouquet is for the grave). never a status, never an error.
chart marks use cat-works, cat-idea, cat-bug, cat-gap in that order and nothing else. they are validated on the dark ground; on paper they are marks, never words.
rainbow is the mandala read rim to centre. a rule or a seal edge; never behind reading text.
text tokens name the grounds they read on in their notes; every pair there holds 4.5:1 in all three registers (the sheet's ink-dim on the dark bg-card is the one kept-exact exception, and its note says so). the focus ring is focus: 2px solid, 3px clear of the control.
type
the house hand is burti (house) — the original latvian letterform of the .a/.b names: one round-capped line, circles for bowls, the whole latvian court, and the dot is a cell. its round shape holds weight in every register — name, titles, wordmarks, signs — even where the reading face is mono. set names through Wordmark and the house-* styles. never set sentences in it.
new bee reads in bee-serif (titles) over bee-sans (everything else). raver shouts in raver-display and talks in raver-body. cypherpunk is mono from top to bottom. the font files travel with this system.
estate surfaces fetch nothing: when a live page cannot carry a face, it sets the same sizes in the ui and mono stacks.
addresses, hashes and amounts are shown whole at the moment of confirmation (bee-address). an ellipsis beside a pay button is a defect.
space, corners, controls
rhythm is senary: s1–s6, all multiples of 6. the phone gutter is s3.
new bee is soft (radius-xl cards, radius-lg primary, radius-pill toggle), raver is round (pills everywhere), cypherpunk is cut (radius-sm).
44px is the floor for anything that takes a press (control-min), in every register. rows are control-row, the primary is control-primary.
edges, not shadows. glow-sovereign is raver's one glow; new bee has none.
right-to-left is a first-class layout: use logical properties, and take gradient angles from flow and hatch, which flip once.
what is true, what is missing, and why
not available yet is prose, never a dead button. use PlainRow: the name, "not available yet", and the reason in plain sight — "private storage for your eyes only is not ready."
a gauge that cannot vouch for its number says so. "sources not counted yet", "b not fetched", "time not measured" — never 0, never a dash.
while the network is being asked there is no pay button. show Asking: the seconds so far and "stop waiting". a price reads "current" with its age, then "earlier".
consent comes before the price is payable, and the numbers being consented to are on the same screen. every choice has an "undo this choice" until the moment it cannot, and that moment is said out loud: "forever means no undo once you pay."
living people stay out. always. they are counted in a GuardRow ("7 held"), never named, never stored.
two gauges, never a ticker: b answers "can i do this?", money answers "what does it mean in my money?". no rate between them except on the one surface built for it.
the commons reads without an account. hardware and biometrics are preferences, never doors.
the tree of life and the signs
austras koks is the system's picture. the latvian tree of life, drawn with the house crest's own branch: roots below, crown above, branches that cross the frame. nothing in this house closes. use TreeOfLife wherever a line, a lineage or a structure is shown. no colour blocks.
each register gets its own tree, equally. new bee: the fir with cells, a family tree anyone can read. raver: the branch spun into a mandala of light under the hub's hex band. cypherpunk: the tree as nodes and chords with counts. the numbers are identical; never ship one reading and recolour it for the other two.
the signs come from the crest, path for path (Sign, assets/Signs/): saule crowns, auseklis flanks, jumis blesses, mara's water runs along the foot. one round-capped line in the colour of its words.
the mandala in assets/Logos/ is the matriarch's mark. copy the file; never redraw it, never set it in one ink.
icons are the ten 16px strokes in assets/Icons/, inline so they take the colour of their words (Icon).
honey stays the colour of b: the crest's gold does not come into the interface.
translation
every word a component says is a key in one dictionary (Skaists.words); a surface hands in its own tongue with setLabels, or labels on one component. whole sentences with {n} slots — never glued fragments, so word order belongs to the translator.
no words live inside art. the trees carry numerals and g1…g4 only; their captions are text.
lay out with logical properties (inline-start, text-align: start) so a right-to-left tongue mirrors; take angles from flow and hatch.
leave room: a label may run 40% longer than its english. pills and rows wrap; nothing is clipped, nothing is nowrap but a name.
burti carries latin and the latvian court. a name in another script falls through to the reading face whole — never half in one face.
the founder's casing and people's names are not translated.
motion
motion is honest: it never implies progress that is not happening. 140ms for a press, 260ms for a change, 520ms for an arrival, eased out. nothing flashes faster than 3 Hz, sound never starts on its own, and under reduced motion every piece holds a still that is still beautiful.

not synced
from beehive-nature/beehive-nature at main@f7465f4: the entity sheet docs/tokens.css is carried whole except ai-deep (the canvas never uses it); from the macro sheet surfaces/tokens.css only the categorical set is carried — its accent family (gold, cyan, violet, leaf, amber) is the drift the reconciliation report names, and the entity tokens stand in for it; its 4px spacing, 9.5–13px type scale and motion durations are not tokens here (motion is prose above). the live hub's new bee (#f6f7f2 ground, #18362a ink, in surfaces/register.js) is not carried: new bee here is the face ruled on 2026-09-19 — paper #fbf7f0, ink #0c1412, human purple, magenta action. components are hand-written from the graded canvas "bData · three registers", not built from a library. burti's small letters, latvian court and cell dot are the founder's dna unchanged; its capitals, ü ö ä and sigils are new cuts on the same grid. skaists v1.0 (the chord cut) stays in assets/Font/ and is not used. the crest itself is not in this system — only its tree and signs.

you
#a8238c
#d655bb
#d655bb
primary
you
you
ai
focus
ink
ink
ink
biomass
#527c46
#86cc72
#86cc72
ai
#0f6f82
#45c2dc
#45c2dc
info
#4d759b
#6fa9e0
#6fa9e0
bg
#fbf7f0
#06110c
#06110c
bg-card
#ffffff
#0c1412
#0c1412
bg-well
#efe9dd
#0c1412
#0c1412
line
#e6dfd2
#1e2b26
#1e2b26
line-soft
#efe9dd
#1e2b26
#1e2b26
ink
#0c1412
#e9f2ec
#e9f2ec
ink-mut
#4a5f55
#8fa79c
#8fa79c
ink-soft
#38463f
#c9d6ce
#c9d6ce
ink-dim
#6a736e
#648176
#648176
sovereign
#6e3fb8
#9c6fd6
#9c6fd6
sovereign-strong
#4f2a8c
#e4d6fa
#c9b2ee
sovereign-soft
#865fb8
#b79fe0
#b79fe0
sovereign-wash
#eadff8
#171028
#120e1e
sovereign-tint
#f7f2fc
#120e1e
#120e1e
on-primary
#ffffff
#06110c
#06110c
register-on
ink
you
ai
link
sovereign
sovereign-soft
ai
link-hover
#4f2a8c
#e4d6fa
#8eddee
guard
#4a3aa8
#b7a8f7
#b7a8f7
guard-wash
#ece8fa
#12102a
bg
verified
#2e6b1e
biomass
biomass
verified-wash
#e4f1df
#0c1412
#0c1412
b-value
#e8b54b
#e8b54b
#e8b54b
b-chip
#0c1412
#0c1412
#0c1412
rose
#a3122b
#c41e3a
#c41e3a
rose-deep
#6e0c1f
#8e1230
#8e1230
cat-works
#3f9c55
#3f9c55
#3f9c55
cat-idea
#a476ec
#a476ec
#a476ec
cat-bug
#c07f1c
#c07f1c
#c07f1c
cat-gap
#0092a6
#0092a6
#0092a6
