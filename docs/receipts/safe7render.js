const fs=require('fs'), path=require('path'), jpeg=require('jpeg-js');
const DIR='C:/Users/travi/OneDrive/Pictures/BNRi pixel art';
const OUT=process.argv[2];
const W=380,H=520,BUDGET=65536,CELL=4,OX=0,OY=72;   // OX,OY both multiples of 8
const clean=n=>n.replace(/_hexrect\.hex$/,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'').toLowerCase();
console.log('piece                                  q   bytes   %budget  palette  maxerr  %px>8');
for(const f of fs.readdirSync(DIR).filter(x=>x.endsWith('_hexrect.hex')).sort()){
  const b=Buffer.from(fs.readFileSync(path.join(DIR,f),'utf8').trim(),'hex');
  const g=Array.from({length:96},()=>new Array(96).fill('0a0a0f'));
  const pal=new Set();
  for(let i=0;i<b.length;i+=8){
    const x=b[i],y=b[i+1],w=b[i+2],h=b[i+3],c=b.slice(i+4,i+7).toString('hex');
    pal.add(c);
    for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)if(x+dx<96&&y+dy<96)g[y+dy][x+dx]=c;
  }
  const ideal=Buffer.alloc(W*H*4);
  for(let i=0;i<W*H;i++){ideal[i*4]=10;ideal[i*4+1]=10;ideal[i*4+2]=15;ideal[i*4+3]=255;}
  for(let y=0;y<96*CELL;y++)for(let x=0;x<96*CELL;x++){
    const px=OX+x,py=OY+y; if(px>=W||py>=H)continue;
    const c=g[(y/CELL)|0][(x/CELL)|0],o=(py*W+px)*4;
    ideal[o]=parseInt(c.slice(0,2),16);ideal[o+1]=parseInt(c.slice(2,4),16);ideal[o+2]=parseInt(c.slice(4,6),16);ideal[o+3]=255;
  }
  // binary-search the highest quality that still fits the device budget
  let lo=70,hi=99,best=null;
  while(lo<=hi){const mid=(lo+hi)>>1;
    const enc=jpeg.encode({data:Buffer.from(ideal),width:W,height:H},mid);
    if(enc.data.length<=BUDGET){best={q:mid,enc};lo=mid+1;}else hi=mid-1;}
  const dec=jpeg.decode(best.enc.data);
  let max=0,bad=0;
  for(let i=0;i<W*H;i++){let e=0;for(let k=0;k<3;k++)e=Math.max(e,Math.abs(dec.data[i*4+k]-ideal[i*4+k]));
    max=Math.max(max,e); if(e>8)bad++;}
  const name='bnri_'+clean(f)+'_safe7.jpg';
  fs.writeFileSync(path.join(OUT,name),best.enc.data);
  console.log(clean(f).slice(0,36).padEnd(38)+String(best.q).padStart(3)+String(best.enc.data.length).padStart(8)+
    (100*best.enc.data.length/BUDGET).toFixed(0).padStart(8)+'%'+String(pal.size).padStart(8)+
    String(max).padStart(8)+(100*bad/(W*H)).toFixed(2).padStart(7)+'%');
}
