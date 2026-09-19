// ── FamilySearch adapter — the ONLY file that knows FamilySearch exists ─────
// The model (model.mjs) stays source-agnostic; another provider (GEDCOM file,
// Ancestry export, WikiTree…) is another adapter into the same model.
//
// TWO halves:
//  1. `harvestResponse(json)` — PURE: one r9 portrait-pedigree response →
//     person/edge/couple deltas. Unit-testable, no network, no session.
//  2. `PAGE_WALKER_SOURCE` — the resumable browser-side walker string used to
//     run the extraction inside a signed-in familysearch.org tab (the founder's
//     own session; we never touch credentials). This is the piece an agent (or
//     a human with devtools) pastes/runs. It speaks ONLY the same-origin tree
//     wire the fan-chart UI itself uses:
//       GET /service/tree/tree-data/r9/portition…/portrait-pedigree/{pid}
//           ?…&treeId=PRIVATE|AAMMU&numGenerations=8   (12 → HTTP 422)
//     with credentials:"include".
//
// RESPONSE SHAPE (verified 2026-09-16 against the live wire):
//   { ancestors: [ { "0": { id:<stub>, parent1:<person>, parent2:<person>,
//       parent1ParentIds:{parent1Id,parent2Id}, parent2ParentIds:{…}, event? } } ] }
//   — `id` is a private-space child STUB, never the ancestor's id.
//   — the true pedigree edges come from parent1ParentIds/parent2ParentIds:
//       parent1.id -> its grandparents are parent1ParentIds.{parent1Id,parent2Id}
//   — bucket N holds the couples of generation N; the top bucket's parentIds
//     point at persons NOT in the response (the "ghost frontier" — the walker
//     resolves them by expanding the child whose parentIds referenced them).

import { addPerson, addEdge, addCouple } from "./model.mjs";

const FSID = /^[A-Z0-9]{4}-[A-Z0-9]{3,4}$/;

// pure: fold one r9 response into the model. Returns counts.
export function harvestResponse(model, json) {
  let added = 0;
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const v of node) walk(v); return; }
    const p1 = node.parent1, p2 = node.parent2;
    if (p1 || p2) {
      for (const p of [p1, p2]) {
        if (p && typeof p.id === "string" && FSID.test(p.id) && typeof p.name === "string") {
          if (addPerson(model, {
            id: p.id, name: p.name, lifespan: p.lifespan ?? null,
            gender: p.gender ?? null, living: !!p.living,
            source: "familysearch", sourceId: p.id,
          })) added++;
        }
      }
      if (p1?.id) {
        const pi = node.parent1ParentIds || {};
        addEdge(model, p1.id, [pi.parent1Id, pi.parent2Id]);
      }
      if (p2?.id) {
        const pi = node.parent2ParentIds || {};
        addEdge(model, p2.id, [pi.parent1Id, pi.parent2Id]);
      }
      if (p1?.id && p2?.id) {
        const marriage = node.event
          ? [node.event.date?.formatted, node.event.place?.original].filter(Boolean).join(" · ") || null
          : null;
        addCouple(model, p1.id, p2.id, marriage);
      }
    }
    for (const v of Object.values(node)) walk(v);
  };
  walk(json);
  return { added };
}

// browser-side walker (string — runs in the signed-in tab's console or via an
// agent-driven page). State lives on window.__rw; each __rwStep() call stays
// inside a ~2s budget so agent evaluate rounds or manual pastes both work.
// Pull results with __rwDump() (chunked strings; concatenate and save as the
// raw walk JSON that pipeline.mjs consumes).
export const PAGE_WALKER_SOURCE = String.raw`
(function installWalker(rootPersonId){
  const FSID=/^[A-Z0-9]{4}-[A-Z0-9]{3,4}$/;
  const s=window.__rw={root:rootPersonId,persons:{},edges:{},couples:{},queue:[rootPersonId],queued:{},done:{},terminal:{},calls:0,errors:[]};
  s.needExpand=(id)=>{const ps=s.edges[id];if(!ps||!ps.length)return !s.terminal[id];return !s.terminal[id]&&ps.some(p=>!s.persons[p]);};
  const addPerson=(p)=>{if(!p||typeof p.id!=="string"||!FSID.test(p.id)||typeof p.name!=="string")return;s.persons[p.id]={id:p.id,name:p.name,lifespan:p.lifespan??null,gender:p.gender??null,living:!!p.living};};
  const addEdge=(c,ids)=>{const ps=[...new Set(ids.filter(x=>typeof x==="string"&&FSID.test(x)))];if(c&&ps.length)s.edges[c]=ps;};
  const harvest=(node)=>{if(!node||typeof node!=="object")return;if(Array.isArray(node)){node.forEach(harvest);return;}
    const p1=node.parent1,p2=node.parent2;if(!p1&&!p2){Object.values(node).forEach(harvest);return;}
    addPerson(p1);addPerson(p2);
    if(p1&&p1.id){const pi=node.parent1ParentIds||{};addEdge(p1.id,[pi.parent1Id,pi.parent2Id]);}
    if(p2&&p2.id){const pi=node.parent2ParentIds||{};addEdge(p2.id,[pi.parent1Id,pi.parent2Id]);}
    if(p1&&p1.id&&p2&&p2.id){const k=[p1.id,p2.id].sort().join("|");if(!s.couples[k])s.couples[k]={p1:p1.id,p2:p2.id,event:node.event?{date:node.event.date?.formatted??null,place:node.event.place?.original??null}:null};}
    Object.values(node).forEach(harvest);};
  window.__rwStep=async function(budgetMs=2200){
    const t0=Date.now();
    while(s.queue.length&&Date.now()-t0<budgetMs){
      const batch=[];while(s.queue.length&&batch.length<4){const pid=s.queue.pop();if(!s.done[pid]&&!s.terminal[pid])batch.push(pid);else delete s.queued[pid];}
      if(!batch.length)break;
      const results=await Promise.all(batch.map(async(pid)=>{
        let data=null;
        for(const treeId of["PRIVATE","AAMMU"]){
          try{const url="/service/tree/tree-data/r9/portrait-pedigree/"+pid+"?includeTempleRollupStatus=false&includeSpouseAncestry=false&includeCountries=false&includeSources=false&includePhotos=false&includeMarriages=false&includeCounts=false&includeResearchSuggestions=false&treeId="+treeId+"&locale=en&useAutonomousCountry=true&numGenerations=8";
            const r=await fetch(url,{credentials:"include"});if(r.ok){data=await r.json();break;}
            if(r.status===401||r.status===403)s.authFail=true;
          }catch(e){}}
        s.done[pid]=true;delete s.queued[pid];s.calls++;return [pid,data];}));
      for(const[pid,data]of results){
        if(!data){s.errors.push(pid);continue;}
        harvest(data);
        if(s.needExpand(pid))s.terminal[pid]=true; // fetch succeeded, revealed no parents
      }
    }
    for(const id of Object.keys(s.persons)){ // frontier = any parent target still missing
      if(s.needExpand(id)){delete s.done[id];if(!s.queued[id]){s.queue.push(id);s.queued[id]=true;}}
    }
    return {calls:s.calls,persons:Object.keys(s.persons).length,edges:Object.keys(s.edges).length,queue:s.queue.length,errors:s.errors.length,authFail:!!s.authFail};
  };
  window.__rwDump=function(){const payload=JSON.stringify({root:s.root,persons:s.persons,edges:s.edges,couples:s.couples,meta:{calls:s.calls,errors:s.errors,pulledAt:new Date().toISOString(),method:"fs-adapter page walker"}});
    const CH=900000,n=Math.ceil(payload.length/CH);window.__rwDumpChunks=Array.from({length:n},(_,i)=>payload.slice(i*CH,(i+1)*CH));return {bytes:payload.length,chunks:n};};
  return "walker installed — call __rwStep() until queue=0, then __rwDump()";
})`;

// ── THIRD half (2026-09-18): the SOURCE/EVIDENCE harvest ────────────────────
// The 8-dead-generations material-evidence walk. Same laws as the pedigree
// half: pure parsers are unit-testable without a session; the page runner
// speaks ONLY the same-origin wires the person page itself uses:
//   GET /service/tree/tree-data/v8/person/{pid}/details
//       -> person summary + sourceCount + parents[] (family objects)
//   GET /service/tree/tf/person/{pid}/entityref?version=2
//       -> entityRefs[]; value.type==="SOURCE" carries value.uri = source id,
//          attribution (who attached, when, changeMessage) and the conclusion
//          types the source supports (affectedConclusionTypes)
//   GET /service/tree/links/sources/{id,id,…}?readExternalData=true
//       -> full source records: citation line, ark record URL, title, event,
//          evidence.facts (field-level transcription of the record)
// The runner repairs the walk's depth-9 frontier first (the original 8-gen
// windows stopped one generation short), then harvests per-person refs, then
// batches the source descriptions. Checkpoints to localStorage (persons/refs
// only — source descriptions are deterministically re-fetchable).

// pure: one tf entityref response → staged source references.
// Keeps the attribution and WHICH conclusions each source supports (the
// evidence-layer law: evidence belongs on claims, not just people).
export function parseEntityRefs(json) {
  const out = { sources: [], typeCounts: {}, refsTotal: 0 };
  const refs = Array.isArray(json?.entityRefs) ? json.entityRefs : [];
  out.refsTotal = refs.length;
  for (const e of refs) {
    const ty = e?.value?.type || "UNKNOWN";
    out.typeCounts[ty] = (out.typeCounts[ty] || 0) + 1;
    if (ty === "SOURCE") {
      out.sources.push({
        id: e.value.uri,
        modified: e.attribution?.modified ?? null,
        contributor: e.attribution?.contributorCisId ?? e.attribution?.contributor?.id ?? null,
        affected: (e.affectedConclusionTypes || []).map((x) => String(x).split("/").pop()),
        originallyAttachedTo: e.originallyAttachedTo ?? null,
        changeMessage: e.attribution?.changeMessage ?? null,
      });
    }
  }
  return out;
}

// pure: one links/sources response → staged source records (full fidelity;
// PUBLIC projection is built by publicSourceRecord, never by omission here).
export function parseSourceDescriptions(json) {
  const out = [];
  for (const s of Array.isArray(json?.sources) ? json.sources : []) {
    if (!s || typeof s.id !== "string") continue;
    out.push({
      id: s.id,
      title: s.title ?? null,
      citation: s.citation ?? null,
      citationSubmittedBy: s.citationSubmittedBy ?? null,
      createdOn: s.createdOn ?? null,
      createdBy: s.createdBy ?? null,
      urls: Array.isArray(s.urls) ? s.urls.map((u) => ({ ...u })) : [],
      event: s.event ? { factType: s.event.factType ?? null, place: s.event.eventPlace ?? null } : null,
      evidence: s.evidence && Array.isArray(s.evidence.facts)
        ? s.evidence.facts.map((f) => ({ factType: f.factType ?? null, fieldType: f.fieldType ?? null, value: f.value ?? f.fieldValue ?? null }))
        : [],
      notes: Array.isArray(s.notes) ? s.notes.map((n) => n.text ?? n) : [],
      about: s.about ?? null,
      retrieved: new Date().toISOString().slice(0, 10),
      provider: "familysearch",
    });
  }
  return out;
}

// pure: the PUBLIC projection of a source record. Living-name redaction is the
// caller's list; anything matching is dropped/redacted with the reason kept.
export function publicSourceRecord(record, { redactNames = [] } = {}) {
  const names = redactNames.filter((n) => n && n.length > 2);
  const hits = (text) => (typeof text === "string"
    ? names.filter((n) => text.toLowerCase().includes(n.toLowerCase())) : []);
  const scrub = (text) => {
    const h = hits(text);
    if (!h.length) return { text, redacted: false };
    let t = text;
    for (const n of h) t = t.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[redacted-living]");
    return { text: t, redacted: true };
  };
  const citation = scrub(record.citation);
  const title = scrub(record.title);
  const evidence = record.evidence.map((f) => {
    const v = scrub(f.value);
    return v.redacted ? { ...f, value: v.text, redacted: true } : f;
  });
  return {
    id: record.id,
    title: title.text,
    citation: citation.text,
    redactedLiving: !!(title.redacted || citation.redacted || evidence.some((f) => f.redacted)),
    urls: record.urls.filter((u) => !u.requiresLogin).map((u) => u.url ?? u),
    event: record.event,
    evidence,
    retrieved: record.retrieved,
    provider: record.provider,
    // public projection drops: notes, changeMessages, contributor cis ids stay
    // only as opaque attribution already embedded in the citation line.
  };
}

// node-side: fold a raw source walk (the PAGE_SOURCE_WALKER dump) into a model.
// Upgrades the SUPPORT axis exactly as the model law promises: "sourced" when
// sources are actually harvested — never touching era, never downgrading
// founder-attested standing, recording the basis string honestly.
export function importSourceWalk(model, raw, { date = null } = {}) {
  const day = date || new Date().toISOString().slice(0, 10);
  let upgraded = 0;
  for (const [fsid, r] of Object.entries(raw.refs || {})) {
    const p = model.persons[fsid];
    if (!p) continue;
    const n = Array.isArray(r.sources) ? r.sources.length : 0;
    if (!n) continue;
    if (!p.evidence || p.evidence.support === "unsourced-entry") {
      p.evidence = { ...(p.evidence || {}), support: "sourced", basis: `${n} FamilySearch source${n === 1 ? "" : "s"} (harvested ${day})` };
      upgraded++;
    } else if (p.evidence.support === "attested" || p.evidence.support === "sourced") {
      p.evidence.basis = `${p.evidence.basis ?? ""}; ${n} FamilySearch source${n === 1 ? "" : "s"} (harvested ${day})`.replace(/^; /, "");
    }
    p.sources = { count: n, harvested: day, provider: "familysearch" };
  }
  return { upgraded };
}

// browser-side source walker (string — runs inside the signed-in tab; the
// agent passes the payload JSON: { cohort:[{pid,dep}], danglers:[{pid,dep}],
// known:[fsid…] }). State on window.__zb; poll it; pull with __zbDump().
// Runner as executed 2026-09-18 (template literals flattened for embedding).
export const PAGE_SOURCE_WALKER_SOURCE = String.raw`
(function installSourceWalker(payloadJson){
  const payload=JSON.parse(payloadJson);
  const LS_KEY="__zb_source_walk_v1";
  const S=(window.__zb=window.__zb||{startedAt:Date.now(),phase:"repair",depth:{},persons:{},refs:{},src:{},errs:{},stats:{fetched:0,ok:0,retries:0,authStreak:0},done:false,paused:null});
  if(S.running)return{alreadyRunning:true,phase:S.phase};
  S.running=true;
  try{const cp=JSON.parse(localStorage.getItem(LS_KEY)||"null");
    if(cp&&cp.persons){Object.assign(S.persons,cp.persons);Object.assign(S.refs,cp.refs||{});Object.assign(S.depth,cp.depth||{});S.resumed=true;}
  }catch(e){S.cpErr=String(e);}
  const known=new Set(payload.known);
  for(const p of payload.danglers)S.depth[p.pid]=p.dep;
  for(const p of payload.cohort)S.depth[p.pid]=p.dep;
  const queues={repair:[],evidence:[]};
  const repairQueued=new Set(),evidenceQueued=new Set();
  const qRepair=(pid,dep)=>{if(dep>9||S.persons[pid]||repairQueued.has(pid))return;repairQueued.add(pid);S.depth[pid]=Math.min(S.depth[pid]??dep,dep);queues.repair.push({pid,dep});};
  const qEvidence=(pid)=>{if(evidenceQueued.has(pid)||S.refs[pid])return;evidenceQueued.add(pid);queues.evidence.push(pid);};
  for(const p of payload.danglers)qRepair(p.pid,p.dep);
  for(const p of payload.cohort)qEvidence(p.pid);
  let lastStart=0;
  const gate=()=>new Promise((r)=>{const w=Math.max(0,160-(Date.now()-lastStart));setTimeout(()=>{lastStart=Date.now();r();},w);});
  const fetchJ=async(url,tries=2)=>{for(let i=0;;i++){await gate();S.stats.fetched++;
    try{const r=await fetch(url,{credentials:"include",headers:{Accept:"application/json"}});
      if(r.status===401||r.status===403){S.stats.authStreak++;if(S.stats.authStreak>=6){S.paused="auth";throw new Error("auth-lost");}}
      else S.stats.authStreak=0;
      if(r.status===429||r.status>=500){if(i<tries){S.stats.retries++;await new Promise((x)=>setTimeout(x,900*(i+1)));continue;}}
      const text=await r.text();let body=null;try{body=text?JSON.parse(text):null;}catch(e){body={_raw:text.slice(0,200)};}
      return{status:r.status,body};
    }catch(e){if(String(e.message)==="auth-lost")throw e;
      if(i<tries){S.stats.retries++;await new Promise((x)=>setTimeout(x,900*(i+1)));continue;}
      return{status:0,body:null,err:String(e)};}}};
  const personSummary=(p,dep,edge)=>p&&{id:p.id,name:p.name||(p.nameConclusion&&p.nameConclusion.details&&p.nameConclusion.details.fullText)||null,
    lifespan:p.lifespan||null,living:!!p.living,gender:p.gender||null,depth:dep,
    sourceCount:typeof p.sourceCount==="number"?p.sourceCount:null,edge:edge};
  const absorbV8=(pid,dep)=>{const v=S.persons[pid];if(!v||v.missing)return;
    for(const fam of(v.__parents||[])){for(const key of["parent1","parent2"]){const par=fam&&fam[key];
      if(!par||!par.id)continue;const pdep=dep+1;
      if(pdep<=9&&!known.has(par.id))qRepair(par.id,pdep);
      if(!S.persons[par.id])S.persons[par.id]=personSummary(par,pdep,"v8-parents-of:"+pid);
      else if(S.persons[par.id].depth===undefined)S.persons[par.id].depth=pdep;}}};
  const doRepair=async(item)=>{const pid=item.pid,dep=item.dep;
    if(S.persons[pid]&&!S.persons[pid].missing&&S.persons[pid].edge==="dangling-repaired")return;
    const r=await fetchJ("/service/tree/tree-data/v8/person/"+pid+"/details");
    if(r.status===200&&r.body){const rec=personSummary(r.body,dep,"dangling-repaired")||{id:pid,missing:true};
      rec.__parents=Array.isArray(r.body.parents)?r.body.parents:[];S.persons[pid]=rec;absorbV8(pid,dep);
      S.stats.ok++;if(dep<=9)qEvidence(pid);}
    else{S.persons[pid]={id:pid,depth:dep,missing:true,reason:"v8:"+r.status};S.errs["v8:"+pid]={status:r.status};}};
  const doEvidence=async(pid)=>{const dep=S.depth[pid]??9;
    if(S.persons[pid]&&S.persons[pid].__parents)absorbV8(pid,dep);
    else{const r=await fetchJ("/service/tree/tree-data/v8/person/"+pid+"/details");
      if(r.status===200&&r.body){const rec=personSummary(r.body,dep,"walked")||{id:pid,missing:true};
        rec.__parents=Array.isArray(r.body.parents)?r.body.parents:[];
        S.persons[pid]=Object.assign({},S.persons[pid],rec);absorbV8(pid,dep);S.stats.ok++;}
      else if(!S.persons[pid]){S.persons[pid]={id:pid,depth:dep,missing:true,reason:"v8:"+r.status};S.errs["v8:"+pid]={status:r.status};}}
    const t=await fetchJ("/service/tree/tf/person/"+pid+"/entityref?version=2");
    if(t.status===200&&t.body&&Array.isArray(t.body.entityRefs)){const typeCounts={};const sources=[];
      for(const e of t.body.entityRefs){const ty=(e.value&&e.value.type)||"UNKNOWN";typeCounts[ty]=(typeCounts[ty]||0)+1;
        if(ty==="SOURCE"){sources.push({id:e.value.uri,modified:(e.attribution&&e.attribution.modified)||null,
          contributor:(e.attribution&&(e.attribution.contributorCisId||(e.attribution.contributor&&e.attribution.contributor.id)))||null,
          affected:(e.affectedConclusionTypes||[]).map((x)=>String(x).split("/").pop()),
          originallyAttachedTo:e.originallyAttachedTo||pid,
          changeMessage:(e.attribution&&e.attribution.changeMessage)||null});}}
      S.refs[pid]={sources:sources,typeCounts:typeCounts,refsTotal:t.body.entityRefs.length};S.stats.ok++;}
    else{S.refs[pid]={sources:[],typeCounts:{},refsTotal:0,err:"tf:"+t.status};S.errs["tf:"+pid]={status:t.status};}};
  let cpCount=0;
  const checkpoint=()=>{if(++cpCount%25!==0)return;
    try{const persons={};for(const[k,v]of Object.entries(S.persons)){const{__parents,...rest}=v;persons[k]=rest;}
      localStorage.setItem(LS_KEY,JSON.stringify({persons:persons,refs:S.refs,depth:S.depth}));}catch(e){S.cpErr=String(e);}};
  const srcQueue=[];
  const planSources=()=>{const ids=new Set();
    for(const r of Object.values(S.refs))for(const s of r.sources){
      if(/^[A-Z0-9]{4}-[A-Z0-9]{3}(:[0-9]+)?$/.test(s.id))ids.add(s.id);else s.nonBatchable=true;}
    const all=[...ids].filter((i)=>!S.src[i]);
    for(let i=0;i<all.length;i+=15)srcQueue.push(all.slice(i,i+15));
    S.stats.sourceIdsTotal=ids.size;};
  const doSourceBatch=async(batch)=>{if(batch.every((i)=>S.src[i]))return;
    const r=await fetchJ("/service/tree/links/sources/"+batch.join(",")+"?readExternalData=true");
    if(r.status===200&&r.body&&Array.isArray(r.body.sources)){for(const s of r.body.sources)if(s&&s.id)S.src[s.id]=s;S.stats.ok++;}
    else S.errs["src:"+batch[0]]={status:r.status};};
  (async()=>{try{
    while(queues.repair.length){const item=queues.repair.shift();await doRepair(item);checkpoint();}
    S.phase="evidence";let guard=0;
    while(queues.evidence.length||queues.repair.length){if(guard++>20000)break;
      while(queues.repair.length){const it=queues.repair.shift();await doRepair(it);checkpoint();}
      const pid=queues.evidence.shift();if(pid){await doEvidence(pid);checkpoint();}}
    S.phase="sources";planSources();S.stats.sourceBatches=srcQueue.length;
    while(srcQueue.length){const b=srcQueue.shift();await doSourceBatch(b);checkpoint();}
    S.phase="done";S.done=true;S.finishedAt=Date.now();checkpoint();
  }catch(e){S.paused=S.paused||String(e.message||e);}finally{S.running=false;}})();
  window.__zbDump=function(){const payload={persons:{},refs:S.refs,src:S.src,depth:S.depth,errs:S.errs,
    meta:{startedAt:S.startedAt,finishedAt:S.finishedAt||null,stats:S.stats,phase:S.phase,method:"fs-adapter PAGE_SOURCE_WALKER (v8 details + tf entityref + links/sources), cookie session"}};
    for(const[k,v]of Object.entries(S.persons)){const{__parents,...rest}=v;payload.persons[k]=rest;}
    const s=JSON.stringify(payload);const CH=900000,n=Math.ceil(s.length/CH);
    window.__zbDumpChunks=Array.from({length:n},(_,i)=>s.slice(i*CH,(i+1)*CH));
    return{bytes:s.length,chunks:n};};
  return{started:true,resumed:!!S.resumed,repairQueued:queues.repair.length,evidenceQueued:queues.evidence.length,phase:S.phase};
})`;

// ── STAGED 2026-09-19, NOT YET EXECUTED (needs the founder's signed-in      ──
// session; the 2026-09-19 seat probed the tab and got 401 — everything below
// runs when the founder signs in to familysearch.org in the IAB pane). Two
// pieces: the PARENT-CLOSURE recovery (v8 wire, already proven by the source
// walker — recovers the child→parent edges the source walker did not persist
// for already-known parents, i.e. the 28 unlinked danglers) and the image-pass
// DISCOVERY probe (the image-resolution wire is genuinely unknown; observe the
// record page's own requests, then codify the sweep — never guess URLs).
export const PAGE_PARENT_CLOSURE_SOURCE = String.raw`
(function installParentClosure(payloadJson){
  const payload=JSON.parse(payloadJson); // { pids:[fsid...] } — depth-8 cohort
  const LS_KEY="__zb_parent_closure_v1";
  const S=(window.__zpc=window.__zpc||{startedAt:Date.now(),phase:"run",parents:{},errs:{},stats:{fetched:0,ok:0,retries:0,authStreak:0},done:false,paused:null});
  if(S.running)return{alreadyRunning:true,phase:S.phase};
  S.running=true;
  try{const cp=JSON.parse(localStorage.getItem(LS_KEY)||"null");
    if(cp&&cp.parents){Object.assign(S.parents,cp.parents);S.resumed=true;}}catch(e){S.cpErr=String(e);}
  let lastStart=0;
  const gate=()=>new Promise((r)=>{const w=Math.max(0,160-(Date.now()-lastStart));setTimeout(()=>{lastStart=Date.now();r();},w);});
  const fetchJ=async(url,tries=2)=>{for(let i=0;;i++){await gate();S.stats.fetched++;
    try{const r=await fetch(url,{credentials:"include",headers:{Accept:"application/json"}});
      if(r.status===401||r.status===403){S.stats.authStreak++;if(S.stats.authStreak>=6){S.paused="auth";throw new Error("auth-lost");}}
      else S.stats.authStreak=0;
      if(r.status===429||r.status>=500){if(i<tries){S.stats.retries++;await new Promise((x)=>setTimeout(x,900*(i+1)));continue;}}
      const text=await r.text();let body=null;try{body=text?JSON.parse(text):null;}catch(e){body=null;}
      return{status:r.status,body};
    }catch(e){if(String(e.message)==="auth-lost")throw e;
      if(i<tries){S.stats.retries++;await new Promise((x)=>setTimeout(x,900*(i+1)));continue;}
      return{status:0,body:null,err:String(e)};}}};
  const checkpoint=()=>{try{localStorage.setItem(LS_KEY,JSON.stringify({parents:S.parents}));}catch(e){}};
  (async()=>{try{
    for(const pid of payload.pids){
      if(S.parents[pid])continue;
      const r=await fetchJ("/service/tree/tree-data/v8/person/"+pid+"/details");
      if(r.status===200&&r.body){
        // persist the FULL parents[] (id + name + lifespan per family) — the
        // edge the source walker dropped for already-known parents
        S.parents[pid]=(Array.isArray(r.body.parents)?r.body.parents:[]).map((f)=>{
          const row={};for(const k of["parent1","parent2"])if(f&&f[k])row[k]={id:f[k].id,name:f[k].name||null,lifespan:f[k].lifespan||null};
          return row;});
        S.stats.ok++;
      } else S.errs[pid]={status:r.status};
      checkpoint();
    }
    S.phase="done";S.done=true;S.finishedAt=Date.now();checkpoint();
  }catch(e){S.paused=S.paused||String(e.message||e);}finally{S.running=false;}})();
  window.__zpcDump=function(){const s=JSON.stringify({parents:S.parents,errs:S.errs,meta:{stats:S.stats,phase:S.phase,method:"fs-adapter PAGE_PARENT_CLOSURE (v8 parents[] full persistence), cookie session"}});
    const CH=900000,n=Math.ceil(s.length/CH);
    window.__zpcDumpChunks=Array.from({length:n},(_,i)=>s.slice(i*CH,(i+1)*CH));
    return{bytes:s.length,chunks:n};};
  return{started:true,resumed:!!S.resumed,pids:payload.pids.length,phase:S.phase};
})`;

// image-pass step 1 — DISCOVERY (one record, observe the page's own requests;
// the sweep gets codified FROM this observation, per the never-guess-URLs law).
// Run in the signed-in tab: pass DISCOVER_RECORD_WIRE_SOURCE through evaluate
// with the record's ark suffix (e.g. "1:1:6KWG-ZBHL").
export const DISCOVER_RECORD_WIRE_SOURCE = String.raw`
(async function discoverRecordWire(arkSuffix){
  const mark=performance.now();
  const before=new Set(performance.getEntriesByType("resource").map((e)=>e.name));
  const r=await fetch("https://www.familysearch.org/ark:/61903/"+arkSuffix,{credentials:"include"});
  const html=await r.text();
  const doc=new DOMParser().parseFromString(html,"text/html");
  // settle: collect requests the page itself makes after load
  await new Promise((x)=>setTimeout(x,4000));
  const after=performance.getEntriesByType("resource").filter((e)=>e.startTime>=mark)
    .map((e)=>({name:e.name,initiatorType:e.initiatorType,transferSize:e.transferSize}));
  const imageHints=[...doc.querySelectorAll('a[href*="/ark:/61903/3:1:"]')].map((a)=>a.getAttribute("href"));
  const ogImage=[...doc.querySelectorAll('meta[property="og:image"]')].map((m)=>m.getAttribute("content"));
  return{status:r.status,finalUrl:r.url,title:doc.title,imageArks:imageHints,ogImage,
    resourceCalls:after.filter((e)=>/familysearch\.org/.test(e.name)).slice(0,60),htmlBytes:html.length};
})
`;

// ── IMAGE WIRE — PROVEN 2026-09-19 under the founder's live session (the     ──
// discovery concluded; this is the executed path, banked verbatim in shape):
//   1. /ark:/61903/1:1:{record} SPA page → DOM "View Original Document" href
//      carries the image ark 3:1:{imageArk}. The record DATA wire itself
//      (/ark:/61903/1:1:{id}?useSLS=true) 401s outside the SPA — headers-only
//      discovery failed (User-Agent is stripped from page fetches; the
//      orchestration service demands one) — so the SPA page is the oracle.
//   2. The image VIEWER page (/ark:/61903/3:1:{imageArk}?view=index) fires
//      sg30p0.familysearch.org/service/records/volunteer/orchestration/sls/image/3:1:{ark}
//      → resolves the deepzoom storage id (apid:TH-…-…); READ the apid from
//      the viewer page's own performance resource log (cross-origin fetch of
//      orchestration is impossible: CORS + the UA-header gate).
//   3. Park the tab on sg30p0 (any storage URL — e.g. the image.xml itself)
//      and SAME-ORIGIN fetch: …/deepzoomcloud/dz/v1/{apid}/image.xml
//      (TileSize 256, Overlap 1, Size W×H) + …/image_files/{level}/{x}_{y}.jpg
//      tiles. Stitch on an HTML-namespace canvas (an XML document's
//      createElement needs createElementNS), toDataURL jpeg ~0.82.
//      Level policy: smallest level with width ≥2400 (labeled in the manifest
//      as level L/maxLevel — NOT claimed as the maximum pyramid fidelity).
//   4. Bytes ride the PRIVATE tier only (archive copyright); the public layer
//      carries counts + sha256 + ark pointers.
// Executed results: C:/Users/travi/family-lineage/images-harvest/images-manifest.json.
// OPEN FRONTIER (named honestly): record→image-ark mapping at 13k scale — the
// person-keyed hr/v2 search wire (entry.id IS the 1:1 ark suffix; entry
// gedcomx sourceDescriptions carry the 3:1 Persistent ark) joins to our
// citations at only ~2% (search surfaces different records); the reliable
// per-record mapping is the record SPA page's own DOM (one load per record).
export const PAGE_IMAGE_STITCHER_SOURCE = String.raw`
(async function stitchImage(apid, targetWidth){
  const target=targetWidth||2400;
  const BASE="https://sg30p0.familysearch.org/service/records/storage/deepzoomcloud/dz/v1/"+apid;
  const r2=await fetch(BASE+"/image.xml",{credentials:"include"});
  if(r2.status!==200)return{state:"xml-"+r2.status};
  const xt=await r2.text();
  const W=+xt.match(/Width="(\d+)"/)[1],H=+xt.match(/Height="(\d+)"/)[1];
  let maxL=0;while(Math.pow(2,maxL+1)<=Math.max(W,H))maxL++;
  let L=0;while(L<maxL&&Math.pow(2,L+1)<=target)L++;
  const ts=256,dim=Math.pow(2,L);
  const nx=Math.ceil(dim/ts),ny=Math.ceil(dim/ts);
  const canvas=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");
  const r2s=dim/Math.max(W,H);
  canvas.width=Math.max(1,Math.round(W<=dim?W:W*r2s));
  canvas.height=Math.max(1,Math.round(H<=dim?H:H*r2s));
  const ctx=canvas.getContext("2d");
  const sx=canvas.width/dim,sy=canvas.height/dim;
  let tiles=0,skipped=0;
  for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){
    const r3=await fetch(BASE+"/image_files/"+L+"/"+x+"_"+y+".jpg",{credentials:"include"});
    if(r3.status!==200){skipped++;continue;}
    const bmp=await createImageBitmap(await r3.blob());
    ctx.drawImage(bmp,x*ts*sx,y*ts*sy,bmp.width*sx,bmp.height*sy);
    tiles++;}
  if(!tiles)return{state:"no-tiles"};
  const dataUrl=canvas.toDataURL("image/jpeg",0.82);
  return{state:"ok",w:canvas.width,h:canvas.height,level:L,maxLevel:maxL,tiles,skipped,b64:dataUrl.slice(dataUrl.indexOf(",")+1)};
})
`;

// node-side: fold a full raw walk JSON (the __rwDump output) into a model
export function importWalk(model, raw) {
  let n = 0;
  for (const p of Object.values(raw.persons || {})) {
    if (addPerson(model, {
      id: p.id, name: p.name, lifespan: p.lifespan ?? null,
      gender: p.gender ?? null, living: !!p.living,
      source: "familysearch", sourceId: p.id,
    })) n++;
  }
  for (const [child, ps] of Object.entries(raw.edges || {})) addEdge(model, child, ps);
  for (const c of Object.values(raw.couples || {})) {
    const marriage = c.event ? [c.event.date, c.event.place].filter(Boolean).join(" · ") || null : null;
    addCouple(model, c.p1, c.p2, marriage);
  }
  if (raw.root) model.root = raw.root;
  return { persons: n };
}
