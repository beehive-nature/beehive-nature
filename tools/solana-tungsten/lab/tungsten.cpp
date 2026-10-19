// Disposable fixture-unit ledger. No token contract or production custody.
#include <eosio/eosio.hpp>
#include <eosio/crypto_ext.hpp>
#include <eosio/system.hpp>
#include "plonk_verify.hpp"
using namespace eosio;
class [[eosio::contract("tungsten")]] tungsten : public contract {
public:
    using contract::contract;
    struct [[eosio::table]] grantrow {
        uint64_t id;
        name recipient;
        uint64_t amount;
        uint64_t ceiling;
        uint32_t expires;
        std::vector<uint8_t> publics;
        bool spent;
        uint64_t credited;
        uint64_t primary_key() const { return id; }
    };
    using grants = multi_index<"grants"_n, grantrow>;
    struct [[eosio::table]] balance {
        name owner;
        uint64_t units;
        uint64_t primary_key() const { return owner.value; }
    };
    using balances = multi_index<"balances"_n, balance>;
    [[eosio::action]] void grant(name recipient, uint64_t amount, uint64_t ceiling,
                                uint32_t expires, std::vector<uint8_t> publics) {
        require_auth(get_self());
        check(publics.size() == 160, "five canonical public fields required");
        check(amount > 0 && amount <= ceiling && ceiling <= 7, "fixture ceiling");
        check(expires > current_time_point().sec_since_epoch(), "expired grant");
        check(recipient != get_self(), "distinct recipient required");
        grants rows(get_self(), get_self().value);
        check(rows.find(1) == rows.end(), "grant already exists");
        // Test-only genesis allocation. There is no redeemability or exchange
        // rate; subsequent settlement conserves these seven fixture units.
        balances funds(get_self(), get_self().value);
        funds.emplace(get_self(), [&](auto& b) { b = {get_self(), 7}; });
        funds.emplace(get_self(), [&](auto& b) { b = {recipient, 0}; });
        rows.emplace(get_self(), [&](auto& r) {
            r = {1, recipient, amount, ceiling, expires, publics, false, 0};
        });
    }
    static void kec(const unsigned char* in, unsigned len, unsigned char out[32]) {
        const auto bytes = keccak((const char*)in, len).extract_as_byte_array();
        memcpy(out, bytes.data(), 32);
    }
    [[eosio::action]] void settle(name recipient, uint64_t amount, std::vector<uint8_t> proof) {
        grants rows(get_self(), get_self().value);
        auto r = rows.require_find(1, "grant missing");
        require_auth(r->recipient);
        check(!r->spent, "authorization consumed");
        check(current_time_point().sec_since_epoch() <= r->expires, "expired grant");
        check(recipient == r->recipient && amount == r->amount && amount <= r->ceiling, "authority mismatch");
        check(proof.size() == 768, "proof length");
        check(plonk_verify(kec, proof.data(), r->publics.data()) == 0, "PLONK rejected");
        // Atomic verifier + authorization consumption + fixture balance credit.
        balances funds(get_self(), get_self().value);
        auto escrow = funds.require_find(get_self().value, "escrow missing");
        auto worker = funds.require_find(recipient.value, "recipient missing");
        check(escrow->units >= amount, "insufficient escrow");
        funds.modify(escrow, same_payer, [&](auto& b) { b.units -= amount; });
        funds.modify(worker, same_payer, [&](auto& b) { b.units += amount; });
        rows.modify(r, same_payer, [&](auto& row) { row.spent = true; row.credited = amount; });
    }
};
EOSIO_DISPATCH(tungsten, (grant)(settle))
