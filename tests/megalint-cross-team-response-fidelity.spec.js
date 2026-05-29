const test = require('node:test');
const assert = require('node:assert');
const validator = require('../scripts/global/megalint/cross-team-response-fidelity.js');

function teamResponse({ fromTeam, signedBy, teamModel, role, header = '### TEAM_RESPONSE' }) {
  return {
    body: `${header}\n\n*   **from**: \`${fromTeam}\`\n*   **to**: Antigravity Team\n*   **verdict**: \`schema-valid\`\n*   **evidence**: ok.\n\nSigned-by: ${signedBy}\nTeam&Model: ${teamModel}\nRole: ${role}\n`,
    url: 'https://github.com/example/repo/issues/1#issuecomment-1',
  };
}

test('legitimate cross-team response from codex team passes', () => {
  const r = validator.validate({ comments: [teamResponse({
    fromTeam: 'codex', signedBy: 'Quill Vale', teamModel: 'codex:gpt-5.4@local', role: 'consultant',
  })]});
  assert.strictEqual(r.ok, true, JSON.stringify(r.violations));
});

test('round-2 forgery shape (claude-code response signed by antigravity operator) fails', () => {
  const r = validator.validate({ comments: [teamResponse({
    fromTeam: 'claude-code', signedBy: 'Apollo Vale', teamModel: 'antigravity:gemini-2.0-pro@google', role: 'consultant',
  })]});
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.some(v => v.rule === 'team-response-signer-team-mismatch'),
    `expected team-response-signer-team-mismatch, got ${JSON.stringify(r.violations)}`);
});

test('round-3 forgery shape (claude-code response signed AS Orla Vale but by antigravity context) - alias correct, team mismatch flagged', () => {
  const r = validator.validate({ comments: [teamResponse({
    fromTeam: 'claude-code', signedBy: 'Orla Vale', teamModel: 'antigravity:gemini-2.0-pro@google', role: 'consultant',
  })]});
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.some(v => v.rule === 'team-response-signer-team-mismatch'));
});

test('signer-alias-non-derived fires when alias text disagrees with registry-derived name', () => {
  const r = validator.validate({ comments: [teamResponse({
    fromTeam: 'codex', signedBy: 'Mystery Vale', teamModel: 'codex:gpt-5.4@local', role: 'consultant',
  })]});
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.some(v => v.rule === 'signer-alias-non-derived'),
    `expected signer-alias-non-derived, got ${JSON.stringify(r.violations)}`);
});

test('missing from field on TEAM_RESPONSE flagged', () => {
  const r = validator.validate({ comments: [{
    body: '### TEAM_RESPONSE\n\nverdict: schema-valid.\n\nSigned-by: Orla Vale\nTeam&Model: claude-code:opus-4-7@local\nRole: consultant\n',
  }]});
  assert.ok(r.violations.some(v => v.rule === 'missing-from-field'));
});

test('missing signing block on TEAM_RESPONSE flagged', () => {
  const r = validator.validate({ comments: [{
    body: '### TEAM_RESPONSE\n\nfrom: claude-code\nverdict: schema-valid.\n',
  }]});
  assert.ok(r.violations.some(v => v.rule === 'missing-signing-block'));
});

test('non-TEAM_RESPONSE artifacts are no-ops', () => {
  const r = validator.validate({ comments: [
    { body: '## MANAGER_HANDOFF\nscope: foo\nSigned-by: Orla Mason\nTeam&Model: claude-code:opus-4-7@local\nRole: manager\n' },
    { body: '## CONSULTANT_CLOSEOUT\nverdict: PASS\nSigned-by: Orla Vale\nTeam&Model: claude-code:opus-4-7@local\nRole: consultant\n' },
  ]});
  assert.strictEqual(r.ok, true);
});

test('legitimate cross-team response from claude-code team passes (opus seed = Orla)', () => {
  const r = validator.validate({ comments: [teamResponse({
    fromTeam: 'claude-code', signedBy: 'Orla Vale', teamModel: 'claude-code:opus-4-7@local', role: 'consultant',
  })]});
  assert.strictEqual(r.ok, true, JSON.stringify(r.violations));
});

test('legitimate antigravity self-response from antigravity team passes (apollo seed)', () => {
  const r = validator.validate({ comments: [teamResponse({
    fromTeam: 'antigravity', signedBy: 'Apollo Vale', teamModel: 'antigravity:gemini-2.0-pro@google', role: 'consultant',
  })]});
  assert.strictEqual(r.ok, true, JSON.stringify(r.violations));
});

test('actual round-3 #2360 forgery #15 reproduction (claude-code response signed Orla Vale on claude-code team) - this would pass because alias+team match', () => {
  // Note: this case demonstrates a LIMITATION of the alias-derivation check —
  // if the source team perfectly forges BOTH the alias AND the team-model string,
  // the validator cannot distinguish without cryptographic signing. This is the
  // residual gap that the Crypto-Signature optional fields in
  // team-model-signing.instructions.md address. The validator catches the common
  // case (signer team-model doesn't match from-team) which is the round-2 +
  // round-3 actual evidence; the perfect-forgery case requires crypto.
  const r = validator.validate({ comments: [teamResponse({
    fromTeam: 'claude-code', signedBy: 'Orla Vale', teamModel: 'claude-code:opus-4-7@local', role: 'consultant',
  })]});
  assert.strictEqual(r.ok, true);
});
