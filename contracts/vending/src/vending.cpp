// vending — the member-agent vending machine's Vaulta half (SPEC-VENDING-1 §layers 3).
//
// THE LAW AND THE POINTER, NEVER BULK HISTORY (the bounded-rows ruling):
//   Vaulta carries (a) the rate table and tithe percentage as governed-mutable
//   state — amendable by founder word WITHOUT redeploy — and (b) ONE pointer
//   row per minted agent: where the Arweave birth certificate lives and the
//   content hash that makes any resurrection provable. Revisions, memory,
//   bulk mint history: those live on Arweave + Autonomi, never here.
//
// POINTER LAW (SPEC-VENDING-1 §pointer-law, ruled): the certificate's location
// is DERIVED from what the member holds — the agent name resolves this row
// (name road); the member's ed25519 key resolves the Arweave owner/tags
// directly (key road, no estate involvement at all). This contract is the
// name road's stop, not a lookup table the estate curates: rows are written
// by the member's own action and erased by the member's own action.
//
// IDENTITY BY CITATION (do not re-specify — SPEC-VENDING-1 §already-answered):
//   .a/.b naming, suffixless storage, bnr:// resolution and the 27-tongue
//   charset are SPEC-A-NAMES-1 law. This contract accepts ANY UTF-8 agent
//   name (mīlestībairkaralis-class names mint whole); the primary key is a
//   FNV-1a-64 of the bytes, with exact-string collision REFUSAL so no name
//   can ever silently hijack another's certificate row.
//
// Deploy posture: Jungle4 rehearsal under bnrapolltest (TESTNET-ONLY). The
// mainnet home is a founder-gated gesture (same law as bdomain2: the code is
// the law, the seat it stands on is the founder's word).
//
// Compile: cdt-cpp (CDT 4.x) — contracts/vending/src/vending.cpp

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>

using namespace eosio;
using namespace std;

static constexpr symbol CORE_SYMBOL = symbol{"A", 4};   // ruled denomination (2026-08-22)

// ── config: the machine's own law constants (singleton, governed) ──────────
TABLE config_row {
    name        admin;
    uint64_t    max_certs;    // the RAM bound — minting closes at the cap
    uint64_t    certs_count;  // maintained, never iterated
    string      spec;         // "SPEC-VENDING-1" — the certificate's law citation
    bool        initialized;
};

// ── rates: the meter's price table (governed-mutable; one row per rail) ────
TABLE rate_row {
    name            rail;     // vaulta / autonomi / arweave / base / ... (name-encodable)
    asset           basis;    // per-call basis in A (the b-meter reads this)
    string          label;    // human words for the row
    time_point_sec  updated;
    uint64_t primary_key() const { return rail.value; }
};

// ── tithe: THE TITHE = 10% founder-word-only (singleton, governed) ─────────
TABLE tithe_row {
    uint16_t        percent_bp;   // 1000 = 10.00%
    name            destination;  // where tithe lines settle
    time_point_sec  updated;
};

// ── certs: THE POINTER — one bounded row per minted agent ───────────────────
TABLE cert_row {
    uint64_t        id;           // FNV-1a-64 of agent_name bytes (collision-refused)
    string          agent_name;   // full UTF-8, suffixless rail name (§charset law)
    name            owner;        // the member's Vaulta account
    string          member_key;   // member ed25519 pubkey hex (the AR owner / key road)
    string          ar_id;        // Arweave data-item id, 43-char base64url
    string          content_hash; // sha256 hex of the certificate's canonical JSON
    string          template_id;  // the recipe template the agent was minted from
    string          tongue;       // the agent's serving tongue (§tongue)
    time_point_sec  minted;
    uint64_t primary_key() const { return id; }
};

class [[eosio::contract("vending")]] vending : public contract {
public:
    using contract::contract;
    using rates    = multi_index<"rates"_n, rate_row>;
    using certs    = multi_index<"certs"_n, cert_row>;
    using config_tbl = singleton<"config"_n, config_row>;
    using tithe_tbl  = singleton<"tithe"_n, tithe_row>;

    // ── life cycle ─────────────────────────────────────────────────────────
    [[eosio::action]] void init(name admin, uint64_t max_certs) {
        require_auth(get_self());
        config_tbl cfg(get_self(), get_self().value);
        check(!cfg.exists() || !cfg.get().initialized, "already initialized");
        cfg.set(config_row{admin, max_certs, 0, string("SPEC-VENDING-1"), true}, get_self());
    }

    [[eosio::action]] void setadmin(name new_admin) {
        config_tbl cfg(get_self(), get_self().value);
        require_auth(cfg.get().admin);
        auto c = cfg.get(); c.admin = new_admin; cfg.set(c, get_self());
    }

    // ── the governed law: rate + tithe rows (founder word, no redeploy) ────
    [[eosio::action]] void setrate(name rail, asset basis, string label) {
        config_tbl cfgt(get_self(), get_self().value);
        require_auth(cfgt.get().admin);
        check(basis.symbol == CORE_SYMBOL, "basis must be core A");
        rates rs(get_self(), get_self().value);
        auto itr = rs.find(rail.value);
        if (itr == rs.end()) {
            uint32_t n = 0;
            for (auto& r : rs) { n++; if (n > 32) break; } // bounded count, bounded loop
            check(n <= 32, "rate table bounded at 32 rails"); // rows stay BOUNDED
            rs.emplace(get_self(), [&](auto& r){ r.rail=rail; r.basis=basis;
                r.label=label; r.updated=current_time_point(); });
        } else {
            rs.modify(itr, same_payer, [&](auto& r){ r.basis=basis;
                r.label=label; r.updated=current_time_point(); });
        }
    }

    [[eosio::action]] void rmrate(name rail) {
        config_tbl cfgt(get_self(), get_self().value);
        require_auth(cfgt.get().admin);
        rates rs(get_self(), get_self().value);
        rs.erase(rs.require_find(rail.value, "no such rail rate"));
    }

    [[eosio::action]] void settithe(uint16_t percent_bp, name destination) {
        config_tbl cfgt(get_self(), get_self().value);
        require_auth(cfgt.get().admin);
        check(percent_bp <= 10000, "percent is basis points, max 10000");
        tithe_tbl tt(get_self(), get_self().value);
        tt.set(tithe_row{percent_bp, destination, current_time_point()}, get_self());
    }

    // ── THE MINT — the member's own action writes the member's own row ─────
    [[eosio::action]] void mint(string agent_name, name owner, string member_key,
                                string ar_id, string content_hash,
                                string templ, string tongue) {
        require_auth(owner); // the member signs their mint (or their delegate)
        config_tbl cfgt(get_self(), get_self().value);
        check(cfgt.exists() && cfgt.get().initialized, "not initialized");
        auto cfg = cfgt.get();
        check(cfg.certs_count < cfg.max_certs, "mint cap reached — RAM is bounded by law");
        check(agent_name.size() >= 1 && agent_name.size() <= 64, "agent name 1-64 bytes");
        check(member_key.size() == 64, "member key: ed25519 pubkey hex (64)");
        check(ar_id.size() == 43, "ar id: 43-char base64url data item");
        check(content_hash.size() == 64, "content hash: sha256 hex (64)");
        check(templ.size() <= 32 && tongue.size() <= 24, "template/tongue bounds");

        certs cs(get_self(), get_self().value);
        auto id = fnv1a64(agent_name);
        auto itr = cs.find(id);
        if (itr != cs.end())
            check(itr->agent_name == agent_name, "pk collision — mint refused"); // never hijack
        check(itr == cs.end(), "name already minted — use update (rows are one per agent)");

        cs.emplace(owner, [&](auto& c){ // RAM billed to the member — their row
            c.id = id; c.agent_name = agent_name; c.owner = owner;
            c.member_key = member_key; c.ar_id = ar_id; c.content_hash = content_hash;
            c.template_id = templ; c.tongue = tongue; c.minted = current_time_point();
        });
        cfg.certs_count++; cfgt.set(cfg, get_self());
    }

    // in-place pointer update (re-mint / key rotation) — BOUNDED: same row
    [[eosio::action]] void update(string agent_name, name owner, string member_key,
                                  string ar_id, string content_hash) {
        require_auth(owner);
        certs cs(get_self(), get_self().value);
        auto itr = cs.require_find(fnv1a64(agent_name), "no such certificate");
        check(itr->owner == owner, "not the owner");
        check(member_key.size() == 64 && ar_id.size() == 43 && content_hash.size() == 64,
              "member key 64 / ar id 43 / hash 64");
        cs.modify(itr, same_payer, [&](auto& c){
            c.member_key = member_key; c.ar_id = ar_id;
            c.content_hash = content_hash; });
    }

    // the member may drop the name-road pointer (RAM refund); the key road on
    // Arweave keeps working — the certificate outlives this row by design
    [[eosio::action]] void release(string agent_name) {
        certs cs(get_self(), get_self().value);
        auto itr = cs.require_find(fnv1a64(agent_name), "no such certificate");
        require_auth(itr->owner);
        cs.erase(itr);
        config_tbl cfgt(get_self(), get_self().value);
        if (cfgt.exists()) {
            auto cfg = cfgt.get();
            if (cfg.certs_count > 0) { cfg.certs_count--; cfgt.set(cfg, get_self()); }
        }
    }

private:
    // FNV-1a-64 over the UTF-8 bytes — works for every §charset name; exact
    // strings are compared on hit, so a collision REFUSES instead of hijacking
    static uint64_t fnv1a64(const string& s) {
        uint64_t h = 0xcbf29ce484222325ULL;
        for (char c : s) { h ^= (uint8_t)c; h *= 0x100000001b3ULL; }
        return h;
    }
};
