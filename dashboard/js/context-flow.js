// Context Flow — world-class redesign #378
function renderContextFlow(devices, fleetStats, isActive, liveQuotas) {
  const W=984,H=356;
  const dm={}; (devices||[]).forEach(d=>{dm[d.id]=d.status;});
  const wl=dm['windows-laptop']||'unknown', sl=dm['penguin-1']||'unknown';
  const liveMap={
    'VS Code':'online','AUTO':'online','CB-1':sl,'Ollama SLM':sl,
    'Win Laptop':wl,'OpenClaw':wl,'mistral':wl,'qwen2.5:7b':wl,'phi3:mini':wl,
    'Copilot API':'online','Copilot RAG':'online','GitHub':'online',
    'Google AI':'online','Groq':'online','Cerebras':'online',
    'OpenRouter':'online','Cloudflare':'online',
  };
  const zones=[
    {x:8,  y:18,w:180,h:330,k:'l',label:'💻 CB-2 Dev Machine'},
    {x:194,y:18,w:466,h:330,k:'t',label:'🌐 Tailscale VPN Mesh'},
    {x:666,y:18,w:310,h:330,k:'c',label:'☁️ Cloud / Internet'},
  ];
  const subs=[
    {x:200,y:26,w:186,h:230,cls:'cf-sg',label:'🖥 CB-1 (2.7GB SLM)'},
    {x:392,y:26,w:262,h:302,cls:'cf-sg',label:'🖥 Win Laptop (16GB)'},
    {x:398,y:130,w:250,h:184,cls:'cf-oc',label:'⚡ OpenClaw :4000'},
  ];
  const nodes=[
    {x:98, y:102,type:'SW', icon:'💻',label:'VS Code',    sub:'Copilot Agent', tip:'VS Code + Copilot Agent on CB-2'},
    {x:98, y:238,type:'SW', icon:'🧠',label:'AUTO',       sub:'Router',        tip:'Model router on CB-2. Dispatches to cloud or OpenClaw.'},
    {x:293,y:88, type:'HW', icon:'💻',label:'CB-1',       sub:'2.7GB RAM',     tip:'Chromebook-1: dedicated SLM inference node'},
    {x:293,y:210,type:'LLM',icon:'🤖',label:'Ollama SLM', sub:'0.8b–1.2b',    tip:'Ollama on CB-1: qwen3.5:0.8b, gemma3:270m, tinyllama'},
    {x:524,y:72, type:'HW', icon:'🖥️',label:'Win Laptop', sub:'16GB RAM',     tip:'Windows laptop: primary inference node'},
    {x:524,y:178,type:'SW', icon:'⚡',label:'OpenClaw',   sub:'LiteLLM :4000', tip:'LiteLLM proxy on Win Laptop. Receives prompt from AUTO.'},
    {x:450,y:284,type:'LLM',icon:'🤖',label:'mistral',    sub:'7.2B Q4',       tip:'ollama/mistral — general chat, 7.2B params'},
    {x:524,y:284,type:'LLM',icon:'🤖',label:'qwen2.5:7b', sub:'7.6B Q4',      tip:'ollama/qwen2.5:7b-instruct — coding'},
    {x:598,y:284,type:'LLM',icon:'🤖',label:'phi3:mini',  sub:'3.8B Q4',       tip:'ollama/phi3:mini — fast reasoning'},
    {x:730,y:62, type:'SVC',icon:'☁️',label:'Copilot API',sub:'Claude/GPT',    tip:'GitHub Copilot cloud API — primary gateway'},
    {x:730,y:144,type:'SVC',icon:'🔍',label:'Copilot RAG',sub:'context',       tip:'Copilot RAG: retrieves repo/wiki context'},
    {x:730,y:226,type:'SVC',icon:'🐙',label:'GitHub',     sub:'API+Actions',   tip:'GitHub API + Actions via gh CLI from CB-2'},
    {x:730,y:308,type:'SVC',icon:'🔀',label:'OpenRouter', sub:'free models',   tip:'OpenRouter: free model failover for OpenClaw'},
    {x:870,y:62, type:'SVC',icon:'🔶',label:'Google AI',  sub:'Gemini 2.5',    tip:'Google AI Studio: Gemini 2.5 Pro/Flash'},
    {x:870,y:144,type:'SVC',icon:'⚡',label:'Groq',       sub:'fast infer.',   tip:'Groq: ultra-fast LLM inference, free tier'},
    {x:870,y:226,type:'SVC',icon:'🧠',label:'Cerebras',   sub:'120B OSS',      tip:'Cerebras: GPT-OSS-120B, Llama 3.1-8B'},
    {x:870,y:308,type:'SVC',icon:'🌩️',label:'Cloudflare', sub:'Workers AI',   tip:'Cloudflare Workers AI: Llama vision, D1, R2'},
  ];
  const arrows=[
    {from:0,to:1, type:'internal',tip:'VS Code passes prompt to AUTO Router'},
    {from:1,to:9, type:'cloud',   label:'prompt',  curve:true,tip:'PRIMARY: prompt → Copilot API cloud'},
    {from:1,to:5, type:'local',   label:'fallback', curve:true,tip:'FALLBACK: AUTO → OpenClaw via Tailscale'},
    {from:5,to:6, type:'inference',tip:'OpenClaw → mistral'},
    {from:5,to:7, type:'inference',tip:'OpenClaw → qwen2.5:7b'},
    {from:5,to:8, type:'inference',tip:'OpenClaw → phi3:mini'},
    {from:2,to:3, type:'hosts',   label:'runs',    tip:'CB-1 hosts Ollama SLM'},
    {from:4,to:5, type:'hosts',   label:'hosts',   tip:'Win Laptop hosts OpenClaw'},
    {from:0,to:11,type:'github',  label:'gh cli',  tip:'VS Code → GitHub via gh CLI'},
  ];
  const svg=`<svg viewBox="0 0 ${W} ${H}" width="100%" class="cf-svg" role="img" aria-label="Fleet topology">
    <defs>${cfDefs()}</defs>${cfZones(zones)}${cfSubGroups(subs)}${cfNodes(nodes,liveMap)}${cfArrows(nodes,arrows,isActive)}</svg>`;
  return `<div class="cf-wrap">${svg}</div>`;
}
function cfTypeLegend() {
  const types=[['SW','#3B82F6','Software'],['HW','#6B7280','Hardware'],['LLM','#10B981','AI Model'],['SVC','#F59E0B','Cloud Svc']];
  const flows=[['#3B82F6','Cloud prompt'],['#F59E0B','Local fallback'],['#10B981','Inference'],['#8B5CF6','GitHub API'],['#4B5563','Hosts']];
  const ts=types.map(([l,c,n])=>`<span class="cf-tleg"><span class="cf-tbadge" style="border-color:${c};color:${c}">${l}</span>${n}</span>`).join('');
  const fs=flows.map(([c,n])=>`<span class="cf-tleg"><span class="cf-fline" style="background:${c}"></span>${n}</span>`).join('');
  return `<div class="cf-legend-bar">${ts}<span class="cf-leg-sep">|</span>${fs}</div>`;
}
function contextBudgetLegend() {
  const items=[{label:'System prompt',pct:10,color:'#3B82F6'},{label:'Conversation',pct:35,color:'#10B981'},{label:'File context',pct:25,color:'#F59E0B'},{label:'MCP tools',pct:10,color:'#6B7280'},{label:'User message',pct:5,color:'#EF4444'},{label:'Headroom',pct:15,color:'#4B5563'}];
  const bars=items.map(i=>`<div class="cb-seg" style="flex:${i.pct};background:${i.color}" title="${i.label}: ~${i.pct}%"></div>`).join('');
  const labels=items.map(i=>`<span><span class="dot" style="background:${i.color}"></span>${i.label}</span>`).join('');
  return `<div class="cb-bar">${bars}</div><div class="cb-legend">${labels}</div>`;
}
