// Fleet context dispatch helper (#2802 P1-0 slice 3; design D12/D15). The operational dogfood:
// one call gives a fleet model the MOST context possible — assemble bundle (slice 1) + render
// preamble (slice 2) + prepend to the task — then dispatch. The pure prompt-build is separable and
// testable (no network); the dispatch fn is injectable so callers wire the real fleet/HAMR call.
const { assembleContextBundle } = require('./fleet-context-bundle');
const { renderContextPreamble } = require('./fleet-context-render');

// buildContextualPrompt(opts) -> { prompt, manifest, included, truncated }. Pure (composes slice1+2).
// Renders the auto-assembled context, then the task. With no context, returns the bare task.
function buildContextualPrompt({ ticket, paths = [], wikiQuery, task = '', maxContextChars } = {}) {
  const bundle = assembleContextBundle({ ticket, paths, wikiQuery });
  const { preamble, included, truncated } = renderContextPreamble(bundle, { maxChars: maxContextChars });
  const header = `=== AUTO-ASSEMBLED CONTEXT (included: ${included.join(', ') || 'none'}`
    + `${truncated ? '; truncated to budget' : ''}) ===`;
  const prompt = preamble ? `${header}\n${preamble}\n\n=== TASK ===\n${task}` : task;
  return { prompt, manifest: bundle.manifest, included, truncated };
}

// dispatchWithContext(opts) -> { result, manifest, included, truncated }. `opts.dispatch` is an
// injectable `(prompt) => Promise<result>` (the real fleet/HAMR call), keeping this testable and
// substrate-agnostic (G5). Throws a clear error when no dispatch is wired.
async function dispatchWithContext(opts = {}) {
  const built = buildContextualPrompt(opts);
  if (typeof opts.dispatch !== 'function') {
    throw new Error('dispatchWithContext: opts.dispatch (prompt) => Promise<result> is required');
  }
  const result = await opts.dispatch(built.prompt);
  return { result, manifest: built.manifest, included: built.included, truncated: built.truncated };
}

module.exports = { buildContextualPrompt, dispatchWithContext };
