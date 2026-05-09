#!/usr/bin/env node
const fs=require('fs'),readline=require('readline'),store=require('./incidents-store.js');
const suppression=require('./suppression-store.js');
const PATTERNS_FILE='instructions/recurring-patterns.json';
let patterns={};try{patterns=JSON.parse(fs.readFileSync(PATTERNS_FILE,'utf8')).patterns.reduce((m,p)=>(m[p.id]=p,m),{});
}catch(e){console.error(`Failed to load patterns: ${e.message}`);process.exit(1);}

const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const ask=(q)=>new Promise(r=>rl.question(q,r));

async function review(){store.ensureDir();const idx=store.loadIndex();
  if(!fs.existsSync(store.INCIDENTS_FILE)){console.log('✅ No incidents');rl.close();return;}
  const proposals=[],lines=fs.readFileSync(store.INCIDENTS_FILE,'utf8').split('\n').filter(l=>l);
  for(const line of lines){try{const i=JSON.parse(line);
    if(i.status==='proposed'){const p=patterns[i.pattern_id];
      const supp=suppression.isSuppressed(i.pattern_id);
      if(!supp)proposals.push({...i,name:p?.name||i.pattern_id,remediation:p?.proposed_remediation||'(no fix)'});
      else console.log(`⏭️  Skipping ${i.pattern_id}: ${suppression.getSuppressionReason(i.pattern_id)}`);}}}catch(e){}}
  if(proposals.length<1){console.log('✅ No proposals');rl.close();return;}
  console.log(`\n🔍 Found ${proposals.length} proposals:\n`);
  const ans=await ask('Review now? (Y/n): ');if(ans.toLowerCase()==='n'){rl.close();return;}
  let approved=0,rejected=0,skipped=0;
  for(let i=0;i<proposals.length;i++){const p=proposals[i];
    console.log(`\n${i+1}. ${p.name} (${p.count} in ${p.window_start.slice(0,10)})`);
    console.log(`   Fix: ${p.remediation}`);if(p.evidence&&p.evidence[0])console.log(`   Evidence: ${p.evidence.slice(0,2).join(', ')}`);
    const choice=await ask(`   Accept/Reject[7d]/Skip? (a/r/s): `);
    if(choice==='a'){approved++;p.status='accepted';}
    else if(choice==='r'){rejected++;p.status='rejected';
      suppression.addSuppression(p.pattern_id,'Rejected by operator during review',7);
      console.log(`   ✓ Suppressed for 7 days`);}
    else{skipped++;p.status='skipped';continue;}
    store.append({...p,updated_at:new Date().toISOString(),suppressed_by:choice==='r'?process.env.USER||'operator':null});}
  store.rotate();
  console.log(`\n📊 Summary: ${approved} approved, ${rejected} rejected, ${skipped} skipped\n`);rl.close();}

review().catch(e=>{console.error(`Error: ${e.message}`);process.exit(1);});
