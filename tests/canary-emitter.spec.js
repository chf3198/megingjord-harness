// canary-emitter.spec.js -- Tests for the security-surface lane canary/auto-rollback emitter.
// Refs #3795, Epic #3789. AC2 (events + metrics schema + rollback predicate). tdd-pyramid.
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ce = require('../scripts/global/canary-emitter');
const { isValidV3 } = require('../scripts/global/event-schema-v3');

describe('canary-emitter', () => {
  let file;
  beforeEach(() => { file = path.join(os.tmpdir(), `canary-${process.pid}-${process.hrtime.bigint()}.jsonl`); });
  afterEach(() => { try { fs.unlinkSync(file); } catch { /* best-effort temp cleanup */ } });

  describe('rollbackPredicate (AC2 rollback signal)', () => {
    it('breaches when a metric exceeds its threshold', () => {
      const r = ce.rollbackPredicate({ error_rate: 0.5 });
      assert.equal(r.breach, true);
      assert.match(r.signal, /error_rate>/);
    });
    it('does not breach when all metrics are within budget', () => {
      const r = ce.rollbackPredicate({ error_rate: 0.001, auth_reject_rate: 0.01, latency_p99_ms: 100 });
      assert.deepEqual(r, { breach: false, signal: null });
    });
    it('honours overridden thresholds', () => {
      assert.equal(ce.rollbackPredicate({ error_rate: 0.03 }, { error_rate: 0.5 }).breach, false);
    });
    it('exposes a fixed canary-metrics schema', () => {
      assert.deepEqual(ce.CANARY_METRICS_SCHEMA, ['error_rate', 'auth_reject_rate', 'latency_p99_ms', 'sample_count']);
    });
  });

  describe('event emission (AC2 event-schema-v3)', () => {
    it('emits a valid v3 event:merged-dark', () => {
      const ev = ce.emitMergedDark('MEGINGJORD_MCP_ADAPTER_ENABLED', file);
      assert.equal(ev.event, 'event:merged-dark');
      assert.equal(ev.version, 3);
      assert.equal(isValidV3(ev).ok, true);
      assert.equal(fs.readFileSync(file, 'utf8').trim().split('\n').length, 1);
    });
    it('emits event:canary-start with the scope', () => {
      const ev = ce.emitCanaryStart('F', 'copilot-session-class-A', file);
      assert.equal(ev.event, 'event:canary-start');
      assert.equal(ev.canary_scope, 'copilot-session-class-A');
    });
    it('rejects an unknown canary kind', () => {
      assert.throws(() => ce.emitCanaryEvent('bogus', {}, file), /unknown canary kind/);
    });
  });

  describe('evaluateAndEmit (AC2 auto-rollback vs promote)', () => {
    it('emits event:canary-rollback on a breach', () => {
      const ev = ce.evaluateAndEmit('F', { error_rate: 0.9 }, file);
      assert.equal(ev.event, 'event:canary-rollback');
      assert.match(ev.regression_signal, /error_rate>/);
    });
    it('emits event:canary-promote when clean', () => {
      const ev = ce.evaluateAndEmit('F', { error_rate: 0.001, auth_reject_rate: 0, latency_p99_ms: 50 }, file);
      assert.equal(ev.event, 'event:canary-promote');
      assert.equal(ev.regression_signal, null);
    });
  });
});
