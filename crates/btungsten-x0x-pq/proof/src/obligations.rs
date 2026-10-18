//! Closed inventory of required symbolic obligations and deliberate false ones.
pub struct Script {
    pub name: String,
    pub body: String,
    pub markers: Vec<String>,
    pub control: bool,
}

pub fn scripts() -> Vec<Script> {
    let mut honest = Script {
        name: "honest".into(),
        body: "include \"common.saw\";\n".into(),
        markers: vec![],
        control: false,
    };
    let mut obligation = |label: String, command: String| {
        let marker = format!("PREPARE PROVEN {label}");
        honest
            .body
            .push_str(&format!("{command};\nprint \"{marker}\";\n"));
        honest.markers.push(marker);
    };
    for name in ["prepared", "modern"] {
        for (m, s, c, refused) in [
            (0, 3309, 0, false),
            (1, 3309, 1, false),
            (257, 3309, 255, false),
            (4096, 3309, 254, false),
            (257, 3309, 256, true),
            (1, 3309, 257, true),
            (257, 0, 255, true),
            (257, 1, 255, true),
            (257, 3308, 255, true),
            (257, 3310, 255, true),
            (257, 4096, 255, true),
        ] {
            obligation(
                format!("{name} m={m} s={s} c={c}"),
                format!("check \"pq_prepare_proof::{name}\" {m} {s} {c} {refused}"),
            );
        }
        for p in [0, 1, 1951, 1953] {
            obligation(
                format!("{name} key-length={p}"),
                format!("check_key_length \"pq_prepare_proof::{name}\" {p}"),
            );
        }
    }
    for (m, s, refused) in [
        (0, 3309, false),
        (257, 3309, false),
        (257, 0, true),
        (257, 3308, true),
        (257, 3310, true),
    ] {
        obligation(
            format!("legacy m={m} s={s} c=0"),
            format!("check_legacy {m} {s} {refused}"),
        );
    }
    obligation(
        "reuse independent operations".into(),
        "check_reuse \"pq_prepare_proof::reuse\"".into(),
    );
    let mut scripts = vec![honest];
    for (name, cmd) in [
        (
            "accept",
            "check \"pq_prepare_proof::accept_all\" 1 0 1 true",
        ),
        (
            "reject",
            "check \"pq_prepare_proof::reject_all\" 1 3309 1 false",
        ),
        ("message", "check_ignored_message"),
        ("context", "check_ignored_context"),
        (
            "signature",
            "check \"pq_prepare_proof::truncate_signature\" 1 3310 1 true",
        ),
        (
            "key",
            "check \"pq_prepare_proof::replace_key\" 1 3309 1 false",
        ),
        ("reuse", "check_reuse \"pq_prepare_proof::cached_result\""),
    ] {
        let marker = format!("PREPARE CONTROL {name} obligation");
        scripts.push(Script { name:name.into(), markers:vec![marker.clone()], control:true,
            body:format!("include \"common.saw\";\nprint \"{marker}\";\n{cmd};\nprint \"PREPARE UNEXPECTED-PROVEN\";\n") });
    }
    scripts
}

pub fn validate(script: &Script, code: Option<i32>, log: &str) -> std::result::Result<(), String> {
    if script.markers.is_empty() {
        return Err("empty proof coverage".into());
    }
    for marker in &script.markers {
        if log.lines().filter(|l| *l == marker).count() != 1 {
            return Err(format!("missing or duplicated obligation: {marker}"));
        }
    }
    if script.control {
        if code != Some(2)
            || log.contains("PREPARE UNEXPECTED-PROVEN")
            || !log.contains("----------Counterexample----------")
            || !log.contains("Subgoal failed:")
            || !log.lines().any(|line| {
                line.starts_with("Subgoal failed:")
                    && line.ends_with("Literal equality postcondition")
            })
            || log.contains("No override specification applies")
            || log.contains("Translation error")
        {
            return Err(format!(
                "{} was not refuted at its return-value equation",
                script.name
            ));
        }
    } else {
        let observed: Vec<_> = log
            .lines()
            .filter(|l| l.starts_with("PREPARE PROVEN "))
            .collect();
        if code != Some(0) || observed != script.markers || log.contains("Counterexample") {
            return Err("incomplete or failed honest proof".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn proof_transcript_controls() {
        let s = Script {
            name: "gate".into(),
            body: String::new(),
            markers: vec!["PREPARE PROVEN one".into()],
            control: false,
        };
        assert!(validate(&s, Some(0), "PREPARE PROVEN one\n").is_ok());
        for (code, log) in [
            (Some(1), "PREPARE PROVEN one\n"),
            (Some(0), ""),
            (None, "PREPARE PROVEN one\n"),
            (Some(0), "PREPARE PROVEN one\nPREPARE PROVEN one\n"),
            (Some(0), "PREPARE PROVEN one\nPREPARE PROVEN extra\n"),
        ] {
            assert!(validate(&s, code, log).is_err());
        }
        let t = Script {
            name: "teeth".into(),
            body: String::new(),
            markers: vec!["PREPARE CONTROL teeth obligation".into()],
            control: true,
        };
        let ok = "PREPARE CONTROL teeth obligation\nSubgoal failed: Literal equality postcondition\n----------Counterexample----------\n";
        assert!(validate(&t, Some(2), ok).is_ok());
        assert!(validate(&t, Some(0), ok).is_err());
        assert!(validate(&t, Some(2), &(ok.to_string() + "PREPARE UNEXPECTED-PROVEN")).is_err());
        assert!(validate(
            &t,
            Some(2),
            "PREPARE CONTROL teeth obligation\nnetwork failure"
        )
        .is_err());
        assert!(validate(
            &t,
            Some(2),
            &(ok.to_string() + "No override specification applies")
        )
        .is_err());
        assert_eq!(scripts()[0].markers.len(), 36);
        assert_eq!(scripts().len(), 8);
    }
}
