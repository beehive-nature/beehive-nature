pragma circom 2.2.3;
// Same ordered public statement as SquareJob in src/lib.rs.
template SquareJob() {
    signal input x;
    signal input y;
    signal input contextHi;
    signal input contextLo;
    signal input nonce;
    signal input copyHi;
    signal input copyLo;
    signal input copyNonce;
    x * x === y;
    contextHi === copyHi;
    contextLo === copyLo;
    nonce === copyNonce;
}
component main {public [x, y, contextHi, contextLo, nonce]} = SquareJob();
