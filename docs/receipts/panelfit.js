const fs=require('fs'), jpeg=require('jpeg-js');
const ART='C:/Users/travi/OneDrive/Pictures/BNRi pixel art/000_bqueen_bee_genesis_96x96_hexrect.hex';
const W=380,H=520;
function load(f){const b=Buffer.from(fs.readFileSync(f,'utf8').trim(),'hex');
  const g=Array.from({length:96},()=>new Array(96).fill('000000'));
  for(let i=0;i<b.length;i+=8){const x=b[i],y=b[i+1],w=b[i+2],h=b[i+3],c=b.slice(i+4,i+7).toString('hex');
    for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)if(x+dx<96&&y+dy<96)g[y+dy][x+dx]=c;}
  return g;}
const src=load(ART);
function reduce(g,n){if(n===96)return g;
  const out=Array.from({length:n},()=>new Array(n)); const s=96/n;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const m=new Map();
    for(let dy=0;dy<Math.ceil(s);dy++)for(let dx=0;dx<Math.ceil(s);dx++){
      const sy=Math.min(95,Math.floor(y*s)+dy),sx=Math.min(95,Math.floor(x*s)+dx);
      const c=g[sy][sx];m.set(c,(m.get(c)||0)+1);}
    out[y][x]=[...m.entries()].sort((a,b)=>b[1]-a[1])[0][0];}
  return out;}
const rgb=c=>[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];
// REDUCTION LOSS: reduced grid re-expanded to 96 vs the true 96x96
function redLoss(g,n){if(n===96)return {max:0,mean:0,pct:0};
  let max=0,sum=0,bad=0; const s=96/n;
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
    const a=rgb(src[y][x]), b=rgb(g[Math.min(n-1,Math.floor(y/s))][Math.min(n-1,Math.floor(x/s))]);
    let e=0;for(let k=0;k<3;k++)e=Math.max(e,Math.abs(a[k]-b[k]));
    max=Math.max(max,e);sum+=e;if(e>8)bad++;}
  return {max,mean:sum/9216,pct:100*bad/9216};}
function render(g,cell,ox,oy){const n=g.length,art=n*cell;
  const buf=Buffer.alloc(W*H*4);
  for(let i=0;i<W*H;i++){buf[i*4]=10;buf[i*4+1]=10;buf[i*4+2]=15;buf[i*4+3]=255;}
  for(let y=0;y<art;y++)for(let x=0;x<art;x++){
    const px=ox+x,py=oy+y; if(px<0||px>=W||py<0||py>=H)continue;
    const c=rgb(g[Math.floor(y/cell)][Math.floor(x/cell)]),o=(py*W+px)*4;
    buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];buf[o+3]=255;}
  return buf;}
const CASES=[
  {n:96,cell:4,tag:'96x96 @4px=384  FULL DETAIL'},
  {n:48,cell:8,tag:'48x48 @8px=384  2:1 reduce'},
  {n:47,cell:8,tag:'47x47 @8px=376  2.04:1 reduce'},
  {n:32,cell:8,tag:'32x32 @8px=256  3:1 reduce'},
];
console.log('Origin SNAPPED to (0,0) so art-pixel edges land on JPEG 8x8 block boundaries.\n');
console.log('                                 REDUCTION LOSS (art)      JPEG q92 ROUND-TRIP');
console.log('case                             max  mean   %>8    bytes  fits  max  mean   %>8');
for(const c of CASES){
  const g=reduce(src,c.n); const rl=redLoss(g,c.n);
  const ideal=render(g,c.cell,0,0);
  const enc=jpeg.encode({data:Buffer.from(ideal),width:W,height:H},92);
  const dec=jpeg.decode(enc.data);
  let max=0,sum=0,bad=0;
  for(let i=0;i<W*H;i++){let e=0;for(let k=0;k<3;k++)e=Math.max(e,Math.abs(dec.data[i*4+k]-ideal[i*4+k]));
    max=Math.max(max,e);sum+=e;if(e>8)bad++;}
  console.log(c.tag.padEnd(32)+String(rl.max).padStart(4)+rl.mean.toFixed(1).padStart(6)+
    rl.pct.toFixed(1).padStart(6)+'%'+String(enc.data.length).padStart(9)+
    (enc.data.length<=65536?'  YES ':'  NO  ')+String(max).padStart(5)+
    (sum/(W*H)).toFixed(2).padStart(6)+(100*bad/(W*H)).toFixed(2).padStart(6)+'%');
  fs.writeFileSync('C:/Users/travi/AppData/Local/Temp/claude/C--Users-travi/c12f969c-d7b5-4c11-80ea-730879628488/scratchpad/imgtest'+'/dev_'+c.n+'.jpg', enc.data);
}
