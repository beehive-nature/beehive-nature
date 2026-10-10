//! bTunGsTeN WB002 — the WASM-vs-model corpus, driving the Rust model.
//!
//! WHAT RUNS: the VENDORED 2021 wasm + abi (scripts/btungsten/wb002-specimen/
//! simpleassets-e6a042f/build/SimpleAssets/, byte-identical to upstream
//! e6a042f), deployed VERBATIM onto a fresh local dev chain under Antelope
//! Spring. Each corpus step executes on BOTH the chain (cleos) and the model
//! (btungsten_wb002::chain, profile Specimen) and is compared on:
//!   1. the ACCEPT/REFUSE class of the action;
//!   2. the FULL post-state projection (every contract table) after EVERY step;
//!   3. for refused steps: that the chain's whole state is UNCHANGED.
//!
//! NAMED RECONCILIATIONS: volatile block-time fields are dropped (offers /
//! offerfs / delegates `cdate`); `offerfs.id` is excluded and reconciled
//! (Chain::rekey_ft_offer); asset ids and FT ids match naturally.
//!
//! RESULT CLASS: an EXECUTED CORPUS comparison, sampled evidence, not a proof.
//! NOT claimed: testnet/mainnet behavior, behavior outside this corpus,
//! Spring-version generality.

use btungsten_wb002::chain::{qty, Chain, Profile, Row, R};
use btungsten_wb002::log::sha;
use btungsten_wb002::ready::{iso_ms, not_ready_reason, Head};
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::fs;
use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const DEV_KEY: &str = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3"; // PUBLIC-CONSTANT: the universal eosio/Antelope dev-chain genesis key (it unlocks only throwaway local chains)
const DEV_PUB: &str = "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV";
const ACTORS: [&str; 9] = [
    "authorgov",
    "authorx",
    "alice",
    "bob",
    "carol",
    "dave",
    "ed",
    "mallory",
    "simpleasset1",
];
const CONTRACT: &str = "simpleasset1";
const TABLES: [&str; 8] = [
    "sassets",
    "snttassets",
    "accounts",
    "offers",
    "nttoffers",
    "offerfs",
    "delegates",
    "stat",
];

struct Env {
    http: String,
    wallet: String,
    run: String,
    procs: Vec<Child>,
}

impl Drop for Env {
    fn drop(&mut self) {
        for p in &mut self.procs {
            let _ = p.kill();
            let _ = p.wait();
        }
    }
}

fn fail(msg: impl std::fmt::Display) -> ! {
    eprintln!("HARNESS FAILED: {msg}");
    std::process::exit(2);
}

impl Env {
    fn cleos(&self, args: &[&str]) -> Result<String, String> {
        let out = Command::new("cleos")
            .args([
                "-u",
                &self.http,
                "--wallet-url",
                &self.wallet,
                "--no-auto-keosd",
            ])
            .args(args)
            .stdin(Stdio::null())
            .output()
            .map_err(|e| format!("cleos did not start: {e}"))?;
        if out.status.success() {
            return Ok(String::from_utf8_lossy(&out.stdout).into_owned());
        }
        let raw = if out.stderr.is_empty() {
            out.stdout
        } else {
            out.stderr
        };
        let err: Vec<String> = String::from_utf8_lossy(&raw)
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect();
        Err(err.join(" | ").chars().take(1400).collect())
    }

    fn get_info(&self) -> Result<Value, String> {
        let out = self.cleos(&["get", "info"])?;
        serde_json::from_str(&out).map_err(|e| e.to_string())
    }

    fn head_time(&self) -> u64 {
        let info = self
            .get_info()
            .unwrap_or_else(|e| fail(format!("get info: {e}")));
        let t = info["head_block_time"]
            .as_str()
            .unwrap_or_else(|| fail("no head_block_time"));
        (iso_ms(t).unwrap_or_else(|| fail(format!("unparsed head time {t}"))) / 1000) as u64
    }

    fn get_table(&self, scope: &str, table: &str) -> Vec<Value> {
        match self.cleos(&["get", "table", CONTRACT, scope, table, "--limit", "500"]) {
            Ok(out) => {
                let v: Value = serde_json::from_str(&out).unwrap_or_else(|e| fail(format!("getTable {scope}/{table}: {e}")));
                v["rows"].as_array().cloned().unwrap_or_default()
            }
            Err(e) => fail(format!("getTable {scope}/{table} FAILED (a failed read must never read as an empty table): {}", &e[..e.len().min(160)])),
        }
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn boot(env: &mut Env, http_port: u16, p2p_port: u16) -> Value {
    // refuse occupied ports before creating a wallet or touching a chain
    for port in [http_port, p2p_port] {
        TcpListener::bind(("127.0.0.1", port))
            .unwrap_or_else(|e| fail(format!("port {port} is occupied: {e}")));
    }
    for d in ["data", "config", "wallet"] {
        fs::create_dir_all(format!("{}/{d}", env.run)).unwrap_or_else(|e| fail(e));
    }
    let keosd = Command::new("keosd")
        .args([
            "--unlock-timeout",
            "86400",
            &format!("--unix-socket-path={}/wallet/keosd.sock", env.run),
            &format!("--wallet-dir={}/wallet", env.run),
            &format!("--data-dir={}/wallet/keosd-data", env.run),
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap_or_else(|e| fail(format!("keosd: {e}")));
    env.procs.push(keosd);
    let mut up = false;
    for _ in 0..30 {
        sleep(Duration::from_millis(500));
        if env.cleos(&["wallet", "list"]).is_ok() {
            up = true;
            break;
        }
    }
    if !up {
        fail("keosd did not come up on its socket");
    }
    let log = fs::File::create(format!("{}/nodeos.log", env.run)).unwrap_or_else(|e| fail(e));
    let nodeos = Command::new("nodeos")
        .args([
            "-e",
            "-p",
            "eosio",
            "--plugin",
            "eosio::chain_api_plugin",
            "--plugin",
            "eosio::producer_plugin",
            "--plugin",
            "eosio::producer_api_plugin",
            "--plugin",
            "eosio::http_plugin",
            "--access-control-allow-origin=*",
            "--http-validate-host=false",
            &format!("--http-server-address=127.0.0.1:{http_port}"),
            &format!("--p2p-listen-endpoint=127.0.0.1:{p2p_port}"),
            // WSL's timer accuracy is poor; the 499ms subjective deadline
            // kills the 2021 contract's heavier calls nondeterministically
            "--max-transaction-time=10000",
            "--abi-serializer-max-time-ms=10000",
            &format!("--signature-provider={DEV_PUB}=KEY:{DEV_KEY}"),
            &format!("--data-dir={}/data", env.run),
            &format!("--config-dir={}/config", env.run),
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::from(log))
        .spawn()
        .unwrap_or_else(|e| fail(format!("nodeos: {e}")));
    env.procs.push(nodeos);
    // answering is not ready: see btungsten_wb002::ready
    let mut prev: Option<Head> = None;
    let mut why = "get info never answered".to_string();
    for _ in 0..60 {
        sleep(Duration::from_millis(500));
        if let Some(Ok(Some(_))) = env.procs.last_mut().map(|p| p.try_wait()) {
            fail(format!(
                "nodeos exited during startup; see {}/nodeos.log",
                env.run
            ));
        }
        let Ok(info) = env.get_info() else { continue };
        let head = Head {
            num: info["head_block_num"].as_u64().unwrap_or(0),
            time: info["head_block_time"].as_str().unwrap_or("").to_string(),
        };
        match not_ready_reason(prev.as_ref(), &head, now_ms()) {
            None => return info,
            Some(r) => why = r,
        }
        prev = Some(head);
    }
    fail(format!(
        "nodeos not ready at {} within 30s: {why} (see {}/nodeos.log)",
        env.http, env.run
    ))
}

// ---- projections ------------------------------------------------------------

/// "10000.0000 WOOD" -> (raw integer units, symbol)
fn parse_qty(s: &str) -> (u128, String) {
    let (num, sym) = s
        .split_once(' ')
        .unwrap_or_else(|| fail(format!("unparsed quantity {s}")));
    let (i, f) = num.split_once('.').unwrap_or((num, ""));
    (
        (format!("{i}{f}"))
            .parse()
            .unwrap_or_else(|_| fail(format!("unparsed quantity {s}"))),
        sym.to_string(),
    )
}

fn vs(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

fn truthy(v: &Value) -> bool {
    match v {
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_u64().unwrap_or(0) != 0,
        _ => false,
    }
}

fn by_id(mut v: Vec<Value>, key: &str) -> Value {
    v.sort_by(|a, b| vs(&a[key]).cmp(&vs(&b[key])));
    Value::Array(v)
}

fn by_canon(mut v: Vec<Value>) -> Value {
    v.sort_by_key(canon);
    Value::Array(v)
}

fn canon(v: &Value) -> String {
    match v {
        Value::Object(m) => {
            let mut keys: Vec<&String> = m.keys().collect();
            keys.sort();
            let inner: Vec<String> = keys
                .iter()
                .map(|k| format!("{}:{}", Value::String((*k).clone()), canon(&m[*k])))
                .collect();
            format!("{{{}}}", inner.join(","))
        }
        Value::Array(a) => format!("[{}]", a.iter().map(canon).collect::<Vec<_>>().join(",")),
        other => other.to_string(),
    }
}

fn norm_chain_asset(row: &Value) -> Value {
    let contains: Vec<Value> = row["container"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(norm_chain_asset)
        .collect();
    let contains_f: Vec<Value> = row["containerf"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(|c| {
            let b = if c["balance"].is_string() {
                vs(&c["balance"])
            } else {
                vs(&c["balance"]["quantity"])
            };
            let (amount, sym) = parse_qty(&b);
            json!({"id": vs(&c["id"]), "amount": amount.to_string(), "sym": sym})
        })
        .collect();
    json!({"id": vs(&row["id"]), "owner": row["owner"], "author": row["author"], "category": row["category"], "idata": row["idata"], "mdata": row["mdata"], "contains": contains, "containsF": contains_f})
}

fn norm_model_asset(row: &Row) -> Value {
    let contains: Vec<Value> = row.container.iter().map(norm_model_asset).collect();
    let contains_f: Vec<Value> = row
        .containerf
        .iter()
        .map(|f| json!({"id": f.id.to_string(), "amount": f.amount.to_string(), "sym": f.sym}))
        .collect();
    json!({"id": row.id.to_string(), "owner": row.owner, "author": row.author, "category": row.category, "idata": row.idata, "mdata": row.mdata, "contains": contains, "containsF": contains_f})
}

fn project_chain(env: &Env) -> Value {
    let (mut sassets, mut sntt, mut accounts) = (vec![], vec![], vec![]);
    for actor in ACTORS {
        for r in env.get_table(actor, "sassets") {
            sassets.push(norm_chain_asset(&r));
        }
        for r in env.get_table(actor, "snttassets") {
            sntt.push(json!({"id": vs(&r["id"]), "owner": r["owner"], "author": r["author"], "category": r["category"], "idata": r["idata"], "mdata": r["mdata"]}));
        }
        for r in env.get_table(actor, "accounts") {
            let (amount, sym) = parse_qty(&vs(&r["balance"]));
            accounts.push(json!({"holder": actor, "id": vs(&r["id"]), "balance": amount.to_string(), "sym": sym}));
        }
    }
    let offers: Vec<Value> = env.get_table(CONTRACT, "offers").iter().map(|r| json!({"assetid": vs(&r["assetid"]), "owner": r["owner"], "offeredto": r["offeredto"]})).collect();
    let nttoffers: Vec<Value> = env.get_table(CONTRACT, "nttoffers").iter().map(|r| json!({"assetid": vs(&r["assetid"]), "owner": r["owner"], "offeredto": r["offeredto"]})).collect();
    let offerfs: Vec<Value> = env
        .get_table(CONTRACT, "offerfs")
        .iter()
        .map(|r| {
            let (amount, sym) = parse_qty(&vs(&r["quantity"]));
            json!({"author": r["author"], "owner": r["owner"], "offeredto": r["offeredto"], "quantity": amount.to_string(), "sym": sym})
        })
        .collect();
    let delegates: Vec<Value> = env
        .get_table(CONTRACT, "delegates")
        .iter()
        .map(|r| json!({"assetid": vs(&r["assetid"]), "owner": r["owner"], "delegatedto": r["delegatedto"], "period": vs(&r["period"]), "redelegate": truthy(&r["redelegate"])}))
        .collect();
    let mut stat = vec![];
    for author in ["authorgov", "authorx"] {
        for r in env.get_table(author, "stat") {
            let (supply, sym) = parse_qty(&vs(&r["supply"]));
            let (max, _) = parse_qty(&vs(&r["max_supply"]));
            stat.push(json!({"issuer": r["issuer"], "id": vs(&r["id"]), "authorctrl": truthy(&r["authorctrl"]), "supply": supply.to_string(), "max": max.to_string(), "sym": sym}));
        }
    }
    json!({
        "sassets": by_id(sassets, "id"), "snttassets": by_id(sntt, "id"), "accounts": by_id(accounts, "id"),
        "offers": by_id(offers, "assetid"), "nttoffers": by_id(nttoffers, "assetid"), "offerfs": by_canon(offerfs),
        "delegates": by_id(delegates, "assetid"), "stat": by_id(stat, "id"),
    })
}

fn project_model(c: &Chain) -> Value {
    let sassets: Vec<Value> = c
        .scopes()
        .values()
        .flat_map(|m| m.values())
        .map(norm_model_asset)
        .collect();
    let sntt: Vec<Value> = c.ntt_scopes().values().flat_map(|m| m.values()).map(|r| json!({"id": r.id.to_string(), "owner": r.owner, "author": r.author, "category": r.category, "idata": r.idata, "mdata": r.mdata})).collect();
    let mut accounts = vec![];
    for (holder, m) in c.balances() {
        for (ftid, b) in m {
            accounts.push(json!({"holder": holder, "id": ftid.to_string(), "balance": b.amount.to_string(), "sym": b.sym}));
        }
    }
    let offers: Vec<Value> = c.offers().iter().map(|(id, o)| json!({"assetid": id.to_string(), "owner": o.owner, "offeredto": o.offeredto})).collect();
    let nttoffers: Vec<Value> = c.ntt_offers().iter().map(|(id, o)| json!({"assetid": id.to_string(), "owner": o.owner, "offeredto": o.offeredto})).collect();
    let offerfs: Vec<Value> = c.ft_offers().values().map(|o| json!({"author": o.author, "owner": o.owner, "offeredto": o.offeredto, "quantity": o.amount.to_string(), "sym": o.sym})).collect();
    let delegates: Vec<Value> = c.delegates().iter().map(|(id, d)| json!({"assetid": id.to_string(), "owner": d.owner, "delegatedto": d.delegatedto, "period": d.period.to_string(), "redelegate": d.redelegate})).collect();
    let stat: Vec<Value> = c.stats().values().map(|s| json!({"issuer": s.issuer, "id": s.id.to_string(), "authorctrl": s.authorctrl, "supply": s.supply.to_string(), "max": s.max.to_string(), "sym": s.symbol})).collect();
    json!({
        "sassets": by_id(sassets, "id"), "snttassets": by_id(sntt, "id"), "accounts": by_id(accounts, "id"),
        "offers": by_id(offers, "assetid"), "nttoffers": by_id(nttoffers, "assetid"), "offerfs": by_canon(offerfs),
        "delegates": by_id(delegates, "assetid"), "stat": by_id(stat, "id"),
    })
}

// ---- the stepper ------------------------------------------------------------

#[derive(Default)]
struct Tally {
    rows: Vec<Value>,
    class: usize,
    state: usize,
    atomic: usize,
}

#[allow(clippy::too_many_arguments)]
fn step(
    env: &Env,
    model: &mut Chain,
    t: &mut Tally,
    name: &str,
    model_call: impl FnOnce(&mut Chain) -> R<()>,
    action: &str,
    args: Value,
    signers: &[&str],
) {
    model.now = env.head_time(); // one clock: the chain's, for both sides
    let before = sha(&canon(&project_chain(env)));
    let model_res = model_call(model);
    let perms: Vec<String> = signers
        .iter()
        .flat_map(|s| ["-p".to_string(), format!("{s}@active")])
        .collect();
    let mut cargs: Vec<&str> = vec!["push", "action", CONTRACT, action];
    let args_s = args.to_string();
    cargs.push(&args_s);
    cargs.extend(perms.iter().map(String::as_str));
    let chain = env.cleos(&cargs);
    let model_s = match &model_res {
        Ok(()) => "accept".to_string(),
        Err(r) => format!("refuse:{}", r.code),
    };
    let chain_s = if chain.is_ok() { "accept" } else { "refuse" };
    let mut row = Map::new();
    row.insert("name".into(), json!(name));
    row.insert("model".into(), json!(model_s));
    row.insert("chain".into(), json!(chain_s));
    if model_res.is_ok() != chain.is_ok() {
        t.class += 1;
        let msg = chain.as_ref().err().cloned().unwrap_or_default();
        eprintln!("CLASS-MISMATCH  {name}: model={model_s} chain={chain_s} :: {msg}");
        row.insert(
            "chainMsg".into(),
            json!(msg.chars().take(400).collect::<String>()),
        );
        row.insert("verdict".into(), json!("CLASS-MISMATCH"));
        t.rows.push(Value::Object(row));
        return;
    }
    if let Err(msg) = &chain {
        let atomic = sha(&canon(&project_chain(env))) == before;
        if atomic {
            t.atomic += 1;
        } else {
            t.state += 1;
            eprintln!("ATOMICITY-MISMATCH {name}: the chain state changed across a REFUSED action");
        }
        row.insert("chainMsg".into(), json!(msg));
        row.insert("atomicOnChain".into(), json!(atomic));
        row.insert("verdict".into(), json!("match"));
        t.rows.push(Value::Object(row));
        return;
    }
    let (cp, mp) = (project_chain(env), project_model(model));
    if canon(&cp) != canon(&mp) {
        t.state += 1;
        let k = TABLES
            .iter()
            .find(|k| canon(&cp[**k]) != canon(&mp[**k]))
            .copied()
            .unwrap_or("?");
        eprintln!("STATE-MISMATCH  {name}: tables diverged first at '{k}'");
        eprintln!(
            "  chain: {}",
            canon(&cp[k]).chars().take(500).collect::<String>()
        );
        eprintln!(
            "  model: {}",
            canon(&mp[k]).chars().take(500).collect::<String>()
        );
        row.insert("verdict".into(), json!("STATE-MISMATCH"));
    } else {
        row.insert("verdict".into(), json!("match"));
    }
    t.rows.push(Value::Object(row));
}

fn main() {
    let http_port: u16 = std::env::var("WB002_HTTP_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8889);
    let p2p_port: u16 = std::env::var("WB002_P2P_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(9877);
    if http_port < 1024 || p2p_port < 1024 {
        fail("Invalid WB002 port");
    }
    let run = format!(
        "{}/wb002-{}-{}",
        std::env::temp_dir().display(),
        std::process::id(),
        now_ms()
    );
    let specimen = std::env::var("WB002_SPECIMEN").unwrap_or_else(|_| {
        concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../scripts/btungsten/wb002-specimen/simpleassets-e6a042f/"
        )
        .to_string()
    });
    let mut env = Env {
        http: format!("http://127.0.0.1:{http_port}"),
        wallet: format!("unix://{run}/wallet/keosd.sock"),
        run,
        procs: vec![],
    };
    let info = boot(&mut env, http_port, p2p_port);
    let server = info["server_version_string"]
        .as_str()
        .or(info["server_version"].as_str())
        .unwrap_or("?")
        .to_string();
    eprintln!("chain up: Spring {server}, head {}", info["head_block_num"]);

    // wallet over the socket: a freshly created keosd wallet is ALREADY unlocked
    env.cleos(&["wallet", "create", "-n", "wb002", "--to-console"])
        .unwrap_or_else(|e| fail(format!("wallet create failed: {e}")));
    env.cleos(&["wallet", "import", "-n", "wb002", "--private-key", DEV_KEY])
        .unwrap_or_else(|e| fail(format!("import dev key: {e}")));
    let mut pubs = BTreeMap::new();
    for a in ACTORS {
        let k = env
            .cleos(&["create", "key", "--to-console"])
            .unwrap_or_else(|e| fail(format!("create key for {a}: {e}")));
        let field = |label: &str| {
            k.lines()
                .find_map(|l| l.strip_prefix(label))
                .map(|s| s.trim().to_string())
                .unwrap_or_else(|| fail(format!("no {label} for {a}")))
        };
        let (pk, sk) = (field("Public key:"), field("Private key:"));
        env.cleos(&["wallet", "import", "-n", "wb002", "--private-key", &sk])
            .unwrap_or_else(|e| fail(format!("import key {a}: {e}")));
        pubs.insert(a, pk);
    }
    eprintln!("wallet + keys ready");
    let mut model = Chain::new(Profile::Specimen, 1_700_000_000);
    for a in ACTORS {
        env.cleos(&["create", "account", "eosio", a, &pubs[a]])
            .unwrap_or_else(|e| fail(format!("create account {a}: {e}")));
        model.acct(a); // the model learns the world the chain just built
    }
    let wasm = format!("{specimen}build/SimpleAssets/SimpleAssets.wasm");
    let abi = format!("{specimen}build/SimpleAssets/SimpleAssets.abi");
    env.cleos(&["set", "code", CONTRACT, &wasm])
        .unwrap_or_else(|e| fail(format!("set code failed (RAM? wasm compat?): {e}")));
    env.cleos(&["set", "abi", CONTRACT, &abi])
        .unwrap_or_else(|e| fail(format!("set abi failed: {e}")));
    // the documented deployment step for this 2021 contract: its sendEvent
    // deferred transactions act as simpleasset1@active
    env.cleos(&[
        "set",
        "account",
        "permission",
        CONTRACT,
        "active",
        "--add-code",
        "-p",
        &format!("{CONTRACT}@active"),
    ])
    .unwrap_or_else(|e| fail(format!("link eosio.code failed: {e}")));
    eprintln!("deployed the VENDORED 2021 wasm+abi verbatim onto Spring + the contract's own documented eosio.code link");

    let mut t = Tally::default();
    let mut ids: BTreeMap<&str, u64> = BTreeMap::new();
    macro_rules! s {
        ($name:expr, $call:expr, $action:expr, $args:expr, $signers:expr) => {
            step(
                &env, &mut model, &mut t, $name, $call, $action, $args, $signers,
            )
        };
    }

    // ---- THE CORPUS -----------------------------------------------------------
    s!(
        "create NFT direct",
        |m: &mut Chain| m
            .create(
                "authorgov",
                "cred",
                "alice",
                "cmt-a",
                "md-a",
                false,
                &["authorgov"]
            )
            .map(|i| {
                ids.insert("a", i);
            }),
        "create",
        json!(["authorgov", "cred", "alice", "cmt-a", "md-a", 0]),
        &["authorgov"]
    );
    s!(
        "create NFT requireclaim",
        |m: &mut Chain| m
            .create(
                "authorgov",
                "cred",
                "bob",
                "cmt-b",
                "md-b",
                true,
                &["authorgov"]
            )
            .map(|i| {
                ids.insert("b", i);
            }),
        "create",
        json!(["authorgov", "cred", "bob", "cmt-b", "md-b", 1]),
        &["authorgov"]
    );
    let (a, b) = (ids["a"], ids["b"]);
    s!(
        "claim own offer (consent)",
        |m: &mut Chain| m.claim("bob", &[b], &["bob"]),
        "claim",
        json!(["bob", [b]]),
        &["bob"]
    );
    s!(
        "create by a stranger",
        |m: &mut Chain| m
            .create("authorx", "cred", "carol", "x", "{}", false, &["mallory"])
            .map(|_| ()),
        "create",
        json!(["authorx", "cred", "carol", "x", "{}", 0]),
        &["mallory"]
    );
    s!(
        "transfer alice->bob",
        |m: &mut Chain| m.transfer("alice", "bob", &[a], "mv", &["alice"]),
        "transfer",
        json!(["alice", "bob", [a], "mv"]),
        &["alice"]
    );
    s!(
        "transfer by a stranger",
        |m: &mut Chain| m.transfer("bob", "carol", &[a], "x", &["mallory"]),
        "transfer",
        json!(["bob", "carol", [a], "x"]),
        &["mallory"]
    );
    s!(
        "transfer by the receiver only",
        |m: &mut Chain| m.transfer("bob", "carol", &[a], "x", &["carol"]),
        "transfer",
        json!(["bob", "carol", [a], "x"]),
        &["carol"]
    );
    s!(
        "partial batch rolls back whole (R-1 on the real stack)",
        |m: &mut Chain| m.transfer("bob", "carol", &[a, 999_999_999_999_999], "x", &["bob"]),
        "transfer",
        json!(["bob", "carol", [a, 999_999_999_999_999u64], "x"]),
        &["bob"]
    );
    s!(
        "offer bob->carol",
        |m: &mut Chain| m.offer("bob", "carol", &[a], "off", &["bob"]),
        "offer",
        json!(["bob", "carol", [a], "off"]),
        &["bob"]
    );
    s!(
        "claim by the wrong offeree",
        |m: &mut Chain| m.claim("dave", &[a], &["dave"]),
        "claim",
        json!(["dave", [a]]),
        &["dave"]
    );
    s!(
        "transfer an offered asset",
        |m: &mut Chain| m.transfer("bob", "dave", &[a], "x", &["bob"]),
        "transfer",
        json!(["bob", "dave", [a], "x"]),
        &["bob"]
    );
    s!(
        "claim by the offeree (consent)",
        |m: &mut Chain| m.claim("carol", &[a], &["carol"]),
        "claim",
        json!(["carol", [a]]),
        &["carol"]
    );
    s!(
        "mdata update by the author",
        |m: &mut Chain| m.update("authorgov", "carol", a, "md-a2", &["authorgov"]),
        "update",
        json!(["authorgov", "carol", a, "md-a2"]),
        &["authorgov"]
    );
    s!(
        "mdata update by the owner refuses",
        |m: &mut Chain| m.update("authorgov", "carol", a, "nope", &["carol"]),
        "update",
        json!(["authorgov", "carol", a, "nope"]),
        &["carol"]
    );

    s!(
        "delegate carol->dave (long period)",
        |m: &mut Chain| m.delegate("carol", "dave", &[a], 500_000, false, "d1", &["carol"]),
        "delegate",
        json!(["carol", "dave", [a], 500_000, 0, "d1"]),
        &["carol"]
    );
    s!(
        "borrower routes a delegated asset onward",
        |m: &mut Chain| m.transfer("dave", "ed", &[a], "x", &["dave"]),
        "transfer",
        json!(["dave", "ed", [a], "x"]),
        &["dave"]
    );
    s!(
        "undelegate before expiry refuses",
        |m: &mut Chain| m.undelegate("carol", &[a], &["carol"]),
        "undelegate",
        json!(["carol", [a]]),
        &["carol"]
    );
    s!(
        "borrower returns early (upstream semantics)",
        |m: &mut Chain| m.transfer("dave", "carol", &[a], "back", &["dave"]),
        "transfer",
        json!(["dave", "carol", [a], "back"]),
        &["dave"]
    );
    s!(
        "delegate carol->dave (2s period, redelegate on)",
        |m: &mut Chain| m.delegate("carol", "dave", &[a], 2, true, "d2", &["carol"]),
        "delegate",
        json!(["carol", "dave", [a], 2, 1, "d2"]),
        &["carol"]
    );
    s!(
        "redelegation by the borrower (sovereign never moves)",
        |m: &mut Chain| m.delegate("dave", "ed", &[a], 1, false, "r1", &["dave"]),
        "delegate",
        json!(["dave", "ed", [a], 1, 0, "r1"]),
        &["dave"]
    );
    sleep(Duration::from_millis(3500)); // the 2s period elapses in real chain time
    s!(
        "undelegate after expiry",
        |m: &mut Chain| m.undelegate("carol", &[a], &["carol"]),
        "undelegate",
        json!(["carol", [a]]),
        &["carol"]
    );

    s!(
        "create container",
        |m: &mut Chain| m
            .create(
                "authorgov",
                "cred",
                "carol",
                "cmt-c",
                "md-c",
                false,
                &["authorgov"]
            )
            .map(|i| {
                ids.insert("c", i);
            }),
        "create",
        json!(["authorgov", "cred", "carol", "cmt-c", "md-c", 0]),
        &["authorgov"]
    );
    s!(
        "create child",
        |m: &mut Chain| m
            .create(
                "authorgov",
                "cred",
                "carol",
                "cmt-d",
                "md-d",
                false,
                &["authorgov"]
            )
            .map(|i| {
                ids.insert("d", i);
            }),
        "create",
        json!(["authorgov", "cred", "carol", "cmt-d", "md-d", 0]),
        &["authorgov"]
    );
    let (c, d) = (ids["c"], ids["d"]);
    s!(
        "attach by the AUTHOR (F-3 composition is author-gated upstream)",
        |m: &mut Chain| m.attach("carol", c, &[d], &["authorgov"]),
        "attach",
        json!(["carol", c, [d]]),
        &["authorgov"]
    );
    s!(
        "attach by the OWNER refuses (the F-3 seam, live)",
        |m: &mut Chain| m.attach("carol", c, &[a], &["carol"]),
        "attach",
        json!(["carol", c, [a]]),
        &["carol"]
    );
    s!(
        "burn a container with children refuses",
        |m: &mut Chain| m.burn("carol", &[c], &["carol"]),
        "burn",
        json!(["carol", [c], "b"]),
        &["carol"]
    );
    s!(
        "detach by the AUTHOR",
        |m: &mut Chain| m.detach("carol", c, &[d], &["authorgov"]),
        "detach",
        json!(["carol", c, [d]]),
        &["authorgov"]
    );

    s!(
        "createf WOOD authorctrl=true",
        |m: &mut Chain| m
            .createf(
                "authorgov",
                1_000_000_000_000,
                "WOOD",
                true,
                "{}",
                &["authorgov"]
            )
            .map(|_| ()),
        "createf",
        json!(["authorgov", "100000000.0000 WOOD", 1, "{}"]),
        &["authorgov"]
    );
    s!(
        "issuef to bob",
        |m: &mut Chain| m.issuef(
            "bob",
            "authorgov",
            &qty("WOOD", 100_000_000),
            "i",
            &["authorgov"]
        ),
        "issuef",
        json!(["bob", "authorgov", "10000.0000 WOOD", "i"]),
        &["authorgov"]
    );
    s!(
        "transferf bob->carol",
        |m: &mut Chain| m.transferf(
            "bob",
            "carol",
            "authorgov",
            &qty("WOOD", 10_000_000),
            "t",
            &["bob"]
        ),
        "transferf",
        json!(["bob", "carol", "authorgov", "1000.0000 WOOD", "t"]),
        &["bob"]
    );
    s!(
        "F-1 LIVE: the issuer moves a holder balance on the issuer signature ALONE",
        |m: &mut Chain| m.transferf(
            "carol",
            "authorgov",
            "authorgov",
            &qty("WOOD", 5_000_000),
            "confiscate",
            &["authorgov"]
        ),
        "transferf",
        json!([
            "carol",
            "authorgov",
            "authorgov",
            "500.0000 WOOD",
            "confiscate"
        ]),
        &["authorgov"]
    );
    s!(
        "transferf by a stranger refuses",
        |m: &mut Chain| m.transferf(
            "carol",
            "ed",
            "authorgov",
            &qty("WOOD", 100_000),
            "x",
            &["mallory"]
        ),
        "transferf",
        json!(["carol", "ed", "authorgov", "10.0000 WOOD", "x"]),
        &["mallory"]
    );
    s!(
        "offerf carol->ed",
        |m: &mut Chain| m.offerf(
            "carol",
            "ed",
            "authorgov",
            &qty("WOOD", 1_000_000),
            "of",
            &["carol"]
        ),
        "offerf",
        json!(["carol", "ed", "authorgov", "100.0000 WOOD", "of"]),
        &["carol"]
    );
    // the NAMED RECONCILIATION: deferred-event ids are upstream-internal
    let chain_offers = env.get_table(CONTRACT, "offerfs");
    if chain_offers.len() != 1 || model.ft_offers().len() != 1 {
        fail(format!(
            "reconcile expects exactly 1 FT offer on each side, saw chain {} model {}",
            chain_offers.len(),
            model.ft_offers().len()
        ));
    }
    let oid: u64 = vs(&chain_offers[0]["id"])
        .parse()
        .unwrap_or_else(|_| fail("unparsed offerfs id"));
    let mid = *model.ft_offers().keys().next().unwrap();
    model.rekey_ft_offer(mid, oid);
    s!(
        "claimf by the wrong offeree refuses",
        |m: &mut Chain| m.claimf("mallory", &[oid], &["mallory"]),
        "claimf",
        json!(["mallory", [oid]]),
        &["mallory"]
    );
    s!(
        "claimf by the offeree (consent)",
        |m: &mut Chain| m.claimf("ed", &[oid], &["ed"]),
        "claimf",
        json!(["ed", [oid]]),
        &["ed"]
    );
    s!(
        "F-1b LIVE: the issuer burns a holder balance alone",
        |m: &mut Chain| m.burnf(
            "ed",
            "authorgov",
            &qty("WOOD", 100_000),
            "cb",
            &["authorgov"]
        ),
        "burnf",
        json!(["ed", "authorgov", "10.0000 WOOD", "cb"]),
        &["authorgov"]
    );
    s!(
        "attachf value into the container (author-gated)",
        |m: &mut Chain| m.attachf(
            "carol",
            "authorgov",
            &qty("WOOD", 100_000),
            c,
            &["authorgov"]
        ),
        "attachf",
        json!(["carol", "authorgov", "10.0000 WOOD", c]),
        &["authorgov"]
    );
    s!(
        "detachf value back (author-gated)",
        |m: &mut Chain| m.detachf(
            "carol",
            "authorgov",
            &qty("WOOD", 100_000),
            c,
            &["authorgov"]
        ),
        "detachf",
        json!(["carol", "authorgov", "10.0000 WOOD", c]),
        &["authorgov"]
    );

    s!(
        "createntt for alice (direct)",
        |m: &mut Chain| m
            .createntt(
                "authorgov",
                "cap",
                "alice",
                "ntt-cmt",
                "{}",
                false,
                &["authorgov"]
            )
            .map(|i| {
                ids.insert("n1", i);
            }),
        "createntt",
        json!(["authorgov", "cap", "alice", "ntt-cmt", "{}", 0]),
        &["authorgov"]
    );
    s!(
        "createntt requireclaim for bob",
        |m: &mut Chain| m
            .createntt(
                "authorgov",
                "cap",
                "bob",
                "ntt-cmt2",
                "{}",
                true,
                &["authorgov"]
            )
            .map(|i| {
                ids.insert("n2", i);
            }),
        "createntt",
        json!(["authorgov", "cap", "bob", "ntt-cmt2", "{}", 1]),
        &["authorgov"]
    );
    let (n1, n2) = (ids["n1"], ids["n2"]);
    s!(
        "claimntt by bob (consent)",
        |m: &mut Chain| m.claimntt("bob", &[n2], &["bob"]),
        "claimntt",
        json!(["bob", [n2]]),
        &["bob"]
    );
    s!(
        "updatentt by the author",
        |m: &mut Chain| m.updatentt("authorgov", "alice", n1, "nmd", &["authorgov"]),
        "updatentt",
        json!(["authorgov", "alice", n1, "nmd"]),
        &["authorgov"]
    );
    s!(
        "burnntt by alice",
        |m: &mut Chain| m.burnntt("alice", &[n1], &["alice"]),
        "burnntt",
        json!(["alice", [n1], "b"]),
        &["alice"]
    );

    s!(
        "changeauthor by the author alone (F-8 seam, upstream semantics)",
        |m: &mut Chain| m.changeauthor("authorgov", "authorx", "carol", &[c], "ca", &["authorgov"]),
        "changeauthor",
        json!(["authorgov", "authorx", "carol", [c], "ca"]),
        &["authorgov"]
    );
    s!(
        "changeauthor by the owner alone refuses",
        |m: &mut Chain| m.changeauthor("authorx", "authorgov", "carol", &[c], "ca", &["carol"]),
        "changeauthor",
        json!(["authorx", "authorgov", "carol", [c], "ca"]),
        &["carol"]
    );
    s!(
        "burn by the owner (final)",
        |m: &mut Chain| m.burn("carol", &[c], &["carol"]),
        "burn",
        json!(["carol", [c], "final"]),
        &["carol"]
    );

    // ---- receipt ------------------------------------------------------------
    let matched = t.rows.iter().filter(|r| r["verdict"] == "match").count();
    let f1 = t
        .rows
        .iter()
        .find(|r| {
            r["name"]
                .as_str()
                .is_some_and(|n| n.starts_with("F-1 LIVE"))
        })
        .map(|r| r["chain"] == "accept")
        .unwrap_or(false);
    let f3 = t
        .rows
        .iter()
        .find(|r| {
            r["name"]
                .as_str()
                .is_some_and(|n| n.starts_with("attach by the OWNER"))
        })
        .map(|r| r["chain"] == "refuse")
        .unwrap_or(false);
    let final_chain = sha(&canon(&project_chain(&env)));
    let final_model = sha(&canon(&project_model(&model)));
    println!("bT-WB002-WASM: corpus steps 0 -> {}, verdicts matched 0 -> {matched}, class mismatches 0 -> {}, state mismatches 0 -> {}", t.rows.len(), t.class, t.state);
    println!("bT-WB002-WASM: refused steps proven atomic on chain 0 -> {}; F-1 issuer confiscation ACCEPTED on chain: {f1}; F-3 owner-attach refused on chain: {f3}", t.atomic);
    println!(
        "bT-WB002-WASM: final projections agree: {}",
        final_chain == final_model
    );
    println!("bT-WB002-WASM: model = Rust (btungsten_wb002::chain, sovereignty through the SAW-proven core)");
    // the committed receipt scrubs 48+ hex runs (tx ids)
    let scrub = |s: &str| -> String {
        let mut out = String::new();
        let mut run = String::new();
        for ch in s.chars().chain(std::iter::once(' ')) {
            if ch.is_ascii_hexdigit() {
                run.push(ch);
                continue;
            }
            if run.len() >= 48 {
                out.push_str(&run[..10]);
                out.push_str("…redacted");
            } else {
                out.push_str(&run);
            }
            run.clear();
            out.push(ch);
        }
        out.pop();
        out
    };
    let rows: Vec<Value> = t
        .rows
        .iter()
        .map(|r| {
            let mut r = r.clone();
            if let Some(m) = r["chainMsg"].as_str().map(&scrub) {
                r["chainMsg"] = json!(m);
            }
            r
        })
        .collect();
    let receipt = json!({
        "beat": "wb002-wasm-vs-model",
        "stack": {"client": format!("antelope-spring {server}"), "chain": "local dev chain, single producer", "wasm": "vendored 2021 e6a042f, verbatim, never rebuilt", "model": "Rust btungsten-wb002 (Specimen profile)"},
        "steps": t.rows.len(), "matched": matched, "classMismatches": t.class, "stateMismatches": t.state,
        "refusedStepsProvenAtomicOnChain": t.atomic, "f1IssuerConfiscationAcceptedOnChain": f1, "f3OwnerAttachRefusedOnChain": f3,
        "hexScrubbed": true, "finalChainHash40": &final_chain[..40], "rows": rows,
    });
    let path = std::env::var("WB002_RECEIPT")
        .unwrap_or_else(|_| format!("{}/wb002-wasm-receipt.json", std::env::temp_dir().display()));
    fs::write(&path, serde_json::to_string_pretty(&receipt).unwrap())
        .unwrap_or_else(|e| fail(format!("write receipt {path}: {e}")));
    let bad = t.class + t.state > 0 || final_chain != final_model;
    drop(env);
    std::process::exit(if bad { 1 } else { 0 });
}
