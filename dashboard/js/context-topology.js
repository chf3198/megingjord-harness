// Context Topology — SVG zones, type-differentiated nodes, and flow arrows
const CF_TYPE_STYLE = {
  HW:    {rx:4,  sw:2,   stroke:'var(--text-muted)', fill:'var(--surface)'},
  SW:    {rx:8,  sw:1.5, stroke:'var(--blue)',        fill:'color-mix(in srgb,var(--blue) 8%,var(--bg))'},
  LLM:   {rx:10, sw:1.5, stroke:'var(--green)',       fill:'color-mix(in srgb,var(--green) 8%,var(--bg))'},
  SVC:   {rx:6,  sw:1.5, stroke:'var(--yellow)',      fill:'color-mix(in srgb,var(--yellow) 6%,var(--bg))'},
  STORE: {rx:4,  sw:1,   stroke:'var(--border)',      fill:'var(--bg)'},
};
const CF_TYPE_LBL = {HW:'HW', SW:'SW', LLM:'LLM', SVC:'SVC', STORE:'DB'};
const FLOW_TYPE = {
  internal: {color:'var(--border)',  head:'cfHd',  dash:false, dur:0,      op:0.45},
  hosts:    {color:'var(--border)',  head:'cfHd',  dash:true,  dur:0,      op:0.3},
  cloud:    {color:'var(--blue)',    head:'cfHdB', dash:false, dur:'2s',   op:0.85},
  local:    {color:'var(--yellow)',  head:'cfHdY', dash:true,  dur:'3s',   op:0.85},
  inference:{color:'var(--green)',   head:'cfHd',  dash:false, dur:'2s',   op:0.85},
  github:   {color:'#a371f7',        head:'cfHdP', dash:false, dur:'3.5s', op:0.75},
};
function cfDefs() {
  const mk=(id,c)=>`<marker id="${id}" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="${c}"/></marker>`;
  return mk('cfHd','var(--green)')+mk('cfHdB','var(--blue)')+mk('cfHdY','var(--yellow)')+mk('cfHdP','#a371f7')
    +`<style>.cf-zone{stroke-width:1.5;stroke-dasharray:5,3}
    .cf-zl{stroke:var(--blue);fill:color-mix(in srgb,var(--blue) 4%,transparent)}
    .cf-zt{stroke:var(--yellow);fill:color-mix(in srgb,var(--yellow) 3%,transparent)}
    .cf-zc{stroke:var(--text-muted);fill:color-mix(in srgb,var(--text-muted) 3%,transparent)}
    .cf-zlbl{font-size:8px;font-weight:700;fill:var(--text-muted);pointer-events:none}
    .cf-nm{font-size:8.5px;fill:var(--text);font-weight:700;pointer-events:none}
    .cf-sb{font-size:6.5px;fill:var(--text-muted);pointer-events:none}
    .cf-tb{font-size:6px;font-weight:800;pointer-events:none}
    .cf-lbl2{font-size:6.5px;fill:var(--text-muted);font-style:italic}
    .cf-ng:hover rect{filter:brightness(1.4)}
    @keyframes cfpulse{0%,100%{opacity:.4}50%{opacity:1}}
    circle.cfp{animation:cfpulse 1.5s ease-in-out infinite}
    .cfpkt{filter:drop-shadow(0 0 3px currentColor)}</style>`;
}
function cfZones(zones) {
  return zones.map(z=>`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="8" class="cf-zone cf-z${z.k}"/>
    <text x="${z.x+8}" y="${z.y+13}" class="cf-zlbl">${z.label}</text>`).join('');
}
function cfNodes(nodes, liveMap) {
  const sc={healthy:'var(--green)',degraded:'var(--yellow)',offline:'var(--red)',unknown:'var(--text-muted)'};
  const NW=76,NH=44;
  return nodes.map(n=>{
    const st=(liveMap||{})[n.label]||'unknown';
    const ts=CF_TYPE_STYLE[n.type]||CF_TYPE_STYLE.SW;
    const sd=n.type==='STORE'?'stroke-dasharray="3,2"':'';
    const hp=st==='healthy'?' class="cfp"':'';
    return `<g class="cf-ng"><title>${n.tip}</title>
    <rect x="${n.x-NW/2}" y="${n.y-NH/2}" width="${NW}" height="${NH}" rx="${ts.rx}" ${sd} fill="${ts.fill}" stroke="${ts.stroke}" stroke-width="${ts.sw}"/>
    <circle cx="${n.x+NW/2-6}" cy="${n.y-NH/2+7}" r="4" fill="${sc[st]||sc.unknown}"${hp}/>
    <text x="${n.x-NW/2+5}" y="${n.y-NH/2+10}" fill="${ts.stroke}" class="cf-tb">${CF_TYPE_LBL[n.type]||''}</text>
    <text x="${n.x}" y="${n.y}" text-anchor="middle" style="font-size:11px;pointer-events:none">${n.icon}</text>
    <text x="${n.x}" y="${n.y+12}" text-anchor="middle" class="cf-nm">${n.label}</text>
    <text x="${n.x}" y="${n.y+21}" text-anchor="middle" class="cf-sb">${n.sub}</text></g>`;
  }).join('');
}
function cfArrows(nodes,arrows,isActive){
  return arrows.map((a,i)=>{
    const f=nodes[a.from],t=nodes[a.to];
    const ft=FLOW_TYPE[a.type||'internal'];
    const d=a.curve?`M${f.x},${f.y} C${f.x},${f.y-90} ${t.x},${t.y-90} ${t.x},${t.y}`:`M${f.x},${f.y} L${t.x},${t.y}`;
    const dk=ft.dash?'stroke-dasharray="5,3"':'';
    const pid=`cfp${i}`;
    const mx=(f.x+t.x)/2, my=a.curve?Math.min(f.y,t.y)-62:(f.y+t.y)/2-5;
    const pkt=(isActive&&ft.dur)?`<circle r="2.5" fill="${ft.color}" class="cfpkt" opacity="0.9"><animateMotion dur="${ft.dur}" repeatCount="indefinite"><mpath href="#${pid}"/></animateMotion></circle>`:'';
    return `<path id="${pid}" d="${d}" fill="none" stroke="${ft.color}" stroke-width="1.5" ${dk} opacity="${ft.op}" marker-end="url(#${ft.head})"><title>${a.tip||''}</title></path>${pkt}
    ${a.label?`<text x="${mx}" y="${my}" text-anchor="middle" class="cf-lbl2">${a.label}</text>`:''}`;
  }).join('');
}
