'use strict';
// Shared baton field extraction — tolerates plain, markdown-bold, and heading prefixes (#3030 F-BC1).

function extractField(body, field) {
  const re = new RegExp(
    `(?:^|\\n)\\s*(?:#{1,3}\\s+)?(?:\\*{0,2})?\\s*${field}\\s*:\\s*([^\\n]+)`,
    'i',
  );
  const m = String(body || '').match(re);
  if (!m) return null;
  return m[1].replace(/^\*\*|\*\*$/g, '').trim();
}

module.exports = { extractField };
