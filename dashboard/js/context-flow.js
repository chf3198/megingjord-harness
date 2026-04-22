// Context Flow — fleet topology with hardware sub-groupings #374 fix:#376
function renderContextFlow(devices, fleetStats, isActive, liveQuotas) {
  const W=900,H=300;
  const dm={}; (devices||[]).forEach(d=>{dm[d.id]=d.status;});
  const wl=dm['windows-laptop']||'unknown', sl=dm['penguin-1']||'unknown';
  const liveMap={
    'VS Code':'online','AUTO':'online',
    'CB-1':sl,'Ollama SLM':sl,'Win Laptop':wl,
    'OpenClaw':wl,'mistral':wl,'qwen2.5:7b':wl,'phi3:mini':wl,
    'Copilot API':'online','Copilot RAG':'online','GitHub':'online',
    'Google AI':'online','Groq':'online','Cerebras':'online',
    'OpenRouter':'online','Cloudflare AI':'online',
  };
  const zones=[
    {x:8,  y:18,w:162,h:265,k:'l',label:'💻 CB-2 Dev Machine (local)'},
    {x:176,y:18,w:440,h:265,k:'t',label:'🌐 Tailscale VPN Mesh'},
    {x:622,y:18,w:272,h:265,k:'c',label:'☁️ Cloud / Internet'},
  ];
  const subs=[
    {x:184,y:26,w:182,h:248,cls:'cf-sg',label:'🖥 CB-1 (2.7GB SLM)'},
    {x:374,y:26,w:234,h:252,cls:'cf-sg',label:'🖥 Win Laptop (16GB)'},
    {x:382,y:118,w:218,h:155,cls:'cf-oc',label:'⚡ OpenClaw :4000'},
  ];
  // nodes indexed 0-16
  const nodes=[
    // CB-2 (0-1)
    {x:90, y:90, type:'SW',  icon:'💻',label:'VS Code',    sub:'Copilot Agent',  tip:'VS Code + Copilot Agent on CB-2'},
    {x:90, y:205,type:'SW',  icon:'🧠',label:'AUTO',       sub:'Router',         tip:'Model router on CB-2. Dispatches to cloud or OpenClaw.'},
    // CB-1 sub-group (2-3)
    {x:275,y:88, type:'HW',  icon:'💻',label:'CB-1',       sub:'2.7GB RAM',      tip:'Chromebook-1: dedicated SLM inference node'},
    {x:275,y:198,type:'LLM', icon:'🤖',label:'Ollama SLM', sub:'0.8b–1.2b',     tip:'Ollama on CB-1: qwen3.5:0.8b, gemma3:270m, tinyllama, lfm2.5:1.2b'},
    // Win Laptop sub-group (4)
    {x:491,y:65, type:'HW',  icon:'🖥️',label:'Win Laptop', sub:'16GB RAM',       tip:'Windows laptop: primary inference node. Hosts OpenClaw + Ollama.'},
    // OpenClaw sub-group (5-8)
    {x:491,y:160,type:'SW',  icon:'⚡',label:'OpenClaw',   sub:'LiteLLM :4000',  tip:'LiteLLM proxy on Win Laptop. Receives prompt from AUTO via Tailscale.'},
    {x:422,y:248,type:'LLM', icon:'🤖',label:'mistral',    sub:'7.2B Q4',        tip:'ollama/mistral:latest — general chat, 7.2B params'},
    {x:491,y:248,type:'LLM', icon:'🤖',label:'qwen2.5:7b', sub:'7.6B Q4',        tip:'ollama/qwen2.5:7b-instruct — coding/instruction'},
    {x:560,y:248,type:'LLM', icon:'🤖',label:'phi3:mini',  sub:'3.8B Q4',        tip:'ollama/phi3:mini — fast/lightweight reasoning'},
    // Cloud nodes (9-16)
    {x:693,y:62, type:'SVC', icon:'☁️',label:'Copilot API',sub:'Claude/GPT',     tip:'GitHub Copilot cloud API — primary inference gateway'},
    {x:693,y:128,type:'SVC', icon:'🔍',label:'Copilot RAG',sub:'context',        tip:'Copilot RAG pipeline: retrieves repo/wiki context for grounding'},
    {x:693,y:196,type:'SVC', icon:'🐙',label:'GitHub',     sub:'API + Actions',  tip:'GitHub API + Actions. Accessed via gh CLI from CB-2.'},
    {x:693,y:262,type:'SVC', icon:'🔀',label:'OpenRouter', sub:'free models',    tip:'OpenRouter: free model failover gateway for OpenClaw'},
    {x:821,y:62, type:'SVC', icon:'🔶',label:'Google AI',  sub:'Gemini 2.5',     tip:'Google AI Studio: Gemini 2.5 Pro/Flash, free tier + $10 credit'},
    {x:821,y:128,type:'SVC', icon:'⚡',label:'Groq',       sub:'fast inference', tip:'Groq: ultra-fast LLM inference, free tier'},
    {x:821,y:196,type:'SVC', icon:'🧠',label:'Cerebras',   sub:'GPT-OSS-120B',   tip:'Cerebras: GPT-OSS-120B, Llama 3.1-8B, Qwen3-235B — free tier'},
    {x:821,y:262,type:'SVC', icon:'🌩️',label:'Cloudflare', sub:'Workers AI',     tip:'Cloudflare Workers AI: Llama vision, D1, R2 — $10/mo'},
  ];
  const arrows=[
    {from:0,to:1,type:'internal',tip:'VS Code passes prompt to AUTO Router'},
    {from:1,to:9,type:'cloud',label:'prompt',curve:true,tip:'PRIMARY: prompt → Copilot API cloud'},
    {from:1,to:5,type:'local',label:'fallback',curve:true,tip:'FALLBACK: AUTO → OpenClaw via Tailscale'},
    {from:5,to:6,type:'inference',tip:'OpenClaw → mistral'},
    {from:5,to:7,type:'inference',tip:'OpenClaw → qwen2.5:7b'},
    {from:5,to:8,type:'inference',tip:'OpenClaw → phi3:mini'},
    {from:2,to:3,type:'hosts',label:'runs',tip:'CB-1 hosts Ollama SLM'},
    {from:4,to:5,type:'hosts',label:'hosts',tip:'Win Laptop hosts OpenClaw'},
    {from:0,to:11,type:'github',label:'gh cli',tip:'VS Code → GitHub via gh CLI'},
  ];
  const svg=`<svg viewBox="0 0 ${W} ${H}" height="${H}" class="cf-svg" role="img" aria-label="Fleet topology">
    <defs>${cfDefs()}</defs>${cfZones(zones)}${cfSubGroups(subs)}${cfArrows(nodes,arrows,isActive)}${cfNodes(nodes,liveMap)}</svg>`;
  return `<div class="cf-wrap">${svg}${cfTypeLegend()}${contextBudgetLegend()}${typeof cfResourcePills==='function'?cfResourcePills(liveQuotas):''}</div>`;
}
function cfTypeLegend() {
  const types=[['SW','var(--blue)','Software'],['HW','var(--text-muted)','Hardware'],['LLM','var(--green)','AI Model'],['SVC','var(--yellow)','Cloud Svc'],['DB','var(--border)','Storage']];
  const flows=[['var(--blue)','Cloud prompt'],['var(--yellow)','Local fallback'],['var(--green)','Inference'],['#a371f7','GitHub API'],['var(--border)','Hosts (HW to SW)']];
  const ts=types.map(([l,c,n])=>`<span class="cf-tleg"><span class="cf-tbadge" style="border-color:${c};color:${c}">${l}</span>${n}</span>`).join('');
  const fs=flows.map(([c,n])=>`<span class="cf-tleg"><span class="cf-fline" style="background:${c}"></span>${n}</span>`).join('');
  return `<div class="cf-legend-bar">${ts}<span class="cf-leg-sep">|</span>${fs}</div>`;
}
function contextBudgetLegend() {
  const items=[{label:'System prompt',pct:10,color:'var(--blue)'},{label:'Conversation',pct:35,color:'var(--green)'},{label:'File context',pct:25,color:'var(--yellow)'},{label:'MCP tools',pct:10,color:'var(--text-muted)'},{label:'User message',pct:5,color:'var(--red)'},{label:'Headroom',pct:15,color:'var(--border)'}];
  const bars=items.map(i=>`<div class="cb-seg" style="flex:${i.pct};background:${i.color}" title="${i.label}: ~${i.pct}%"></div>`).join('');
  const labels=items.map(i=>`<span><span class="dot" style="background:${i.color}"></span>${i.label}</span>`).join('');
  return `<div class="cb-bar">${bars}</div><div class="cb-legend">${labels}</div>`;
}
