const fs = require('fs');
const path = require('path');
const PROMPT = 'Write a short Python fibonacci function and one-line complexity note.';

function arg(name, d = '') { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : d; }
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function classifyError(status, text = '', e = '') {
  if (/timed out|timeout|aborted/i.test(`${e}`)) return 'timeout';
  if (/requires more system memory/i.test(text)) return 'memory';
  if (status >= 500) return 'http_5xx';
  if (status >= 400) return 'http_4xx';
  return 'transport';
}
async function j(method, url, body, timeoutMs) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeoutMs);
  const init = { method, signal: ac.signal, headers: { 'content-type': 'application/json' } };
  if (body != null) init.body = JSON.stringify(body);
  try { const r = await fetch(url, init);
    const text = await r.text(); let data = {}; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: r.ok, status: r.status, data, text }; } finally { clearTimeout(t); }
}
async function benchOnce(host, model, prompt, timeoutMs) {
  const t0 = Date.now();
  try {
    const r = await j('POST', `http://${host}:11434/api/generate`, { model, prompt, stream: false }, timeoutMs);
    const ms = Date.now() - t0; const c = r.data.eval_count || 0; const d = r.data.eval_duration || 0;
    const tok = d ? Number((c / (d / 1e9)).toFixed(2)) : null;
    if (!r.ok) return { ok: false, status: r.status, latency_ms: ms, reason: classifyError(r.status, r.text), error: r.data.error || r.text };
    return { ok: true, status: r.status, latency_ms: ms, tok_s: tok };
  } catch (e) { return { ok: false, status: 0, latency_ms: Date.now() - t0, reason: classifyError(0, '', e.message), error: e.message }; }
}
async function run(opts = {}) {
  const inv = JSON.parse(fs.readFileSync(opts.devices || path.join(process.cwd(), 'inventory/devices.json'), 'utf8'));
  const devices = inv.devices.filter((d) => d.ollama && d.tailscaleIP).map((d) => ({ id: d.id, host: d.tailscaleIP }));
  const out = { ts: new Date().toISOString(), prompt: opts.prompt || PROMPT, timeout_ms: opts.timeoutMs || 90000, devices: [] };
  for (const d of devices) {
    const row = { id: d.id, host: d.host }; out.devices.push(row);
    try {
      const tags = await j('GET', `http://${d.host}:11434/api/tags`, null, 20000);
      const cfg = inv.devices.find((x) => x.id === d.id) || {};
      const preferred = cfg.benchmarks?.model || cfg.recommendedModels?.[0]?.model;
      const names = (tags.data.models || []).map((m) => m.name);
      const model = names.includes(preferred) ? preferred : names[0];
      row.model = model || null;
      if (!model) { row.error = { reason: 'no_model', message: 'no installed models' }; continue; }
      row.cold = await benchOnce(d.host, model, out.prompt, out.timeout_ms);
      row.warm = await benchOnce(d.host, model, out.prompt, out.timeout_ms);
    } catch (e) { row.error = { reason: 'transport', message: e.message }; }
  }
  const p = opts.out || path.join(process.cwd(), 'test-results/fleet-benchmark-runner.json');
  fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, `${JSON.stringify(out, null, 2)}\n`);
  return out;
}
if (require.main === module) run({ devices: arg('devices'), out: arg('out'), prompt: arg('prompt', PROMPT), timeoutMs: num(arg('timeout-ms'), 90000) })
  .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(0); })
  .catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { classifyError, benchOnce, run };
