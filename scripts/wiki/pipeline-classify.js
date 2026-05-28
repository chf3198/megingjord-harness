// scripts/wiki/pipeline-classify.js — Diff classification + invisible-char scan.
// Consumed by auto-update-pipeline.js. CommonJS. Refs #2055
'use strict';

// HIGH: characters that can alter parsing or hide injected content.
const INVISIBLE_CHAR_PATTERNS = [
  { regex: /[‪-‮⁦-⁩]/g, severity: 'HIGH', name: 'bidi-override' },
  { regex: /​/g, severity: 'HIGH', name: 'zero-width-space' },
  { regex: /﻿/g, severity: 'HIGH', name: 'bom-mid-file' },
  { regex: /[‌‍­]/g, severity: 'LOW', name: 'zero-width-misc' },
];

/**
 * Scan text for invisible characters.
 * @param {string} text
 * @returns {{ findings: Array<{name, severity, count}>, maxSeverity: 'HIGH'|'LOW'|'NONE' }}
 */
function scanInvisibleChars(text) {
  const findings = [];
  for (const { regex, severity, name } of INVISIBLE_CHAR_PATTERNS) {
    const matches = text.match(regex);
    if (matches && matches.length > 0) findings.push({ name, severity, count: matches.length });
  }
  const maxSeverity = findings.some((f) => f.severity === 'HIGH')
    ? 'HIGH' : findings.length > 0 ? 'LOW' : 'NONE';
  return { findings, maxSeverity };
}

/**
 * Classify changed file paths into wiki update target categories.
 * @param {string[]} changedFiles
 * @returns {{ code: string[], workLog: string[], wisdom: string[] }}
 */
function classifyDiff(changedFiles) {
  const code = [];
  const workLog = [];
  const wisdom = [];
  for (const filePath of changedFiles) {
    if (/^(scripts|cloudflare|dashboard)\//.test(filePath) || /\.(ts|js)$/.test(filePath)) {
      code.push(filePath);
    } else if (/^\.github\/workflows\//.test(filePath) || /\.(yml|yaml)$/.test(filePath)) {
      workLog.push(filePath);
    } else if (/\.(md|txt)$/.test(filePath)) {
      wisdom.push(filePath);
    }
  }
  return { code, workLog, wisdom };
}

/**
 * Generate wiki frontmatter per #2052 schema (with content_trust_score).
 * @param {{ title: string, type: string, prNumber: number|string, date: string }} opts
 * @returns {object} frontmatter data
 */
function generateFrontmatter({ title, type, prNumber, date }) {
  return {
    title,
    type,
    content_trust_score: 0.7,
    created: date,
    updated: date,
    tags: [`pr-${prNumber}`, 'auto-update'],
    status: 'auto-generated',
  };
}

module.exports = { scanInvisibleChars, classifyDiff, generateFrontmatter, INVISIBLE_CHAR_PATTERNS };
