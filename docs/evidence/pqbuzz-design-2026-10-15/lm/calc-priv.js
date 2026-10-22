const b64u = n => Math.ceil(n*4/3);
const ev = (contentLen, tags, kind=1059) => JSON.stringify({id:'x'.repeat(64),pubkey:'x'.repeat(64),created_at:1760000000,kind,tags,content:'x'.repeat(contentLen),sig:'x'.repeat(128)}).length;
const SLOT=1589, SELF=85, CORE=187, SEALJ=7191;
// plaintext = a signed kind-14 NIP-01 event whose content is a ~400 B bChat v2 envelope (200 B text)
const inner = ev(400, [['p','x'.repeat(64)]], 14);
console.log({innerSignedEvent: inner});
let rmax=0;
for (let r=1;r<=40;r++){
  const sealed = 8+16+CORE+(2+r*SLOT+SELF)+(inner+16);
  const wire = ev(b64u(sealed), Array.from({length:Math.min(r,2)},()=>['p','x'.repeat(64)]));
  if (wire+12<=65536) rmax=r;
  if ([1,2,3,4,8,16].includes(r)) console.log(`r=${r}: sealed ${sealed} B -> kind-1059 ${wire} B; +SEAL ${ev(b64u(sealed+SEALJ),[['p','x'.repeat(64)]])} B`);
}
console.log({rmax_under_64KiB: rmax});
// classical NIP-17 1:1 = gift to recipient + gift to self
console.log({classicalNip17_1to1: 2*2557});
