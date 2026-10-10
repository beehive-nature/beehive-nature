#include <eosio/eosio.hpp>
#include <eosio/privileged.hpp>
class [[eosio::contract("boot")]] boot : public eosio::contract {
public:
    using contract::contract;
    [[eosio::action]] void activate(eosio::checksum256 digest) {
        require_auth(get_self());
        eosio::preactivate_feature(digest);
    }
};
EOSIO_DISPATCH(boot, (activate))
