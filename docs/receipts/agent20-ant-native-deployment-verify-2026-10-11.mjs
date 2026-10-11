import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sourceSha='54d8e96c4c5511fb39835da36d3390757b07034d';
const deploymentSha=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(deploymentSha||'')) throw Error('Provide the verified Pages deployment SHA');
execFileSync('git',['merge-base','--is-ancestor',sourceSha,deploymentSha]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const out={classification:'PUBLIC-CONSTANT',at:new Date().toISOString(),sourceSha,deploymentSha,files:[]};
for(const path of ['surfaces/wallet.html','surfaces/ant-pay.js','surfaces/bpay-invoice.js','surfaces/stack.html','surfaces/onboarding/vendor/bnr-keys.js','surfaces/onboarding/vendor/bnr-keys.wasm']){
 const expected=execFileSync('git',['show',`${sourceSha}:${path}`],{maxBuffer:8*1024*1024});
 const deployed=execFileSync('git',['show',`${deploymentSha}:${path}`],{maxBuffer:8*1024*1024});
 const url='https://skaists.dev/'+path+(path.includes('/bnr-keys.')?'?v=1':path.endsWith('.js')?'?v=9':'');
 const response=await fetch(url,{cache:'no-store'});
 const bytes=Buffer.from(await response.arrayBuffer());
 const sourceBlobMatches=expected.equals(deployed);
 let sourceScopeMatches=sourceBlobMatches;
 if(path==='surfaces/stack.html'){
  const row=b=>b.toString('utf8').match(/<tr data-surface="surfaces\/wallet\.html"[\s\S]*?<\/tr>/)?.[0];
  const a=row(expected),b=row(deployed);
  sourceScopeMatches=!!a&&a===b;
 }
 out.files.push({path,url,status:response.status,bytes:bytes.length,sha256:hash(bytes),testedSourceSha256:hash(expected),deploymentSha256:hash(deployed),sourceBlobMatches,sourceScope:path==='surfaces/stack.html'?'wallet inventory row':'entire file',sourceScopeMatches,match:response.ok&&bytes.equals(deployed)});
}
out.passed=out.files.every(f=>f.match&&f.sourceScopeMatches);
await writeFile('tools/agent20-native-deployed-bytes.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(!out.passed) process.exitCode=1;
