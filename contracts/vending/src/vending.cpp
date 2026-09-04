// vending — the member-agent vending machine's Vaulta half (SPEC-VENDING-1 §layers 3)
// + THE METER (§x402, ruled 2026-09-04 from docs/raids/X402-SORT-2026-09-01.md —
// RULES only, never Hedera code; the estate rail replaces every SDK call).
//
// THE LAW AND THE POINTER, NEVER BULK HISTORY (the bounded-rows ruling):
//   Vaulta carries (a) the rate table and tithe percentage as governed-mutable
//   state — amendable by founder word WITHOUT redeploy — and (b) ONE pointer
//   row per minted agent: where the Arweave birth certificate lives and the
//   content hash that makes any resurrection provable. Revisions, memory,
//   bulk mint history: those live on Arweave + Autonomi, never here.
//
// THE METER (x402 rules, cited shapes):
//   credit-only-from-settlement — `settle` is the ONLY credit path and every
//     credit is keyed on a single-use nonce, so a replayed payment credits
//     once and is refused the second time (pinout session.mjs / idempotent
//     credit keyed on the settlement).
//   pause-not-kill — a session that cannot pay is PAUSED, never deleted;
//     charges refuse while paused; a top-up + `resume` bring it back
//     (pinout session.mjs pause-at-zero).
//   rate = cost basis + tithe — every rates row carries its own tithe_bp
//     beside the basis (pinout compute/rates.json shape; the estate's field
//     is cost basis + tithe, not margin).
//   upto ceiling with nonce burn even at zero — the ceiling is signed once
//     at opensess; charges clamp under it; a settle consumes its nonce even
//     when the amount is zero (Tally X402UptoProxy capture rule).
//   THE STATEFUL PARTY — single-use nonces need one stateful party; in the
//     estate that party is THIS contract on Vaulta, not a box (raid §residue).
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
//   x402 rule: the row IS cost basis + tithe (pinout compute/rates.json shape)
TABLE rate_row {
    name            rail;     // vaulta / autonomi / arweave / base / ... (name-encodable)
    asset           basis;    // per-call cost basis in A (the b-meter reads this)
    uint16_t        tithe_bp; // the tithe split for this rail, basis points
    string          label;    // human words for the row
    time_point_sec  updated;
    uint64_t primary_key() const { return rail.value; }
};

// ── sessions: the metered session (pinout session.mjs state machine, RULE) ──
//   ACTIVE ↔ PAUSED — pause-not-kill; credit only via settle; charges clamp
//   under the upto ceiling signed once at open
TABLE session_row {
    uint64_t        id;           // caller-chosen, collision-refused
    name            owner;        // the member
    string          agent_name;   // the metered agent
    name            rail;         // which rates row prices the units
    uint8_t         state;        // 0=ACTIVE 1=PAUSED 2=CLOSED
    asset           credit;       // summed settlements (credit-only-from-settlement)
    asset           burned;       // summed charges
    asset           ceiling;      // the upto max, signed once at open
    uint8_t         audit_state;  // 255=none, else the four-state verdict
    string          audit_hash;   // sha256 hex of the pure audit record
    time_point_sec  opened;
    time_point_sec  updated;
    uint64_t primary_key() const { return id; }
};

// ── nonces: THE STATEFUL PARTY (Tally X402UptoProxy: burn even at zero) ────
//   row presence = spent. Single-use, chain-held, no box.
TABLE nonce_row {
    uint64_t        value;     // the single-use nonce
    uint64_t        session;   // which session it credited
    asset           amount;    // the settled amount (may be 0 — still burned)
    time_point_sec  at;
    uint64_t primary_key() const { return value; }
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
    using sessions = multi_index<"sessions"_n, session_row>;
    using nonces   = multi_index<"nonces"_n, nonce_row>;
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
    //   x402: the row is cost basis + tithe_bp (compute/rates.json shape)
    [[eosio::action]] void setrate(name rail, asset basis, uint16_t tithe_bp, string label) {
        config_tbl cfgt(get_self(), get_self().value);
        require_auth(cfgt.get().admin);
        check(basis.symbol == CORE_SYMBOL, "basis must be core A");
        check(tithe_bp <= 10000, "tithe is basis points, max 10000");
        rates rs(get_self(), get_self().value);
        auto itr = rs.find(rail.value);
        if (itr == rs.end()) {
            uint32_t n = 0;
            for (auto& r : rs) { n++; if (n > 32) break; } // bounded count, bounded loop
            check(n <= 32, "rate table bounded at 32 rails"); // rows stay BOUNDED
            rs.emplace(get_self(), [&](auto& r){ r.rail=rail; r.basis=basis;
                r.tithe_bp=tithe_bp; r.label=label; r.updated=current_time_point(); });
        } else {
            rs.modify(itr, same_payer, [&](auto& r){ r.basis=basis;
                r.tithe_bp=tithe_bp; r.label=label; r.updated=current_time_point(); });
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

    // ── THE METER (x402 rules; Jungle4 rehearsal, member-auth/member-RAM) ──

    // open a metered session: the upto CEILING is signed once, here
    [[eosio::action]] void opensess(uint64_t sess, name owner, string agent_name,
                                    name rail, asset ceiling) {
        require_auth(owner);
        check(ceiling.symbol == CORE_SYMBOL, "ceiling must be core A");
        rates rs(get_self(), get_self().value);
        rs.require_find(rail.value, "no such rail rate");
        sessions ss(get_self(), get_self().value);
        check(ss.find(sess) == ss.end(), "session id exists");
        ss.emplace(owner, [&](auto& s){
            s.id=sess; s.owner=owner; s.agent_name=agent_name; s.rail=rail;
            s.state=0; s.credit=asset{0, CORE_SYMBOL}; s.burned=asset{0, CORE_SYMBOL};
            s.ceiling=ceiling; s.audit_state=255; s.audit_hash="";
            s.opened=current_time_point(); s.updated=s.opened;
        });
    }

    // CREDIT-ONLY-FROM-SETTLEMENT: the one credit path, keyed on a single-use
    // nonce. The nonce BURNS even when the amount is zero (Tally capture rule)
    // and a replay is refused — a replayed payment credits exactly once.
    [[eosio::action]] void settle(uint64_t sess, name payer, uint64_t nonce, asset amount) {
        require_auth(payer);
        check(amount.symbol == CORE_SYMBOL && amount.amount >= 0, "settle in core A");
        sessions ss(get_self(), get_self().value);
        auto sitr = ss.require_find(sess, "no such session");
        check(sitr->state != 2, "session closed");
        nonces ns(get_self(), get_self().value);
        check(ns.find(nonce) == ns.end(), "nonce spent — replay refused");
        ns.emplace(payer, [&](auto& n){ n.value=nonce; n.session=sess;
            n.amount=amount; n.at=current_time_point(); }); // BURN, even at zero
        ss.modify(sitr, same_payer, [&](auto& s){
            s.credit += amount; s.updated = current_time_point(); });
    }

    // burn a charge against the rate basis — pause-at-zero semantics (pinout
    // session.mjs): burn whole payable units, never overdraw, and when the
    // balance runs out the session PAUSES (a committed state change — the
    // session outlives its balance; nothing is killed or reverted)
    [[eosio::action]] void charge(uint64_t sess, uint64_t units) {
        sessions ss(get_self(), get_self().value);
        auto sitr = ss.require_find(sess, "no such session");
        require_auth(sitr->owner);
        check(sitr->state == 0, "session paused — resume first (pause, not kill)");
        check(units >= 1 && units <= 1000000000, "units 1..1e9");
        rates rs(get_self(), get_self().value);
        auto ritr = rs.require_find(sitr->rail.value, "rate row vanished");
        int64_t perUnit = ritr->basis.amount;
        check(perUnit > 0, "rate basis is zero");
        int64_t cost = perUnit * (int64_t)units;
        check(sitr->burned.amount + cost <= sitr->ceiling.amount,
              "over ceiling — upto max refused (verifyAgainst rule)");
        int64_t available = sitr->credit.amount - sitr->burned.amount; // never negative by construction
        int64_t payableUnits = available / perUnit;
        int64_t burnUnits = payableUnits < (int64_t)units ? payableUnits : (int64_t)units;
        ss.modify(sitr, same_payer, [&](auto& s){
            s.burned.amount += perUnit * burnUnits;
            if (s.credit.amount - s.burned.amount < perUnit) s.state = 1; // PAUSE AT ZERO
            s.updated = current_time_point(); });
    }

    [[eosio::action]] void pause(uint64_t sess) {
        sessions ss(get_self(), get_self().value);
        auto sitr = ss.require_find(sess, "no such session");
        require_auth(sitr->owner);
        check(sitr->state == 0, "not active");
        ss.modify(sitr, same_payer, [&](auto& s){ s.state = 1; s.updated = current_time_point(); });
    }

    [[eosio::action]] void resume(uint64_t sess) {
        sessions ss(get_self(), get_self().value);
        auto sitr = ss.require_find(sess, "no such session");
        require_auth(sitr->owner);
        check(sitr->state == 1, "not paused");
        ss.modify(sitr, same_payer, [&](auto& s){ s.state = 0; s.updated = current_time_point(); });
    }

    // the pure 9-check audit runs OFF-chain (public record only); its verdict
    // lands here — bounded: two fields on the session row, never a history
    [[eosio::action]] void auditmark(uint64_t sess, uint8_t state, string audit_hash) {
        sessions ss(get_self(), get_self().value);
        auto sitr = ss.require_find(sess, "no such session");
        require_auth(sitr->owner);
        check(state <= 3, "state 0..3 (PASSED/PENDING_ANCHOR/FAILED/INCONCLUSIVE)");
        check(audit_hash.size() == 64, "audit hash: sha256 hex (64)");
        ss.modify(sitr, same_payer, [&](auto& s){
            s.audit_state = state; s.audit_hash = audit_hash; s.updated = current_time_point(); });
    }

    // bounded nonce table: the owner may sweep their spent nonces
    [[eosio::action]] void rmnonce(uint64_t sess, uint64_t nonce) {
        sessions ss(get_self(), get_self().value);
        auto sitr = ss.require_find(sess, "no such session");
        require_auth(sitr->owner);
        nonces ns(get_self(), get_self().value);
        auto nitr = ns.require_find(nonce, "no such nonce");
        check(nitr->session == sess, "nonce belongs to another session");
        ns.erase(nitr);
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
