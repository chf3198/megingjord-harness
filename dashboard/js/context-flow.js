/* global cfDefs, cfZoneRects, cfSubRects, cfNodes, cfArrows, cfSubLabels, cfZoneLabels */
// Context Flow — 700px canvas (#384 label/cloud/z-order fix)
const CF_W=700, CF_H=298;   // canvas viewport

function renderContextFlow(devices, fleetStats, isActive) {
  const W=CF_W, H=CF_H;
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
    {x:5,  y:28,w:122,h:260,k:'l',label:'💻 CB-2 Dev Machine'},
    {x:132,y:28,w:340,h:260,k:'t',label:'🌐 Tailscale VPN Mesh'},
    {x:477,y:28,w:218,h:260,k:'c',label:'☁️ Cloud / Internet'},
  ];
  const subs=[
    {x:136,y:36,w:120,h:178,cls:'cf-sg',label:'🖥 CB-1 (2.7GB SLM)'},
    {x:260,y:36,w:206,h:248,cls:'cf-sg',label:'🖥 Win Laptop (16GB)'},
    {x:265,y:126,w:196,h:150,cls:'cf-oc',label:'⚡ OpenClaw :4000'},
  ];
  const nodes=[
    {x:66, y:94, type:'SW', icon:'💻',label:'VS Code',    sub:'Copilot Agent',tip:'VS Code + Copilot Agent on CB-2'},
    {x:66, y:206,type:'SW', icon:'🧠',label:'AUTO',       sub:'Router',       tip:'Model router on CB-2. Dispatches to cloud or OpenClaw.'},
    {x:196,y:78, type:'HW', icon:'💻',label:'CB-1',       sub:'2.7GB RAM',    tip:'Chromebook-1: dedicated SLM inference node'},
    {x:196,y:176,type:'LLM',icon:'🤖',label:'Ollama SLM', sub:'0.8b–1.2b',   tip:'Ollama on CB-1: qwen3.5:0.8b, gemma3:270m, tinyllama'},
    {x:362,y:68, type:'HW', icon:'🖥️',label:'Win Laptop', sub:'16GB RAM',    tip:'Windows laptop: primary inference node'},
    {x:362,y:158,type:'SW', icon:'⚡',label:'OpenClaw',   sub:'LiteLLM :4000',tip:'LiteLLM proxy on Win Laptop. Receives prompt from AUTO.'},
    {x:310,y:254,type:'LLM',icon:'🤖',label:'mistral',    sub:'7.2B Q4',      tip:'ollama/mistral — general chat, 7.2B params'},
    {x:362,y:254,type:'LLM',icon:'🤖',label:'qwen2.5:7b', sub:'7.6B Q4',     tip:'ollama/qwen2.5:7b-instruct — coding'},
    {x:414,y:254,type:'LLM',icon:'🤖',label:'phi3:mini',  sub:'3.8B Q4',      tip:'ollama/phi3:mini — fast reasoning'},
    {x:527,y:64, type:'SVC',icon:'☁️',label:'Copilot API',sub:'Claude/GPT',   tip:'GitHub Copilot cloud API — primary gateway'},
    {x:527,y:126,type:'SVC',icon:'🔍',label:'Copilot RAG',sub:'context',      tip:'Copilot RAG: retrieves repo/wiki context'},
    {x:527,y:188,type:'SVC',icon:'🐙',label:'GitHub',     sub:'API+Actions',  tip:'GitHub API + Actions via gh CLI from CB-2'},
    {x:527,y:250,type:'SVC',icon:'🔀',label:'OpenRouter', sub:'free models',  tip:'OpenRouter: free model failover for OpenClaw'},
    {x:622,y:64, type:'SVC',icon:'🔶',label:'Google AI',  sub:'Gemini 2.5',   tip:'Google AI Studio: Gemini 2.5 Pro/Flash'},
    {x:622,y:126,type:'SVC',icon:'⚡',label:'Groq',       sub:'fast infer.',  tip:'Groq: ultra-fast LLM inference, free tier'},
    {x:622,y:188,type:'SVC',icon:'🧠',label:'Cerebras',   sub:'120B OSS',     tip:'Cerebras: GPT-OSS-120B, Llama 3.1-8B'},
    {x:622,y:250,type:'SVC',icon:'🌩️',label:'Cloudflare', sub:'Workers AI',  tip:'Cloudflare Workers AI: Llama vision, D1, R2'},
  ];
  const arrows=[
    {from:0,to:1, type:'internal',tip:'VS Code passes prompt to AUTO Router'},
    {from:1,to:9, type:'cloud',   label:'prompt',  curve:true,tip:'PRIMARY: prompt → Copilot API cloud'},
    {from:1,to:5, type:'local',   label:'fallback',curve:true,tip:'FALLBACK: AUTO → OpenClaw via Tailscale'},
    {from:5,to:6, type:'inference',tip:'OpenClaw → mistral'},
    {from:5,to:7, type:'inference',tip:'OpenClaw → qwen2.5:7b'},
    {from:5,to:8, type:'inference',tip:'OpenClaw → phi3:mini'},
    {from:2,to:3, type:'hosts',   label:'runs',    tip:'CB-1 hosts Ollama SLM'},
    {from:4,to:5, type:'hosts',   label:'hosts',   tip:'Win Laptop hosts OpenClaw'},
    {from:0,to:11,type:'github',  label:'gh cli',  tip:'VS Code → GitHub via gh CLI'},
  ];
  const svg=`<svg viewBox="0 0 ${W} ${H}" width="100%" class="cf-svg" role="img" aria-label="Fleet topology">
    <defs>${cfDefs()}</defs>${cfZoneRects(zones)}${cfSubRects(subs)}${cfNodes(nodes,liveMap)}${cfArrows(nodes,arrows,isActive)}${cfSubLabels(subs)}${cfZoneLabels(zones)}</svg>`;
  return `<div class="cf-wrap">${svg}</div>`;
}

window.renderContextFlow = renderContextFlow;

