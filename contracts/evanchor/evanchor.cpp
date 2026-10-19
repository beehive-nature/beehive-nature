// evanchor — the carrier for bnrose-evolve journal anchors (Vaulta; built for
// the Jungle4 testnet). One row per subject holding the latest canonical
// anchor statement (crates/bnrose-evolve/src/anchor.rs). The Rust check
// reads the row and compares the local journal against it at open.
//
// What the contract enforces, and only this:
// - the statement is a bnrose-evolve anchor statement (version 1, kind 0xA0)
//   whose own subject and count are the action's subject and count;
// - the first anchor of a subject binds its publisher; only that publisher
//   may advance it;
// - count strictly grows: an anchor never moves backward, so a truncation
//   cannot be hidden by re-anchoring a shorter journal;
// - the publisher pays the row's RAM (CONSTITUTION Article V.1), and the
//   statement is bounded (MAX_STATEMENT).
//
// What it does not establish, named: that the anchored head is the journal
// the publisher's controller actually holds. A publisher key that is
// compromised can advance the anchor to a forged head; the check then
// refuses the honest journal (fail closed, loud), it does not accept a
// rewrite. Deployment and every push are signed in the estate's signer
// lanes; no key is held by the seat that wrote this.

#include <eosio/eosio.hpp>
#include <eosio/system.hpp>

#include <string>
#include <vector>

using namespace eosio;

static constexpr uint32_t MAX_STATEMENT = 256;

class [[eosio::contract("evanchor")]] evanchor : public contract {
public:
   using contract::contract;

   [[eosio::action]] void anchor(name publisher, name subject, uint64_t count,
                                 const std::vector<uint8_t>& statement) {
      require_auth(publisher);
      check(statement.size() <= MAX_STATEMENT, "statement exceeds MAX_STATEMENT");
      check(statement.size() >= 6 && statement[0] == 1 && statement[1] == 0xA0,
            "not a bnrose-evolve anchor statement");
      uint32_t n = (uint32_t(statement[2]) << 24) | (uint32_t(statement[3]) << 16) |
                   (uint32_t(statement[4]) << 8) | uint32_t(statement[5]);
      check(n <= 12 && statement.size() >= 6 + n + 8, "statement is short");
      std::string s(statement.begin() + 6, statement.begin() + 6 + n);
      check(s == subject.to_string(), "statement names another subject");
      uint64_t c = 0;
      for (uint32_t i = 0; i < 8; ++i) c = (c << 8) | statement[6 + n + i];
      check(c == count, "statement states another count");

      anchors t(get_self(), get_self().value);
      auto it = t.find(subject.value);
      if (it == t.end()) {
         t.emplace(publisher, [&](auto& r) {
            r.subject = subject;
            r.publisher = publisher;
            r.count = count;
            r.seq = 1;
            r.statement = statement;
            r.at = time_point_sec(current_time_point());
         });
      } else {
         check(it->publisher == publisher, "subject is anchored by another publisher");
         check(count > it->count, "an anchor never moves backward");
         t.modify(it, publisher, [&](auto& r) {
            r.count = count;
            r.seq += 1;
            r.statement = statement;
            r.at = time_point_sec(current_time_point());
         });
      }
   }

   struct [[eosio::table]] anchor_row {
      name subject;
      name publisher;
      uint64_t count;
      uint64_t seq;
      std::vector<uint8_t> statement;
      time_point_sec at;
      uint64_t primary_key() const { return subject.value; }
   };
   typedef multi_index<"anchors"_n, anchor_row> anchors;
};
