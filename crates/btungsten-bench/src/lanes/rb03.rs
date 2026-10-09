//! RB03: Crux-MIR properties of the actual gas-budget arithmetic in
//! `ops/ant-extsig/src/budget.rs`.
//!
//! The harness (`scripts/btungsten/rb03-budget`) compiles budget.rs itself by
//! path; nothing is extracted. This lane checks that correspondence (the
//! path, the file digest, the shared dependency pins), runs the concrete
//! vectors natively and under Crux-MIR, runs each symbolic property as its
//! own Crux-MIR process with a recorded budget, and requires the faulty
//! variants to be convicted.

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::{json, Value};

use crate::digest::file_tag;
use crate::host::{git_identity, host, loadavg};
use crate::measure::{self, output, output_env, Obs, Spec};
use crate::receipt::{Class, Outcome as O, Receipt, Row};
use crate::recognize::{crux_report, CruxReport};
use crate::stats::summary;
use crate::upstream::{read_lock, repo_root};

pub const CRUCIBLE_REV: &str = "25d0f3698a96cb8f014911146c02fabdb26f66ff";
/// crucible 25d0f369's dependencies/mir-json submodule commit.
pub const MIR_JSON_REV: &str = "ece1622caf39c9530873f376caa84a5fa6a3ded3";
pub const TOOLCHAIN: &str = "nightly-2026-03-21";
pub const SOLVER_SNAPSHOT: &str = "snapshot-20260622";
/// GaloisInc/crucible Actions run 37835376050 (push of 25d0f369), artifact
/// 11575803445 `crux-mir-ubuntu-24.04-X64-9.10.3`, as the API reports it.
pub const CRUX_ARTIFACT_SHA256_HEX: &str =
    "005bbf274cfda4937954ba63d91f8a170306baaea381dda034eb376d6bce3da6"; // PUBLIC-CONSTANT: upstream CI artifact digest
/// GaloisInc/what4-solvers release snapshot-20260622, ubuntu-24.04-X64-bin.zip.
pub const SOLVERS_SHA256_HEX: &str =
    "f4933ce5bc47d1a30d489266b86dfa6038110ab6850c96c42c34ee1327d0b705"; // PUBLIC-CONSTANT: upstream release asset digest
pub const HARNESS: &str = "scripts/btungsten/rb03-budget";
pub const BUDGET_RS: &str = "ops/ant-extsig/src/budget.rs";
pub const PATH_ATTR: &str = "#[path = \"../../../../ops/ant-extsig/src/budget.rs\"]";
pub const SHIM_SRC: &str = "crates/btungsten-bench/src/bin/rb-cvc5-intblast.rs";

/// How Crux-MIR's goals are decided. Both run with
/// `--force-offline-goal-solving` (a fresh solver process per goal).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Strategy {
    /// cvc5 with `--solve-bv-as-int=sum` through the `rb-cvc5-intblast`
    /// shim: bit-vector goals as integer arithmetic. The required rows.
    IntBlast,
    /// bitwuzla, bit-blasting: the bundle's default bit-vector solver. An
    /// optional cross-check by an independent solver and method.
    BitBlast,
}

impl Strategy {
    pub fn label(self) -> &'static str {
        match self {
            Strategy::IntBlast => "cvc5-intblast",
            Strategy::BitBlast => "bitwuzla",
        }
    }
    fn solver(self) -> &'static str {
        match self {
            Strategy::IntBlast => "cvc5",
            Strategy::BitBlast => "bitwuzla",
        }
    }
}

/// (test name, the claim, the domain).
const PROPERTIES: &[(&str, &str, &str)] = &[
    ("p1_zero_gas_limit_refuses", "fee_cap refuses a zero gas limit as ZeroGasLimit", "remaining, fee, headroom_num, headroom_den: all u128"),
    ("p2_refuses_iff_network_fee_unaffordable", "with gas_limit != 0, fee_cap refuses exactly when network_fee × gas_limit > remaining (overflow counted as unaffordable)", "all five arguments u128, gas_limit != 0"),
    ("p3_cap_at_least_network_fee", "every returned cap ≥ the network fee", "all five arguments u128"),
    ("p4_cap_fits_remaining_budget", "every returned cap × gas_limit ≤ remaining, overflow-safe", "all five arguments u128"),
    ("p5_headroom_never_exceeded", "a returned cap never exceeds max(fee, ⌊fee × num / den⌋) when fee × num is representable", "all five arguments u128"),
    ("p6_headroom_granted_when_it_fits", "when ⌊fee × num / den⌋ fits the budget, the returned cap is at least it", "all five arguments u128"),
    ("p7_zero_denominator_reads_as_one", "headroom_den = 0 gives exactly the result of headroom_den = 1", "remaining, gas_limit, fee, headroom_num: all u128"),
    ("p8_gas_buffer_is_floor_six_fifths", "gas_limit_with_buffer(e) = ⌊e × 6/5⌋ ≥ e and the saturating multiply never saturates", "e: all u64"),
    ("p9_payment_floor_is_half_product", "payment_floor_limit(a, t) = ⌊a × t / 2⌋, or u128::MAX / 2 when a × t overflows", "a, t: all u128"),
    ("p10_refusal_reports_the_need", "an Unaffordable refusal carries gas_limit × fee (saturating), the need plan_fee_cap prints", "all five arguments u128"),
];

const TEETH: &[(&str, &str)] = &[
    (
        "t1_wrapping_affordability_cap_fits",
        "F1 (wrapping affordability check) must violate p4: a cap that does not fit",
    ),
    (
        "t2_ceiling_budget_cap_fits",
        "F2 (ceiling per-gas budget) must violate p4",
    ),
    (
        "t3_ceiling_budget_refuses_iff_unaffordable",
        "F2 must violate p2: an unaffordable fee accepted",
    ),
];

/// Budgets from the 2026-10-08 trials on this host: under cvc5 int-blasting
/// every property closed in 4-17 s and every TEETH variant was refuted in
/// under 80 s under bitwuzla; under bitwuzla, p2/p4/p5/p6 stayed Unknown at
/// 300, 900, 1,200 and 1,800 s goal timeouts (`trial_history`). The required
/// budget is 30x the slowest observed closure; the cross-check budget only
/// bounds how long an Unknown is waited for.
pub struct Plan {
    pub property_budget: Duration,
    pub goal_timeout_s: u64,
    pub repeat: usize,
    pub cross_check: bool,
    pub cross_budget: Duration,
    pub cross_goal_timeout_s: u64,
}

struct Tools {
    root: PathBuf,
    crux_mir: PathBuf,
    mirjson_bin: PathBuf,
    rlibs: PathBuf,
    solvers: PathBuf,
}

impl Tools {
    fn at(root: &Path) -> Result<Tools, String> {
        let crux_dist = std::fs::read_dir(root.join("crux-mir"))
            .map_err(|e| format!("{}: {e}", root.join("crux-mir").display()))?
            .filter_map(|e| e.ok().map(|e| e.path()))
            .find(|p| p.join("bin/crux-mir").exists())
            .ok_or("no crux-mir/<dist>/bin/crux-mir under the tools directory")?;
        let t = Tools {
            root: root.to_path_buf(),
            crux_mir: crux_dist.join("bin/crux-mir"),
            mirjson_bin: root.join("mir-json-inst/bin"),
            rlibs: root.join("mir-json/rlibs"),
            solvers: root.join("solvers"),
        };
        for p in [
            t.mirjson_bin.join("cargo-crux-test"),
            t.rlibs.join("libstd.rlib"),
            t.solvers.join("bitwuzla"),
            t.solvers.join("cvc5"),
        ] {
            if !p.exists() {
                return Err(format!(
                    "Crux-MIR bundle incomplete: {} missing",
                    p.display()
                ));
            }
        }
        Ok(t)
    }

    fn path_env(&self) -> String {
        format!(
            "{}:{}:{}:{}",
            self.mirjson_bin.display(),
            self.crux_mir.parent().unwrap_or(Path::new("")).display(),
            self.solvers.display(),
            std::env::var("PATH").unwrap_or_default()
        )
    }

    fn identity(&self) -> Value {
        let hex_tag = |h: &str| {
            let bytes: Vec<u8> = (0..h.len() / 2)
                .filter_map(|i| u8::from_str_radix(&h[2 * i..2 * i + 2], 16).ok())
                .collect();
            format!("sha256:{}", crate::digest::b64url(&bytes))
        };
        let zip = |name: &str| {
            file_tag(&self.root.join("dl").join(name))
                .ok()
                .map(|(t, _)| t)
        };
        let crux_zip = zip("crux-mir-ubuntu-24.04-X64-9.10.3.zip");
        let solv_zip = zip("ubuntu-24.04-X64-bin.zip");
        let version = output(
            &[&self.crux_mir.display().to_string(), "--version"],
            Path::new("."),
        )
        .unwrap_or_default();
        let solver_version = |s: &str| {
            output(
                &[&self.solvers.join(s).display().to_string(), "--version"],
                Path::new("."),
            )
            .map(|v| v.lines().next().unwrap_or("").trim().to_string())
        };
        json!({
            "bundle": "crux-mir at crucible 25d0f369 (upstream CI build, GHC 9.10.3, ubuntu-24.04) + mir-json at that commit's submodule pin + Rust nightly-2026-03-21 + what4-solvers snapshot-20260622: the versions crucible's crux-mir-build.yml pins at 25d0f369",
            "crux_mir_version": version.lines().take(3).collect::<Vec<_>>(),
            "crux_mir_binary": file_tag(&self.crux_mir).ok().map(|(t, _)| t),
            "crux_artifact_zip": { "expected": hex_tag(CRUX_ARTIFACT_SHA256_HEX), "observed": crux_zip.clone(), "matches": crux_zip.as_deref() == Some(hex_tag(CRUX_ARTIFACT_SHA256_HEX).as_str()), "source": "GaloisInc/crucible Actions run 37835376050, artifact 11575803445 (expires 2027-01-06)" },
            "solvers_zip": { "expected": hex_tag(SOLVERS_SHA256_HEX), "observed": solv_zip.clone(), "matches": solv_zip.as_deref() == Some(hex_tag(SOLVERS_SHA256_HEX).as_str()), "release": format!("GaloisInc/what4-solvers {SOLVER_SNAPSHOT} ubuntu-24.04-X64-bin.zip") },
            "strategies": { "required": "cvc5-intblast: cvc5 --solve-bv-as-int=sum through rb-cvc5-intblast (src/bin/rb-cvc5-intblast.rs), offline goal solving", "cross_check": "bitwuzla, offline goal solving" },
            "solver_versions": { "bitwuzla": solver_version("bitwuzla"), "cvc5": solver_version("cvc5"), "yices": solver_version("yices"), "z3": solver_version("z3") },
            "mir_json": {
                "expected_rev": MIR_JSON_REV,
                "source_head": output(&["git", "rev-parse", "HEAD"], &self.root.join("mir-json")).map(|s| s.trim().to_string()),
                "version": output_env(&[&self.mirjson_bin.join("mir-json").display().to_string(), "--version"], Path::new("."), &[("PATH", self.path_env().as_str())]).map(|s| s.trim().to_string()),
            },
            "toolchain": TOOLCHAIN,
        })
    }
}

pub fn run(
    work: &Path,
    out: &Path,
    tools_dir: &Path,
    quick: bool,
) -> Result<(PathBuf, &'static str), String> {
    let plan = if quick {
        Plan {
            property_budget: Duration::from_secs(600),
            goal_timeout_s: 540,
            repeat: 1,
            cross_check: false,
            cross_budget: Duration::from_secs(0),
            cross_goal_timeout_s: 0,
        }
    } else {
        Plan {
            property_budget: Duration::from_secs(600),
            goal_timeout_s: 540,
            repeat: 3,
            cross_check: true,
            cross_budget: Duration::from_secs(420),
            cross_goal_timeout_s: 300,
        }
    };
    let root = repo_root();
    std::fs::create_dir_all(work).map_err(|e| format!("work directory {}: {e}", work.display()))?;
    let logs = out.join("logs");
    std::fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
    let tools = Tools::at(tools_dir)?;
    let harness = root.join(HARNESS);
    let target = work.join("rb03-target");
    let cargo_home = work.join("cargo-home-rb03");
    let mut n = 0usize;
    let mut stem = |name: &str| {
        n += 1;
        logs.join(format!("{n:03}-{name}"))
    };
    let rel = |p: &Path| p.strip_prefix(out).unwrap_or(p).display().to_string();

    let mut r = Receipt::new("RB03", "crux-mir-ant-extsig-budget", out);
    r.section("bnr", json!({ "checkout": git_identity(&root), "provenance_review_commit": "a3419732c0c06d1d24c8bca2d4cb70e5022971cf" }));
    r.section("host", host());
    let load_before = loadavg();
    let tool_id = tools.identity();
    let crux_ok = tool_id["crux_mir_version"].as_array().is_some_and(|l| {
        l.iter()
            .any(|x| x.as_str().is_some_and(|s| s.contains(CRUCIBLE_REV)))
    });
    let mj_ok = tool_id["mir_json"]["source_head"] == MIR_JSON_REV;
    r.row(
        Row::new(
            "toolchain-identity",
            Class::Vector,
            "crux-mir reports crucible 25d0f369; mir-json is that commit's submodule pin",
        )
        .expect(json!({ "crucible": CRUCIBLE_REV, "mir_json": MIR_JSON_REV }))
        .observe(
            if crux_ok && mj_ok { O::Pass } else { O::Fail },
            tool_id.clone(),
        ),
    );
    r.section("verifier", tool_id);

    // ---- correspondence ---------------------------------------------------------
    let lib = std::fs::read_to_string(harness.join("src/lib.rs")).map_err(|e| e.to_string())?;
    let resolved = harness
        .join("src")
        .join("../../../../ops/ant-extsig/src/budget.rs");
    let same_file = match (resolved.canonicalize(), root.join(BUDGET_RS).canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    };
    let (budget_tag, budget_len) = file_tag(&root.join(BUDGET_RS)).map_err(|e| e.to_string())?;
    let path_ok = lib.contains(PATH_ATTR) && lib.contains("pub mod budget;") && same_file;
    r.row(Row::new("correspondence-source", Class::Vector, "the harness compiles ops/ant-extsig/src/budget.rs itself through #[path] (no copy); the one extraction, fee_cap out of plan_fee_cap, keeps every production call site and is checked by correspondence-split")
        .expect(json!({ "path_attribute": PATH_ATTR, "resolves_to": BUDGET_RS }))
        .observe(if path_ok { O::Pass } else { O::Fail }, json!({ "budget_rs_sha256": budget_tag, "bytes": budget_len, "resolved_same_file": same_file })));
    let hl = read_lock(&harness.join("Cargo.lock"))?;
    let pl = read_lock(&root.join("ops/ant-extsig/Cargo.lock"))?;
    let mut shared = Vec::new();
    let mut mismatched = Vec::new();
    let mut harness_only = Vec::new();
    for p in hl.iter().filter(|p| p.name != "rb03-budget") {
        let prod: Vec<_> = pl.iter().filter(|q| q.name == p.name).collect();
        if prod.is_empty() {
            harness_only.push(format!("{} {}", p.name, p.version));
        } else if prod
            .iter()
            .any(|q| q.version == p.version && q.checksum == p.checksum)
        {
            shared.push(format!("{} {}", p.name, p.version));
        } else {
            mismatched.push(json!({ "package": p.name, "harness": p.version, "ant_extsig": prod.iter().map(|q| q.version.clone()).collect::<Vec<_>>() }));
        }
    }
    r.row(Row::new("correspondence-dependencies", Class::Vector, "every package the harness lockfile shares with ops/ant-extsig/Cargo.lock has the same version and checksum")
        .expect(json!("no mismatched shared package"))
        .observe(if mismatched.is_empty() { O::Pass } else { O::Fail }, json!({ "same_version_and_checksum": shared, "mismatched": mismatched, "harness_only": harness_only })));

    // ---- preparation + native build/test -------------------------------------------
    let _ = std::fs::remove_dir_all(&cargo_home);
    std::fs::create_dir_all(&cargo_home).map_err(|e| e.to_string())?;
    let ch = cargo_home.display().to_string();
    let tgt = target.display().to_string();
    let path_env = tools.path_env();
    let rlibs = tools.rlibs.display().to_string();
    let tc = format!("+{TOOLCHAIN}");
    let cargo = |stem: &Path, args: &[&str], budget: u64| -> Result<Obs, String> {
        let mut argv = vec!["cargo", tc.as_str()];
        argv.extend_from_slice(args);
        measure::run(
            &Spec::new(&argv, &harness, Duration::from_secs(budget), stem)
                .env("CARGO_HOME", &ch)
                .env("CARGO_TARGET_DIR", &tgt)
                .env(
                    "CARGO_NET_OFFLINE",
                    if args.first() == Some(&"fetch") {
                        "false"
                    } else {
                        "true"
                    },
                )
                .env("CRUX_RUST_LIBRARY_PATH", &rlibs)
                .env("PATH", &path_env),
        )
        .map_err(|e| e.to_string())
    };
    let lock_before = file_tag(&harness.join("Cargo.lock"))
        .map(|x| x.0)
        .map_err(|e| e.to_string())?;
    let fetch = cargo(&stem("prep-fetch-cold"), &["fetch", "--locked"], 1800)?;
    if !fetch.ok() {
        return Err(format!("cargo fetch failed: {}", fetch.stderr_text()));
    }
    let _ = std::fs::remove_dir_all(&target);
    let s = stem("native-test-cold");
    let native = cargo(&s, &["test", "--locked", "--offline", "--lib"], 1800)?;
    let nt = native.stdout_text();
    let native_ok = native.ok()
        && nt.contains("test result: ok.")
        && nt.contains("vectors::plan_fee_cap_vectors ... ok")
        && nt.contains("budget::tests::");
    r.row(Row::new("vectors-native", Class::Vector, "the boundary vectors (max values, zero and maximal denominators, exact fit and one wei short, zero gas limit) and ant-extsig's own budget.rs unit tests pass on the native build of the same file")
        .observe(if native_ok { O::Pass } else { O::Fail }, json!({ "summary": nt.lines().filter(|l| l.starts_with("test result:")).collect::<Vec<_>>(), "process": native.json(out) }))
        .evidence(&[&rel(&s.with_extension("stdout"))]));
    r.evidence_file(&rel(&s.with_extension("stdout")), "committed");
    let split_ok = native.ok()
        && nt.contains("prior::plan_fee_cap_is_unchanged_by_the_split ... ok")
        && nt.contains("budget::tests::plan_fee_cap_is_fee_cap_with_a_message ... ok");
    r.row(Row::new("correspondence-split", Class::Vector, "plan_fee_cap after the split returns the same cap or the same refusal text as the verbatim pre-split function (2e8d20970) on 74,536 boundary-grid inputs, and is fee_cap plus a message on 20,480 more")
        .observe(if split_ok { O::Pass } else { O::Fail }, json!({ "tests": ["prior::plan_fee_cap_is_unchanged_by_the_split", "budget::tests::plan_fee_cap_is_fee_cap_with_a_message"] }))
        .evidence(&[&rel(&s.with_extension("stdout"))]));

    // ---- Crux-MIR builds --------------------------------------------------------------
    let mut builds = Vec::new();
    let mut linked = std::collections::BTreeMap::new();
    for (label, feats) in [("honest", None), ("teeth", Some("teeth"))] {
        // cargo-crux-test takes neither --locked nor --offline: CARGO_NET_OFFLINE
        // (set for every cargo call here) keeps it offline, and the lockfile
        // must be byte-identical afterwards
        let mut args = vec!["crux-test", "--lib", "--no-run"];
        if let Some(f) = feats {
            args.extend_from_slice(&["--features", f]);
        }
        let o = cargo(&stem(&format!("crux-build-cold-{label}")), &args, 3600)?;
        if !o.ok() {
            return Err(format!("crux build ({label}) failed: {}", o.stderr_text()));
        }
        if file_tag(&harness.join("Cargo.lock"))
            .map(|x| x.0)
            .ok()
            .as_deref()
            != Some(lock_before.as_str())
        {
            return Err(format!(
                "crux build ({label}) changed the harness Cargo.lock"
            ));
        }
        let exe = executable_path(&o.stderr_text())
            .ok_or_else(|| format!("crux build ({label}): no Executable line"))?;
        linked.insert(
            label,
            PathBuf::from(format!("{}.linked-mir.json", exe.display())),
        );
        builds.push(o);
        let w = cargo(&stem(&format!("crux-build-warm-noop-{label}")), &args, 600)?;
        builds.push(w);
    }
    let mut mir_ids = serde_json::Map::new();
    for (label, p) in &linked {
        mir_ids.insert(
            label.to_string(),
            json!({ "linked_mir_sha256": file_tag(p).ok().map(|(t, _)| t) }),
        );
    }
    let src: Vec<(String, String)> = [
        "lib.rs",
        "spec.rs",
        "props.rs",
        "vectors.rs",
        "prior.rs",
        "faulty.rs",
    ]
    .iter()
    .filter_map(|f| {
        file_tag(&harness.join("src").join(f))
            .ok()
            .map(|(t, _)| (format!("src/{f}"), t))
    })
    .collect();
    mir_ids.insert("harness_sources".into(), json!({ "tree": crate::digest::tree_tag(&src), "files": src.iter().map(|(p, t)| json!({ "path": p, "sha256": t })).collect::<Vec<_>>() }));
    mir_ids.insert(
        "budget_rs".into(),
        json!(file_tag(&root.join(BUDGET_RS)).ok().map(|(t, _)| t)),
    );
    mir_ids.insert("harness_cargo_lock".into(), json!(lock_before));
    r.section("executables", Value::Object(mir_ids));

    // process startup of the verifier itself: crux-mir --version
    let mut st = Vec::new();
    for k in 0..if quick { 3 } else { 10 } {
        let s = stem(&format!("startup-crux-mir-{k}"));
        st.push(
            measure::run(
                &Spec::new(
                    &[&tools.crux_mir.display().to_string(), "--version"],
                    &harness,
                    Duration::from_secs(60),
                    &s,
                )
                .env("PATH", &path_env),
            )
            .map_err(|e| e.to_string())?,
        );
    }
    let pick = |f: &dyn Fn(&Obs) -> Option<u64>| st.iter().filter_map(f).collect::<Vec<u64>>();
    r.measure("startup_crux_mir_version", json!({ "wall_ns": summary(&pick(&|o| Some(o.wall_ns))), "user_cpu_us": summary(&pick(&|o| o.user_us)), "max_rss_kib": summary(&pick(&|o| o.max_rss_kib)), "runs": st.iter().map(|o| o.json(out)).collect::<Vec<_>>() }));
    r.measure("compile", json!({
        "native_test_cold_including_test_run": native.json(out),
        "crux_builds": builds.iter().map(|o| o.json(out)).collect::<Vec<_>>(),
        "note": "crux builds alternate cold (empty target for the first, honest; the teeth build shares the dependency artifacts) and warm no-op; the native build ran first into the same target directory",
    }));

    // ---- verification ------------------------------------------------------------------
    // the shim is installed as `cvc5` in a directory put first on the PATH of
    // the int-blasting runs; RB_CVC5 names the snapshot cvc5 it wraps
    let shim_built = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .with_file_name("rb-cvc5-intblast");
    let shim_dir = work.join("rb03-cvc5-shim");
    std::fs::create_dir_all(&shim_dir).map_err(|e| e.to_string())?;
    std::fs::copy(&shim_built, shim_dir.join("cvc5"))
        .map_err(|e| format!("install {} as cvc5: {e}", shim_built.display()))?;
    let path_intblast = format!("{}:{path_env}", shim_dir.display());
    let real_cvc5 = tools.solvers.join("cvc5").display().to_string();
    r.section(
        "solver_shim",
        json!({
            "binary": file_tag(&shim_built).ok().map(|(t, _)| t),
            "source": SHIM_SRC,
            "source_sha256": file_tag(&root.join(SHIM_SRC)).ok().map(|(t, _)| t),
            "wraps": real_cvc5,
            "adds": "--solve-bv-as-int=sum",
            "drops": "the script line (set-option :produce-abducts true): it puts cvc5 in SyGuS mode, which refuses integer blasting; abducts are only used with crux-mir --get-abducts, which is not passed",
        }),
    );
    let crux = |stem: &Path,
                json: &Path,
                filter: &str,
                strategy: Strategy,
                budget: Duration,
                goal: u64|
     -> Result<(Obs, CruxReport), String> {
        let o = measure::run(
            &Spec::new(
                &[
                    &tools.crux_mir.display().to_string(),
                    "--assert-false-on-error",
                    "--cargo-test-file",
                    &json.display().to_string(),
                    &format!("--solver={}", strategy.solver()),
                    "--force-offline-goal-solving",
                    &format!("--goal-timeout={goal}"),
                    &format!("--timeout={}", budget.as_secs().saturating_sub(30)),
                    "--no-colors",
                    "--show-model",
                    &format!("--test-filter={filter}"),
                ],
                &harness,
                budget,
                stem,
            )
            .env(
                "PATH",
                if strategy == Strategy::IntBlast {
                    &path_intblast
                } else {
                    &path_env
                },
            )
            .env("RB_CVC5", &real_cvc5)
            .env("CRUX_RUST_LIBRARY_PATH", &rlibs),
        )
        .map_err(|e| e.to_string())?;
        let rep = crux_report(&format!("{}\n{}", o.stdout_text(), o.stderr_text()));
        Ok((o, rep))
    };
    let honest = linked.get("honest").cloned().ok_or("no honest build")?;
    let teeth = linked.get("teeth").cloned().ok_or("no teeth build")?;
    let mut ver = serde_json::Map::new();

    // concrete vectors under crux
    let s = stem("crux-vectors");
    let (o, rep) = crux(
        &s,
        &honest,
        "vectors",
        Strategy::IntBlast,
        Duration::from_secs(600),
        300,
    )?;
    r.evidence_file(&rel(&s.with_extension("stdout")), "committed");
    let names = [
        "plan_fee_cap_vectors",
        "gas_buffer_vectors",
        "payment_floor_vectors",
    ];
    let all_ok = names.iter().all(|t| rep.status(t) == Some("ok"))
        && rep.overall.as_deref() == Some("Valid.");
    r.row(
        Row::new(
            "vectors-crux",
            Class::Vector,
            "the same boundary vectors pass under Crux-MIR's translation of the code",
        )
        .observe(
            if all_ok { O::Pass } else { O::Inconclusive },
            json!({ "tests": rep.tests, "overall": rep.overall }),
        )
        .evidence(&[&rel(&s.with_extension("stdout"))]),
    );
    ver.insert("vectors".into(), o.json(out));

    let mut strategies = vec![(
        Strategy::IntBlast,
        plan.property_budget,
        plan.goal_timeout_s,
        plan.repeat,
    )];
    if plan.cross_check {
        strategies.push((
            Strategy::BitBlast,
            plan.cross_budget,
            plan.cross_goal_timeout_s,
            1,
        ));
    }
    for (strategy, budget, goal, repeat) in strategies {
        let required = strategy == Strategy::IntBlast;
        let suffix = if required {
            String::new()
        } else {
            format!("@{}", strategy.label())
        };
        for (name, claim, domain) in PROPERTIES {
            let mut runs = Vec::new();
            let mut verdict = O::NotRun;
            let mut detail = Value::Null;
            for k in 0..repeat.max(1) {
                let s = stem(&format!("crux-{name}-{}-{k}", strategy.label()));
                let (o, rep) = crux(&s, &honest, name, strategy, budget, goal)?;
                r.evidence_file(&rel(&s.with_extension("stdout")), "committed");
                let this = property_outcome(&o, &rep, name);
                // repeated runs are for timing; they must also agree
                verdict = if k == 0 || this == verdict {
                    this
                } else {
                    O::Inconclusive
                };
                detail = json!({ "strategy": strategy.label(), "status": rep.status(name), "overall": rep.overall, "goals": rep.goals.map(|g| json!({ "total": g.total, "proved": g.proved, "disproved": g.disproved, "incomplete": g.incomplete, "unknown": g.unknown })), "errors": rep.errors, "counterexamples": rep.counterexamples });
                runs.push(o);
                if this != O::Pass {
                    break;
                }
            }
            let mut row = Row::new(&format!("{name}{suffix}"), Class::ProveUniversal, claim)
                .expect(json!({ "domain": domain, "status": "ok", "overall": "Valid.", "strategy": strategy.label() }))
                .observe(verdict, detail);
            if !required {
                row = row.optional();
            }
            r.row(row);
            ver.insert(format!("{name}{suffix}"), json!({
                "wall_ns": summary(&runs.iter().map(|o| o.wall_ns).collect::<Vec<_>>()),
                "user_cpu_us": summary(&runs.iter().filter_map(|o| o.user_us).collect::<Vec<_>>()),
                "max_rss_kib": summary(&runs.iter().filter_map(|o| o.max_rss_kib).collect::<Vec<_>>()),
                "runs": runs.iter().map(|o| o.json(out)).collect::<Vec<_>>(),
            }));
        }
        for (name, claim) in TEETH {
            let s = stem(&format!("crux-{name}-{}", strategy.label()));
            let (o, rep) = crux(&s, &teeth, name, strategy, budget, goal)?;
            r.evidence_file(&rel(&s.with_extension("stdout")), "committed");
            let convicted = rep.status(name).is_some_and(|st| st != "ok")
                && rep.overall.as_deref() == Some("Invalid.")
                && !rep.counterexamples.is_empty();
            let outcome = if convicted {
                O::Pass
            } else if rep.status(name) == Some("ok") && rep.overall.as_deref() == Some("Valid.") {
                O::Fail
            } else {
                O::Inconclusive
            };
            let mut row = Row::new(&format!("{name}{suffix}"), Class::Teeth, claim)
                .expect(json!({ "verdict": "Invalid. with a counterexample", "strategy": strategy.label() }))
                .observe(outcome, json!({ "status": rep.status(name), "overall": rep.overall, "counterexamples": rep.counterexamples, "errors": rep.errors }));
            if !required {
                row = row.optional();
            }
            r.row(row);
            ver.insert(format!("{name}{suffix}"), o.json(out));
        }
    }
    if !plan.cross_check {
        r.row(
            Row::new(
                "cross-check-bitwuzla",
                Class::ProveUniversal,
                "every property and TEETH row again under bitwuzla",
            )
            .optional()
            .observe(O::NotRun, json!("not run in the --quick plan")),
        );
    }
    r.measure("verification", Value::Object(ver));
    r.measure("network_bytes", json!("not measured: after preparation (cargo fetch) every step runs offline (CARGO_NET_OFFLINE=true for cargo; crux-mir and the solvers use no network)"));
    r.section("budgets", json!({
        "required_strategy": { "process_budget_s": plan.property_budget.as_secs(), "goal_timeout_s": plan.goal_timeout_s, "repeats": plan.repeat },
        "cross_check": { "run": plan.cross_check, "process_budget_s": plan.cross_budget.as_secs(), "goal_timeout_s": plan.cross_goal_timeout_s },
        "mode": "--force-offline-goal-solving: each goal in a fresh solver process (the online mode crashed crux-mir when a goal timed out, trial_history)",
        "derivation": "Plan (rb03.rs): the required budget is 30x the slowest closure observed in the trials; a property that does not close within it is INCONCLUSIVE, never PASS.",
    }));
    r.section("trial_history", json!([
        "2026-10-08 21:33 UTC: cargo crux-test --lib -- --solver=yices --goal-timeout=300 --timeout=850 --test-filter=props (plan_fee_cap before the split): p1 ok; p2 goal timed out; crux-mir then exited 1 with `user error (Unexpected response from solver while awaiting acknowledgement *** result:\"interrupted\" in response to command ***: (pop))`. A tool error, recorded as INCONCLUSIVE, not as a verdict.",
        "2026-10-08 21:39 UTC: the same with --solver=bitwuzla: p1 ok; p2 goal timed out; crux-mir exited 1 with `user error (Could not pop from empty entry stack.)`. INCONCLUSIVE (tool error).",
        "2026-10-08 21:45 UTC: each property alone, bitwuzla, --force-offline-goal-solving, goal timeout 900 s: even p3 (cap >= fee, immediate from .max(fee)) had not closed after 14 min, while the three TEETH variants (whose refusal messages format no integer) were refuted in 28-77 s. A probe formatting one symbolic u128 with format!(\"{x}\") alone did not close in 1,200 s. Diagnosis: plan_fee_cap formatted its symbolic u128 arguments into the refusal message, and u128 Display yields 128-bit division goals. Repair: the arithmetic moved into budget::fee_cap and plan_fee_cap wraps it with the same messages (correspondence-split); the properties are stated on fee_cap.",
        "2026-10-08 22:00 UTC, on fee_cap, bitwuzla offline: p1, p3, p7, p8, p9, p10 Valid in 4-53 s; p5 Unknown (1 of 14 goals) at a 1,200 s goal timeout. A probe of the bare 128-bit lemma (g != 0 => (r / g < f <=> f * g > r, overflow-safe)) was Unknown at 1,100 s.",
        "2026-10-08 22:23 UTC: p2, p4, p6 restated over a bounded domain (gas_limit < 2^32, fee < 2^64, remaining < 2^96, headroom < 2^16), bitwuzla offline, goal timeout 1,800 s: each Unknown (1 goal). The bounded restatements were then removed: the full-domain results below subsume them.",
        "2026-10-08 22:40 UTC: the bare lemma as a 128-bit SMT-LIB problem: cvc5 1.3.1 --solve-bv-as-int=sum unsat in 0.53 s; z3 and cvc5 (default bit-blasting) timed out at 900 s.",
        "2026-10-08 23:00 UTC: crux-mir --solver=cvc5 through a shim adding --solve-bv-as-int=sum: cvc5 refused (`solveBVAsInt not supported in sygus`) because what4 sends (set-option :produce-abducts true); the shim was changed to drop that line. Then p2, p3, p4, p5, p6 Valid in 9-17 s each over the full domain.",
    ]));
    r.assumptions = vec![
        "Semantics are Crux-MIR's: MIR from rustc nightly-2026-03-21 through mir-json at ece1622c, unoptimized (test profile) with overflow checks, std from mir-json's translated libraries; u128/u64 arithmetic is modelled exactly as bit-vectors.".into(),
        "Each property is a separate Crux-MIR process over its own fresh symbolic inputs; a property's PASS needs its test line `ok` and `Overall status: Valid.` from that process.".into(),
        "--assert-false-on-error: a function crux-mir cannot translate becomes `assert false`, so an untranslatable path fails a property rather than passing it silently.".into(),
        format!("The required rows' goals are decided by cvc5 from what4-solvers {SOLVER_SNAPSHOT} with --solve-bv-as-int=sum (integer blasting: each bit-vector term becomes an integer with range constraints), through the rb-cvc5-intblast shim (solver_shim). The soundness of that translation is cvc5's; only an unsat (Proved) answer counts. The cross-check rows use bitwuzla from the same snapshot."),
        "fee_cap, not plan_fee_cap, is the function the symbolic properties call: plan_fee_cap is fee_cap with a refusal message (correspondence-split; vectors-native and vectors-crux run both).".into(),
    ];
    r.obligations = vec![
        "Ledger persistence: GasLedger::persist writes a temp file, fsyncs it and renames it; durability of the rename and the directory entry is not checked here.".into(),
        "Concurrent writers: budget.rs documents that two runs of one plan at the same time lose each other's entries (no lock); not checked, and not safe.".into(),
        "Receipt authenticity and chain observations: settle() takes the payer's balance change and receipt cost as given; nothing here checks they came from the chain.".into(),
        "Call-site arithmetic: main.rs computes reserve_limit = limit.saturating_mul(SEND_ATTEMPTS) before calling plan_fee_cap; at saturation the reserved limit is below the true four-attempt worst case. plan_fee_cap's guarantees hold for the gas limit it is given.".into(),
        "SEND_ATTEMPTS = 4 is a claim about evmlib v0.10.0's retry loop (retry.rs), not checked here.".into(),
        "GasLedger::reserve/settle/remaining_wei/exposure_wei and default_ledger_path are not covered by these properties.".into(),
    ];
    r.measure(
        "load_average",
        json!({ "before": load_before, "after": loadavg() }),
    );
    r.write().map_err(|e| e.to_string())
}

/// `Executable unittests src/lib.rs (<path>)` from `cargo crux-test --no-run`.
fn executable_path(stderr: &str) -> Option<PathBuf> {
    stderr
        .lines()
        .find_map(|l| {
            l.trim()
                .strip_prefix("Executable unittests src/lib.rs (")
                .and_then(|r| r.strip_suffix(')'))
        })
        .map(PathBuf::from)
}

fn property_outcome(o: &Obs, rep: &CruxReport, name: &str) -> O {
    match (rep.status(name), rep.overall.as_deref()) {
        (Some("ok"), Some("Valid.")) if rep.errors.is_empty() && o.ok() => O::Pass,
        (Some(st), Some("Invalid.")) if st != "ok" && !rep.counterexamples.is_empty() => O::Fail,
        // anything else (a budget kill, a tool error, a missing status line) is
        // not a recognized verdict: never a pass, and not a failure of the property
        _ => O::Inconclusive,
    }
}
