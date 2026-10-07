#!/bin/bash
# cleos.stub.sh — deterministic offline cleos substitute for the
# finalizer's verdict-logic regressions (review order 2026-10-07 round
# 3: assess the RUNNER, not the chain). Driven entirely by $STUB_DIR
# fixtures; counts every verify push in $STUB_DIR/verify.count so the
# tests can assert that legs actually ran. No wallet, no network.
MODE="$1"; shift
case "$MODE" in
  wallet) exit 0 ;;
  get)
    WHAT="$1"; shift
    case "$WHAT" in
      code)   cat "$STUB_DIR/code.txt"; exit 0 ;;
      table)
        # $A $A <scope> ... — the anchors table serves per-call files
        # table.N.json when present (N = 1-based call counter), else
        # table.json; other tables are static files
        TBL="$3"
        if [ "$TBL" = "anchors" ]; then
          C=$(cat "$STUB_DIR/anchors.reads" 2>/dev/null || echo 0); C=$((C+1)); echo $C > "$STUB_DIR/anchors.reads"
          [ -f "$STUB_DIR/table.$C.json" ] && { cat "$STUB_DIR/table.$C.json"; exit 0; }
          cat "$STUB_DIR/table.json"; exit 0
        fi
        cat "$STUB_DIR/$TBL.json"; exit 0 ;;
      *) echo "stub: unhandled get $WHAT" >&2; exit 1 ;;
    esac ;;
  push)
    # push action <account> <action> '<json>' -p ...
    ACT="$3"; ARGS="$4"
    case "$ACT" in
      verify)
        C=$(cat "$STUB_DIR/verify.count" 2>/dev/null || echo 0); C=$((C+1)); echo $C > "$STUB_DIR/verify.count"
        SEQ=$(node -pe "try{JSON.parse(process.argv[1]).seq}catch(e){-1}" "$ARGS" 2>/dev/null || echo -1)
        # per-seq response: the fixture's verified row (reverify leg)
        # gets the one-proof-per-anchor message; everything else the
        # pairing refusal
        VSEQ=$(node -pe "JSON.parse(require('fs').readFileSync(process.env.STUB_DIR+'/table.json','utf8')).rows.find(r=>r.verified_at>0).seq" 2>/dev/null || echo -1)
        if [ "$SEQ" = "$VSEQ" ]; then
          printf 'error 2026: assertion failure with message: anchor already verified (one proof per anchor)\n'
        else
          printf 'error 2026: assertion failure with message: count proof REJECTED — plonk pairing false\n'
        fi
        exit 1 ;;
      anchor)
        cat "$STUB_DIR/anchor.resp" 2>/dev/null || printf 'error 2026: assertion failure with message: anchor table FULL (bounded resource budget)\n'
        exit 1 ;;
      *) echo "stub: unhandled action $ACT" >&2; exit 1 ;;
    esac ;;
  *) echo "stub: unhandled mode $MODE" >&2; exit 1 ;;
esac
