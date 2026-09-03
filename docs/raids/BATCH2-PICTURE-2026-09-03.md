# NINE MORE — THE PICTURE (one screen)

The second nine from the list. Firecrawl was already ruled and is not here. The rest read cover to
cover today.

| # | project | what a member gets | stays behind | recommended verdict |
|---|---|---|---|---|
| 1 | **Codebase Memory** (code memory for agents) | An agent that *remembers the whole codebase* — every function, call and import mapped into one local file, asked in plain queries — with **no model in the loop and no network at all** | Only its self-updater | **TAKE** — on every code seat, and as the shape for the hive's own memory |
| 2 | **GraphRAG** (Microsoft) | Documents turned into a map of who-relates-to-what, summarised neighbourhood by neighbourhood, so questions about a whole library can be answered; runs on the local engine | Its appetite: building the map costs several model calls per page, and "ask the whole library" grows with the library — a meter line, not a free lunch; Azure stores | **PATTERN** — the neighbourhood-summary idea; run it only with the meter watching |
| 3 | **Trivy** (security scanner) | One command that checks a box, an image or a config for known holes, from a copy of the vulnerability list the hive keeps itself | It **reports home on every scan** unless two switches are set; the live list comes from the vendor's registry until mirrored | **INSTRUMENT** — with the phone-home switched off and the list mirrored |
| 4 | **Zed** (code editor) | The **Rust drawing engine underneath it (GPUI)** is free to lift outright — the same kind of engine the hive's deep seat is built on; the editor itself talks to a local model happily | The editor's licence keeps it beside the core, not inside; its AI, predictions, multiplayer, extension store, crash reports and updates all go to Zed's cloud, and reporting is **on by default** | **TAKE the engine · use the editor with reporting off · LEAVE the cloud** |
| 5 | **Continue** (AI coding assistant) | A coding helper that runs on the member's own model — and its makers have already **cut their own cloud out of the code** | The remaining version-check ping and the extension marketplaces | **INSTRUMENT** — self-built, local model |
| 6 | **LiteLLM** (one door to every model) | **One plug every seat speaks**, pointed at the local engine; no database needed for the simple case; the meter's natural front door | A proprietary "enterprise" folder that rides along with the server install — install the library, not that; a price-list download at start-up (one switch) | **TAKE the library and the plain proxy · LEAVE enterprise** |
| 7 | **OpenTofu** (infrastructure as code) | Describe the hive's boxes in files and stand them up repeatably, with the state file **encrypted on the member's side** and **no reporting anywhere** | The public module registry (mirrorable) | **INSTRUMENT** — the cleanest of the nine |
| 8 | **SearXNG** (private search) | A search box the hive runs itself — no tracking, and one line turns it into a tool agents can call; can also search the hive's own stores | The results are borrowed from Google, Bing and friends, who can shut the door any day; its licence means it runs beside the moat as a member's own box, never rebuilt inside it | **INSTRUMENT** — member-run, agent switch on, suggestions off |
| 9 | **uv** (Python packaging) | The tool the seats already use, now on the record: with a warmed cache it rebuilds a box **with the network unplugged** | Package and interpreter downloads until mirrored | **INSTRUMENT** — already in use |

Three switches before any of these run on a member's box: Zed's reporting, Trivy's reporting,
LiteLLM's start-up download. Everything marked TAKE or INSTRUMENT keeps working the day the makers'
servers stop — except fetching new packages, new engines' results, or new vulnerability lists, which
is what mirrors are for.
