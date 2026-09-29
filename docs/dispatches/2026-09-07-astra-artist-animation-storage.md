# Artist animation possibilities and inscription storage sizes

Founder question: what can the original-based Blender studies become, especially
animations, and how do ERC-20i art sizes compare with NFTs? Read-only technical
research plus this record; no renderer deployment, mint, campaign or purchase.

## Measured study sizes

Decimal units: 1 kB = 1,000 bytes; 1 MB = 1,000,000 bytes.

| Representation | Measured bytes | Scope |
|---|---:|---|
| Individual PNG renders | 1,059,511–1,141,508 | Four 1000 × 1000 stills |
| GLB models | 5,406,620–6,086,320 | Four variants, 180 cells and embedded original image per file |
| Blender master | 7,764,280 | Five editable scenes, four packed original images |
| Monochrome flat SVG encoding probe | 34,949 | All 180 existing traced outlines, coordinates rounded to 0.1 source pixel |
| Gzip of that SVG probe | 9,517 | HTTP/storage compression measurement, not an automatic gas discount |

The flat SVG probe was constructed in memory from `source/cells.json`: use
`contour` when `area_px < 40`, otherwise `model_contour`; multiply normalized
coordinates by 820 and 821, format to one decimal place, emit one polygon per
cell, and wrap the polygons in a single teal-filled group. It excludes original
gradient textures, 3D lighting, animation and metadata. No visual fidelity or
contract compatibility was tested, and it was not published as finished art.
The existing trace source remains the durable geometry input. Reproduce the
size probe from the repository root with Python's standard library:

```python
import gzip, json
from pathlib import Path
cells = json.loads(Path('docs/mvp-walk/assets/genesis-3d/source/cells.json').read_text())['cells']
paths = []
for cell in cells:
    pts = cell['contour'] if cell['area_px'] < 40 else cell['model_contour']
    coords = ' '.join(f'{x*820:.1f},{y*821:.1f}' for x,y in pts)
    paths.append(f'<polygon points="{coords}"/>')
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 821"><g fill="#25aae3">' + ''.join(paths) + '</g></svg>').encode()
print(len(svg), len(gzip.compress(svg, mtime=0)))
```

## What the token label does and does not imply

ERC-20i does not establish a universal upload-size ceiling. Implementations and
rendering/ownership interfaces differ. The reference Fungi
[`Generator.sol`](https://github.com/ToddStool/fungi/blob/main/contracts/Generator.sol)
defines `SeedData`, stores shared rectangle layers, and has `getSvg` call
`toSvg(this.getMushroom(seed_data))`. This describes that repository source;
it is not a fresh claim that its tip matches the deployed FUNGI contract.

The conserved PEPi Base source's `mushroomOfOwnerByIndex` returns stored
`SeedData` directly: `docs/receipts/erc20i-s10-sources/Pepi-Base.sol:248`.
The seed record, shared renderer/data, generated SVG output and ownership
bookkeeping are different size accounts. Reporting only the seed as the
complete artwork's storage cost would hide the shared dependencies.

ERC-721's optional metadata extension defines `tokenURI`, which can reference
JSON describing the media. It does not impose a universal artwork file cap or
require that the media itself be stored on-chain. Fully on-chain NFT renderers
are also possible. Source: [ERC-721](https://eips.ethereum.org/EIPS/eip-721).

For one concrete marketplace boundary, OpenSea currently documents external
media up to 300 MB, recommends below 200 MB, and supports GLB, GLTF, video,
audio and HTML through `animation_url`. This is its service limit, not the
ERC-721 protocol or a sensible default download budget. It caches SVG `image`
media as PNG, so animated behavior must be checked in the actual viewer.
Source: [OpenSea media and traits](https://docs.opensea.io/docs/media-and-traits),
read 2026-09-07.

Direct on-chain storage is constrained by the selected chain, gas, encoding and
renderer execution. The EIP-170 24,576-byte limit concerns one deployed runtime
code body, not a universal maximum artwork file size. No current fee quote or
test deployment was performed. Source: [EIP-170](https://eips.ethereum.org/EIPS/eip-170).

## Proposed artist-facing directions

- A breathing bloom: all 180 cells rise and settle in a slow seamless loop.
- A musical sculpture: concentric waves respond to a track or performance.
- An unfolding mark: cells peel into depth and return to the original composition.
- Artist editions: artist-chosen motion, depth, tempo and sound with a stable
  recipe and declared remix permissions; creator credit remains attached.
- Exports for artists: social loops, album visuals, VJ/projection assets,
  interactive browser pieces, and later fabrication-ready derivatives.

Purple/humans, teal/AI and green/biomass remain meaningful through motion and
mixed gradients. Color should be accompanied by readable context. A pause
control and reduced-motion presentation belong in the viewing experience.

The suggested first experiment is one breathing bloom delivered both as a small
vector animation and a richer 3D loop. Compare actual appearance, mobile load,
file size and artist control before committing a collection design.

For durable art, preserve a compact versioned renderer, original geometry,
artist-approved parameters and a still fallback. Rich masters can accompany
the work through content-addressed storage with redundant retention. A hash
proves which bytes were intended; it does not keep those bytes available.
IPFS specifically requires ongoing retention/pinning: see
[IPFS persistence](https://docs.ipfs.tech/concepts/persistence/).
The estate's existing seed/renderer plus media-master direction is recorded in
`docs/specs/SPEC-DJBUZZ-1.md:17`; this is compatible design work, not evidence
that the new logo collection or an upload adapter already exists.

The first artist experience should allow creation, playback and export before
asking for a wallet. Any collector edition is a later explicit publishing
choice. Existing token collections are not arbitrary upload slots for these
new logos; a dedicated renderer/collection or an identified derivative viewer
would need its own implementation and review.

## Founder follow-up: skaists, LOVErnment DAO and the Raver view

The founder explicitly included skaists and LOVErnment DAO in this direction,
and selected `green-teal BN logo.jpg` as a reference for empathic and emotional
communication in the Raver view alongside the existing inscription art.

The shared original has a green outer field, a teal transition and purple
center. Its authored relationships should guide motion and composition.
The current hub's Raver art stage already includes FUNGi, FROGGi and PEPi
snapshots with a source caption (`surfaces/index.html:45`). Keep those artworks
and their source links intact; presentation effects do not change the chain art.

Concrete next board lane for Grok, after the current #28 review edits:

- Show one coherent Raver composition for skaists, LOVErnment DAO and the
  creative community, combining the selected original and existing credited
  inscription snapshots. Artist names and legible context accompany color.
- Prototype three user-chosen expressions: gentle breathing, connected/shared
  rhythm, and celebration. These are expressive choices, not emotion detection.
  Do not infer mood or publish a mood/presence signal without an explicit act.
- Keep pause and motion intensity easy to reach. Honor reduced-motion settings;
  audio starts only through a deliberate action. The reading area stays legible.
- Show the route into people, art and collective participation with honest labels
  for available and proposed DAO/social features. No simulated activity counts.

Astra retains shared theme behavior, original-based geometry and byte budgets;
Grok retains the social journeys and creative board. The three views retain full
access, with New bee as the calm default. Raver is emotional communication as
well as dance-floor energy; Cypherpunk exposes provenance and mechanics. No
organization is assigned exclusively to a skin. This is the next design brief,
not a claim that the animations or DAO integration have already shipped.

## Research limitations

The Fungi whitepaper URL returned HTTP 404, and an initially guessed
`ERC-20i/Fungi` GitHub path also returned 404. Neither is evidence for the
claims above; the existing repository receipt identified `ToddStool/fungi`,
whose generator source was then read. Historical estate specs carry corrections
about mismatched implementations and ABIs; their old deployment ceilings were
not generalized into current family-wide file limits. No portfolio or live
inscription scan was performed.
