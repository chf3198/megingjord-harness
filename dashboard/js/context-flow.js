// Context Flow — fleet topology with hardware sub-groupings #374
function renderContextFlow(devices, fleetStats, isActive, liveQuotas) {
  const W=1050,H=460;
  const dm={}; (devices||[]).forEach(d=>{dm[d.id]=d.status;});
  const wl=dm['windows-laptop']||'unknown', sl=dm['penguin-1']||'unknown';
  const liveMap={
    'VS Code':'online','AUTO':'online','Wiki':'online',
    'CB-1':sl,'Ollama SLM':sl,'Win Laptop':wl,
    'OpenClaw':wl,'mistral':wl,'qwen2.5:7b':wl,'phi3:mini':wl,
    'Copilot API':'online','Copilot RAG':'online','GitHub':'online',
    'Google AI':'online','Groq':'online','Cerebras':'online',
    'OpenRouter':'online','Cloudflare AI':'online',
  };
  const zones=[
    {x:8,  y:22,w:182,h:420,k:'l',label:'💻 CB-2 Dev Machine (local)'},
    {x:196,y:22,w:492,h:420,k:'t',label:'🌐 Tailscale VPN Mesh'},
    {x:694,y:22,w:350,h:420,k:'c',label:'☁️ Cloud / Internet'},
  ];
  const subs=[
    {x:204,y:35, w:200,h:210,cls:'cf-sg', label:'🖥 CB-1 (2.7GB SLM)'},
    {x:412,y:35, w:268,h:400,cls:'cf-sg', label:'🖥 Win Laptop (16GB)'},
    {x:420,y:175,w:252,h:248,cls:'cf-oc', label:'⚡ OpenClaw :4000'},
  ];
  // nodes indexed 0-17
  const nodes=[
    // CB-2 (0-2)
    {x:98, y:95, type:'SW',  icon:'💻',label:'VS Code',    sub:'Copilot Agent',  tip:'VS Code + Copilot Agent on CB-2'},
    {x:98, y:210,type:'SW',  icon:'🧠',label:'AUTO',       sub:'Router',         tip:'Model router on CB-2. Dispatches to cloud or OpenClaw.'},
    {x:98, y:360,type:'STORE',icon:'📖',label:'Wiki',      sub:'local files',    tip:'Local wiki/context files on CB-2'},
    // CB-1 sub-group (3-4)
    {x:304,y:95, type:'HW',  icon:'💻',label:'CB-1',       sub:'2.7GB RAM',      tip:'Chromebook-1: dedicated SLM inference node'},
    {x:304,y:180,type:'LLM', icon:'🤖',label:'Ollama SLM', sub:'0.8b–1.2b',     tip:'Ollama on CB-1: qwen3.5:0.8b, gemma3:270m, tinyllama, lfm2.5:1.2b'},
    // Win Laptop sub-group (5)
    {x:546,y:85, type:'HW',  icon:'🖥️',label:'Win Laptop', sub:'16GB RAM',       tip:'Windows laptop: primary inference node. Hosts OpenClaw + Ollama.'},
    // OpenClaw sub-group (6-9)
    {x:490,y:240,type:'SW',  icon:'⚡',label:'OpenClaw',   sub:'LiteLLM :4000',  tip:'LiteLLM proxy on Win Laptop. Receives prompt from AUTO via Tailscale.'},
    {x:460,y:335,type:'LLM', icon:'🤖',label:'mistral',    sub:'7.2B Q4',        tip:'ollama/mistral:latest — general chat, 7.2B params'},
    {x:546,y:380,type:'LLM', icon:'🤖',label:'qwen2.5:7b', sub:'7.6B Q4',        tip:'ollama/qwen2.5:7b-instruct — coding/instruction'},
    {x:632,y:335,type:'LLM', icon:'🤖',label:'phi3:mini',  sub:'3.8B Q4',        tip:'ollama/phi3:mini — fast/lightweight reasoning'},
    // Cloud nodes (10-17)
    {x:800,y:65, type:'SVC', icon:'☁️',label:'Copilot API',sub:'Claude/GPT/Gemini',tip:'GitHub Copilot cloud API — primary inference gateway'},
    {x:800,y:150,type:'SVC', icon:'🔍',label:'Copilot RAG',sub:'context retrieval',tip:'Copilot RAG pipeline: retrieves repo/wiki context for grounding'},
    {x:800,y:235,type:'SVC', icon:'🐙',label:'GitHub',     sub:'API + Actions',  tip:'GitHub API + Actions. Accessed via gh CLI from CB-2.'},
    {x:900,y:65, type:'SVC', icon:'🔶',label:'Google AI',  sub:'Gemini 2.5',     tip:'Google AI Studio: Gemini 2.5 Pro/Flash, free tier + $10 credit'},
    {x:900,y:150,type:'SVC', icon:'⚡',label:'Groq',       sub:'fast inference', tip:'Groq: ultra-fast LLM inference, free tier'},
    {x:900,y:235,type:'SVC', icon:'🧠',label:'Cerebras',   sub:'GPT-OSS-120B',   tip:'Cerebras: GPT-OSS-120B, Llama 3.1-8B, Qwen3-235B — free tier'},
    {x:850,y:320,type:'SVC', icon:'🔀',label:'OpenRouter', sub:'free models',    tip:'OpenRouter: free model failover gateway for OpenClaw'},
    {x:850,y:400,type:'SVC', icon:'🌩️',label:'Cloudflare', sub:'Workers AI',    tip:'Cloudflare Workers AI: Llama vision, D1, R2 — $10/mo'},
  ];
  const arrows=[
    {from:0,to:1,type:'internal',tip:'VS Code passes prompt to AUTO Router'},
    {from:1,to:10,type:'cloud',label:'prompt',curve:true,tip:'PRIMARY: prompt → Copilot API cloud'},
    {from:1,to:6,type:'local',label:'fallback',curve:true,tip:'FALLBACK: AUTO → OpenClaw via Tailscale'},
    {from:6,to:7,type:'inference',tip:'OpenClaw → mistral'},
    {from:6,to:8,type:'inference',tip:'OpenClaw → qwen2.5:7b'},
    {from:6,to:9,type:'inference',tip:'OpenClaw → phi3:mini'},
    {from:3,to:4,type:'hosts',label:'runs',tip:'CB-1 hosts Ollama SLM'},
    {from:5,to:6,type:'hosts',label:'hosts',tip:'Win Laptop hosts OpenClaw'},
    {from:0,to:12,type:'github',label:'gh cli',tip:'VS Code → GitHub via gh CLI'},
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
