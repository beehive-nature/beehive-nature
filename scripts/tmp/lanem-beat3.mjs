// Lane M beat 3 — listening.html honest state machine + music.html demo link label
import { readFileSync, writeFileSync } from 'node:fs';

// ---------- listening.html ----------
const P = 'surfaces/listening.html';
let h = readFileSync(P, 'utf8');
const rep = (before, after) => {
  const i = h.indexOf(before);
  if (i < 0 || h.indexOf(before, i + 1) >= 0) throw new Error('anchor not unique/found: ' + before.slice(0, 50));
  h = h.slice(0, i) + after + h.slice(i + before.length);
};

// 1. the status line is a polite live region (state changes are announced)
rep('<div id="now">idle', '<div id="now" aria-live="polite">idle');

// 2. replace the play/stop engine with the honest state machine
const oldStart = h.indexOf('function play(){');
const oldStopFn = 'function stop(){ if(timer){clearInterval(timer);timer=null;} }';
const oldEnd = h.indexOf(oldStopFn);
if (oldStart < 0 || oldEnd < 0 || oldEnd < oldStart) throw new Error('play/stop block not found');
const M = '\u00b7';
const engine = `function setNow(t){ $('now').textContent=t; }
function silenceContext(){ if(ac&&ac.state==='running'){ try{ ac.suspend(); }catch(e){} } }
function stopTimer(){ if(timer){clearInterval(timer);timer=null;} }
function seedLabel(s){ return s.length>18?s.slice(0,18)+'.':s; }
var totalSteps=32, lastSeed='';
/* every state tells the truth: stopped, completed, suspended and failed are four
   DIFFERENT sentences, and none of them is "playing" - the old stop() cleared the
   timer but left the "playing" line on screen for both button-stop and natural
   completion, which is exactly the dishonesty this cure removes. */
function stop(userStopped){
  var played=step;
  stopTimer(); silenceContext();
  if(userStopped){ setNow('stopped - '+played+' of '+totalSteps+' steps played (seed '+seedLabel(lastSeed)+' kept)'); }
}
function play(){
  stopTimer();
  var seed=$('seed').value.trim()||'0';
  lastSeed=seed; notes=buildPiece(seed); drawViz(seed); step=0; totalSteps=notes.length;
  if(!ac){
    var Ctor=window.AudioContext||window.webkitAudioContext;
    if(!Ctor){ setNow('audio unavailable - this browser exposes no audio engine, so no sound can play here; the seed, the fork law and the hex-field still work'); return; }
    try{ ac=new Ctor(); }catch(err){ ac=null; setNow('audio unavailable - the audio engine refused to start; no sound can play here'); return; }
    ac.onstatechange=function(){ if(ac&&ac.state==='suspended'&&timer){ var played=step; stopTimer(); silenceContext(); setNow('suspended - the browser blocked audio mid-piece ('+played+' of '+totalSteps+' steps); press play to try again'); } };
  }
  if(ac.state==='suspended'){
    setNow('waiting - asking the browser for audio; sound starts when it agrees');
    var wantSeed=seed;
    ac.resume().then(function(){
      if(ac&&ac.state==='running'&&lastSeed===wantSeed){ beginPiece(wantSeed); }
      else if(lastSeed===wantSeed){ setNow('suspended - the browser did not let audio start; press play again'); }
    }).catch(function(){ if(lastSeed===wantSeed){ setNow('suspended - audio was refused; press play again'); } });
    return;
  }
  beginPiece(seed);
  function beginPiece(bseed){
    setNow('playing - '+totalSteps+' steps from seed '+seedLabel(bseed)+' ${M} '+notes.length+' notes ${M} scale and rhythm derived, not sampled');
    timer=setInterval(function(){
      if(step>=notes.length){ stopTimer(); silenceContext(); setNow('completed - all '+totalSteps+' steps played from seed '+seedLabel(bseed)); return; }
      try{ beep(notes[step]); }catch(err){ stopTimer(); silenceContext(); setNow('failed - the audio engine stopped mid-piece ('+step+' of '+totalSteps+' steps); nothing is claimed playing'); return; }
      step++;
    },160);
  }
}
/* inspectable state, cypherpunk register style: the page's own claim about
   itself is checkable from outside (and by the e2e proof) without any
   test-only backdoor into the engine. */
window.listeningDemo={ get audioState(){return ac?ac.state:'none';}, get steps(){return step;}, get total(){return totalSteps;}, get playing(){return !!timer;} };`;
h = h.slice(0, oldStart) + engine + h.slice(oldEnd + oldStopFn.length);

// 3. the stop button reports a user stop; play re-arms cleanly
rep("$('play').onclick=play;$('stop').onclick=stop;", "$('play').onclick=play;$('stop').onclick=function(){stop(true);};");
writeFileSync(P, h);
console.log('listening.html: engine replaced, aria-live added, handle exposed');

// ---------- music.html: the demo path says what it is ----------
const MP = 'surfaces/music.html';
let m = readFileSync(MP, 'utf8');
const anchor = '<a href="listening.html">listening room</a>';
const panelIdx = m.indexOf(anchor);
if (panelIdx < 0 || m.indexOf(anchor, panelIdx + 1) >= 0) {
  // two anchors (nav + panel): label only the panel one (inside the ways row)
  const ways = m.indexOf('music.waysTitle');
  const nav = m.indexOf('href="listening.html"');
  if (ways < 0 || nav < 0) throw new Error('ways/nav anchors not found');
  const panelOne = m.indexOf(anchor, ways);
  if (panelOne < 0) throw new Error('panel listening anchor not found');
  m = m.slice(0, panelOne) + '<a href="listening.html">listening room - generated-sound demo</a>' + m.slice(panelOne + anchor.length);
} else {
  m = m.replace(anchor, '<a href="listening.html">listening room - generated-sound demo</a>');
}
writeFileSync(MP, m);
console.log('music.html: panel demo link labeled');
