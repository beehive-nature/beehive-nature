// spend.circom — the note spend statement (SPEC-PRIVACY-1, PLONK fork).
//
// Proves knowledge of (secret, amount, tag) such that
//   commitment = Poseidon(secret, amount)   — the deposited note's commitment
//   nullifier  = Poseidon(secret, tag)      — the spend's nullifier
// with (commitment, nullifier) PUBLIC. Poseidon from circomlib (iden3), NOT
// keccak — in-circuit keccak is enormous (handoff §6, lane law).
//
// What this statement binds and what it does NOT (labeled exactly):
//   BINDS: nullifier and commitment to the SAME secret (the linkage the
//   nullifier set needs — a nullifier cannot be produced for a note whose
//   secret the spender does not know).
//   DOES NOT BIND: membership of the commitment in the chain's commitment
//   set (a merkle-tree root public input is the named future lane) and
//   value conservation across transfer legs. The rehearsal chain keeps
//   amounts openly, labeled, per SPEC-PRIVACY-1 §m3-design.
pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

template Spend() {
    // private
    signal input secret;
    signal input amount;
    signal input tag;
    // public (see component main {public [...]})
    signal input commitment;
    signal input nullifier;

    component hc = Poseidon(2);
    hc.inputs[0] <== secret;
    hc.inputs[1] <== amount;
    hc.out === commitment;

    component hn = Poseidon(2);
    hn.inputs[0] <== secret;
    hn.inputs[1] <== tag;
    hn.out === nullifier;
}

component main {public [commitment, nullifier]} = Spend();
