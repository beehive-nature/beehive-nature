// FOREIGN-ORACLE conformance: arbundles (independent JS implementation) parses and
// validates our Rust-encoded Ed25519 DataItem. Exit 0 only if isValid && sigType===2.
const fs = require('fs');
const { DataItem } = require('arbundles');
(async () => {
  const path = process.argv[2];
  const d = new DataItem(fs.readFileSync(path));
  const out = {
    signatureType: d.signatureType,
    id: d.id,
    ownerLength: Buffer.from(d.rawOwner).length,
    isValid: await d.isValid(),
  };
  console.log(JSON.stringify(out, null, 2));
  const ok = out.isValid === true && out.signatureType === 2 && out.ownerLength === 32;
  console.log(ok ? 'CONFORMANCE: PASS (arbundles accepts our Ed25519 DataItem)'
                 : 'CONFORMANCE: FAIL');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('CONFORMANCE ERROR:', e.stack || e.message); process.exit(2); });
