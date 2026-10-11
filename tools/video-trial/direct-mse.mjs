// Remux original MP4 samples into MSE fragments. No transcoding or network I/O.
import { createFile } from '../../vendor/mp4box/2.4.1/mp4box.all.mjs';

export async function createMP4Stream(first, { video, signal, onAttach = () => {}, onReady = () => {}, onSeekOutside = () => {} }) {
  if (!globalThis.MediaSource) return null;
  const file = createFile(true), queues = new Map();
  let info, failure, offset = 0, stopped = false, finishing = false, waitingForMedia = true;
  const stats = { mode:'mse', fragments:0, appendedBytes:0, initBytes:0, errors:0, queuedBytes:0, peakQueuedBytes:0, parserSampleBytes:0, peakParserSampleBytes:0, forwardTargetSeconds:20, backTargetSeconds:10, bufferTargetBytes:24<<20, forwardBytes:0, peakForwardBytes:0, quotaRecoveries:0, evictions:0, evictedUntil:0, peakAhead:0 };
  const fail = error => { failure = error instanceof Error ? error : new Error(String(error)); stats.errors++; };
  file.onError = fail;
  file.onReady = value => { info = value; };
  const parse = value => { const data = value.slice().buffer; data.fileStart = offset; offset += data.byteLength; file.appendBuffer(data); };
  parse(first);
  const tracks = info?.tracks.filter(t => t.video || t.audio) || [];
  const mime = t => `${t.video ? 'video' : 'audio'}/mp4; codecs="${t.codec}"`;
  if (failure || !info || info.isFragmented || !tracks.some(t => t.video) || tracks.some(t => !MediaSource.isTypeSupported(mime(t)))) {
    file.stop(); return null;
  }
  const source = new MediaSource(), url = URL.createObjectURL(source);
  const alive = () => !stopped && !signal.aborted;
  const check = () => { if (!alive()) throw new DOMException('Cancelled','AbortError'); if (failure) throw failure; if(video.error)throw new Error('MSE decoder failed'); };
  const event = (target, name, action) => new Promise((resolve, reject) => {
    let timer;
    const clean = () => { clearTimeout(timer); target.removeEventListener(name,yes); target.removeEventListener('error',no); signal.removeEventListener('abort',abort); };
    const yes = () => { clean(); resolve(); };
    const no = () => { clean(); reject(new Error('MSE media operation failed')); };
    const abort = () => { clean(); reject(new DOMException('Cancelled','AbortError')); };
    target.addEventListener(name,yes,{once:true}); target.addEventListener('error',no,{once:true}); signal.addEventListener('abort',abort,{once:true});
    timer = setTimeout(no,10000);
    try { check(); action(); } catch (e) { clean(); reject(e); }
  });
  const destroy = () => { if (stopped) return; stopped = true; file.stop(); queues.clear(); URL.revokeObjectURL(url); video.removeEventListener('loadeddata',ready); video.removeEventListener('seeking',seeking); video.removeEventListener('timeupdate',measureForward); video.removeEventListener('ended',measureForward); video.removeEventListener('waiting',waiting); video.removeEventListener('playing',playing); signal.removeEventListener('abort',destroy); };
  const ready = () => { if (alive()) onReady(); };
  const waiting = () => { waitingForMedia = true; };
  const playing = () => { waitingForMedia = false; };
  const seeking = () => {
    // Old samples have been released from both parser and MSE. The caller still
    // retains original bytes and can recover without another network request.
    if(video.currentTime < stats.evictedUntil){failure=new Error('Seek before retained MSE samples');onSeekOutside();}
  };
  function measureForward() {
    stats.forwardBytes=0;
    for(const q of queues.values()){
      q.history=q.history.filter(s=>!video.ended && s.end>video.currentTime);
      stats.forwardBytes+=q.history.reduce((n,s)=>n+s.bytes,0);
    }
    stats.peakForwardBytes=Math.max(stats.peakForwardBytes,stats.forwardBytes);
  }
  signal.addEventListener('abort',destroy,{once:true});
  video.addEventListener('loadeddata',ready,{once:true});
  video.addEventListener('seeking',seeking);
  video.addEventListener('timeupdate',measureForward);
  video.addEventListener('ended',measureForward);
  video.addEventListener('waiting',waiting);
  video.addEventListener('playing',playing);
  try {
    await event(source,'sourceopen',() => { onAttach(); video.src = url; video.load(); });
    check(); source.duration = info.duration / info.timescale;
    const samplesPerSegment = Math.max(1,Math.min(60,...tracks.map(t=>Math.ceil(t.nb_samples/(t.duration/t.timescale)/2))));
    for (const track of tracks) {
      const buffer = source.addSourceBuffer(mime(track));
      queues.set(track.id,{buffer,items:[],history:[]});
      // Small fragments allow actual playback from the first decrypted chunk.
      // Sample bytes and timestamps are preserved; only their container changes.
      file.setSegmentOptions(track.id,null,{nbSamples:samplesPerSegment,rapAlignement:false});
    }
    file.onSegment = (id,user,buffer,nextSample) => {
      if (!alive()) return;
      const samples=file.getTrackSamplesInfo(id),last=samples[nextSample-1];
      queues.get(id).items.push({data:buffer,end:(last.cts+last.duration)/last.timescale}); stats.fragments++; stats.queuedBytes += buffer.byteLength;
      stats.peakQueuedBytes = Math.max(stats.peakQueuedBytes,stats.queuedBytes);
      stats.peakParserSampleBytes = Math.max(stats.peakParserSampleBytes,file.getAllocatedSampleDataSize());
      file.releaseUsedSamples(id,nextSample);
      stats.parserSampleBytes = file.getAllocatedSampleDataSize();
    };
    for (const init of file.initializeSegmentation('per-track')) {
      stats.initBytes += init.buffer.byteLength;
      await event(queues.get(init.id).buffer,'updateend',() => queues.get(init.id).buffer.appendBuffer(init.buffer));
    }
    file.start();
    const drain = async () => {
      check();
      for (const q of queues.values()) {
        const {buffer,items}=q;
        const cutoff = video.currentTime - stats.backTargetSeconds;
        if(cutoff>0 && buffer.buffered.length && buffer.buffered.start(0)<cutoff-1){
          await event(buffer,'updateend',()=>buffer.remove(0,cutoff));
          stats.evictions++; stats.evictedUntil=Math.max(stats.evictedUntil,cutoff);
        }
        while (items.length) {
        check(); const {data,end} = items.shift();
        try { await event(buffer,'updateend',() => buffer.appendBuffer(data)); }
        catch(e){
          if(e.name==='QuotaExceededError' && video.currentTime>2){
            // One bounded retry after freeing history; never redownload a chunk.
            stats.quotaRecoveries++;stats.backTargetSeconds=2;stats.bufferTargetBytes=Math.max(8<<20,stats.bufferTargetBytes/2);
            await event(buffer,'updateend',()=>buffer.remove(0,video.currentTime-2));
            stats.evictions++;stats.evictedUntil=Math.max(stats.evictedUntil,video.currentTime-2);
            await event(buffer,'updateend',()=>buffer.appendBuffer(data));
          }else{stats.errors++;throw e;}
        }
        stats.queuedBytes -= data.byteLength; stats.appendedBytes += data.byteLength;
        q.history.push({end,bytes:data.byteLength});
        }
      }
      measureForward();
      stats.peakAhead=Math.max(stats.peakAhead,video.buffered.length?video.buffered.end(video.buffered.length-1)-video.currentTime:0);
      check();
    };
    await drain();
    return { stats, destroy,
      async capacity() {
        // Bound fetching ahead; the caller's three read lanes have their own
        // bounded queue. Deliberate pause stops further consumption after startup.
        const playableAhead=()=>{
          for(let i=0;i<video.buffered.length;i++)if(video.buffered.start(i)<=video.currentTime+0.05 && video.buffered.end(i)>=video.currentTime)return video.buffered.end(i)-video.currentTime;
          return 0;
        };
        measureForward();
        // Interleaved audio/video may need another chunk even when one track
        // already exceeds the byte target. Never apply backpressure to a dry
        // player: it would prevent the very bytes required to resume playback.
        while(alive() && ((!waitingForMedia && video.readyState>=3 && playableAhead()>2 && (stats.forwardBytes>stats.bufferTargetBytes || playableAhead()>stats.forwardTargetSeconds)) || video.paused && video.currentTime>0 && !video.ended)) {
          check();
          await new Promise(resolve=>{const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,250);signal.addEventListener('abort',done,{once:true});});
          measureForward();
        }
        check();
      },
      async append(bytes) { check(); if (finishing) throw Error('MP4 stream already finished'); parse(bytes); await drain(); },
      async finish() { check(); finishing = true; file.flush(); await drain(); if (source.readyState === 'open') source.endOfStream(); },
    };
  } catch (e) { destroy(); throw e; }
}
