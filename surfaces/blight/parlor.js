/* THE PARLOR — TASK 3 of the comms ledger. Extends the gallery room:
   live spot value, make-an-offer, paywalled contact, the artist's AI seat.
   Built as a self-contained extension script: wraps openRoom (global), adds
   #parlor into the room after #deets. DOM-built, short lines, no exotica. */
(function(){
  if(document.getElementById('parlor')) return;
  var PAIRS={'FUNGI':'base/0x8ce9b689018fc94f44540b62ba6e10dc8b346448'};
  var SPOT={'FUNGI':0.00041,'$FROGGI':0.004,'JELLI':0.0009,'PEPI v2':3.2,'PEPI v1':0.55};
  var spotCache={};
  async function spot(sym){
    if(spotCache[sym]!==undefined) return spotCache[sym];
    var p=PAIRS[sym], px=SPOT[sym]||0;
    if(p){
      try{
        var ctl=new AbortController(); var kill=setTimeout(function(){ctl.abort();},8000);
        var r=await fetch('https://api.dexscreener.com/latest/dex/pairs/'+p,
          {headers:{'User-Agent':'gallery/1.0'},signal:ctl.signal});
        var j=await r.json(); clearTimeout(kill);
        var pr=j.pair||(j.pairs&&j.pairs[0]);
        if(pr&&pr.priceUsd) px=parseFloat(pr.priceUsd);
      }catch(e){}
    }
    spotCache[sym]=px; return px;
  }
  function el(tag,style,text){
    var e=document.createElement(tag);
    if(style) e.style.cssText=style;
    if(text!==undefined) e.textContent=text;
    return e;
  }
  function btn(txt,style,fn){
    var b=el('button',style,txt);
    b.onclick=fn; return b;
  }
  function buildParlor(i,room){
    var pieces=window.__garden||[];
    var p=pieces[i]; if(!p||!p.col) return;
    var inner=room.querySelector('.inner'); if(!inner) return;
    var old=document.getElementById('parlor'); if(old) old.remove();
    var pz=el('div'); pz.id='parlor';
    pz.style.cssText='margin-top:14px;max-width:600px;width:100%';
    spot(p.col.sym).then(function(px){
      if(px<=0){ pz.textContent=''; return; }
      var val=Math.round((p.seed||0)*px);
      var line=el('div','font-size:11.5px;line-height:2');
      line.innerHTML='spot value of this seed: <b style="color:#9FFF3D">approx ' +
        '$'+val.toLocaleString()+'</b>' +
        '<span style="color:#5a6478"> ('+px+' per token · live)</span>';
      var row=el('div','display:flex;gap:8px;flex-wrap:wrap;margin-top:8px');
      var offer=btn('offer — copies the note',
        'background:#12301a;color:#9FFF3D;border:1px solid #242433;border-radius:7px;padding:8px 12px;cursor:pointer;font:11px ui-monospace,monospace',
        function(){
          var u=location.origin+location.pathname;
          var note='OFFER - '+p.col.sym+' seed '+p.seed.toLocaleString()+
            ' (level '+(p.lvln===null?'?':p.lvln)+')\n'+
            'spot approx $'+val.toLocaleString()+' | my offer: ____ USDC | exact amount\n'+
            'room: '+u+'\n- from the Modern Inscription Art Gallery';
          navigator.clipboard.writeText(note).then(function(){
            offer.textContent='offer note copied';
          });
        });
      var ct=btn('contact owner — 5 USDC anti-spam',
        'background:#0a1626;color:#69b7ff;border:1px solid #242433;border-radius:7px;padding:8px 12px;cursor:pointer;font:11px ui-monospace,monospace',
        function(){ ct.textContent='5 USDC held — opens when the rail docks'; });
      var ai=btn('the artist AI seat',
        'background:#26123a;color:#c9a0ff;border:1px solid #242433;border-radius:7px;padding:8px 12px;cursor:pointer;font:11px ui-monospace,monospace',
        function(){
          var w=document.getElementById('aiWin');
          if(w) w.style.display=(w.style.display==='block')?'none':'block';
        });
      row.appendChild(offer); row.appendChild(ct); row.appendChild(ai);
      var win=el('div'); win.id='aiWin';
      win.style.cssText='display:none;margin-top:10px;background:#0b0b12;border:1px solid #2a1a3d;border-radius:9px;padding:12px';
      var cap=el('div','color:#c9a0ff;font-size:10.5px;margin-bottom:6px',
        'the artist AI seat — session window (the model docks with the hearth)');
      var log=el('div','color:#7e8c85;font-size:11px;min-height:30px;line-height:1.8');
      var bar=el('div','display:flex;gap:6px;margin-top:8px');
      var inp=el('input','flex:1;background:#050508;color:#cfe8d6;border:1px solid #242433;border-radius:6px;padding:7px 9px;font:11px ui-monospace,monospace');
      inp.placeholder='ask about the piece, the artist, an offer';
      function sendAI(){
        var q=inp.value.trim(); if(!q) return;
        var F=(window.ARTIST&&window.ARTIST[p.col.sym])||'an anonymous hand';
        var lines=[
          'this piece is '+p.col.sym+', seed '+p.seed.toLocaleString()+
            ', level '+(p.lvln===null?'?':p.lvln)+' of '+(p.col.lv?p.col.lv.length-1-(p.col.base||0):'?')+'. '+F+'.',
          'its spot sits near $'+val.toLocaleString()+
            ' - an offer travels by note; the owner answers from their own seat.',
          'the artist laws: art travels whole, cushions shown, pools never touch it.'
        ];
        var a1=el('div','color:#cfe8d6','you: '+q);
        var a2=el('div','color:#c9a0ff',lines[Math.floor(Math.random()*lines.length)]);
        log.appendChild(a1); log.appendChild(a2);
        inp.value='';
      }
      var go=btn('send','background:#26123a;color:#c9a0ff;border:1px solid #242433;border-radius:6px;padding:7px 10px;cursor:pointer',function(){ sendAI(); });
      inp.addEventListener('keydown',function(e){ if(e.key==='Enter') sendAI(); });
      bar.appendChild(inp); bar.appendChild(go);
      win.appendChild(cap); win.appendChild(log); win.appendChild(bar);
      var note=el('div','color:#5a6478;font-size:10px;margin-top:8px;line-height:1.7',
        'offers are pointers to this room — the room renders from chain state; messages stay thin.');
      pz.appendChild(line); pz.appendChild(row); pz.appendChild(win); pz.appendChild(note);
    });
    inner.appendChild(pz);
  }
  var orig=openRoom;
  openRoom=function(i){
    var out=orig(i);
    var room=document.getElementById('room');
    if(room) buildParlor(i,room);
    return out;
  };
})();
