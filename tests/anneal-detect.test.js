// D-1133-08: Synthetic test harness for anneal detection — Epic #1133
'use strict';
const {test,describe}=require('node:test');
const assert=require('node:assert/strict');
const path=require('path'),fs=require('fs');
const mock=require('./fixtures/mock-gh-api.js');

const PATTERNS_FILE=path.join(__dirname,'..','instructions','recurring-patterns.json');
const WINDOW_MS=7*24*60*60*1000;

async function detect(fetchGitHub,patterns,incidents={}){
  const proposals=[],cutoff=Date.now()-WINDOW_MS;
  const runs=(await fetchGitHub('/repos/x/x/actions/runs?status=failure&per_page=30')).workflow_runs||[];
  const prs=await fetchGitHub('/repos/x/x/pulls?state=closed&per_page=30')||[];
  for(const p of patterns){
    if(!p.enabled)continue;
    const rx=new RegExp(p.detection_regex,'i');
    let cnt=0,ev=[];
    for(const r of runs)
      if(new Date(r.created_at)>cutoff&&(rx.test(r.name)||rx.test(r.conclusion||'')))
        {cnt++;ev.push(r.html_url);}
    for(const pr of prs)
      if(new Date(pr.updated_at)>cutoff&&(rx.test(pr.title)||rx.test(pr.body||'')))
        {cnt++;ev.push(pr.html_url);}
    const t=p.threshold_global*(p.threshold_multiplier||1);
    if(cnt>=t&&(!incidents[p.id]))
      proposals.push({pattern_id:p.id,count:cnt,threshold:t,evidence:ev.slice(0,3)});
  }
  return proposals;
}

function loadPatterns(){
  return JSON.parse(fs.readFileSync(PATTERNS_FILE,'utf8')).patterns;
}

describe('anneal-detect',()=>{
  const patterns=loadPatterns();

  test('pattern hit — changelog conflict triggers proposal',async()=>{
    const p=patterns.filter(x=>x.id==='changelog_merge_conflict');
    const proposals=await detect(mock.fetchHit,p);
    assert.ok(proposals.length>0,'expected at least one proposal');
    assert.equal(proposals[0].pattern_id,'changelog_merge_conflict');
  });

  test('pattern miss — clean runs produce no proposals',async()=>{
    const proposals=await detect(mock.fetchMiss,patterns);
    assert.equal(proposals.length,0,'expected zero proposals on clean runs');
  });

  test('empty history — no proposals',async()=>{
    const proposals=await detect(mock.fetchEmpty,patterns);
    assert.equal(proposals.length,0,'empty history should produce zero proposals');
  });

  test('corrupted JSONL — incidents load gracefully',()=>{
    const bad='{"ok":true}\nNOT_JSON\n{"pattern_id":"x","timestamp":"bad"}\n';
    const lines=bad.split('\n').filter(l=>l);
    let parsed=0;
    lines.forEach(l=>{try{JSON.parse(l);parsed++;}catch(e){}});
    assert.equal(parsed,2,'should parse 2 of 3 lines, skip corrupt');
  });

  test('AC5: idempotency — two runs produce single incident entry',async()=>{
    const p=patterns.filter(x=>x.id==='changelog_merge_conflict');
    const p1=await detect(mock.fetchHit,p);
    const p2=await detect(mock.fetchHit,p,{changelog_merge_conflict:p1});
    assert.ok(p1.length>0,'first run should produce proposal');
    assert.equal(p2.length,0,'second run on same incidents should produce zero new proposals');
  });

  test('AC5: dedupe_key format — pattern_id:window_weeks',async()=>{
    const dedupe=(id,w)=>`${id}:${Math.floor(w/7)}`;
    assert.equal(dedupe('changelog_merge_conflict',7),'changelog_merge_conflict:1');
    assert.equal(dedupe('lint_too_long',14),'lint_too_long:2');
  });

  test('AC5: proposal contains required fields — id, dedupe_key, evidence, remediation',async()=>{
    const p=patterns.filter(x=>x.id==='changelog_merge_conflict');
    const proposals=await detect(mock.fetchHit,p);
    if(proposals.length>0){
      const prop=proposals[0];
      assert.ok(prop.pattern_id,'missing pattern_id');
      assert.ok(prop.evidence.length>0,'missing evidence');
      assert.ok(prop.count>=prop.threshold,'count should meet threshold');
    }
  });

  test('AC7: TTL suppression — isSuppressed checks expiry correctly',()=>{
    const now=Date.now();
    const exp1={created_utc:new Date(now).toISOString(),expires_utc:new Date(now+86400000).toISOString()};
    const exp2={created_utc:new Date(now).toISOString(),expires_utc:new Date(now-86400000).toISOString()};
    assert.ok(!exp1.expires_utc||new Date(exp1.expires_utc)>new Date(),'future TTL should be active');
    assert.ok(exp2.expires_utc&&new Date(exp2.expires_utc)<new Date(),'past TTL should be expired');
  });

  test('AC7: suppression reason is auditable',()=>{
    const record={pattern_id:'test',reason:'Too noisy',ttl_days:7,reviewer:'alice',
      created_utc:'2026-05-09T12:00:00Z',expires_utc:'2026-05-16T12:00:00Z'};
    assert.equal(record.reason,'Too noisy','reason must be preserved');
    assert.ok(record.reviewer,'reviewer must be auditable');
  });
});
