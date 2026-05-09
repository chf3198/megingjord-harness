#!/usr/bin/env node
/**
 * Anneal Governance Sensor — Compute recurring failure metrics for governance-audit
 * AC9: Governance-audit integration for anneal queue visibility
 */
const fs=require('fs'),path=require('path');
const INCIDENTS_FILE=path.join(process.env.HOME,'.megingjord','incidents.jsonl');
const SUPPRESSION_FILE=path.join(process.env.HOME,'.megingjord','suppressions.json');

function computeMetrics(){
  const metrics={pending:0,proposed:0,resolved:0,suppressed:0,top_patterns:[]};
  const patternCounts={};
  
  try{
    if(fs.existsSync(INCIDENTS_FILE)){
      const lines=fs.readFileSync(INCIDENTS_FILE,'utf8').split('\n').filter(l=>l);
      for(const line of lines){
        try{const i=JSON.parse(line);
          if(!i.status)continue;
          if(i.status==='proposed')metrics.proposed++;
          else if(i.status==='accepted'||i.status==='resolved')metrics.resolved++;
          patternCounts[i.pattern_id]=(patternCounts[i.pattern_id]||0)+1;
        }catch(e){}
      }
    }
    if(fs.existsSync(SUPPRESSION_FILE)){
      const s=JSON.parse(fs.readFileSync(SUPPRESSION_FILE,'utf8'))||[];
      metrics.suppressed=s.filter(x=>new Date(x.expires_utc)>new Date()).length;
    }
    metrics.pending=metrics.proposed+metrics.suppressed;
    metrics.top_patterns=Object.entries(patternCounts)
      .sort(([,a],[,b])=>b-a).slice(0,3)
      .map(([id,count])=>({pattern_id:id,count}));
  }catch(e){console.error(`Anneal sensor error: ${e.message}`);}
  
  return metrics;
}

if(require.main===module){
  const metrics=computeMetrics();
  console.log(JSON.stringify(metrics));
}

module.exports={computeMetrics};
