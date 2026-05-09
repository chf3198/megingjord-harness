#!/usr/bin/env node
const fs=require('fs'),path=require('path'),https=require('https');
const {fileProposal,makeDedupeKey}=require('./anneal-proposal-actuator');
const suppression=require('./suppression-store.js');
const PATTERNS_FILE=path.join(__dirname,'../..','instructions/recurring-patterns.json');
const INCIDENTS_FILE=path.join(process.env.HOME,'.megingjord','incidents.jsonl');
const GITHUB_TOKEN=process.env.GITHUB_TOKEN,REPO='chf3198/megingjord-harness';
const WINDOW_DAYS=7;

async function fetchGitHub(ep){return new Promise((res,rej)=>{
  const u=new URL(`https://api.github.com${ep}`);
  const o={hostname:'api.github.com',path:u.pathname+u.search,method:'GET',headers:
    {'User-Agent':'megingjord','Accept':'application/vnd.github.v3+json',
     ...(GITHUB_TOKEN&&{'Authorization':`token ${GITHUB_TOKEN}`})}};
  https.request(o,(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>
    r.statusCode===200?res(JSON.parse(d||'[]')):rej(new Error(`${r.statusCode}`)))
  }).on('error',rej).end()});}

async function loadPatterns(){try{return JSON.parse(fs.readFileSync(PATTERNS_FILE,'utf8')).patterns;
}catch(e){console.warn(`⚠️  patterns: ${e.message}`);return [];}}

async function loadIncidents(){try{if(!fs.existsSync(INCIDENTS_FILE))return{};
  const idx={};fs.readFileSync(INCIDENTS_FILE,'utf8').split('\n').filter(l=>l).forEach(l=>{
    try{const i=JSON.parse(l);idx[i.pattern_id]=(idx[i.pattern_id]||[]).concat(i);}catch(e){}});
  return idx;}catch(e){console.warn(`⚠️  incidents: ${e.message}`);return {};}}

async function detect(patterns,incidents){const proposals=[],cutoff=Date.now()-WINDOW_DAYS*864e5;
  try{const runs=(await fetchGitHub(`/repos/${REPO}/actions/runs?status=failure&per_page=30`)).workflow_runs||[];
    const prs=await fetchGitHub(`/repos/${REPO}/pulls?state=closed&per_page=30`)||[];
    for(const p of patterns){if(!p.enabled)continue;
      if(suppression.isSuppressed(p.id)){console.log(`⏭️  Skipping ${p.id}: suppressed`);continue;}
      const rx=new RegExp(p.detection_regex,'i');
      let cnt=0,ev=[];
      for(const r of runs)if(new Date(r.created_at)>cutoff&&(rx.test(r.name)||rx.test(r.conclusion||'')))
        {cnt++;ev.push(r.html_url);}
      for(const pr of prs)if(new Date(pr.updated_at)>cutoff&&(rx.test(pr.title)||rx.test(pr.body||'')))
        {cnt++;ev.push(pr.html_url);}
      const t=p.threshold_global*(p.threshold_multiplier||1);
      if(cnt>=t&&(!incidents[p.id]||incidents[p.id][0].timestamp<cutoff)){
        const dedupeKey=makeDedupeKey({pattern_id:p.id,window:WINDOW_DAYS});
        proposals.push({pattern_id:p.id,name:p.name,count:cnt,window:WINDOW_DAYS,
          threshold:t,evidence:ev.slice(0,3),remediation:p.proposed_remediation,
          dedupe_key:dedupeKey,proposal_id:null});}}}
  catch(e){console.error(`❌ ${e.message}`);}return proposals;}

async function main(){const dryRun=process.argv.includes('--dry-run');const autoFile=process.argv.includes('--auto-file');
  const patterns=await loadPatterns(),incidents=await loadIncidents();
  if(patterns.length<1){console.error('❌ No patterns');process.exit(1);}
  const proposals=await detect(patterns,incidents);
  if(proposals.length<1){console.log('✅ No patterns');process.exit(0);}
  console.log(`🔍 Found ${proposals.length} patterns:\n`);
  proposals.forEach((p,i)=>{console.log(`${i+1}. ${p.name} (${p.count}/${p.threshold})`);
    console.log(`   Fix: ${p.remediation}`);console.log(`   Evidence: ${p.evidence.join(', ')}\n`);});
  if(!dryRun){const dir=path.dirname(INCIDENTS_FILE);
    if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});
    for(const p of proposals){
      const proposal_id=autoFile?await fileProposal(p):null;
      fs.appendFileSync(INCIDENTS_FILE,JSON.stringify({
      timestamp:new Date().toISOString(),pattern_id:p.pattern_id,window_start:new Date(Date.now()-WINDOW_DAYS*864e5).toISOString(),
      count:p.count,evidence:p.evidence,status:'proposed',suppression_until:null,
      dedupe_key:p.dedupe_key,proposal_id,source_event:'detector'})+'\n');}
    console.log(`💾 Written to incidents.jsonl`);}else console.log('🏜️  Dry-run');}

main().catch(e=>{console.error(`Fatal: ${e.message}`);process.exit(1);});
