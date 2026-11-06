#![forbid(unsafe_code)]
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    error::Error,
    fs,
    path::Path,
    process::{Command, Stdio},
    time::Instant,
};
type Result<T> = std::result::Result<T, Box<dyn Error>>;
const REPO: &str = "beehive-nature/beehive-nature";
const CUTOFF: &str = "2026-10-30T05:03:43Z";
fn read(p: &Path) -> Result<Value> {
    let b = fs::read(p)?;
    if b.len() > 64 * 1024 * 1024 {
        return Err("input exceeds 64 MiB".into());
    }
    Ok(serde_json::from_slice(&b)?)
}
fn write(p: &Path, v: &Value) -> Result<()> {
    fs::write(p, format!("{}\n", serde_json::to_string_pretty(v)?))?;
    Ok(())
}
fn digest(p: &Path) -> Result<String> {
    Ok(URL_SAFE_NO_PAD.encode(Sha256::digest(fs::read(p)?)))
}
fn hex_digest(p: &Path) -> Result<String> {
    Ok(Sha256::digest(fs::read(p)?)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect())
}
fn s<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
fn timestamp(s: &str) -> Option<i64> {
    DateTime::parse_from_rfc3339(s).ok().map(|t| t.timestamp())
}
fn delta(a: &str, b: &str) -> Option<f64> {
    let d = timestamp(b)? - timestamp(a)?;
    (d >= 0).then_some(d as f64)
}
fn api(endpoint: &str) -> Result<Value> {
    let cache = std::env::var("FORENSICS_API_CACHE").ok().map(|p| {
        Path::new(&p).join(format!(
            "{}.json",
            URL_SAFE_NO_PAD.encode(Sha256::digest(endpoint.as_bytes()))
        ))
    });
    if let Some(p) = &cache {
        if p.exists() {
            return read(p);
        }
    }
    let gh = std::env::var("GH_BIN").unwrap_or_else(|_| "gh".into());
    let out = Command::new(gh).args(["api", endpoint]).output()?;
    if !out.status.success() {
        return Err(format!("GitHub API failed ({}) for {endpoint}", out.status).into());
    }
    if out.stdout.len() > 32 * 1024 * 1024 {
        return Err("API response exceeds 32 MiB".into());
    }
    let value: Value = serde_json::from_slice(&out.stdout)?;
    if let Some(p) = cache {
        fs::create_dir_all(p.parent().ok_or("cache parent missing")?)?;
        fs::write(p, &out.stdout)?;
    }
    Ok(value)
}
fn select(v: &Value, keys: &[&str]) -> Value {
    let mut r = serde_json::Map::new();
    for k in keys {
        r.insert((*k).into(), v[*k].clone());
    }
    Value::Object(r)
}
fn collect(out: &Path) -> Result<()> {
    fs::create_dir(out)?;
    let mut pulls = Vec::new();
    for page in 1..=20 {
        let v = api(&format!(
            "repos/{REPO}/pulls?state=all&sort=created&direction=desc&per_page=100&page={page}"
        ))?;
        let rows = v.as_array().ok_or("PR array missing")?;
        for p in rows {
            if s(p, "created_at") >= "2026-07-04T00:00:00Z" && s(p, "created_at") <= CUTOFF {
                let mut row = select(
                    p,
                    &[
                        "number",
                        "title",
                        "state",
                        "draft",
                        "created_at",
                        "updated_at",
                        "closed_at",
                        "merged_at",
                        "html_url",
                    ],
                );
                row["head_sha"] = p["head"]["sha"].clone();
                pulls.push(row);
            }
        }
        if rows.len() < 100
            || rows
                .last()
                .is_some_and(|p| s(p, "created_at") < "2026-07-04T00:00:00Z")
        {
            break;
        }
        if page == 20 {
            return Err("PR pagination bound reached".into());
        }
    }
    write(&out.join("pulls.json"), &json!(pulls))?;
    let mut runs = BTreeMap::new();
    let mut intervals = Vec::new();
    let mut start = NaiveDate::from_ymd_opt(2026, 10, 15).unwrap();
    let end = NaiveDate::from_ymd_opt(2026, 10, 29).unwrap();
    while start <= end {
        let stop = (start + Duration::days(6)).min(end);
        fetch_interval(start, stop, &mut runs, &mut intervals)?;
        write(
            &out.join("runs.partial.json"),
            &json!(runs.values().collect::<Vec<_>>()),
        )?;
        write(&out.join("intervals.partial.json"), &json!(intervals))?;
        start = stop + Duration::days(1);
    }
    let runs: Vec<Value> = runs
        .into_values()
        .filter(|r| s(r, "created_at") <= CUTOFF)
        .collect();
    write(&out.join("runs.json"), &json!(runs))?;
    // Re-fetch documented cases, plus the earliest retained tests/pull_request run per day
    // in October 15-29. Selection uses creation time, never the observed delay/outcome.
    let mut ids: Vec<u64> = vec![
        39008052140,
        39013417846,
        39013417840,
        39057237019,
        39057237018,
        39166986891,
        39167003391,
        39179422708,
        39179422712,
        39179422723,
        39179422737,
        39179422744,
    ];
    let mut daily: BTreeMap<String, &Value> = BTreeMap::new();
    for r in &runs {
        let t = s(r, "created_at");
        if ("2026-10-15".."2026-10-30").contains(&t)
            && s(r, "name") == "tests"
            && s(r, "event") == "pull_request"
        {
            let day = t[..10].to_string();
            if daily.get(&day).is_none_or(|old| s(old, "created_at") > t) {
                daily.insert(day, r);
            }
        }
    }
    for r in daily.values() {
        ids.push(r["id"].as_u64().ok_or("run ID missing")?)
    }
    ids.sort();
    ids.dedup();
    let selected_ids = ids.clone();
    let mut jobs = Vec::new();
    let mut cases = Vec::new();
    for id in ids {
        let run = api(&format!("repos/{REPO}/actions/runs/{id}"))?;
        cases.push(select(
            &run,
            &[
                "id",
                "name",
                "event",
                "head_sha",
                "created_at",
                "run_started_at",
                "updated_at",
                "status",
                "conclusion",
                "run_attempt",
                "html_url",
            ],
        ));
        for page in 1..=5 {
            let v = api(&format!(
                "repos/{REPO}/actions/runs/{id}/jobs?filter=latest&per_page=100&page={page}"
            ))?;
            let a = v["jobs"].as_array().ok_or("jobs missing")?;
            for job in a {
                let mut j = select(
                    job,
                    &[
                        "id",
                        "run_id",
                        "run_attempt",
                        "name",
                        "status",
                        "conclusion",
                        "created_at",
                        "started_at",
                        "completed_at",
                        "html_url",
                    ],
                );
                j["run_created_at"] = run["created_at"].clone();
                j["run_name"] = run["name"].clone();
                j["run_event"] = run["event"].clone();
                j["steps"] = json!(job["steps"]
                    .as_array()
                    .unwrap_or(&Vec::new())
                    .iter()
                    .map(|step| select(
                        step,
                        &[
                            "name",
                            "number",
                            "status",
                            "conclusion",
                            "started_at",
                            "completed_at"
                        ]
                    ))
                    .collect::<Vec<_>>());
                jobs.push(j);
            }
            if a.len() < 100 {
                break;
            }
            if page == 5 {
                return Err("job pagination bound reached".into());
            }
        }
    }
    write(&out.join("jobs.json"), &json!(jobs))?;
    write(&out.join("case-runs.json"), &json!(cases))?;
    write(
        &out.join("collection.json"),
        &json!({"repository":REPO,"cutoff_utc":CUTOFF,"retrieved_at_utc":Utc::now().to_rfc3339(),"intervals":intervals,"pulls":pulls.len(),"retained_runs":runs.len(),"jobs":jobs.len(),"selected_run_ids":selected_ids,"daily_selection_ids":daily.values().map(|r|r["id"].clone()).collect::<Vec<_>>(),"coverage":"PRs created July 4 through cutoff. Workflow enumeration: tests.yml/pull_request, October 15-29 only; documented historical cases fetched separately. Retained API-visible records only; deleted/expired runs and logs cannot be reconstructed from this API. Latest job attempts only; PR API state observed at retrieval, timestamps cut at the fixed cutoff during analysis."}),
    )?;
    Ok(())
}
fn fetch_interval(
    start: NaiveDate,
    end: NaiveDate,
    runs: &mut BTreeMap<u64, Value>,
    intervals: &mut Vec<Value>,
) -> Result<()> {
    let base = format!("repos/{REPO}/actions/workflows/tests.yml/runs?event=pull_request&created={start}..{end}&per_page=100");
    let first = api(&format!("{base}&page=1"))?;
    let total = first["total_count"].as_u64().ok_or("run count missing")?;
    if total > 1000 {
        if start == end {
            return Err("single day exceeds GitHub 1000 search bound".into());
        }
        let mid = start + Duration::days((end - start).num_days() / 2);
        fetch_interval(start, mid, runs, intervals)?;
        return fetch_interval(mid + Duration::days(1), end, runs, intervals);
    }
    let mut count = 0;
    for page in 1..=total.div_ceil(100).max(1) {
        let v = if page == 1 {
            first.clone()
        } else {
            api(&format!("{base}&page={page}"))?
        };
        for r in v["workflow_runs"].as_array().ok_or("runs missing")? {
            count += 1;
            let row = select(
                r,
                &[
                    "id",
                    "name",
                    "event",
                    "head_sha",
                    "created_at",
                    "run_started_at",
                    "updated_at",
                    "status",
                    "conclusion",
                    "run_attempt",
                    "html_url",
                ],
            );
            runs.insert(r["id"].as_u64().ok_or("run ID missing")?, row);
        }
    }
    if count != total {
        return Err(format!("unstable pagination {start}..{end}: {count}/{total}").into());
    }
    intervals.push(json!({"from":start.to_string(),"through":end.to_string(),"api_count":total,"retrieved":count}));
    eprintln!("API interval {start}..{end}: {count}");
    Ok(())
}
fn quantile(v: &[f64], p: f64) -> f64 {
    let mut x = v.to_vec();
    x.sort_by(f64::total_cmp);
    if x.is_empty() {
        return f64::NAN;
    }
    let i = p * (x.len() - 1) as f64;
    let a = i.floor() as usize;
    let b = i.ceil() as usize;
    x[a] + (x[b] - x[a]) * (i - a as f64)
}
fn mean(v: &[f64]) -> f64 {
    v.iter().sum::<f64>() / v.len() as f64
}
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
}
fn paired(a: &[f64], b: &[f64]) -> Result<Value> {
    if a.len() != b.len() || a.len() < 2 || a.iter().chain(b).any(|x| !x.is_finite() || *x <= 0.0) {
        return Err("invalid paired samples".into());
    }
    let dif: Vec<f64> = a.iter().zip(b).map(|(a, b)| a - b).collect();
    let observed = mean(&dif).abs();
    let mut rng = Rng(0x5eed20261029);
    let mut boot = Vec::new();
    let mut extreme = 0;
    for _ in 0..10000 {
        let mut d = 0.0;
        let mut perm = 0.0;
        for x in &dif {
            d += dif[(rng.next() % dif.len() as u64) as usize];
            perm += if rng.next() & 1 == 0 { *x } else { -*x };
        }
        boot.push(d / dif.len() as f64);
        if (perm / dif.len() as f64).abs() >= observed {
            extreme += 1
        }
    }
    Ok(
        json!({"pairs":a.len(),"a_mean_seconds":mean(a),"b_mean_seconds":mean(b),"a_median_seconds":quantile(a,0.5),"b_median_seconds":quantile(b,0.5),"mean_paired_difference_seconds_a_minus_b":mean(&dif),"paired_bootstrap_mean_difference_95pct_ci_seconds":[quantile(&boot,0.025),quantile(&boot,0.975)],"paired_sign_flip_two_sided_monte_carlo_p":(extreme+1) as f64/10001.0,"resamples":10000,"seed":"0x5eed20261029","mean_ratio_a_over_b":mean(a)/mean(b)}),
    )
}
fn invoke(args: &[String], cwd: &Path) -> Result<(f64, i32)> {
    use std::os::unix::process::CommandExt;
    let start = Instant::now();
    let mut child = Command::new(args.first().ok_or("empty command")?)
        .args(&args[1..])
        .process_group(0)
        .current_dir(cwd)
        .env("PYTHONDONTWRITEBYTECODE", "1")
        .env("PYTHONHASHSEED", "0")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    loop {
        if let Some(status) = child.try_wait()? {
            return Ok((start.elapsed().as_secs_f64(), status.code().unwrap_or(-1)));
        }
        if start.elapsed().as_secs() >= 30 {
            let _ = Command::new("/bin/kill")
                .args(["-KILL", "--", &format!("-{}", child.id())])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
            let _ = child.kill();
            child.wait()?;
            return Ok((start.elapsed().as_secs_f64(), 124));
        }
        std::thread::sleep(std::time::Duration::from_millis(1));
    }
}
fn benchmark(
    out: &Path,
    python_module: &Path,
    runner: &Path,
    bsigner: &Path,
    source: &Path,
) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::create_dir(out)?;
    let corpus = out.join("corpus");
    fs::create_dir(&corpus)?;
    let content: Vec<u8> = (0..65536).map(|i| (i % 251) as u8).collect();
    let hash: String = Sha256::digest(&content)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    let mut manifest = Vec::new();
    for i in 0..512 {
        let name = format!("public-{i:04}.bin");
        let p = corpus.join(&name);
        fs::write(&p, &content)?;
        fs::set_permissions(p, fs::Permissions::from_mode(0o644))?;
        manifest.push(json!({"path":name,"bytes":content.len(),"sha256":hash,"mode":420}));
    }
    write(&corpus.join("manifest.json"), &json!(manifest))?;
    let anchor = hex_digest(&corpus.join("manifest.json"))?;
    // This invocation imports the preserved historical implementation unchanged.
    // No new Python algorithm is supplied; Rust creates fixtures and performs analysis.
    let py=vec!["/usr/bin/python3".into(),"-B".into(),"-c".into(),"import sys; from pathlib import Path; sys.path.insert(0, sys.argv[1]); from bsigner import verify_snapshot; verify_snapshot(Path(sys.argv[2]))".into(),python_module.parent().ok_or("module parent missing")?.to_string_lossy().into_owned(),corpus.to_string_lossy().into_owned()];
    let native = vec![
        runner.to_string_lossy().into_owned(),
        "verify".into(),
        corpus.to_string_lossy().into_owned(),
        anchor,
    ];
    let legacy_law = vec![
        "/bin/sh".into(),
        source
            .join("scripts/verify-law-signatures-rust.sh")
            .to_string_lossy()
            .into_owned(),
        bsigner.to_string_lossy().into_owned(),
    ];
    let native_law = vec![
        runner.to_string_lossy().into_owned(),
        "law".into(),
        bsigner.to_string_lossy().into_owned(),
        source.to_string_lossy().into_owned(),
    ];
    let mut workloads = Vec::new();
    let mut calibration = Vec::new();
    for _ in 0..5 {
        let (seconds, code) = invoke(&["/bin/true".into()], &corpus)?;
        if code != 0 {
            return Err("no-op control failed".into());
        }
        calibration.push(json!({"seconds":seconds,"exit":code}));
    }
    for (name, a, b, cwd) in [
        (
            "snapshot-integrity-python-vs-rust",
            &py,
            &native,
            corpus.as_path(),
        ),
        ("law-shell-node-vs-rust", &legacy_law, &native_law, source),
    ] {
        for _ in 0..3 {
            for cmd in [a, b] {
                let (_, code) = invoke(cmd, cwd)?;
                if code != 0 {
                    return Err(format!("warmup {name} exit {code}").into());
                }
            }
        }
        let mut rng = Rng(0x29c0de);
        let mut aa = Vec::new();
        let mut bb = Vec::new();
        let mut samples = Vec::new();
        for pair in 0..30 {
            let first = rng.next() & 1 == 0;
            let (ra, rb) = if first {
                (invoke(a, cwd)?, invoke(b, cwd)?)
            } else {
                let rb = invoke(b, cwd)?;
                (invoke(a, cwd)?, rb)
            };
            samples.push(json!({"pair":pair,"order":if first{"a,b"}else{"b,a"},"a_seconds":ra.0,"b_seconds":rb.0,"a_exit":ra.1,"b_exit":rb.1}));
            if ra.1 != 0 || rb.1 != 0 {
                return Err(format!("timed {name} exit failure: {},{}", ra.1, rb.1).into());
            }
            aa.push(ra.0);
            bb.push(rb.0);
        }
        let row = json!({"name":name,"a_command":a,"b_command":b,"cwd":cwd,"samples":samples,"statistics":paired(&aa,&bb)?});
        write(&out.join(format!("{name}.json")), &row)?;
        workloads.push(row);
    }
    // Decisions are about these implementations, not a language-wide vulnerability rate.
    let mut controls = Vec::new();
    for kind in [
        "clean",
        "changed-byte",
        "extra-file",
        "missing-file",
        "changed-mode",
        "manifest-and-content-replaced",
        "duplicate-path",
        "parent-traversal",
        "invalid-json",
    ] {
        let target = corpus.join("public-0000.bin");
        let original_manifest = fs::read(corpus.join("manifest.json"))?;
        match kind {
            "changed-byte" => {
                let mut changed = content.clone();
                changed[0] ^= 1;
                fs::write(&target, changed)?;
            }
            "extra-file" => fs::write(corpus.join("extra.bin"), b"public test")?,
            "missing-file" => fs::remove_file(&target)?,
            "changed-mode" => fs::set_permissions(&target, fs::Permissions::from_mode(0o600))?,
            "manifest-and-content-replaced" => {
                let replacement = b"public replacement";
                fs::write(&target, replacement)?;
                let mut m = manifest.clone();
                m[0]["bytes"] = json!(replacement.len());
                m[0]["sha256"] = json!(hex_digest(&target)?);
                write(&corpus.join("manifest.json"), &json!(m))?;
            }
            "duplicate-path" => {
                let mut m = manifest.clone();
                m.push(m[0].clone());
                write(&corpus.join("manifest.json"), &json!(m))?;
            }
            "parent-traversal" => {
                let mut m = manifest.clone();
                m[0]["path"] = json!("../outside");
                write(&corpus.join("manifest.json"), &json!(m))?;
            }
            "invalid-json" => fs::write(corpus.join("manifest.json"), b"{")?,
            _ => {}
        }
        let (_, a) = invoke(&py, &corpus)?;
        let (_, b) = invoke(&native, &corpus)?;
        if ![0, 1].contains(&a) || ![0, 1].contains(&b) {
            return Err("integrity control timed out or terminated unexpectedly".into());
        }
        controls.push(json!({"case":kind,"python_exit":a,"rust_exit":b,"expected":"clean: accept; mutations: reject","boundary":"anchor checks cause early rejection of manifest edits in Rust; these are not independent parser-path coverage tests"}));
        fs::write(&target, &content)?;
        fs::set_permissions(&target, fs::Permissions::from_mode(0o644))?;
        fs::write(corpus.join("manifest.json"), original_manifest)?;
        if kind == "extra-file" {
            fs::remove_file(corpus.join("extra.bin"))?;
        }
    }
    let mut files = Vec::new();
    for (label, p) in [
        ("historical_python", python_module),
        ("native_runner", runner),
        ("bsigner", bsigner),
        (
            "original_law_wrapper",
            source
                .join("scripts/verify-law-signatures-rust.sh")
                .as_path(),
        ),
    ] {
        files.push(json!({"label":label,"path":p,"sha256_base64url":digest(p)?}));
    }
    let output = json!({"created_at":Utc::now().to_rfc3339(),"files":files,"corpus":{"files":512,"bytes_per_file":65536,"total_content_bytes":33554432,"data":"byte[i] = i mod 251","mode":"0644"},"warmups_per_implementation":3,"noop_control":calibration,"workloads":workloads,"security_controls":controls,"limits":"One host, warm page cache, randomized order within 30 pairs, serial jobs, 30 second child timeout. Timing includes subprocess startup and Rust supervision polling every 1 ms; no-op controls are reported, not subtracted. Neither workload compares cryptographic implementations. Rust verifies an additional independent manifest anchor and optional file modes. p-values are descriptive for these repeated runs, not independent hosts or language-wide causal effects."});
    write(&out.join("benchmark.json"), &output)?;
    Ok(())
}
fn escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
fn bars(
    path: &Path,
    title: &str,
    subtitle: &str,
    rows: &[(String, f64, f64)],
    labels: (&str, &str),
    unit: &str,
) -> Result<()> {
    let height = 160 + rows.len() * 62;
    let max = rows.iter().map(|r| r.1 + r.2).fold(0.0, f64::max).max(1.0);
    let mut svg = format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="{height}" viewBox="0 0 1100 {height}" role="img"><title>{}</title><desc>{}</desc><rect width="1100" height="{height}" fill="#f4f7fc"/><g font-family="Arial,sans-serif" fill="#152139"><text x="28" y="35" font-size="23" font-weight="bold">{}</text><text x="28" y="60" font-size="14">{}</text><rect x="28" y="78" width="14" height="14" fill="#b86521"/><text x="49" y="90" font-size="13">{}</text><rect x="360" y="78" width="14" height="14" fill="#126b65"/><text x="381" y="90" font-size="13">{}</text>"##,
        escape(title),
        escape(subtitle),
        escape(title),
        escape(subtitle),
        escape(labels.0),
        escape(labels.1)
    );
    for (i, (label, a, b)) in rows.iter().enumerate() {
        let y = 115 + i * 62;
        let wa = a / max * 580.0;
        let wb = b / max * 580.0;
        svg += &format!(
            r##"<text x="28" y="{}" font-size="14">{}</text><rect x="340" y="{y}" width="{wa:.2}" height="23" fill="#b86521"/><rect x="{}" y="{y}" width="{wb:.2}" height="23" fill="#126b65"/><text x="340" y="{}" font-size="12">{a:.2} + {b:.2} {}</text>"##,
            y + 16,
            escape(label),
            340.0 + wa,
            y + 41,
            escape(unit)
        );
    }
    svg += &format!(
        r##"<text x="340" y="{}" font-size="12">Linear scale from zero; maximum stacked length = {max:.2} {}</text></g></svg>"##,
        height - 8,
        escape(unit)
    );
    fs::write(path, svg)?;
    Ok(())
}
fn analyze(data: &Path, benchmark: &Path, out: &Path) -> Result<()> {
    fs::create_dir(out)?;
    let pulls = read(&data.join("pulls.json"))?;
    let runs = read(&data.join("runs.json"))?;
    let jobs = read(&data.join("jobs.json"))?;
    let cases = read(&data.join("case-runs.json"))?;
    let bench = read(benchmark)?;
    let collection = read(&data.join("collection.json"))?;
    evidence_charts(&bench, out)?;
    let mut monthly: BTreeMap<String, Vec<&Value>> = BTreeMap::new();
    for p in pulls.as_array().ok_or("pulls missing")? {
        monthly
            .entry(s(p, "created_at")[..7].into())
            .or_default()
            .push(p);
    }
    let mut months = Vec::new();
    let mut pr_chart = Vec::new();
    for (month, prs) in monthly {
        let merged: Vec<f64> = prs
            .iter()
            .filter(|p| !s(p, "merged_at").is_empty() && s(p, "merged_at") <= CUTOFF)
            .filter_map(|p| delta(s(p, "created_at"), s(p, "merged_at")))
            .collect();
        let closed_unmerged = prs
            .iter()
            .filter(|p| {
                s(p, "merged_at").is_empty()
                    && !s(p, "closed_at").is_empty()
                    && s(p, "closed_at") <= CUTOFF
            })
            .count();
        let outstanding = prs.len() - merged.len() - closed_unmerged;
        months.push(json!({"month":month,"opened":prs.len(),"merged_by_cutoff":merged.len(),"closed_unmerged":closed_unmerged,"unresolved_at_cutoff":outstanding,"merged_median_hours":quantile(&merged,0.5)/3600.0,"merged_p90_hours":quantile(&merged,0.9)/3600.0,"selection":"creation-month cohorts; unresolved excluded from duration quantiles and counted separately"}));
        if !merged.is_empty() {
            pr_chart.push((
                format!("{month}: {} merged / {} opened", merged.len(), prs.len()),
                quantile(&merged, 0.5) / 3600.0,
                0.0,
            ));
        }
    }
    let mut job_rows = Vec::new();
    for j in jobs.as_array().ok_or("jobs missing")? {
        let mut row = select(
            j,
            &[
                "id",
                "run_id",
                "run_name",
                "run_event",
                "name",
                "conclusion",
                "html_url",
            ],
        );
        let executed = s(j, "conclusion") != "skipped" && !s(j, "started_at").starts_with("0001");
        row["dispatch_to_start_seconds"] = if executed {
            json!(delta(s(j, "run_created_at"), s(j, "started_at")))
        } else {
            Value::Null
        };
        row["execution_seconds"] = if executed {
            json!(delta(s(j, "started_at"), s(j, "completed_at")))
        } else {
            Value::Null
        };
        job_rows.push(row);
    }
    let daily_ids: Vec<u64> = collection["daily_selection_ids"]
        .as_array()
        .ok_or("selection missing")?
        .iter()
        .filter_map(Value::as_u64)
        .collect();
    let mut daily_rows = Vec::new();
    let mut daily_chart = Vec::new();
    for id in daily_ids {
        let run = cases
            .as_array()
            .unwrap()
            .iter()
            .find(|r| r["id"].as_u64() == Some(id))
            .ok_or("case run missing")?;
        let js: Vec<&Value> = job_rows
            .iter()
            .filter(|j| j["run_id"].as_u64() == Some(id) && j["execution_seconds"].is_number())
            .collect();
        let waits: Vec<f64> = js
            .iter()
            .filter_map(|j| j["dispatch_to_start_seconds"].as_f64())
            .collect();
        let work: Vec<f64> = js
            .iter()
            .filter_map(|j| j["execution_seconds"].as_f64())
            .collect();
        let first = waits.iter().copied().reduce(f64::min);
        let longest = js
            .iter()
            .filter_map(|j| {
                Some(j["dispatch_to_start_seconds"].as_f64()? + j["execution_seconds"].as_f64()?)
            })
            .reduce(f64::max);
        daily_rows.push(json!({"id":id,"created_at":run["created_at"],"conclusion":run["conclusion"],"executed_jobs":js.len(),"first_job_start_delay_seconds":first,"creation_to_last_completed_job_seconds":longest,"summed_job_execution_seconds":work.iter().sum::<f64>()}));
        if let (Some(f), Some(l)) = (first, longest) {
            daily_chart.push((
                format!("{} · {id}", &s(run, "created_at")[5..10]),
                f / 60.0,
                (l - f) / 60.0,
            ));
        }
    }
    let duplicate_ids = [
        39179422708u64,
        39179422712,
        39179422723,
        39179422737,
        39179422744,
    ];
    let duplicate_work: f64 = job_rows
        .iter()
        .filter(|j| duplicate_ids.contains(&j["run_id"].as_u64().unwrap_or(0)))
        .filter_map(|j| j["execution_seconds"].as_f64())
        .sum();
    let mut bottleneck_chart = Vec::new();
    let mut bottleneck_rows = Vec::new();
    for j in &job_rows {
        let id = j["run_id"].as_u64().unwrap_or(0);
        if id == 39008052140 && s(j, "name") == "wallet" {
            bottleneck_chart.push((
                "Oct 17 wallet job".into(),
                j["dispatch_to_start_seconds"].as_f64().unwrap_or(0.0) / 60.0,
                j["execution_seconds"].as_f64().unwrap_or(0.0) / 60.0,
            ));
            bottleneck_rows.push(j.clone());
        }
    }
    // Performance bars are independent values, never stacked as if one execution.
    let mut benchmark_chart = Vec::new();
    for w in bench["workloads"].as_array().ok_or("workloads missing")? {
        let st = &w["statistics"];
        let short = if s(w, "name").starts_with("snapshot") {
            "32 MiB inventory"
        } else {
            "Seven law signatures"
        };
        benchmark_chart.push((
            format!("{short}: historical"),
            st["a_mean_seconds"].as_f64().ok_or("mean missing")? * 1000.0,
            0.0,
        ));
        benchmark_chart.push((
            format!("{short}: native Rust"),
            0.0,
            st["b_mean_seconds"].as_f64().ok_or("mean missing")? * 1000.0,
        ));
    }
    bars(
        &out.join("language-timing.svg"),
        "Measured controller costs",
        "30 randomized pairs per workload; one host; warm cache; arithmetic means",
        &benchmark_chart,
        (
            "Historical Python or shell + Node",
            "Native Rust controller",
        ),
        "milliseconds",
    )?;
    bars(
        &out.join("pr-calendar-time.svg"),
        "How long did merged pull requests stay open?",
        "Calendar time includes development, review and CI; unresolved PRs are counted in the data",
        &pr_chart,
        ("Median open-to-merge hours", ""),
        "hours",
    )?;
    bars(&out.join("ci-daily-sample.svg"),"CI waiting and the remaining workflow interval","First tests/PR run each available day, Oct 15-29; later phase includes execution AND further waits",&daily_chart,("Creation to first job start","First start to last completed job"),"minutes")?;
    bars(
        &out.join("wallet-delay.svg"),
        "A documented bottleneck: waiting before execution",
        "One selected historical wallet job; this is a case study, not a repository-wide average",
        &bottleneck_chart,
        ("Workflow creation to job start", "Job execution"),
        "minutes",
    )?;
    let mut run_counts: BTreeMap<String, u64> = BTreeMap::new();
    let mut dates = Vec::new();
    for r in runs.as_array().unwrap() {
        *run_counts
            .entry(s(r, "created_at")[..7].into())
            .or_default() += 1;
        dates.push(s(r, "created_at"));
    }
    dates.sort();
    let analysis = json!({"cutoff_utc":CUTOFF,"monthly_pull_requests":months,"retained_workflows_by_month":run_counts,"earliest_retained_run":dates.first(),"latest_included_run":dates.last(),"selected_daily_runs":daily_rows,"selected_job_timings":job_rows,"wallet_case":bottleneck_rows,"documented_duplicate_push_run_ids":duplicate_ids,"documented_duplicate_push_job_seconds_latest_attempt":duplicate_work,"benchmark_statistics":bench["workloads"].as_array().unwrap().iter().map(|w|json!({"name":w["name"],"statistics":w["statistics"]})).collect::<Vec<_>>(),"limits":"Retained public API records, latest attempts only, nonrandom historical cases and a deterministic daily sample. No billing, human-time ledger, model assignment or provider policy decision telemetry. No project-wide causal language or sabotage estimate."});
    write(&out.join("analysis.json"), &analysis)?;
    Ok(())
}
fn evidence_charts(bench: &Value, out: &Path) -> Result<()> {
    let workloads = bench["workloads"].as_array().ok_or("workloads missing")?;
    let max = workloads
        .iter()
        .filter_map(|w| {
            w["statistics"]["paired_bootstrap_mean_difference_95pct_ci_seconds"][1].as_f64()
        })
        .fold(0.0, f64::max)
        * 1000.0;
    let min = workloads
        .iter()
        .filter_map(|w| {
            w["statistics"]["paired_bootstrap_mean_difference_95pct_ci_seconds"][0].as_f64()
        })
        .fold(0.0, f64::min)
        * 1000.0;
    let span = (max - min).max(1.0);
    let x = |value: f64| 340.0 + (value - min) / span * 620.0;
    let mut svg = String::from(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="345" viewBox="0 0 1100 345" role="img"><title>Paired controller time difference</title><rect width="1100" height="345" fill="#f4f7fc"/><g font-family="Arial,sans-serif" fill="#152139"><text x="28" y="35" font-size="23" font-weight="bold">Time difference per invocation, with uncertainty</text><text x="28" y="61" font-size="14">Historical minus Rust: positive favors Rust. Point = mean; line = 95% bootstrap interval; 30 pairs.</text><path d="M340 275H1000" stroke="#52637b" fill="none"/>"##,
    );
    svg += &format!(
        r##"<path d="M{} 90V275" stroke="#52637b" stroke-dasharray="4 4"/><text x="{}" y="298" font-size="12">0 ms</text>"##,
        x(0.0),
        x(0.0) - 5.0
    );
    for (i, w) in workloads.iter().enumerate() {
        let st = &w["statistics"];
        let y = 125 + i * 100;
        let ci = &st["paired_bootstrap_mean_difference_95pct_ci_seconds"];
        let lo = ci[0].as_f64().ok_or("CI missing")? * 1000.0;
        let hi = ci[1].as_f64().ok_or("CI missing")? * 1000.0;
        let avg = st["mean_paired_difference_seconds_a_minus_b"]
            .as_f64()
            .ok_or("mean missing")?
            * 1000.0;
        let label = if i == 0 {
            "Python inventory → Rust"
        } else {
            "Shell/Node law gate → Rust"
        };
        let p = st["paired_sign_flip_two_sided_monte_carlo_p"]
            .as_f64()
            .ok_or("p missing")?;
        svg += &format!(
            r##"<text x="28" y="{}" font-size="15">{label}</text><path d="M{} {y}H{}" stroke="#126b65" stroke-width="5"/><circle cx="{}" cy="{y}" r="7" fill="#126b65"/><text x="340" y="{}" font-size="13">Difference {avg:.1} ms; 95% CI [{lo:.1}, {hi:.1}] ms; p = {p:.5}</text>"##,
            y + 5,
            x(lo),
            x(hi),
            x(avg),
            y + 30
        );
    }
    svg += &format!(
        r##"<text x="930" y="298" font-size="12">{max:.0} ms</text><text x="28" y="330" font-size="12">Local implementation measurements; no language-wide or cryptographic performance claim.</text></g></svg>"##
    );
    fs::write(out.join("paired-confidence.svg"), svg)?;
    let mut matrix = String::from(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="510" viewBox="0 0 1100 510" role="img"><title>Integrity controls on preserved Python and native Rust</title><rect width="1100" height="510" fill="#f4f7fc"/><g font-family="Arial,sans-serif" fill="#152139"><text x="28" y="35" font-size="23" font-weight="bold">Two missing controls in the preserved Python implementation</text><text x="28" y="61" font-size="14">Deterministic test cases; these are not a language vulnerability rate or a security proof.</text><text x="520" y="95" font-size="15">Preserved Python</text><text x="790" y="95" font-size="15">Native Rust</text>"##,
    );
    for (i, row) in bench["security_controls"]
        .as_array()
        .ok_or("controls missing")?
        .iter()
        .enumerate()
    {
        let y = 115 + i * 36;
        matrix += &format!(
            r##"<text x="28" y="{}" font-size="14">{}</text>"##,
            y + 17,
            escape(s(row, "case"))
        );
        for (x, k) in [(520, "python_exit"), (790, "rust_exit")] {
            let clean = s(row, "case") == "clean";
            let exit = row[k].as_i64().ok_or("exit missing")?;
            let good = if clean { exit == 0 } else { exit != 0 };
            let color = if good { "#126b65" } else { "#a63327" };
            let label = if clean {
                "clean accepted"
            } else if good {
                "change rejected"
            } else {
                "change accepted"
            };
            matrix += &format!(
                r##"<rect x="{x}" y="{y}" width="205" height="26" rx="3" fill="{color}"/><text x="{}" y="{}" font-size="13" fill="white">{label} (exit {exit})</text>"##,
                x + 10,
                y + 18
            );
        }
    }
    matrix += r##"<text x="28" y="465" font-size="13">The Rust port adds independent manifest anchoring and mode checks. Python can implement both.</text><text x="28" y="488" font-size="13">Manifest edits are stopped at the Rust anchor; this table does not prove all downstream parser paths.</text></g></svg>"##;
    fs::write(out.join("integrity-controls.svg"), matrix)?;
    Ok(())
}
fn session_audit(input: &Path, output: &Path) -> Result<()> {
    // Snapshot a single user-authorized lane's local trace; never export message bodies.
    let bytes = fs::read(input)?;
    if bytes.len() > 64 * 1024 * 1024 {
        return Err("trace exceeds 64 MiB".into());
    }
    let mut counts = BTreeMap::<String, usize>::new();
    let mut events = Vec::new();
    let mut tool_outputs = 0;
    let mut first = String::new();
    let mut last = String::new();
    for line in bytes.split(|b| *b == b'\n').filter(|l| !l.is_empty()) {
        let v: Value = serde_json::from_slice(line)?;
        if first.is_empty() {
            first = s(&v, "timestamp").to_owned();
        }
        last = s(&v, "timestamp").to_owned();
        let p = &v["payload"];
        if s(&v, "type") != "response_item"
            || !matches!(
                s(p, "type"),
                "function_call_output" | "custom_tool_call_output"
            )
        {
            continue;
        }
        tool_outputs += 1;
        let text = p["output"].as_str().unwrap_or("").to_lowercase();
        // Conservative exact strings, not every occurrence of the word safety/approval.
        for (label, needles) in [
            (
                "automatic_approval_rejection",
                &[
                    "automatic approval review rejected",
                    "rejected by auto-review",
                    "denied by auto-review",
                ][..],
            ),
            (
                "sandbox_denial",
                &[
                    "sandbox denied",
                    "sandbox policy denied",
                    "rejected by sandbox",
                ][..],
            ),
            (
                "rate_limit",
                &["rate limit exceeded", "rate_limit_exceeded"][..],
            ),
        ] {
            if needles.iter().any(|n| text.contains(n)) {
                *counts.entry(label.to_owned()).or_default() += 1;
                events.push(json!({"timestamp":v["timestamp"],"category":label,"call_id":p["call_id"],"interpretation":"pattern candidate; requires original event review before causal attribution"}));
            }
        }
    }
    write(
        output,
        &json!({"trace_sha256_base64url":URL_SAFE_NO_PAD.encode(Sha256::digest(&bytes)),"trace_bytes":bytes.len(),"first_timestamp":first,"last_timestamp":last,"tool_output_records":tool_outputs,"pattern_counts":counts,"candidate_events":events,"coverage":"One local build-recovery conversation snapshot only. Exact-string search of tool output records, not all providers, all sessions or all refusal formats. Zero matches is not proof no guardrail delay occurred. Raw trace remains local because it contains conversation and environment data."}),
    )
}
fn main() -> Result<()> {
    let a: Vec<String> = std::env::args().collect();
    match a.get(1).map(String::as_str){Some("collect") if a.len()==3=>collect(Path::new(&a[2])),Some("benchmark") if a.len()==7=>benchmark(Path::new(&a[2]),Path::new(&a[3]),Path::new(&a[4]),Path::new(&a[5]),Path::new(&a[6])),Some("analyze") if a.len()==5=>analyze(Path::new(&a[2]),Path::new(&a[3]),Path::new(&a[4])),Some("session-audit") if a.len()==4=>session_audit(Path::new(&a[2]),Path::new(&a[3])),_=>Err("usage: build-forensics collect NEW_DIRECTORY | benchmark NEW_DIRECTORY HISTORICAL_PYTHON NATIVE_RUNNER BSIGNER SOURCE | analyze DATA BENCHMARK_JSON NEW_OUTPUT | session-audit TRACE OUTPUT_JSON".into())}
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn supervisor_propagates_failure_and_bounds_a_hung_child() {
        let (_, code) = invoke(&["/bin/false".into()], Path::new("/tmp")).unwrap();
        assert_eq!(code, 1);
        let (elapsed, code) =
            invoke(&["/bin/sleep".into(), "40".into()], Path::new("/tmp")).unwrap();
        assert_eq!(code, 124);
        assert!((30.0..35.0).contains(&elapsed));
    }
    #[test]
    fn timestamp_arithmetic_and_missing_are_explicit() {
        assert_eq!(
            delta("2026-10-19T00:08:30Z", "2026-10-19T01:19:30Z"),
            Some(4260.0)
        );
        assert_eq!(delta("bad", "2026-10-19T01:19:30Z"), None);
        assert_eq!(delta("2026-10-19T01:19:30Z", "2026-10-19T00:08:30Z"), None);
    }
    #[test]
    fn paired_interval_recovers_known_difference() {
        let a = vec![2.0; 30];
        let b = vec![1.0; 30];
        let v = paired(&a, &b).unwrap();
        assert_eq!(v["mean_paired_difference_seconds_a_minus_b"], 1.0);
        assert_eq!(
            v["paired_bootstrap_mean_difference_95pct_ci_seconds"],
            json!([1.0, 1.0])
        );
        assert!(
            v["paired_sign_flip_two_sided_monte_carlo_p"]
                .as_f64()
                .unwrap()
                < 0.001
        );
    }
    #[test]
    fn equal_pairs_are_not_significant() {
        let a = vec![1.0; 30];
        assert_eq!(
            paired(&a, &a).unwrap()["paired_sign_flip_two_sided_monte_carlo_p"],
            1.0
        );
        assert!(paired(&[1.0], &[1.0]).is_err());
        assert!(paired(&[0.0, 1.0], &[1.0, 1.0]).is_err());
    }
    #[test]
    fn percentile_interpolates() {
        assert_eq!(quantile(&[4.0, 1.0, 3.0, 2.0], 0.5), 2.5);
        assert!(quantile(&[], 0.5).is_nan());
    }
}
