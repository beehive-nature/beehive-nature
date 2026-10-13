/* prelude.js — loads before vendor/hive-tx.min.js and carries only the browser
   guard that vendor needs to start. hive-tx 6.1.0 (the same file the wallet
   and bDroP load, see surfaces/onboarding/vendor/BUILD-NOTES.md) starts a
   healthcheck interval at init and calls .unref() on the numeric timer handle
   — a node-ism browsers do not carry — and its factory dies before
   window.hiveTx attaches. Guarded no-ops, installed only when absent, nothing
   else touches Number. The keychain never lets hive-tx talk to the network:
   connect-src 'none' in this page's CSP holds that line, and the keychain
   calls no method that fetches (it only serializes and encodes public keys). */
if (typeof Number.prototype.unref !== 'function') { Number.prototype.unref = function () {}; Number.prototype.ref = function () {}; }
