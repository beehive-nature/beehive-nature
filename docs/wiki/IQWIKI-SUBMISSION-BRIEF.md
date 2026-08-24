# IQ.wiki deployment brief — what SOPHIA requires of our three wiki articles

Researched 2026-08-23 from iq.wiki's own pages (guidelines, FAQ, SOPHIA page, sophia.iqai.com).

## The submission path

- Entry point: the **"Suggest Wiki" button on iq.wiki** — it opens a **chat with SOPHIA**, the
  platform's AI editor, "where you can share details about a new topic or an update to an
  existing page" (FAQ).
- SOPHIA "gathers the proposal, runs it against the editorial standards, and routes it to the
  editorial team" (Guidelines). For updates: "Send SOPHIA the change with sources."
- Human editorial team verifies everything; "most decisions land within a few days."
- Accepted wikis are **signed on-chain on Polygon**.
- No wallet, staking, or token requirement is stated for suggesting wikis. (The $SOPHIA token
  gates *edit-priority suggestions* on sophia.iqai.com — a different, optional lane. The
  special:createpage URL exists but the flow runs through SOPHIA chat.)

## The requirements that bind us

1. **Scope: "Subject must be meaningfully connected to crypto."** Our articles are generic
   Linux/storage diagnostics. As-is they are OUT OF SCOPE. The crypto connection must be real,
   not a coat of paint: these are the failure modes of running *blockchain node* software (an
   antnode-class data store, an mmap'd node database) on ARM64 Linux. Framing the symptom as
   "your node won't start / crawls" is the honest bridge; inventing a crypto angle is not.
2. **"Every claim needs a citation."** Accepted sources: "Official docs, primary sources, and
   reputable publications." This is the big lift: our articles currently credit community
   members (storage_guy, TT3, traktion, aautonomicc) — right thing to do, but a Discord/forum
   thread is NOT an accepted source. Each technical claim needs a kernel-docs, man-page, LMDB/
   upstream-docs, or reputable-publication citation pasted as text.
3. **SOPHIA cannot browse external links** (seat-established). Everything evidentiary must be
   pasted into the chat as text: the claim, the citation name, and the quoted passage. Bare
   GitHub/wiki links carry zero weight.
4. **Tone: clear, objective, neutral, educational — "educational value over hype or opinion."**
   Our articles already comply. No advertising/spam: our one-line attribution ceiling is inside
   this rule.
5. **No plagiarism, including unattributed paraphrasing.** Cite the kernel docs we paraphrase.
6. **Currency: accurate and current.** Kernel-behaviour claims (read-ahead captured at file
   open; KiB-vs-bytes sysfs semantics) must be pinned to a kernel-docs version and re-checked
   at submission time.

## Gap list per article (what must change before an IQ.wiki submission)

- **Article 1 (read-ahead):** add citations — kernel docs `Documentation/admin-guide/abi-testing`
  / block layer readahead docs, `udev(7)` man page for the ATTR rule. Community credit stays in
  a Credits line; it is attribution, not the citation.
- **Article 2 (OOM/ARM64):** citations — `mmap(2)` man page (ENOMEM causes), kernel arm64 docs
  on VA_BITS, `proc(5)` for overcommit. The VA_BITS-hypothesis fence already exceeds their
  neutrality bar — keep it.
- **Article 3 (dedup):** citations — the content-addressing scheme's own docs (upstream
  self-encryption/chunking documentation), CDC literature (e.g. the FastCDC paper), restic/borg
  dedup docs as reputable corroboration.

## Decision needed (founder)

Whether we submit these three to IQ.wiki at all, given the crypto-scope rule — vs. keeping them
on our own Pages estate where no scope rule applies and linking them from IQ.wiki articles that
DO meet scope (e.g. a "running an antnode on ARM64" wiki whose citations include our pages only
as non-evidentiary further reading). The second path preserves the articles as written; the
first requires the node-operator reframing above.
