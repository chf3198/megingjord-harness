// ai-matrix-scorer.js — heuristic scoring of LLM analysis responses
'use strict';

const RUBRIC = {
  clarity: [
    /^\s*\d+\.\s+\*\*/mg,                    // numbered bold items: "1. **..."
    /^\s*#{1,3}\s+\S/mg,                     // markdown headers
    /\*\*[^*]{3,}\*\*/g,                     // bold text (>=3 chars)
    /\b(first|second|third|additionally|furthermore|finally|in summary)\b/gi,
    /^\s*[-*]\s+/mg,                         // bullet points
  ],
  accuracy: [
    /\b(overflow|viewport|column width|max-width|640px|1366px)\b/gi,
    /\b(schema|validation|JSON|commit|consensus|pipeline|ensemble)\b/gi,
    /\b(enum|state machine|state transition|locked|unlocked|missing)\b/gi,
    /\b(race condition|idempotent|retry|fallback|rollback)\b/gi,
  ],
  security: [
    /\b(vault|kv v2|audit log|rotation|TTL|break.glass|least.privilege)\b/gi,
    /\b(secret|credential|token|encrypt|plaintext|OWASP|exposure)\b/gi,
    /\b(short.lived|session|expiry|revoke|access control)\b/gi,
    /\b(injection|SSRF|supply.chain|dependency|pin)\b/gi,
  ],
  ux: [
    /\b(modal|toggle|tooltip|badge|icon|button|edit|lock|unlock)\b/gi,
    /\b(scroll|horizontal|responsive|viewport|overflow|hidden)\b/gi,
    /\b(UX|UI|user experience|readability|scannable|compact)\b/gi,
    /\b(loading|error state|empty state|placeholder|feedback)\b/gi,
  ],
};

function countMatches(text, patterns) {
  return patterns.reduce((sum, re) => {
    re.lastIndex = 0;
    const m = text.match(re);
    return sum + (m ? m.length : 0);
  }, 0);
}

function stripThinking(text) {
  // Remove <think>...</think> reasoning blocks — score only the final answer.
  // Reasoning models (qwen3, deepseek-r1) put their actual response AFTER the block.
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // If stripping leaves very little, fall back to full text (non-reasoning model)
  return stripped.length > 80 ? stripped : text;
}

function scoreResponse(rawText) {
  const text = stripThinking(rawText || '');
  if (!text || text.length < 80) return { clarity: 0, accuracy: 0, security: 0, ux: 0, composite: 0 };
  const len = text.length;
  const scores = {};
  for (const [dim, patterns] of Object.entries(RUBRIC)) {
    const hits = countMatches(text, patterns);
    // Scale: >8 hits = 9-10, 5-7 = 7-8, 3-4 = 5-6, 1-2 = 3-4, 0 = 1-2
    // Plus length bonus: 200-600 chars = ideal
    let base = Math.min(10, Math.round(hits * 1.2 + 1));
    if (len < 150) base = Math.max(1, base - 3);
    if (len > 3000) base = Math.max(1, base - 1); // penalise bloat slightly
    scores[dim] = Math.min(10, Math.max(1, base));
  }
  const composite = +(Object.values(scores).reduce((a, b) => a + b, 0) / 4).toFixed(1);
  return { ...scores, composite };
}

module.exports = { scoreResponse };
