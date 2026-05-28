#!/usr/bin/env node
// scripts/wiki/invisible-char-scan.js — Invisible/zero-width Unicode scanner
// Detects ZWJ, ZWSP, ZWNJ, BOM, soft-hyphen, and other invisible codepoints.
// Returns structured findings per file. Importable + CLI. Refs #2053
'use strict';

const fs = require('fs');
const path = require('path');

// Codepoints: HIGH = trust-degrading in code; MEDIUM = context-dependent; LOW = benign
const INVISIBLE_CHARS = [
  { cp: '‍', name: 'ZWJ (Zero Width Joiner)', severity: 'HIGH' },
  { cp: '​', name: 'ZWSP (Zero Width Space)', severity: 'HIGH' },
  { cp: '‌', name: 'ZWNJ (Zero Width Non-Joiner)', severity: 'HIGH' },
  { cp: '‮', name: 'RLO (Right-to-Left Override)', severity: 'HIGH' },
  { cp: '⁠', name: 'WJ (Word Joiner)', severity: 'HIGH' },
  { cp: '﻿', name: 'BOM/ZWNBS (Byte Order Mark)', severity: 'MEDIUM' },
  { cp: '­', name: 'SHY (Soft Hyphen)', severity: 'MEDIUM' },
  { cp: '͏', name: 'CGJ (Combining Grapheme Joiner)', severity: 'HIGH' },
];

/**
 * Scan content string for invisible codepoints.
 * @param {string} filePath label for findings
 * @param {string} content file text
 * @returns {Array<{path,line,col,codepoint,name,severity}>}
 */
function scanContent(filePath, content) {
  const findings = [];
  const lines = content.split('\n');
  lines.forEach((lineText, li) => {
    for (const { cp, name, severity } of INVISIBLE_CHARS) {
      let col = 0;
      while ((col = lineText.indexOf(cp, col)) !== -1) {
        // BOM at byte 0 of first line is LOW (standard UTF-8 BOM)
        const sev = (cp === '﻿' && li === 0 && col === 0) ? 'LOW' : severity;
        findings.push({
          path: filePath, line: li + 1, col: col + 1,
          codepoint: `U+${cp.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
          name, severity: sev,
        });
        col += 1;
      }
    }
  });
  return findings;
}

/**
 * Scan a file on disk.
 * @param {string} filePath
 * @returns {Array<{path,line,col,codepoint,name,severity}>}
 */
function scanFile(filePath) {
  return scanContent(filePath, fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Scan multiple files, returning combined findings.
 * @param {string[]} filePaths
 * @returns {Array<{path,line,col,codepoint,name,severity}>}
 */
function scanFiles(filePaths) {
  return filePaths.flatMap((p) => scanFile(p));
}

module.exports = { scanContent, scanFile, scanFiles, INVISIBLE_CHARS };

if (require.main === module) {
  const targets = process.argv.slice(2);
  if (!targets.length) { console.error('Usage: invisible-char-scan.js <file> ...'); process.exit(1); }
  const findings = scanFiles(targets.map((t) => path.resolve(t)));
  if (!findings.length) { console.log('clean — no invisible characters detected'); process.exit(0); }
  findings.forEach((f) => console.log(`[${f.severity}] ${f.path}:${f.line}:${f.col} ${f.codepoint} ${f.name}`));
  process.exit(findings.some((f) => f.severity === 'HIGH') ? 2 : 1);
}
