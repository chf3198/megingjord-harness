#!/usr/bin/env node
/**
 * Anneal Proposal Actuator — Files standardized anneal proposal tickets
 * AC5: Auto-file anneal proposal tickets with idempotent dedupe
 */
const fs=require('fs'),path=require('path'),https=require('https');
const DEDUPE_FILE=path.join(process.env.HOME,'.megingjord','proposal-dedupe.json');
const GITHUB_TOKEN=process.env.GITHUB_TOKEN,REPO='chf3198/megingjord-harness';
const EPIC_NUMBER=1133;

async function callGitHub(method,ep,body){return new Promise((res,rej)=>{
  const u=new URL(`https://api.github.com${ep}`);
  const o={hostname:'api.github.com',path:u.pathname+u.search,method,headers:
    {'User-Agent':'megingjord','Accept':'application/vnd.github.v3+json',
     'Content-Type':'application/json',...(GITHUB_TOKEN&&{'Authorization':`token ${GITHUB_TOKEN}`})}};
  const req=https.request(o,(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>
    r.statusCode>=200&&r.statusCode<300?res(JSON.parse(d||'{}')):rej(new Error(`${r.statusCode}: ${d}`)))});
  req.on('error',rej);if(body)req.write(JSON.stringify(body));req.end()});}

function loadDedupe(){try{
  if(!fs.existsSync(DEDUPE_FILE))return {};
  return JSON.parse(fs.readFileSync(DEDUPE_FILE,'utf8'));
}catch(e){return {};}}

function saveDedupe(m){const d=path.dirname(DEDUPE_FILE);
  if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});
  fs.writeFileSync(DEDUPE_FILE,JSON.stringify(m,null,2));}

function makeDedupeKey(p){return `${p.pattern_id}:${Math.floor(p.window/7)}`;}

async function fileProposal(proposal){
  const dedupeKey=makeDedupeKey(proposal),dedupe=loadDedupe();
  if(dedupe[dedupeKey]){
    console.log(`⏭️  Skipping ${proposal.pattern_id}: already filed #${dedupe[dedupeKey]}`);
    return dedupe[dedupeKey];}
  
  const title=`D-${EPIC_NUMBER}-anneal: ${proposal.name} (${proposal.count}/${proposal.threshold})`;
  const body=`## Anneal Proposal: ${proposal.name}\n\n**Pattern**: \`${proposal.pattern_id}\`\n**Recurrence**: ${proposal.count} in ${proposal.window}d\n**Threshold**: ${proposal.threshold}\n\n### Evidence\n${proposal.evidence.map((e,i)=>`${i+1}. ${e}`).join('\n')}\n\n### Remediation\n${proposal.remediation}\n\n### Workflow\nReview and accept to auto-file fix ticket. Use \`npm run anneal:review\` to manage.\n\n### Metadata\n- Window: ${proposal.window} days\n- Count: ${proposal.count}\n- Detector: workflow-anneal-detect.js\n- Proposed at: ${new Date().toISOString()}`;
  
  try{
    const issue=await callGitHub('POST','/repos/chf3198/megingjord-harness/issues',{
      title,body,labels:['type:task','area:governance','status:backlog'],
      milestone:undefined});
    console.log(`✅ Filed #${issue.number}`);
    dedupe[dedupeKey]=issue.number;
    saveDedupe(dedupe);
    return issue.number;
  }catch(e){console.error(`❌ Failed to file: ${e.message}`);return null;}}

module.exports={fileProposal,makeDedupeKey,loadDedupe,saveDedupe};
