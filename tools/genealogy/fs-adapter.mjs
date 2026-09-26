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
