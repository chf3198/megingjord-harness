// #2772 — opt-in OS-keychain source: precedence (export > keychain > .env), graceful fallback,
// offline (local CLI), and default-off (pure .env, unchanged).
const { test, expect } = require('@playwright/test');
const { keychainProvider, readFromKeychain, getSecret, PROVIDERS } = require('../scripts/global/keychain-source');

// a stub exec that returns a canned value for a given name, or throws (CLI absent)
function stubExec(map) {
  return (cmd, args) => {
    const name = args[args.length - 1].replace(/^op:\/\/[^/]+\//, ''); // last arg = name (op uses a ref)
    if (name in map) return map[name] + '\n';
    const err = new Error('not found'); err.status = 1; throw err;
  };
}

test('default-off: no MEGINGJORD_KEYCHAIN -> provider null, getSecret returns the .env value only', () => {
  const env = { OPENAI_API_KEY: 'from_dotenv' };
  expect(keychainProvider(env)).toBe(null);
  expect(getSecret('OPENAI_API_KEY', { env })).toBe('from_dotenv');
  expect(getSecret('MISSING', { env })).toBe(null);
});

test('opt-in: a configured provider is recognized', () => {
  expect(keychainProvider({ MEGINGJORD_KEYCHAIN: 'op' })).toBe('op');
  expect(keychainProvider({ MEGINGJORD_KEYCHAIN: 'libsecret' })).toBe('libsecret');
  expect(keychainProvider({ MEGINGJORD_KEYCHAIN: 'macos' })).toBe('macos');
  expect(keychainProvider({ MEGINGJORD_KEYCHAIN: 'bogus' })).toBe(null);
});

test('keychain preferred over .env when configured and the key is present there', () => {
  const env = { MEGINGJORD_KEYCHAIN: 'op', K: 'from_dotenv' };
  const filled = new Set(['K']); // K came from .env, so keychain should win
  const value = getSecret('K', { env, dotenvFilled: filled, exec: stubExec({ K: 'from_keychain' }) });
  expect(value).toBe('from_keychain');
});

test('explicit export wins over keychain (not a .env-filled key)', () => {
  const env = { MEGINGJORD_KEYCHAIN: 'op', K: 'explicit_export' };
  const value = getSecret('K', { env, dotenvFilled: new Set(), exec: stubExec({ K: 'from_keychain' }) });
  expect(value).toBe('explicit_export');
});

test('graceful: provider CLI absent/errors -> falls back to the .env value, never throws', () => {
  const env = { MEGINGJORD_KEYCHAIN: 'op', K: 'from_dotenv' };
  const filled = new Set(['K']);
  const throwingExec = () => { throw Object.assign(new Error('command not found'), { code: 'ENOENT' }); };
  expect(getSecret('K', { env, dotenvFilled: filled, exec: throwingExec })).toBe('from_dotenv');
});

test('readFromKeychain returns null (not throw) when the provider CLI is absent', () => {
  const env = { MEGINGJORD_KEYCHAIN: 'libsecret' };
  const throwingExec = () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); };
  expect(readFromKeychain('ANY', { env, exec: throwingExec })).toBe(null);
});

test('offline: every provider argv is a LOCAL CLI (no URL / network host)', () => {
  for (const build of Object.values(PROVIDERS)) {
    const [cmd, args] = build('NAME', 'svc');
    expect(['security', 'secret-tool', 'op']).toContain(cmd);
    expect(args.join(' ')).not.toMatch(/https?:\/\//);
  }
});

test('integration via the shim: getCredential resolves keychain over .env (opt-in)', () => {
  // Fresh module instance so its dotenvFilled set is empty and the env flag is read live.
  delete require.cache[require.resolve('../scripts/global/load-local-env')];
  delete require.cache[require.resolve('../scripts/global/keychain-source')];
  const shim = require('../scripts/global/load-local-env');
  const prev = { K: process.env.K, KC: process.env.MEGINGJORD_KEYCHAIN };
  process.env.MEGINGJORD_KEYCHAIN = ''; // off -> falls through to process.env
  process.env.K = 'plain';
  expect(shim.getCredential('K')).toBe('plain');
  if (prev.K === undefined) delete process.env.K; else process.env.K = prev.K;
  if (prev.KC === undefined) delete process.env.MEGINGJORD_KEYCHAIN; else process.env.MEGINGJORD_KEYCHAIN = prev.KC;
});
