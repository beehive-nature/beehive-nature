//! Select actual monomorphizations by MIR type, never by a guessed hash suffix.
use crate::binding::Result;
use serde_json::{json, Value};
use std::{collections::BTreeMap, fs, path::Path};

fn one<'a>(what: &str, values: Vec<&'a Value>) -> Result<&'a Value> {
    if values.len() != 1 {
        return Err(format!("MIR {what}: expected one match, got {}", values.len()).into());
    }
    Ok(values[0])
}

fn text(v: &Value) -> Result<&str> {
    v.as_str().ok_or_else(|| "MIR expected string".into())
}

fn unmangle(name: &str) -> Result<String> {
    let (head, tail) = name.split_once("::").ok_or("malformed MIR name")?;
    let (krate, _) = head
        .split_once('/')
        .ok_or("MIR crate has no disambiguator")?;
    Ok(format!(
        "{krate}::{}",
        tail.strip_suffix("[0]").unwrap_or(tail)
    ))
}

pub fn generate(mir: &Path, out: &Path) -> Result<Value> {
    let m: Value = serde_json::from_slice(&fs::read(mir)?)?;
    let tys: BTreeMap<_, _> = m["tys"]
        .as_array()
        .ok_or("missing MIR types")?
        .iter()
        .map(|t| Ok((text(&t["name"])?, &t["ty"])))
        .collect::<Result<_>>()?;
    let adts = m["adts"].as_array().ok_or("missing MIR ADTs")?;
    let fns = m["fns"].as_array().ok_or("missing MIR functions")?;
    let ty = |id: &Value| -> Result<&Value> {
        tys.get(text(id)?)
            .copied()
            .ok_or_else(|| "missing MIR type".into())
    };
    let prepared = one(
        "candidate",
        adts.iter()
            .filter(|a| {
                a["orig_def_id"].as_str().is_some_and(|n| {
                    n.starts_with("pq_prepare_proof/")
                        && n.ends_with("::candidate::PreparedMlDsa65PublicKey")
                })
            })
            .collect(),
    )?;
    let key_type = &prepared["variants"][0]["fields"][0]["ty"];
    let key_name = text(&ty(key_type)?["name"])?;
    let key = one(
        "ML-DSA-65 public key",
        adts.iter().filter(|a| a["name"] == key_name).collect(),
    )?;
    if key["size"] != 6240 || key["variants"][0]["fields"].as_array().map(Vec::len) != Some(3) {
        return Err("MIR public-key shape changed".into());
    }
    let polys = ty(&key["variants"][0]["fields"][2]["ty"])?;
    if polys["kind"] != "Array" || polys["size"]["rendered"]["val"] != "6" {
        return Err("not ML-DSA-65's six public-key polynomials".into());
    }
    let poly = text(&ty(&polys["ty"])?["name"])?;
    let expand = one(
        "expand_public",
        fns.iter()
            .filter(|f| {
                f["name"].as_str().is_some_and(|n| {
                    n.starts_with("fips204/") && n.contains("::ml_dsa::expand_public::_inst")
                }) && ty(&f["return_ty"]).is_ok_and(|t| t["args"][0] == *key_type)
            })
            .collect(),
    )?;
    let internal = one(
        "verify_internal",
        fns.iter()
            .filter(|f| {
                f["name"].as_str().is_some_and(|n| {
                    n.starts_with("fips204/") && n.contains("::ml_dsa::verify_internal::_inst")
                }) && f["args"].as_array().map(Vec::len) == Some(12)
                    && ty(&f["args"][5]["ty"]).is_ok_and(|t| t["ty"] == *key_type)
            })
            .collect(),
    )?;
    let mut names = BTreeMap::from([
        ("public_key_adt_name", key_name.to_string()),
        ("polynomial_adt_name", poly.to_string()),
        (
            "expanded_result_adt_name",
            text(&ty(&expand["return_ty"])?["name"])?.to_string(),
        ),
        ("expand_name", unmangle(text(&expand["name"])?)?),
        ("internal_name", unmangle(text(&internal["name"])?)?),
    ]);
    for scalar in ["u8", "i32"] {
        let barrier = one(
            &format!("zeroize barrier {scalar}"),
            fns.iter()
                .filter(|f| {
                    f["name"].as_str().is_some_and(|n| {
                        n.starts_with("zeroize/")
                            && n.contains("::barrier::optimization_barrier::_inst")
                    }) && ty(&f["args"][0]["ty"]).is_ok_and(|t| t["ty"] == format!("ty::{scalar}"))
                })
                .collect(),
        )?;
        names.insert(
            if scalar == "u8" {
                "barrier_u8_name"
            } else {
                "barrier_i32_name"
            },
            unmangle(text(&barrier["name"])?)?,
        );
    }
    let saw: String = names
        .iter()
        .map(|(k, v)| format!("let {k} = {};\n", serde_json::to_string(v).unwrap()))
        .collect();
    fs::write(out, saw)?;
    Ok(
        json!({"names":names,"public_key_bytes":key["size"],"source":"compiled linked MIR; selected by types"}),
    )
}
