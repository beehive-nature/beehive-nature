import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source='088d1651654cc4dcb1ec45cd436e74fef91840eb';
const sha=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(sha||''))throw Error('Deployment SHA required');
execFileSync('git',['merge-base','--is-ancestor',source,sha]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const out={classification:'PUBLIC-CONSTANT',at:new Date().toISOString(),sourceSha:source,deploymentSha:sha,files:[]};
for(const [path,version] of [['surfaces/wallet.html',''],['surfaces/bpay-invoice.js','?v=10'],['surfaces/ant-pay.js','?v=9'],['surfaces/stack.html',''],['surfaces/onboarding/vendor/bnr-keys.js','?v=1'],['surfaces/onboarding/vendor/bnr-keys.wasm','?v=1']]){
 const expected=execFileSync('git',['show',`${sha}:${path}`],{maxBuffer:8*1024*1024});
 const sourceBytes=execFileSync('git',['show',`${source}:${path}`],{maxBuffer:8*1024*1024});
 const url='https://skaists.dev/'+path+version;
 const res=await fetch(url,{cache:'no-store'});const bytes=Buffer.from(await res.arrayBuffer());
 out.files.push({path,url,status:res.status,bytes:bytes.length,sha256:hash(bytes),deploymentSha256:hash(expected),sourceBlobMatches:sourceBytes.equals(expected),match:res.ok&&bytes.equals(expected)});
}
out.passed=out.files.every(f=>f.match);
await writeFile('tools/agent20-ux-deployed-bytes.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));if(!out.passed)process.exitCode=1;
