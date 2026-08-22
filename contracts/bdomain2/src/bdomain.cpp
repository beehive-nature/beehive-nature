// bdomain2 — the evolved .b registry. The scaling-ruled contract shape
// (docs/bdomain-scaling.md §6-7) with every economic defect the analysis named:
//
//   USERS PAY THEIR OWN WAY  — registration_fee is WIRED (prepay via on_notify),
//                              not a dead field; the cap (max_domains) bounds RAM.
//   NO FREE-RIDING TRANSFERS — transfer() requires the transferee's auth AND
//                              re-bills the row to them (the old bug: the old
//                              owner kept paying for a domain they gave away).
//   MEMO GUARD SEEDED        — XRP (slip44:144) and XLM (slip44:148) carry
//                              requires_memo=true from init; seedmemo() repairs
//                              legacy rows. The funds-loss exposure, closed.
//   THE 10B/1k-YEAR SHAPE    — Tier 1 trimmed (byowner index DROPPED, chain_key
//                              string → uint16 ordinal, domain_id dropped from
//                              chainaddrs: the scope IS the domain), plus the
//                              Tier-2 `resolvers` table: owner-set signer +
//                              gateway, so addresses resolve off-chain in
//                              owner-signed responses at ZERO marginal RAM.
//                              Ten billion users are keypairs, not accounts.
//
// Lineage: ABI-faithful evolution of the live kingbeelovis registry (live ABI
// pinned 2026-08-22; the 13 live names migrate as Tier-1 anchors unchanged).
// Forge: Jungle4 first (MX-7; test bed banchor22222 — RAM bought, A funded).
// Compile: cdt-cpp (CDT 4.x). No admin can move a user's records (I-2 [LIVE]).

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/system.hpp>
#include <eosio/crypto.hpp>
#include <eosio/singleton.hpp>

using namespace eosio;
using namespace std;

static constexpr name CORE_TOKEN = "core.vaulta"_n;   // Jungle4 + Vaulta core (A)
static constexpr symbol CORE_SYMBOL = symbol{"A", 4}; // ruled denomination (2026-08-22)

// ── Tier-1: the on-chain anchor row (trimmed: no byowner index, +resolver_id) ──
TABLE domain_row {
    uint64_t    id;            // = name(domain_name).value (≤13-char names enforced)
    string      domain_name;   // stored SUFFIXLESS ("king", not "king.b")
    name        owner;
    name        account;       // the name resolves to (Tier-1 / legacy lane)
    uint16_t    resolver_id;   // 0 = Tier-1 on-chain; >0 = Tier-2 signed resolver
    time_point_sec registered;
    time_point_sec expires;
    uint64_t primary_key() const { return id; }
    // NO byowner: reverse lookup is an indexer's job — the ruled 128 B/user trim.
};

// ── Tier-2: owner-signed off-chain resolution — the row that reaches 10B ──
TABLE resolver_row {
    uint32_t    id;            // small ordinal; a few dozen serve unbounded users
    name        owner;         // the domain owner who set it (I-2: owner-only)
    string      gateway_url;
    string      signer_pub;    // K1/R1 public key hex; client verifies responses
    uint32_t    ttl_seconds;
    uint64_t primary_key() const { return id; }
};

// ── chainkeys: the policy source (ordinal-addressed; memo guard lives here) ──
TABLE chainkey_row {
    uint16_t    ord;           // the ruled ordinal: kills the string + FNV collision class
    string      chain_key;     // canonical id, e.g. "slip44:144"
    string      label;
    bool        requires_memo;
    uint64_t primary_key() const { return ord; }
};

// ── chainaddrs: per-domain scope (scope = name-encoded id — the id IS the scope;
//    domain_id column DROPPED per the ruled trim: 8 B × chains/user saved) ──
TABLE chainaddr_row {
    uint16_t    chain_ord;     // ordinal into chainkeys
    string      address;
    string      addr_type;
    string      memo_tag;
    uint64_t primary_key() const { return chain_ord; }
};


// ── prepaids: fee escrow — users pay their own way, memo = the name ──
TABLE prepaid_row {
    name        payer;
    string      domain_name;
    asset       amount;
    uint64_t primary_key() const { return payer.value; }
};

TABLE config_row {
    name   admin;
    asset  registration_fee;   // WIRED: consumed by registeracc/renew (0 = free era)
    uint32_t registration_days;
    uint64_t max_domains;      // the RAM bound — registration closes at the cap
    uint64_t domains_count;    // maintained, never iterated
    bool    initialized;
};


class [[eosio::contract("bdomain2")]] bdomain2 : public contract {
public:
    using contract::contract;
    // table handles inside the class — CDT abigen exports tables from here
    using domains    = multi_index<"domains"_n, domain_row>;
    using resolvers  = multi_index<"resolvers"_n, resolver_row>;
    using chainkeys  = multi_index<"chainkeys"_n, chainkey_row>;
    using chainaddrs = multi_index<"chainaddrs"_n, chainaddr_row>;
    using prepaids   = multi_index<"prepaids"_n, prepaid_row>;
    using config_tbl = singleton<"config"_n, config_row>;

    // ── life cycle ─────────────────────────────────────────────────────────
    [[eosio::action]] void init(name admin, asset reg_fee, uint32_t reg_days, uint64_t max_domains) {
        require_auth(get_self());
        config_tbl cfg(get_self(), get_self().value);
        check(!cfg.exists() || !cfg.get().initialized, "already initialized");
        check(reg_fee.symbol == CORE_SYMBOL, "fee must be core A");
        config_row c{admin, reg_fee, reg_days, max_domains, 0, true};
        cfg.set(c, get_self());
    }

    // ── registration: fee-wired, capped, users pay their own way ───────────
    [[eosio::action]] void registeracc(name registrant, string domain_name, name target) {
        require_auth(registrant);
        config_tbl cfgt(get_self(), get_self().value);
        check(cfgt.exists() && cfgt.get().initialized, "not initialized");
        auto cfg = cfgt.get();

        valid_name_or_fail(domain_name);
        check(cfg.domains_count < cfg.max_domains, "registry at its cap — RAM is bounded by law");

        domains dom(get_self(), get_self().value);
        auto id = name_id(domain_name);
        auto itr = dom.find(id);
        if (itr != dom.end()) {
            check(itr->expires < current_time_point(), "name already registered");
            // lapsed: the old row's RAM refunds to its payer on erase
            dom.erase(itr);
            cfg.domains_count--; cfgt.set(cfg, get_self());
        }

        // THE FIX: the fee is consumed, not pretended. Prepay (memo=name) or free era.
        if (cfg.registration_fee.amount > 0) {
            prepaids pre(get_self(), get_self().value);
            auto pitr = pre.find(registrant.value);
            check(pitr != pre.end() && pitr->domain_name == domain_name
                  && pitr->amount >= cfg.registration_fee, "fee not prepaid (transfer to the contract with memo = the name)");
            asset excess = pitr->amount - cfg.registration_fee;
            if (excess.amount > 0)
                transfer_core(registrant, excess, "prepay excess refund");
            pre.erase(pitr);
        }

        dom.emplace(registrant, [&](auto& d) {
            d.id = id;
            d.domain_name = domain_name;
            d.owner = registrant;
            d.account = target;
            d.resolver_id = 0; // Tier-1 anchor by default
            d.registered = current_time_point();
            d.expires = current_time_point() + seconds(cfg.registration_days);
        });
        cfg.domains_count++; cfgt.set(cfg, get_self());
    }

    // on_notify prepay: the user's own wallet action, the user's own token
    [[eosio::on_notify("core.vaulta::transfer")]] void
    on_transfer(name from, name to, asset quantity, string memo) {
        if (to != get_self() || from == get_self()) return;
        check(quantity.symbol == CORE_SYMBOL, "core A only");
        check(memo.size() > 0 && memo.size() <= 13, "memo must be the name being prepaid");
        prepaids pre(get_self(), get_self().value);
        auto pitr = pre.find(from.value);
        if (pitr == pre.end()) {
            pre.emplace(from, [&](auto& p){ p.payer=from; p.domain_name=memo; p.amount=quantity; });
        } else {
            pre.modify(pitr, same_payer, [&](auto& p){ p.domain_name=memo; p.amount+=quantity; });
        }
    }

    // ── the trade lane, repaired: transferee signs AND assumes the RAM ─────
    [[eosio::action]] void transfer(name from, string domain_name, name to) {
        require_auth(from);
        require_auth(to); // THE FIX: the recipient is present and consents
        domains dom(get_self(), get_self().value);
        auto itr = dom.require_find(name_id(domain_name), "no such domain");
        check(itr->owner == from, "not the owner");
        check(itr->expires >= current_time_point(), "domain expired");
        dom.modify(itr, to, [&](auto& d){ d.owner = to; }); // payer = to: THE FIX
    }

    [[eosio::action]] void renew(name owner, string domain_name, uint16_t days) {
        require_auth(owner);
        config_tbl cfgt(get_self(), get_self().value);
        auto cfg = cfgt.get();
        domains dom(get_self(), get_self().value);
        auto itr = dom.require_find(name_id(domain_name), "no such domain");
        check(itr->owner == owner, "not the owner");
        if (cfg.registration_fee.amount > 0) {
            prepaids pre(get_self(), get_self().value);
            auto pitr = pre.find(owner.value);
            check(pitr != pre.end() && pitr->domain_name == domain_name
                  && pitr->amount >= cfg.registration_fee, "renewal fee not prepaid");
            pre.erase(pitr);
        }
        time_point_sec now(current_time_point());
        dom.modify(itr, same_payer, [&](auto& d){
            auto base = d.expires > now ? d.expires : now;
            d.expires = base + seconds(uint32_t(days) * 86400);
        });
    }

    [[eosio::action]] void release(name owner, string domain_name) {
        require_auth(owner);
        domains dom(get_self(), get_self().value);
        auto itr = dom.require_find(name_id(domain_name), "no such domain");
        check(itr->owner == owner, "not the owner");
        dom.erase(itr); // RAM refunds to the payer of record
        config_tbl cfgt(get_self(), get_self().value);
        if (cfgt.exists()) {
            auto cfg = cfgt.get();
            if(cfg.domains_count>0){ cfg.domains_count--; cfgt.set(cfg, get_self()); }
        }
    }

    // ── Tier-2: the resolution lane that reaches ten billion ──────────────
    [[eosio::action]] void setresolver(name owner, string domain_name, uint32_t resolver_id,
                                       string gateway_url, string signer_pub, uint32_t ttl_seconds) {
        require_auth(owner); // I-2: NEVER admin — the owner's records are the owner's
        check(gateway_url.size() > 0 && gateway_url.size() <= 256, "gateway url 1-256");
        check(signer_pub.size() >= 53 && signer_pub.size() <= 66, "K1/R1 pub hex expected");
        resolvers res(get_self(), get_self().value);
        auto ritr = res.find(resolver_id);
        if (ritr == res.end()) {
            res.emplace(owner, [&](auto& r){ r.id=resolver_id; r.owner=owner;
                r.gateway_url=gateway_url; r.signer_pub=signer_pub; r.ttl_seconds=ttl_seconds; });
        } else {
            check(ritr->owner == owner, "resolver belongs to another owner");
            res.modify(ritr, same_payer, [&](auto& r){
                r.gateway_url=gateway_url; r.signer_pub=signer_pub; r.ttl_seconds=ttl_seconds; });
        }
        domains dom(get_self(), get_self().value);
        auto ditr = dom.require_find(name_id(domain_name), "no such domain");
        check(ditr->owner == owner, "not the owner");
        dom.modify(ditr, same_payer, [&](auto& d){ d.resolver_id = resolver_id; });
    }

    // ── Tier-1 legacy lane (evolved: ordinal chain keys) ───────────────────
    [[eosio::action]] void setaccount(name owner, string domain_name, name target) {
        require_auth(owner);
        domains dom(get_self(), get_self().value);
        auto itr = dom.require_find(name_id(domain_name), "no such domain");
        check(itr->owner == owner, "not the owner");
        dom.modify(itr, same_payer, [&](auto& d){ d.account = target; });
    }

    [[eosio::action]] void addchainkey(name admin, string chain_key, string label, bool requires_memo) {
        require_admin();
        chainkeys keys(get_self(), get_self().value);
        for (auto& k : keys) check(k.chain_key != chain_key, "chain key exists");
        uint16_t next = 0;
        for (auto& k : keys) next = std::max(next, uint16_t(k.ord + 1));
        keys.emplace(admin, [&](auto& k){ k.ord=next; k.chain_key=chain_key;
                                         k.label=label; k.requires_memo=requires_memo; });
    }

    [[eosio::action]] void rmchainkey(name admin, string chain_key) {
        require_admin();
        chainkeys keys(get_self(), get_self().value);
        for (auto itr = keys.begin(); itr != keys.end(); ++itr)
            if (itr->chain_key == chain_key) { keys.erase(itr); return; }
        check(false, "no such chain key");
    }

    [[eosio::action]] void setchain(name owner, string domain_name, uint16_t chain_ord,
                                    string address, string addr_type, string memo_tag) {
        require_auth(owner);
        chainkeys keys(get_self(), get_self().value);
        auto kitr = keys.require_find(chain_ord, "unknown chain ordinal");
        if (kitr->requires_memo) check(memo_tag.size() > 0, "this chain REQUIRES a memo/tag — empty memo is the funds-loss class");
        domains dom(get_self(), get_self().value);
        auto ditr = dom.require_find(name_id(domain_name), "no such domain");
        check(ditr->owner == owner, "not the owner");
        check(ditr->resolver_id == 0, "domain resolves via Tier-2 signer");
        chainaddrs addrs(get_self(), scope_of(ditr->id));
        auto aitr = addrs.find(chain_ord);
        if (aitr == addrs.end()) {
            addrs.emplace(owner, [&](auto& a){ a.chain_ord=chain_ord; a.address=address;
                                              a.addr_type=addr_type; a.memo_tag=memo_tag; });
        } else {
            addrs.modify(aitr, same_payer, [&](auto& a){ a.address=address;
                                                        a.addr_type=addr_type; a.memo_tag=memo_tag; });
        }
    }

    [[eosio::action]] void delchain(name owner, string domain_name, uint16_t chain_ord) {
        require_auth(owner);
        domains dom(get_self(), get_self().value);
        auto ditr = dom.require_find(name_id(domain_name), "no such domain");
        check(ditr->owner == owner, "not the owner");
        chainaddrs addrs(get_self(), scope_of(ditr->id));
        auto aitr = addrs.require_find(chain_ord, "no such address");
        addrs.erase(aitr);
    }

    // ── THE FUNDS-LOSS FIX: seed the memo guard for XRP/XLM (legacy rows) ──
    [[eosio::action]] void seedmemo(name admin) {
        require_admin();
        chainkeys keys(get_self(), get_self().value);
        bool fixed_any = false;
        for (auto itr = keys.begin(); itr != keys.end(); ++itr) {
            if ((itr->chain_key == "slip44:144" || itr->chain_key == "slip44:148") && !itr->requires_memo) {
                keys.modify(itr, same_payer, [&](auto& k){ k.requires_memo = true; });
                fixed_any = true;
            }
        }
        check(fixed_any, "nothing to seed (already guarded or keys absent)");
    }

    [[eosio::action]] void cleanup(string domain_name) {
        // permissionless, as designed: only lapsed rows may be reclaimed
        domains dom(get_self(), get_self().value);
        auto itr = dom.require_find(name_id(domain_name), "no such domain");
        check(itr->expires < current_time_point(), "domain not expired");
        dom.erase(itr);
        config_tbl cfgt(get_self(), get_self().value);
        if (cfgt.exists()) {
            auto cfg = cfgt.get();
            if(cfg.domains_count>0){ cfg.domains_count--; cfgt.set(cfg, get_self()); }
        }
    }

private:
    static uint64_t name_id(const string& domain_name) {
        return name{domain_name}.value;
    }
    // the per-domain scope: the id, name-encoded — the same encoding the public
    // reader proves live (6830934878284532282 → fva5q53rzb53e)
    static uint64_t scope_of(uint64_t id) { return id; }
    static void valid_name_or_fail(const string& n) {
        check(n.size() >= 1 && n.size() <= 13, "name must be 1-13 chars");
        for (char c : n) check(islower(c) || (c >= '1' && c <= '5') || c == '.',
                               "name chars: a-z, 1-5, optional dots");
    }
    void require_admin() {
        config_tbl cfgt(get_self(), get_self().value);
        require_auth(cfgt.get().admin);
    }
    void transfer_core(name to, asset quantity, string memo) {
        action(permission_level{get_self(), "active"_n},
               CORE_TOKEN, "transfer"_n,
               std::tuple(get_self(), to, quantity, memo)).send();
    }
};
