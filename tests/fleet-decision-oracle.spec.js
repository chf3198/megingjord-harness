const test = require('node:test');
const assert = require('node:assert');
const {
  decideOnce, parseVerdict, pickModel, timeoutFor,
  FAST_MODEL, SLOW_MODEL,
} = require('../scripts/global/fleet-decision-oracle');

test('pickModel: fast tier explicit', () => {
  assert.strictEqual(pickModel({ tier: 'fast' }), FAST_MODEL);
});

test('pickModel: high-stakes tier explicit', () => {
  assert.strictEqual(pickModel({ tier: 'high-stakes' }), SLOW_MODEL);
});

test('pickModel: default routes by question length', () => {
  assert.strictEqual(pickModel({ question: 'short q?' }), FAST_MODEL);
  assert.strictEqual(pickModel({ question: 'x'.repeat(2000) }), SLOW_MODEL);
});

test('timeoutFor: slow model gets longer timeout', () => {
  assert.ok(timeoutFor(SLOW_MODEL) > timeoutFor(FAST_MODEL));
});

test('parseVerdict: yes/approve normalize to approve', () => {
  assert.strictEqual(parseVerdict('VERDICT: yes').verdict, 'approve');
  assert.strictEqual(parseVerdict('VERDICT: approve - rationale').verdict, 'approve');
});

test('parseVerdict: no/reject normalize to reject', () => {
  assert.strictEqual(parseVerdict('VERDICT: no').verdict, 'reject');
  assert.strictEqual(parseVerdict('reject the proposal').verdict, 'reject');
});

test('parseVerdict: partial/revise normalize to partial', () => {
  assert.strictEqual(parseVerdict('VERDICT: partial').verdict, 'partial');
  assert.strictEqual(parseVerdict('revise then accept').verdict, 'partial');
});

test('parseVerdict: empty returns inconclusive', () => {
  assert.strictEqual(parseVerdict('').verdict, 'inconclusive');
  assert.strictEqual(parseVerdict(null).verdict, 'inconclusive');
});

test('parseVerdict: no verdict word returns inconclusive', () => {
  assert.strictEqual(parseVerdict('this is just text without an answer').verdict, 'inconclusive');
});

test('decideOnce: returns inconclusive + escalate when fleet unreachable', async () => {
  const mockHttp = {
    request(opts, cb) {
      const req = {
        on(evt, handler) { if (evt === 'error') setImmediate(() => handler(new Error('network'))); return req; },
        write() {}, end() {}, destroy() {},
      };
      return req;
    },
  };
  const result = await decideOnce('Should I do X?', { httpImpl: mockHttp });
  assert.strictEqual(result.verdict, 'inconclusive');
  assert.strictEqual(result.escalate_to_client, true);
  assert.match(result.rationale, /network/);
});

test('decideOnce: returns parsed verdict when fleet responds', async () => {
  const mockHttp = {
    request(opts, cb) {
      const res = {
        _handlers: {},
        on(evt, h) { this._handlers[evt] = h; return this; },
      };
      setImmediate(() => {
        cb(res);
        setImmediate(() => {
          res._handlers.data(JSON.stringify({ response: 'VERDICT: yes\nRATIONALE: looks good' }));
          res._handlers.end();
        });
      });
      const req = {
        on(evt, handler) { return req; },
        write() {}, end() {}, destroy() {},
      };
      return req;
    },
  };
  const result = await decideOnce('Should I do X?', { httpImpl: mockHttp });
  assert.strictEqual(result.verdict, 'approve');
  assert.strictEqual(result.escalate_to_client, false);
});
