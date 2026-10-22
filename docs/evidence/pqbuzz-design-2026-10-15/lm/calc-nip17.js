const b64u = n => Math.ceil(n*4/3), b64 = n => 4*Math.ceil(n/3);
function padded(len){ if(len<=32) return 32; const np = 1 << (Math.floor(Math.log2(len-1))+1); const chunk = np<=256?32:np/8; return chunk*(Math.floor((len-1)/chunk)+1); }
const nip44 = len => b64(1+32+2+padded(len)+32); // NIP-44 v2 payload, base64 with padding
const ev = (contentLen, tags) => JSON.stringify({id:'x'.repeat(64),pubkey:'x'.repeat(64),created_at:1760000000,kind:1059,tags,content:'x'.repeat(contentLen),sig:'x'.repeat(128)}).length;
const SLOT=1589, SELF=85, CORE=187;
for (const r of [1,2,4,8,16,24,28]) {
  const sealed = 8+16+CORE+(2+r*SLOT+SELF)+(400+16);
  const env = 200 + b64u(sealed); // bChat v2 envelope JSON with body.type bpq1, ~200 B of fields
  const rumor = JSON.stringify({id:'x'.repeat(64),pubkey:'x'.repeat(64),created_at:1760000000,kind:14,tags:[['p','x'.repeat(64)]],content:'x'.repeat(env)}).length;
  if (rumor > 65535) { console.log(`r=${r}: rumor ${rumor} exceeds NIP-44 plaintext cap 65,535`); continue; }
  const seal = ev(nip44(rumor), []);
  if (seal > 65535) { console.log(`r=${r}: seal ${seal} exceeds NIP-44 plaintext cap`); continue; }
  const gift = ev(nip44(seal), [['p','x'.repeat(64)]]);
  const direct = ev(b64u(sealed), [['p','x'.repeat(64)]]);
  console.log(`r=${r}: sealed ${sealed} B, rumor ${rumor} B, NIP-17 gift ${gift} B (frame<=65536: ${gift+12<=65536}), 1059-direct ${direct} B`);
}
// classical NIP-17 DM with 400 B envelope for comparison
const rumor0 = JSON.stringify({id:'x'.repeat(64),pubkey:'x'.repeat(64),created_at:1760000000,kind:14,tags:[['p','x'.repeat(64)]],content:'x'.repeat(400)}).length;
const seal0 = ev(nip44(rumor0), []); const gift0 = ev(nip44(seal0), [['p','x'.repeat(64)]]);
console.log({classicalNip17Gift: gift0});
