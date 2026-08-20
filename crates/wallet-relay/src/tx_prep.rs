//! Unsigned TX preparation for the Vaulta bzDiD mint (SPEC-VAULTA-IDENTITY-1 §5).
//! ALL actions are founder-gated. The seat PREPARES unsigned tx objects; NEVER signs/sends/creates.
//! Keys MUST be sorted by serialized 33-byte compressed bytes (FABLE 8j).

use serde_json::{json, Value};

pub fn prepare_updateauth(account:&str, permission:&str, parent:&str, threshold:u32, keys:&[(&str,u32)]) -> Value {
    json!({ "actions":[{ "account":"eosio", "name":"updateauth",
        "authorization":[{"actor":account,"permission":"active"}],
        "data":{ "account":account, "permission":permission, "parent":parent,
            "auth":{ "threshold":threshold,
                "keys":keys.iter().map(|(k,w)|json!({"key":k,"weight":w})).collect::<Vec<_>>(),
                "accounts":[], "waits":[] } } }],
        "_note":"UNSIGNED — founder signs. Keys sorted by 33-byte compressed (FABLE 8j).",
        "_signatures_required":["active"] })
}

pub fn prepare_linkauth(account:&str, code:&str, action_type:&str, permission:&str) -> Value {
    json!({ "actions":[{ "account":"eosio", "name":"linkauth",
        "authorization":[{"actor":account,"permission":"active"}],
        "data":{"account":account,"code":code,"type":action_type,"requirement":permission} }],
        "_note":"UNSIGNED — founder signs.", "_signatures_required":["active"] })
}

pub fn prepare_newaccount(creator:&str, new_account:&str, owner_keys:&[(&str,u32)], active_keys:&[(&str,u32)], ram_bytes:u64) -> Value {
    json!({ "actions":[{
        "account":"eosio","name":"newaccount","authorization":[{"actor":creator,"permission":"active"}],
        "data":{ "creator":creator, "name":new_account,
            "owner":{"threshold":1,"keys":owner_keys.iter().map(|(k,w)|json!({"key":k,"weight":w})).collect::<Vec<_>>(),"accounts":[],"waits":[]},
            "active":{"threshold":1,"keys":active_keys.iter().map(|(k,w)|json!({"key":k,"weight":w})).collect::<Vec<_>>(),"accounts":[],"waits":[]} }
    },{ "account":"eosio","name":"buyrambytes","authorization":[{"actor":creator,"permission":"active"}],
        "data":{"payer":creator,"receiver":new_account,"bytes":ram_bytes} }],
        "_note":"UNSIGNED. IRREVERSIBLE. Founder signs with creator key. Keys sorted by 33-byte compressed (FABLE 8j).",
        "_signatures_required":[format!("{}@active",creator)], "_irreversible":true })
}

pub fn prepare_mint_walkthrough(creator:&str, new_account:&str, device_addresses:&[Value]) -> Value {
    json!({ "spec":"SPEC-VAULTA-IDENTITY-1", "account":new_account, "all_unsigned":true, "founder_gated":true,
        "steps":[
            {"step":1,"action":"newaccount","note":"Creates the Vaulta account. IRREVERSIBLE. Founder signs."},
            {"step":2,"action":"updateauth bni.id","note":"Identity management permission. Parent: active."},
            {"step":3,"action":"updateauth bni.deploy","note":"Deploy permission. Parent: active."},
            {"step":4,"action":"linkauth bni.deploy → setcode/setabi/buyrambytes","note":"Restricts deploy to code ops only (FABLE 8i)."},
            {"step":5,"action":"write device addresses to identity table","note":"EVM/BTC/ZEC addresses wrapped in versioned envelopes."}
        ],
        "device_addresses":device_addresses,
        "_absolute":"UNSIGNED. Founder signs ALL steps. Seat never holds key/fund/account." })
}
