//! genealogy-publication — the content-addressed publication seal for the
//! staged genealogy corpus.
//!
//! Doctrine (follows `bnr-archive`): deterministic artifacts, zero network.
//! The corpus (roster + sources layer + 11,041 staged person pages) is
//! sealed into two committed artifacts:
//!
//! - `publication-state.json` — every page's SHA-256 and size, every corpus
//!   input's digest, and the file census. A pure function of the tree: no
//!   timestamps, so rebuilding an unchanged tree reproduces byte-identical
//!   output.
//! - `publication-index.json` — the machine index: per person, the evidence
//!   links (FamilySearch refs, record arks, family edges) and the page
//!   hashes, bound to the state file by digest.
//!
//! `check` re-derives both from the tree and names any drift: a changed
//! page, a changed corpus file, an unbound or missing file, a stale or
//! tampered state/index. This is the gate that keeps the publication
//! continuously maintainable — an authorized corpus change re-binds in one
//! command; anything else goes red in CI.
//!
//! `resolve` emits the decentralized resolution record for a person: the
//! canonical `bnr://` address under a `.b` anchor (validated by `bnr-url`,
//! ORDER cC label law) and the rail locators (github-pages bootstrap,
//! arweave, autonomi, x0x). Locators only — rails fetch, this crate never
//! does. Serving is static and content-addressed, so the same bytes are
//! verifiable from any host with zero per-reader marginal cost.
//!
//! Scale claim, bounded: the publication is a set of immutable
//! content-addressed artifacts served statically; adding readers adds no
//! dev-owned capacity. It is NOT a load-tested 10-billion-user claim.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};

pub const SCHEMA_STATE: &str = "skaists.genealogy-publication-state/1";
pub const SCHEMA_INDEX: &str = "skaists.genealogy-publication-index/1";
pub const TOOL: &str = env!("CARGO_PKG_NAME");
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// The corpus inputs, bound by digest. Paths relative to the repo root.
pub const CORPUS_FILES: [&str; 9] = [
    "assets/profile-archive/lineage/remington-bloodline.json",
    "assets/profile-archive/lineage/blood-relation-reconciliation.json",
    "assets/profile-archive/lineage/staging-inventory.json",
    "assets/profile-archive/lineage/attested-overlays.json",
    "assets/profile-archive/lineage/identity-registry.json",
    "assets/profile-archive/lineage/sources/index.json",
    "assets/profile-archive/lineage/sources/records.json",
    "assets/profile-archive/lineage/sources/images-summary.json",
    "assets/profile-archive/lineage/sources/rights-qualification.json",
];

/// Declared rails — NAMES ONLY, not fetch locators (issue #475 §3): no
/// resolvable Arweave transaction ids, Autonomi addresses or x0x routes
/// live in this crate. Naming a rail here claims no working retrieval.
pub const RAILS: [(&str, &str); 4] = [
    (
        "github-pages",
        "declared rail — bootstrap origin; name only, no fetch route in this crate",
    ),
    (
        "arweave",
        "declared rail — adapter-arweave owns any future fetch route",
    ),
    (
        "autonomi",
        "declared rail — adapter-autonomi owns any future fetch route",
    ),
    ("x0x", "declared rail — ops/x0x owns any future mesh route"),
];

fn lineage_dir(root: &Path) -> PathBuf {
    root.join("assets/profile-archive/lineage")
}
fn persons_dir(root: &Path) -> PathBuf {
    lineage_dir(root).join("persons")
}
pub fn state_path(root: &Path) -> PathBuf {
    lineage_dir(root).join("publication-state.json")
}
pub fn index_path(root: &Path) -> PathBuf {
    lineage_dir(root).join("publication-index.json")
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    let out = h.finalize();
    let mut s = String::with_capacity(64);
    for b in out {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

fn digest_file(path: &Path) -> std::io::Result<(String, u64)> {
    let bytes = fs::read(path)?;
    let n = bytes.len() as u64;
    Ok((sha256_hex(&bytes), n))
}

fn read_json(path: &Path) -> Result<Value, String> {
    let bytes = fs::read(path).map_err(|e| format!("{}: {e}", path.display()))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("{}: {e}", path.display()))
}

/// The persons directory census: staged page ids by extension, plus any
/// file that is neither `<id>.html` nor `<id>.json`.
struct Census {
    html: BTreeMap<String, (String, u64)>, // id -> (sha256, bytes)
    json: BTreeMap<String, (String, u64)>,
    strays: Vec<String>,
}

fn census_persons(root: &Path) -> Result<Census, String> {
    let dir = persons_dir(root);
    let mut c = Census {
        html: BTreeMap::new(),
        json: BTreeMap::new(),
        strays: vec![],
    };
    for entry in fs::read_dir(&dir).map_err(|e| format!("{}: {e}", dir.display()))? {
        let entry = entry.map_err(|e| format!("{}: {e}", dir.display()))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        // Issue #475 §4: never follow a symlink or hash a non-regular file —
        // a page must be a regular file inside the corpus, nothing outside it.
        let ft = entry.file_type().map_err(|e| format!("{name}: {e}"))?;
        if ft.is_symlink() {
            c.strays.push(format!("symlink refused: {name}"));
            continue;
        }
        if !ft.is_file() {
            c.strays.push(format!("not-a-regular-file refused: {name}"));
            continue;
        }
        if let Some(id) = name.strip_suffix(".html") {
            let d = digest_file(&entry.path())
                .map_err(|e| format!("{}: {e}", entry.path().display()))?;
            c.html.insert(id.to_string(), d);
        } else if let Some(id) = name.strip_suffix(".json") {
            let d = digest_file(&entry.path())
                .map_err(|e| format!("{}: {e}", entry.path().display()))?;
            c.json.insert(id.to_string(), d);
        } else {
            c.strays.push(name);
        }
    }
    Ok(c)
}

pub struct BindOutcome {
    pub state_json: String,
    pub index_json: String,
    pub persons: usize,
}

/// Derive the state + index from the tree. Deterministic: identical tree in,
/// identical bytes out. Does not write.
pub fn bind(root: &Path) -> Result<BindOutcome, String> {
    // corpus digests (file bytes, exact)
    let mut corpus = Map::new();
    for rel in CORPUS_FILES {
        let (sha, n) =
            digest_file(&root.join(rel)).map_err(|e| format!("corpus input {rel}: {e}"))?;
        corpus.insert(rel.to_string(), json!({"sha256": sha, "bytes": n}));
    }

    let roster = read_json(&root.join(CORPUS_FILES[0]))?;
    let persons = roster
        .get("persons")
        .and_then(Value::as_object)
        .ok_or("roster: persons map missing")?;

    // family edges (child -> parents) and couples, filtered to staged persons
    let edges = roster
        .get("edges")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut children: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
    for (child, parents) in &edges {
        if !persons.contains_key(child) {
            continue;
        }
        if let Some(list) = parents.as_array() {
            for p in list {
                if let Some(pid) = p.as_str() {
                    if persons.contains_key(pid) {
                        children.entry(pid).or_default().push(child.as_str());
                    }
                }
            }
        }
    }
    let mut spouses: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
    if let Some(couples) = roster.get("couples").and_then(Value::as_object) {
        for c in couples.values() {
            let (Some(p1), Some(p2)) = (
                c.get("p1").and_then(Value::as_str),
                c.get("p2").and_then(Value::as_str),
            ) else {
                continue;
            };
            if persons.contains_key(p1) && persons.contains_key(p2) {
                spouses.entry(p1).or_default().push(p2);
                spouses.entry(p2).or_default().push(p1);
            }
        }
    }

    // record arks per person, from the sources index (cohort-scoped)
    let sources_index = read_json(&root.join(CORPUS_FILES[5]))?;
    let mut record_arks: BTreeMap<&str, Vec<String>> = BTreeMap::new();
    if let Some(sp) = sources_index.get("persons").and_then(Value::as_object) {
        for (iid, entry) in sp {
            if persons.contains_key(iid) {
                if let Some(list) = entry.get("sources").and_then(Value::as_array) {
                    for s in list {
                        if let Some(id) = s.get("id").and_then(Value::as_str) {
                            record_arks
                                .entry(iid.as_str())
                                .or_default()
                                .push(id.to_string());
                        }
                    }
                }
            }
        }
    }

    let census = census_persons(root)?;
    if !census.strays.is_empty() {
        return Err(format!(
            "persons directory carries {} unbound file(s): {}",
            census.strays.len(),
            census.strays.join(", ")
        ));
    }
    let roster_ids: Vec<&String> = persons.keys().collect();
    for (kind, ids) in [("html", &census.html), ("json", &census.json)] {
        if ids.len() != roster_ids.len() {
            return Err(format!(
                "census mismatch: {} staged persons but {kind} pages for {}",
                roster_ids.len(),
                ids.len()
            ));
        }
        for id in &roster_ids {
            if !ids.contains_key(id.as_str()) {
                return Err(format!("person {id} has no {kind} page"));
            }
        }
    }

    // the machine index entries
    let mut index_persons = Map::new();
    let mut pages = Vec::with_capacity(persons.len());
    let mut record_arks_total = 0usize;
    let mut fs_refs_total = 0usize;
    for (id, p) in persons {
        let h = &census.html[id.as_str()];
        let j = &census.json[id.as_str()];
        pages.push(json!({
            "id": id,
            "html": {"sha256": h.0, "bytes": h.1},
            "json": {"sha256": j.0, "bytes": j.1},
        }));
        let ev = p.get("evidence");
        let fs_refs: Vec<String> = p
            .get("refs")
            .and_then(Value::as_array)
            .map(|rs| {
                rs.iter()
                    .filter(|r| r.get("provider").and_then(Value::as_str) == Some("familysearch"))
                    .filter_map(|r| r.get("id").and_then(Value::as_str).map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        fs_refs_total += fs_refs.len();
        let arks = record_arks.get(id.as_str()).cloned().unwrap_or_default();
        record_arks_total += arks.len();
        let parents: Vec<&str> = edges
            .get(id)
            .and_then(Value::as_array)
            .map(|ps| {
                ps.iter()
                    .filter_map(|p| p.as_str())
                    .filter(|p| persons.contains_key(*p))
                    .collect()
            })
            .unwrap_or_default();
        index_persons.insert(
            id.clone(),
            json!({
                "name": p.get("name").cloned().unwrap_or(Value::Null),
                "lifespan": p.get("lifespan").cloned().unwrap_or(Value::Null),
                "era": ev.and_then(|e| e.get("era")).cloned().unwrap_or(Value::Null),
                "publication": p.get("publication").and_then(|x| x.get("status")).cloned().unwrap_or(Value::Null),
                "fsRefs": fs_refs,
                "recordArks": arks,
                "parents": parents,
                "spouses": spouses.get(id.as_str()).cloned().unwrap_or_default(),
                "children": children.get(id.as_str()).cloned().unwrap_or_default(),
                "pageHtml": format!("persons/{id}.html"),
                "pageJson": format!("persons/{id}.json"),
                "pageHtmlSha256": h.0,
                "pageJsonSha256": j.0,
            }),
        );
    }
    pages.sort_by(|a, b| a["id"].as_str().cmp(&b["id"].as_str()));

    let state = json!({
        "schema": SCHEMA_STATE,
        "tool": {"name": TOOL, "version": VERSION},
        "hexLawNote": "PUBLIC-CONSTANT machine-generated sha256 content digests of public artifacts",
        "corpus": corpus,
        "census": {
            "persons": persons.len(),
            "htmlPages": census.html.len(),
            "jsonPages": census.json.len(),
            "strays": census.strays.len(),
        },
        "pages": pages,
    });
    let state_json = serde_json::to_string(&state).map_err(|e| e.to_string())? + "\n";
    let state_sha = sha256_hex(state_json.as_bytes());

    let index = json!({
        "schema": SCHEMA_INDEX,
        "tool": {"name": TOOL, "version": VERSION},
        "hexLawNote": "PUBLIC-CONSTANT machine-generated sha256 content digests of public artifacts",
        "stateSha256": state_sha,
        "rootPerson": roster.get("root").cloned().unwrap_or(Value::Null),
        "counts": {
            "persons": persons.len(),
            "fsRefsTotal": fs_refs_total,
            "recordArksTotal": record_arks_total,
        },
        "persons": index_persons,
    });
    let index_json = serde_json::to_string(&index).map_err(|e| e.to_string())? + "\n";

    Ok(BindOutcome {
        state_json,
        index_json,
        persons: persons.len(),
    })
}

/// Write the bound artifacts (bind + persist).
pub fn bind_and_write(root: &Path) -> Result<BindOutcome, String> {
    let out = bind(root)?;
    fs::write(state_path(root), &out.state_json).map_err(|e| format!("write state: {e}"))?;
    fs::write(index_path(root), &out.index_json).map_err(|e| format!("write index: {e}"))?;
    Ok(out)
}

pub struct CheckReport {
    pub green: bool,
    pub findings: Vec<String>,
}

impl CheckReport {
    fn red(&mut self, msg: String) {
        self.green = false;
        self.findings.push(msg);
    }
}

/// Re-derive from the tree and compare against the committed state + index.
/// Green only when every page, every corpus input, the census, the state
/// file and the index file all agree. Findings are named, capped at
/// `max_named` (a total is always reported).
pub fn check(root: &Path, max_named: usize) -> Result<CheckReport, String> {
    let mut report = CheckReport {
        green: true,
        findings: vec![],
    };
    let state_file = state_path(root);
    let index_file = index_path(root);
    let state_on_disk = match fs::read_to_string(&state_file) {
        Ok(s) => Some(s),
        Err(_) => {
            report.red(format!(
                "state file absent: {} — run `gp bind`",
                state_file.display()
            ));
            None
        }
    };
    if fs::read_to_string(&index_file).is_err() {
        report.red(format!(
            "index file absent: {} — run `gp bind`",
            index_file.display()
        ));
    }

    // bind() failing means the tree itself violates the census contract
    let derived = match bind(root) {
        Ok(b) => b,
        Err(e) => {
            report.red(format!("bind refused: {e}"));
            return Ok(report);
        }
    };

    if let Some(disk) = &state_on_disk {
        if disk != &derived.state_json {
            // name the drift inside the state: corpus and per-page digests
            let disk_state: Value =
                serde_json::from_str(disk).map_err(|e| format!("state file unparseable: {e}"))?;
            let derived_state: Value =
                serde_json::from_str(&derived.state_json).map_err(|e| e.to_string())?;
            let mut named = 0usize;
            let dc = disk_state.get("corpus").and_then(Value::as_object);
            let vc = derived_state.get("corpus").and_then(Value::as_object);
            for rel in &CORPUS_FILES {
                let a = dc.and_then(|m| m.get(*rel));
                let b = vc.and_then(|m| m.get(*rel));
                if a != b && named < max_named {
                    named += 1;
                    report.red(format!(
                        "corpus drift: {rel} ({} -> {})",
                        a.and_then(|x| x.get("sha256"))
                            .and_then(Value::as_str)
                            .unwrap_or("absent"),
                        b.and_then(|x| x.get("sha256"))
                            .and_then(Value::as_str)
                            .unwrap_or("absent")
                    ));
                }
            }
            let dp = disk_state
                .get("pages")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let vp = derived_state
                .get("pages")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let dmap: BTreeMap<String, &Value> = dp
                .iter()
                .map(|p| (p["id"].as_str().unwrap_or("").to_string(), p))
                .collect();
            let mut page_drift = 0usize;
            for p in &vp {
                let id = p["id"].as_str().unwrap_or("");
                match dmap.get(id) {
                    None if named < max_named => {
                        named += 1;
                        page_drift += 1;
                        report.red(format!(
                            "page {id}: new on disk, absent from committed state"
                        ));
                    }
                    None => page_drift += 1,
                    Some(old) => {
                        if old["html"] != p["html"] || old["json"] != p["json"] {
                            page_drift += 1;
                            if named < max_named {
                                named += 1;
                                report.red(format!(
                                    "page drift: persons/{id} (html {} -> {}, json {} -> {})",
                                    old["html"]["sha256"].as_str().unwrap_or("?"),
                                    p["html"]["sha256"].as_str().unwrap_or("?"),
                                    old["json"]["sha256"].as_str().unwrap_or("?"),
                                    p["json"]["sha256"].as_str().unwrap_or("?")
                                ));
                            }
                        }
                    }
                }
            }
            for (id, _) in &dmap {
                if !vp.iter().any(|p| p["id"].as_str() == Some(id.as_str())) {
                    page_drift += 1;
                    if named < max_named {
                        named += 1;
                        report.red(format!("page {id}: in committed state, missing from tree"));
                    }
                }
            }
            if page_drift > 0 {
                report.red(format!("total page drift: {page_drift}"));
            }
            if report.findings.is_empty() {
                report.red(
                    "state file bytes differ from re-derivation (fields above matched)".to_string(),
                );
            }
        }
    }

    if let Ok(disk_index) = fs::read_to_string(&index_file) {
        if disk_index != derived.index_json {
            let want = serde_json::from_str::<Value>(&derived.index_json)
                .map_err(|e| e.to_string())?
                .get("stateSha256")
                .and_then(Value::as_str)
                .unwrap_or("?")
                .to_string();
            report.red(format!(
                "index file stale or tampered (re-derivation stateSha256 {want}); run `gp bind`"
            ));
        }
    }

    Ok(report)
}

/// Options for [`resolve`] (issue #475 §2: resolve must validate the seal
/// it reports, fail closed on mismatch, and carry an independently pinned
/// trust root before anything calls it authenticated).
pub struct ResolveOptions<'a> {
    /// Canonical `bnr://` anchor label (e.g. `blood.b`). Address FORM
    /// validation only — an unregistered label is not authentication.
    pub bname: Option<&'a str>,
    /// Independently pinned root: the expected sha256 of the state file,
    /// taken from a channel outside the mutable pair (git commit, signed
    /// .b binding). When set, a mismatch refuses resolution.
    pub expect_state_sha: Option<&'a str>,
    /// Untrusted preview mode: proceeds past drift to let a developer
    /// inspect, with every skip visibly labeled. Never a verification.
    pub preview: bool,
}

impl Default for ResolveOptions<'_> {
    fn default() -> Self {
        ResolveOptions {
            bname: None,
            expect_state_sha: None,
            preview: false,
        }
    }
}

/// Resolution record for one person — FAIL CLOSED. Verifies, in order:
/// the pinned root (if given); the index↔state binding
/// (`index.stateSha256 == sha256(state bytes)`); state↔index agreement on
/// the person's page digests; and the page bytes themselves against the
/// state's digests, recomputed from disk. Only then are digests reported,
/// as verified facts with the trust-root mode named. Locators only — this
/// crate never fetches.
pub fn resolve(root: &Path, person: &str, opts: ResolveOptions) -> Result<String, String> {
    let state_bytes = fs::read(state_path(root))
        .map_err(|e| format!("state file unreadable (run `gp bind`): {e}"))?;
    let state_sha = sha256_hex(&state_bytes);
    if let Some(pin) = opts.expect_state_sha {
        if !pin.eq_ignore_ascii_case(&state_sha) {
            return Err(format!(
                "pinned-root mismatch: pin {pin}, local state hashes {state_sha} — refusing"
            ));
        }
    }

    let index_bytes = fs::read(index_path(root))
        .map_err(|e| format!("index file unreadable (run `gp bind`): {e}"))?;
    let index: Value =
        serde_json::from_slice(&index_bytes).map_err(|e| format!("index unparseable: {e}"))?;
    let index_claim = index
        .get("stateSha256")
        .and_then(Value::as_str)
        .unwrap_or("absent");
    if !index_claim.eq_ignore_ascii_case(&state_sha) {
        return Err(format!(
            "index not bound to the state beside it: index claims {index_claim}, state hashes {state_sha} — tampered or stale index; run `gp check` (or --preview to inspect, untrusted)"
        ));
    }

    let state: Value =
        serde_json::from_slice(&state_bytes).map_err(|e| format!("state unparseable: {e}"))?;
    let state_page = state
        .get("pages")
        .and_then(Value::as_array)
        .and_then(|ps| ps.iter().find(|p| p["id"].as_str() == Some(person)))
        .ok_or_else(|| format!("person {person} absent from the state pages"))?;
    let entry = index
        .get("persons")
        .and_then(|p| p.get(person))
        .ok_or_else(|| format!("person {person} not in the publication index"))?;

    // state ↔ index must agree on the page digests before either is believed
    let want_html = state_page["html"]["sha256"].as_str().unwrap_or("?");
    let want_json = state_page["json"]["sha256"].as_str().unwrap_or("?");
    let got_html = entry
        .get("pageHtmlSha256")
        .and_then(Value::as_str)
        .unwrap_or("?");
    let got_json = entry
        .get("pageJsonSha256")
        .and_then(Value::as_str)
        .unwrap_or("?");
    if got_html != want_html || got_json != want_json {
        return Err(format!(
            "index/state disagree on page digests for {person}: html index {got_html} vs state {want_html}; json index {got_json} vs state {want_json}"
        ));
    }

    // the pages themselves, recomputed from disk — state is the witness
    let mut disk_warnings: Vec<String> = vec![];
    let mut disk_ok = true;
    for (want, fname) in [
        (want_html, format!("{person}.html")),
        (want_json, format!("{person}.json")),
    ] {
        match digest_file(&persons_dir(root).join(&fname)) {
            Ok((got, _)) if got == want => {}
            Ok((got, _)) => {
                disk_ok = false;
                let msg = format!(
                    "page bytes drift: persons/{fname} state says {want}, disk hashes {got}"
                );
                if opts.preview {
                    disk_warnings.push(msg);
                } else {
                    return Err(format!(
                        "{msg} — failing closed (--preview to inspect, untrusted)"
                    ));
                }
            }
            Err(e) => {
                disk_ok = false;
                let msg = format!("page unreadable: persons/{fname}: {e}");
                if opts.preview {
                    disk_warnings.push(msg);
                } else {
                    return Err(msg);
                }
            }
        }
    }

    let anchor = match opts.bname {
        Some(fqn) => {
            let name = bnr_url::BName::parse_fqn(fqn)
                .map_err(|e| format!(".b anchor rejected by ORDER cC label law: {e:?}"))?;
            let raw = format!("bnr://{}/person/{person}", name.fqn());
            let url = bnr_url::BnrUrl::parse(&raw)
                .map_err(|e| format!("constructed address failed its own parser: {e:?}"))?;
            json!({
                "bName": name.fqn(),
                "url": url.canonical(),
                "note": "unregistered demonstration anchor — address FORM validation only, not authentication; .b registration is a founder gesture",
            })
        }
        None => Value::Null,
    };

    let trust_root = if opts.expect_state_sha.is_some() {
        json!({
            "mode": "pinned",
            "stateSha256": state_sha,
            "pinnedBy": "--expect-state-sha from a channel outside the mutable pair",
        })
    } else {
        json!({
            "mode": "unpinned-local",
            "stateSha256": state_sha,
            "warning": "no independently pinned root — binding verified locally only; a full local rewrite of state+index+pages would self-verify. Pin --expect-state-sha from git or a signed .b binding before trusting.",
        })
    };

    let out = json!({
        "schema": "skaists.genealogy-publication-resolve/2",
        "mode": if opts.preview { "preview-untrusted" } else { "verified-local" },
        "tool": {"name": TOOL, "version": VERSION},
        "person": {
            "id": person,
            "pageHtml": entry.get("pageHtml").cloned().unwrap_or(Value::Null),
            "pageJson": entry.get("pageJson").cloned().unwrap_or(Value::Null),
            "pageHtmlSha256": want_html,
            "pageJsonSha256": want_json,
            "fsRefs": entry.get("fsRefs").cloned().unwrap_or(Value::Null),
            "recordArks": entry.get("recordArks").cloned().unwrap_or(Value::Null),
        },
        "verification": {
            "pinnedRootChecked": opts.expect_state_sha.is_some(),
            "indexBoundToState": true,
            "stateIndexAgreeOnPerson": true,
            "pageDigestsRecomputedFromDisk": disk_ok,
        },
        "warnings": disk_warnings,
        "trustRoot": trust_root,
        "anchor": anchor,
        "indexSha256": sha256_hex(&index_bytes),
        "rails": RAILS.iter().map(|(rail, role)| json!({"rail": rail, "role": role})).collect::<Vec<_>>(),
        "note": "rails are declared names, not fetch locators; verify page digests against the pinned stateSha256 after any fetch — locators only, this crate never fetches",
    });
    Ok(serde_json::to_string_pretty(&out).map_err(|e| e.to_string())? + "\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture_root(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("gp-test-{}-{tag}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let lin = dir.join("assets/profile-archive/lineage");
        fs::create_dir_all(lin.join("persons")).unwrap();
        fs::create_dir_all(lin.join("sources")).unwrap();
        dir
    }

    fn write_fixture(dir: &Path) {
        let lin = dir.join("assets/profile-archive/lineage");
        // roster: root + two parents
        let roster = json!({
            "schema": "skaists.lineage/2",
            "root": "founder",
            "persons": {
                "founder": {"name": "Living", "living": true,
                    "evidence": {"era": "living", "support": "unsourced-entry"},
                    "publication": {"status": "private-stub"}, "refs": []},
                "pa": {"name": "Pat", "living": false, "lifespan": "1900-1950",
                    "evidence": {"era": "recorded", "support": "sourced"},
                    "publication": {"status": "public"},
                    "refs": [{"provider": "familysearch", "id": "AAA-111"}]},
                "ma": {"name": "Mat", "living": false, "lifespan": "1902-1970",
                    "evidence": {"era": "recorded", "support": "sourced"},
                    "publication": {"status": "public"},
                    "refs": [{"provider": "familysearch", "id": "BBB-222"}]}
            },
            "edges": {"founder": ["pa", "ma"]},
            "couples": {"pa|ma": {"p1": "pa", "p2": "ma"}}
        });
        fs::write(
            lin.join("remington-bloodline.json"),
            serde_json::to_string(&roster).unwrap(),
        )
        .unwrap();
        // sources index: one record ark on pa
        let si = json!({"schema": "skaists.sources/1", "root": "founder",
            "persons": {"pa": {"iid": "pa", "fsid": "AAA-111", "sources": [{"id": "QW-1"}]}}});
        fs::write(
            lin.join("sources/index.json"),
            serde_json::to_string(&si).unwrap(),
        )
        .unwrap();
        // the remaining corpus files are digested, not parsed
        for (i, rel) in CORPUS_FILES.iter().enumerate() {
            if i == 0 || i == 5 {
                continue; // roster and sources/index.json written above
            }
            let p = dir.join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(p, "{}").unwrap();
        }
        for id in ["founder", "pa", "ma"] {
            fs::write(
                lin.join(format!("persons/{id}.html")),
                format!("<html>{id}</html>"),
            )
            .unwrap();
            fs::write(
                lin.join(format!("persons/{id}.json")),
                format!("{{\"id\":\"{id}\"}}"),
            )
            .unwrap();
        }
    }

    #[test]
    fn bind_check_green_and_deterministic() {
        let dir = fixture_root("green");
        write_fixture(&dir);
        let a = bind_and_write(&dir).unwrap();
        assert_eq!(a.persons, 3);
        let first_state = fs::read_to_string(state_path(&dir)).unwrap();
        // determinism: rebind, byte-identical
        let b = bind(&dir).unwrap();
        assert_eq!(a.state_json, b.state_json);
        assert_eq!(a.index_json, b.index_json);
        // no timestamp drift between separate binds
        assert_eq!(first_state, b.state_json);
        let rep = check(&dir, 20).unwrap();
        assert!(rep.green, "findings: {:?}", rep.findings);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn sabotage_page_goes_red_named() {
        let dir = fixture_root("page");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        let page = dir.join("assets/profile-archive/lineage/persons/pa.html");
        let orig = fs::read_to_string(&page).unwrap();
        fs::write(&page, orig + "<!-- tampered -->").unwrap();
        let rep = check(&dir, 20).unwrap();
        assert!(!rep.green);
        assert!(
            rep.findings
                .iter()
                .any(|f| f.contains("persons/") && f.contains("pa")),
            "findings: {:?}",
            rep.findings
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn sabotage_corpus_goes_red_named() {
        let dir = fixture_root("corpus");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        let recs = dir.join("assets/profile-archive/lineage/sources/records.json");
        fs::write(&recs, "{\"records\":{}}").unwrap();
        let rep = check(&dir, 20).unwrap();
        assert!(!rep.green);
        assert!(
            rep.findings.iter().any(|f| f.contains("records.json")),
            "findings: {:?}",
            rep.findings
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn stray_and_missing_and_stale_state_go_red() {
        // stray file
        let dir = fixture_root("stray");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        fs::write(
            dir.join("assets/profile-archive/lineage/persons/notes.txt"),
            "x",
        )
        .unwrap();
        let rep = check(&dir, 20).unwrap();
        assert!(!rep.green);
        assert!(rep
            .findings
            .iter()
            .any(|f| f.contains("bind refused") && f.contains("unbound")));
        let _ = fs::remove_dir_all(&dir);

        // missing page
        let dir = fixture_root("missing");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        fs::remove_file(dir.join("assets/profile-archive/lineage/persons/ma.json")).unwrap();
        let rep = check(&dir, 20).unwrap();
        assert!(!rep.green);
        let _ = fs::remove_dir_all(&dir);

        // tampered index
        let dir = fixture_root("stale");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        let ip = index_path(&dir);
        let mut idx = fs::read_to_string(&ip).unwrap();
        idx.push(' ');
        fs::write(&ip, idx).unwrap();
        let rep = check(&dir, 20).unwrap();
        assert!(!rep.green);
        assert!(rep
            .findings
            .iter()
            .any(|f| f.contains("index file stale or tampered")));
        let _ = fs::remove_dir_all(&dir);

        // absent state
        let dir = fixture_root("absent");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        fs::remove_file(state_path(&dir)).unwrap();
        let rep = check(&dir, 20).unwrap();
        assert!(!rep.green);
        assert!(rep.findings.iter().any(|f| f.contains("state file absent")));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_emits_canonical_anchor_and_rejects_bad_names() {
        let dir = fixture_root("resolve");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        let out = resolve(
            &dir,
            "pa",
            ResolveOptions {
                bname: Some("blood.b"),
                ..Default::default()
            },
        )
        .unwrap();
        let v: Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["anchor"]["url"], "bnr://blood.b/person/pa");
        assert_eq!(v["person"]["pageHtml"], "persons/pa.html");
        assert_eq!(v["trustRoot"]["mode"], "unpinned-local");
        assert!(v["trustRoot"]["warning"].is_string());
        assert_eq!(v["verification"]["indexBoundToState"], true);
        assert_eq!(v["verification"]["pageDigestsRecomputedFromDisk"], true);
        assert!(resolve(
            &dir,
            "pa",
            ResolveOptions {
                bname: Some("Bad..x.b"),
                ..Default::default()
            }
        )
        .is_err());
        assert!(resolve(&dir, "nobody", ResolveOptions::default()).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_tampered_index_page_hash_fails_closed() {
        let dir = fixture_root("rx-hash");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        let ip = index_path(&dir);
        let mut idx: Value = serde_json::from_str(&fs::read_to_string(&ip).unwrap()).unwrap();
        // attacker edits the person's page hash but leaves stateSha256 intact:
        // the binding check passes; state↔index disagreement must catch it
        idx["persons"]["pa"]["pageHtmlSha256"] = json!("f".repeat(64));
        fs::write(&ip, serde_json::to_string(&idx).unwrap()).unwrap();
        let err = resolve(&dir, "pa", ResolveOptions::default()).unwrap_err();
        assert!(err.contains("index/state disagree"), "{err}");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_tampered_index_state_sha_fails_closed() {
        let dir = fixture_root("rx-sha");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        let ip = index_path(&dir);
        let mut idx: Value = serde_json::from_str(&fs::read_to_string(&ip).unwrap()).unwrap();
        idx["stateSha256"] = json!("0".repeat(64));
        fs::write(&ip, serde_json::to_string(&idx).unwrap()).unwrap();
        let err = resolve(&dir, "pa", ResolveOptions::default()).unwrap_err();
        assert!(err.contains("index not bound"), "{err}");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_page_drift_fails_closed_and_preview_labels_it() {
        let dir = fixture_root("rx-drift");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        let page = dir.join("assets/profile-archive/lineage/persons/pa.html");
        let orig = fs::read_to_string(&page).unwrap();
        fs::write(&page, orig.clone() + "<!-- drift -->").unwrap();
        // fail closed by default
        let err = resolve(&dir, "pa", ResolveOptions::default()).unwrap_err();
        assert!(
            err.contains("page bytes drift") && err.contains("failing closed"),
            "{err}"
        );
        // preview proceeds, visibly untrusted, with the drift named
        let out = resolve(
            &dir,
            "pa",
            ResolveOptions {
                preview: true,
                ..Default::default()
            },
        )
        .unwrap();
        let v: Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["mode"], "preview-untrusted");
        assert_eq!(v["verification"]["pageDigestsRecomputedFromDisk"], false);
        assert!(v["warnings"]
            .as_array()
            .unwrap()
            .iter()
            .any(|w| w.as_str().unwrap().contains("page bytes drift")));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_pinned_root_mismatch_refuses_and_match_passes() {
        let dir = fixture_root("rx-pin");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        let state_bytes = fs::read(state_path(&dir)).unwrap();
        let mut h = Sha256::new();
        h.update(&state_bytes);
        let real: String = h.finalize().iter().map(|b| format!("{b:02x}")).collect();
        let wrong = "a".repeat(64);
        let err = resolve(
            &dir,
            "pa",
            ResolveOptions {
                expect_state_sha: Some(&wrong),
                ..Default::default()
            },
        )
        .unwrap_err();
        assert!(err.contains("pinned-root mismatch"), "{err}");
        let out = resolve(
            &dir,
            "pa",
            ResolveOptions {
                expect_state_sha: Some(&real),
                ..Default::default()
            },
        )
        .unwrap();
        let v: Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["trustRoot"]["mode"], "pinned");
        assert_eq!(v["verification"]["pinnedRootChecked"], true);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn census_refuses_symlinked_and_nonregular_pages() {
        let dir = fixture_root("rx-link");
        write_fixture(&dir);
        bind_and_write(&dir).unwrap();
        let outside = dir.join("outside-secret.html");
        fs::write(&outside, "not part of the corpus").unwrap();
        let link = dir.join("assets/profile-archive/lineage/persons/evil.html");
        let made = make_symlink(&outside, &link).is_ok();
        if !made {
            // this Windows host may refuse unprivileged symlinks; CI (ubuntu)
            // creates it and exercises the refusal
            eprintln!(
                "symlink creation unavailable on this host — negative control deferred to CI"
            );
            let _ = fs::remove_dir_all(&dir);
            return;
        }
        match bind(&dir) {
            Err(e) => assert!(
                e.contains("symlink refused") || e.contains("unbound"),
                "{e}"
            ),
            Ok(_) => panic!("bind accepted a symlinked page into the census"),
        }
        let _ = fs::remove_dir_all(&dir);
    }

    #[cfg(windows)]
    fn make_symlink(orig: &Path, link: &Path) -> std::io::Result<()> {
        std::os::windows::fs::symlink_file(orig, link)
    }

    #[cfg(unix)]
    fn make_symlink(orig: &Path, link: &Path) -> std::io::Result<()> {
        std::os::unix::fs::symlink(orig, link)
    }
}
