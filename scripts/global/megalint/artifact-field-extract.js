'use strict';
// Shared baton field extraction — tolerates plain, markdown-bold, heading,
// and list-prefixed field patterns (#3030 F-BC1, #3225 AC4).

function extractField(body, field) {
  // Supports: `field:`, `- field:`, `* field:`, `## field:`,
  // `**field:**`, `**field**:` (colon outside bold).
  const re = new RegExp(
    `(?:^|\\n)[-*]?\\s*(?:#{1,3}\\s+)?(?:\\*\\*)?\\s*${field}` +
    `(?::\\*\\*|\\*\\*\\s*:|\\s*:)\\s*([^\\n]+)`,
    'i',
  );
  const m = String(body || '').match(re);
  if (!m) return null;
  return m[1].replace(/^\*\*|\*\*$/g, '').trim();
}

module.exports = { extractField };
