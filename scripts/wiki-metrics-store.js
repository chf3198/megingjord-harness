const fs = require('fs'); const path = require('path');
const TMP_SUFFIX = '.tmp'; const LOCK_SUFFIX = '.lock';
const LOCK_WAIT_MS = 1; const STALE_MS = 5000;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function cleanupTempFiles(file) {
  const dir = path.dirname(file); if (!fs.existsSync(dir)) return;
  const prefix = path.basename(file) + TMP_SUFFIX;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(prefix)) fs.rmSync(path.join(dir, name), { force: true });
  }
}

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback(); }
}

function saveJsonAtomic(data, file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  cleanupTempFiles(file);
  const tmp = `${file}${TMP_SUFFIX}.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  if (process.env.WIKI_METRICS_EXIT_AFTER_TMP === file) process.kill(process.pid, 'SIGKILL');
  fs.renameSync(tmp, file);
  cleanupTempFiles(file);
}

function withFileLock(file, fn) {
  const lock = file + LOCK_SUFFIX;
  while (true) {
    try { fs.mkdirSync(lock); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > STALE_MS) fs.rmSync(lock, { recursive: true, force: true });
      } catch {}
      sleep(LOCK_WAIT_MS);
    }
  }
  try { return fn(); }
  finally { fs.rmSync(lock, { recursive: true, force: true }); }
}

module.exports = { loadJson, saveJsonAtomic, withFileLock };