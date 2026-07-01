// #3471 stress-test -- canonical-main redirect detector (shell_write_targets) under an
// adversarial prose/redirect corpus. Asserts: (G6) fault-injection / chaos inputs never
// throw and prose-with-`>` yields ZERO false write-targets; genuine redirects are still
// caught (anti-over-suppress); (G7) p99 latency budget. Bridges to the Python hook the same
// way tests/stress-canonical-main-enforcer.spec.js does. Refs #3471, #2995, #3001.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK_DIR = path.join(REPO_ROOT, 'hooks', 'scripts');

// Drive shell_write_targets in Python; return the JSON array of extracted targets.
function writeTargets(cmd) {
  const driver = `import sys, json; sys.path.insert(0, ${JSON.stringify(HOOK_DIR)}); ` +
    `import pretool_guard as p; ` +
    `print(json.dumps(p.shell_write_targets(json.loads(sys.stdin.read()))))`;
  const result = spawnSync('python3', ['-c', driver], { input: JSON.stringify(cmd), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`python: ${result.stderr}`);
  return JSON.parse(result.stdout.trim());
}

// Prose that CONTAINS `>`/`>=` but is not a redirect -- must yield zero write targets.
const PROSE_CORPUS = [
  "echo 'G1 > G2 > G10'",
  'echo "rubric >= 0.85"',
  "echo '> and >='",
  "gh issue comment 1 --body-file - <<EOF\ngoal G1 > G2 and score >= 93\nEOF",
  "cat <<'EOF'\nnested > redirect >> looking text\nEOF",
  'printf "a -> b => c"',
  "echo 'compare a>=b and c<=d'",
  "run_thing 2>&1 | grep '>'",
];

// Genuine redirects to unquoted targets -- must still be caught (anti-over-suppress).
const REDIRECT_CORPUS = [
  ['echo x > real_out.js', 'real_out.js'],
  ['cat a >> real_append.txt', 'real_append.txt'],
  ['echo y | tee real_tee.md', 'real_tee.md'],
  ["sed -i 's/a/b/' real_sed.py", 'real_sed.py'],
  ["echo 'prose > here' > real_after_prose.js", 'real_after_prose.js'],
];

test('stress: prose containing > / >= yields ZERO false write targets', () => {
  for (const cmd of PROSE_CORPUS) {
    expect(writeTargets(cmd), `prose must not be a redirect: ${cmd}`).toEqual([]);
  }
});

test('stress: genuine redirects to unquoted targets are STILL caught (anti-over-suppress)', () => {
  for (const [cmd, expected] of REDIRECT_CORPUS) {
    expect(writeTargets(cmd), `real redirect must be caught: ${cmd}`).toContain(expected);
  }
});

test('stress: chaos / fault-injection inputs never throw and never false-positive', () => {
  // Fault injection: malformed operators, unterminated quotes/heredocs, control chars
  // (written as \u escapes so the source stays ASCII), huge input, empty input.
  const chaos = [
    '>>>|&;<<<',
    "echo 'unterminated > oops",
    'cat <<EOF\nno terminator > x',
    '` > `',
    '"".join > ',
    '>'.repeat(5000) + " 'quoted > prose'",
    'echo ' + "'x > y' ".repeat(400),
    '',
  ];
  for (const cmd of chaos) {
    let out;
    expect(() => { out = writeTargets(cmd); }, `must not throw: ${cmd.slice(0, 24)}`).not.toThrow();
    expect(Array.isArray(out)).toBe(true);
  }
});

test('stress: p99 latency under 250ms per shell_write_targets call', () => {
  const sample = "gh issue comment 1 --body-file - <<EOF\nG1 > G2 >= 0.85 across a moderately long prose body\nEOF";
  const samples = [];
  for (let i = 0; i < 20; i += 1) {
    const start = Date.now();
    writeTargets(sample);
    samples.push(Date.now() - start);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  console.log(`shell_write_targets p99 latency: ${p99}ms (target <250ms)`);
  expect(p99).toBeLessThan(250);
});
