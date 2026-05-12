// Shared helpers for stress-liveness Playwright tests (#1410, Epic #1398 AC5+AC8).
// SSE injection fallback addresses anthropics/claude-code#20284 caveat from #1395 Theme 4.
'use strict';

async function switchView(page, title) {
  await page.click(`button[title="${title}"]`);
  await page.waitForTimeout(250);
}

async function setPanelTs(page, hhmmss) {
  await page.evaluate((val) => {
    const app = window.Alpine.$data(document.querySelector('[x-data]'));
    app.panelTs = {
      github: val, quotas: val, wiki: val, cost: val,
      agents: val, flow: val, goals: val,
    };
  }, hhmmss);
}

async function injectSSE(page, payload) {
  return await page.evaluate((p) => {
    if (!window.__megingjordSSE) window.__megingjordSSE = { events: [] };
    window.__megingjordSSE.events.push(p);
    window.__megingjordSSE.last = p;
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('megingjord:sse', { detail: p }));
    }
    return window.__megingjordSSE.last;
  }, payload);
}

module.exports = { switchView, setPanelTs, injectSSE };
