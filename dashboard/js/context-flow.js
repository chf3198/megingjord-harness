// Context Flow — fleet topology: zones (CB-2 Local | Tailscale VPN | Cloud)
function renderContextFlow(devices, fleetStats, isActive, liveQuotas) {
  const W=900,H=315;
  const dm={}; (devices||[]).forEach(d=>{dm[d.id]=d.status;});
  const liveMap={
    'VS Code':'healthy','AUTO':'healthy','Wiki':'healthy',
    'CB-1':dm['penguin-1']||'unknown','Ollama SLM':dm['penguin-1']||'unknown',
    'Win Laptop':dm['windows-laptop']||'unknown',
    'OpenClaw':dm['windows-laptop']||'unknown',
    'Ollama 7B':fleetStats?.['windows-laptop']?.online?'healthy':'offline',
    'Copilot API':'healthy','GitHub':'healthy',
  };
  const zones=[
    {x:8,  y:22,w:188,h:285,k:'l',label:'💻 CB-2 Dev Machine (local)'},
    {x:204,y:22,w:368,h:285,k:'t',label:'🌐 Tailscale VPN Mesh'},
    {x:580,y:22,w:312,h:285,k:'c',label:'☁️ Cloud / Internet'},
  ];
  const nodes=[
    {x:102,y:95, type:'SW',    icon:'💻',label:'VS Code',    sub:'Copilot Agent',tip:'VS Code + Copilot Agent on CB-2. Sends prompts to AUTO Router.'},
    {x:102,y:195,type:'SW',    icon:'🧠',label:'AUTO',       sub:'Router',       tip:'Model router software on CB-2. Dispatches to cloud (primary) or OpenClaw (fallback).'},
    {x:102,y:278,type:'STORE', icon:'📖',label:'Wiki',       sub:'local files',  tip:'Local wiki files on CB-2. Loaded as context by Copilot Agent.'},
    {x:293,y:90, type:'HW',    icon:'💻',label:'CB-1',       sub:'SLM node 2.7GB',tip:'Chromebook-1: 2.7GB RAM. Hosts Ollama with tiny SLM models.'},
    {x:293,y:205,type:'LLM',   icon:'🤖',label:'Ollama SLM', sub:'0.8b-1.2b',   tip:'Ollama on CB-1: qwen3.5:0.8b, gemma3:270m, tinyllama, lfm2.5:1.2b.'},
    {x:468,y:90, type:'HW',    icon:'🖥️',label:'Win Laptop', sub:'16GB',         tip:'Windows laptop: primary inference node. 16GB RAM. Hosts OpenClaw + Ollama.'},
    {x:468,y:185,type:'SW',    icon:'⚡',label:'OpenClaw',   sub:'LiteLLM :4000',tip:'LiteLLM proxy on Win Laptop. Receives prompt from AUTO via Tailscale VPN.'},
    {x:468,y:278,type:'LLM',   icon:'🤖',label:'Ollama 7B',  sub:'mistral/qwen', tip:'Ollama on Win Laptop: mistral:latest, qwen2.5:7b-instruct, phi3:mini.'},
    {x:736,y:110,type:'SVC',   icon:'☁️',label:'Copilot API',sub:'Claude/GPT/Gemini',tip:'GitHub Copilot cloud API. Primary inference. Routes to best available model.'},
    {x:736,y:220,type:'SVC',   icon:'🐙',label:'GitHub',     sub:'API + Actions', tip:'GitHub API + Actions CI/CD. Accessed via gh CLI from VS Code on CB-2.'},
  ];
  const arrows=[
    {from:0,to:1,type:'internal',label:'',           tip:'VS Code passes prompt to AUTO Router on CB-2'},
    {from:1,to:8,type:'cloud',   label:'prompt',     tip:'PRIMARY: prompt dispatched to GitHub Copilot cloud API'},
    {from:1,to:6,type:'local',   label:'via Tailscale VPN',curve:true,tip:'FALLBACK: AUTO routes over Tailscale mesh to OpenClaw on Win Laptop'},
    {from:6,to:7,type:'inference',label:'inference', tip:'OpenClaw dispatches prompt to Ollama 7B on Win Laptop'},
    {from:3,to:4,type:'hosts',   label:'runs',       tip:'CB-1 hardware hosts Ollama SLM service'},
    {from:5,to:6,type:'hosts',   label:'hosts',      tip:'Win Laptop hosts OpenClaw LiteLLM proxy'},
    {from:0,to:9,type:'github',  label:'gh cli',     tip:'VS Code uses gh CLI for issues, PRs, commits'},
  ];
  const svg=`<svg viewBox="0 0 ${W} ${H}" height="${H}" class="cf-svg" role="img" aria-label="Fleet topology diagram">
    <defs>${cfDefs()}</defs>${cfZones(zones)}${cfArrows(nodes,arrows,isActive)}${cfNodes(nodes,liveMap)}</svg>`;
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
