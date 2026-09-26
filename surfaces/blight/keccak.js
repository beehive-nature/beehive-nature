/*! keccak.js — the Keccak-256 core (BNR, part of the bLighTnetWorK)
 *
 * extracted verbatim from the five inline page copies (Z3): the three
 * whitespace-style-A pages (gallery/midi/profile) byte-for-byte; the two
 * style-B copies (inscription-explorer/workbench) differ only in spaces and
 * line wrapping — measured, semantically identical (normalized-equal). The
 * unit is four declarations: RC (round constants), KROT (rotation offsets),
 * M64, keccak256 itself — used only by the core on every page. One module,
 * five <script src> pins; no page may still define any of them.
 * classic script law (bcomb.js precedent): plain globals, no exports.
 */
const RC=[1n,0x8082n,0x800000000000808an,0x8000000080008000n,0x808bn,0x80000001n,0x8000000080008081n,0x8000000000008009n,0x8an,0x88n,0x80008009n,0x8000000an,0x8000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x80000001n,0x8000000080008008n];
const KROT=[[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
const M64=(1n<<64n)-1n;
function keccak256(bytes){
  const rot=(x,n)=>n===0n?x:((x<<n)|(x>>(64n-n)))&M64;
  let A=Array.from({length:5},()=>[0n,0n,0n,0n,0n]);
  const rate=136,pad=rate-(bytes.length%rate);
  const msg=new Uint8Array(bytes.length+pad);
  msg.set(bytes);msg[bytes.length]=0x01;msg[msg.length-1]|=0x80;
  for(let off=0;off<msg.length;off+=rate){
    for(let i=0;i<17;i++){let l=0n;for(let b=7;b>=0;b--)l=(l<<8n)|BigInt(msg[off+i*8+b]);A[i%5][(i/5)|0]^=l;}
    for(let r=0;r<24;r++){
      const C=[0,1,2,3,4].map(x=>A[x][0]^A[x][1]^A[x][2]^A[x][3]^A[x][4]);
      const D=[0,1,2,3,4].map(x=>C[(x+4)%5]^rot(C[(x+1)%5],1n));
      for(let x=0;x<5;x++)for(let y=0;y<5;y++)A[x][y]^=D[x];
      const B=[[],[],[],[],[]];
      for(let x=0;x<5;x++)for(let y=0;y<5;y++)B[y][(2*x+3*y)%5]=rot(A[x][y],BigInt(KROT[x][y]));
      for(let x=0;x<5;x++)for(let y=0;y<5;y++)A[x][y]=B[x][y]^((~B[(x+1)%5][y]&M64)&B[(x+2)%5][y]);
      A[0][0]^=RC[r];
    }
  }
  const out=new Uint8Array(32);let p=0;
  for(let i=0;i<4;i++){let l=A[i%5][(i/5)|0];for(let b=0;b<8;b++)out[p++]=Number((l>>BigInt(8*b))&0xFFn);}
  return out;
}
