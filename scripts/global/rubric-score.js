#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULT_RUBRIC = path.join(__dirname, '..', '..', 'inventory', 'rubric-g1-g9-v2.json');

function arg(name, args = process.argv.slice(2)) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

function readText(file) {
  if (!file) return '';
  return fs.readFileSync(file, 'utf8');
}

function sourceText(ctx, source) {
  return String(ctx[source] || '');
}

function evaluateCommand(command, ctx) {
  const [kind, source, ...rest] = String(command || '').split(':');
  const expr = rest.join(':');
  const text = sourceText(ctx, source);
  if (kind === 'contains') {
    const missing = expr.split('|').filter(token => !text.includes(token));
    return { ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : 'matched' };
  }
  if (kind === 'regex' || kind === 'not_regex') {
    const matched = new RegExp(expr, 'im').test(text);
    return { ok: kind === 'regex' ? matched : !matched, detail: matched ? 'matched' : 'not matched' };
  }
  return { ok: false, detail: `unknown evidence command: ${command}` };
}

function validateRubric(rubric) {
  const goals = rubric.goals || {};
  const missing = [];
  // v2 covers G1-G9 (9 goals); v3 covers G1-G10 (#1967). Derive max from rubric version.
  const maxGoal = String(rubric.version || '').includes('g10') ? 10 : 9;
  for (let n = 1; n <= maxGoal; n += 1) {
    const goal = goals[`G${n}`];
    if (!goal || !Array.isArray(goal.boxes) || goal.boxes.length < 3) missing.push(`G${n}`);
  }
  return { ok: missing.length === 0, missing };
}

function scoreRubric(rubric, ctx) {
  const validity = validateRubric(rubric);
  if (!validity.ok) throw new Error(`rubric goals missing >=3 boxes: ${validity.missing.join(', ')}`);
  const out = { rubric_version: rubric.version, goals: {}, mean: 0 };
  for (const [goalId, goal] of Object.entries(rubric.goals)) {
    const boxes = goal.boxes.map(box => ({ ...box, ...evaluateCommand(box.evidence_command, ctx) }));
    const checked = boxes.filter(box => box.ok).length;
    const total = boxes.length;
    out.goals[goalId] = {
      title: goal.title, boxes_checked: checked, boxes_total: total,
      score: Number(((checked / total) * 10).toFixed(2)), boxes,
    };
  }
  const scores = Object.values(out.goals).map(goal => goal.score);
  out.mean = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
  return out;
}

function cli() {
  const rubricPath = arg('--rubric') || DEFAULT_RUBRIC;
  const rubric = JSON.parse(readText(rubricPath));
  const ctx = {
    trail: readText(arg('--trail')), diff: readText(arg('--diff')),
    closeout: readText(arg('--closeout')),
  };
  process.stdout.write(`${JSON.stringify(scoreRubric(rubric, ctx), null, 2)}\n`);
}

if (require.main === module) cli();
module.exports = { evaluateCommand, scoreRubric, validateRubric, DEFAULT_RUBRIC };
