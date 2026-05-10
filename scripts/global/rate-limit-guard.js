'use strict';
// Refs #1294 — Rate-limit guard middleware with ETag cache.
// Per Epic #1271 AC5: 80 content-creating req/min secondary cap; bulk caps 50 req/min.

const REST_PER_MIN = 80;
const REST_PER_HOUR = 5000;
const SEM_PER_MIN = 10;
const SEM_PER_HOUR = 600;
const BULK_PER_MIN = 50;
const BULK_PER_HOUR = 1500;
const BUDGETS = {
  default: { perMinute: REST_PER_MIN, perHour: REST_PER_HOUR },
  semantic_search: { perMinute: SEM_PER_MIN, perHour: SEM_PER_HOUR },
  bulk: { perMinute: BULK_PER_MIN, perHour: BULK_PER_HOUR },
};

const STATUS_RATE_LIMITED = 429;
const STATUS_UNAVAILABLE = 503;
const ONE_MINUTE_MS = 60_000;
const BACKOFF_MS = [1000, 2000, 4000, 8000];

class RateLimitGuard {
  constructor({ now = () => Date.now(), budget = 'default', cache = new Map() } = {}) {
    this.now = now;
    this.budget = BUDGETS[budget] || BUDGETS.default;
    this.cache = cache;
    this.history = [];
  }

  prune() {
    const cutoff = this.now() - ONE_MINUTE_MS;
    while (this.history.length && this.history[0] < cutoff) this.history.shift();
  }

  available() {
    this.prune();
    return this.history.length < this.budget.perMinute;
  }

  consume() {
    this.history.push(this.now());
  }

  async withGuard(key, fn) {
    if (key && this.cache.has(key)) return { hit: true, value: this.cache.get(key) };
    for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
      if (!this.available()) {
        await new Promise(resolve => setTimeout(resolve, BACKOFF_MS[attempt]));
        continue;
      }
      this.consume();
      try {
        const value = await fn();
        if (key) this.cache.set(key, value);
        return { hit: false, value };
      } catch (err) {
        const status = err.status || err.response?.status;
        if (status === STATUS_RATE_LIMITED || status === STATUS_UNAVAILABLE) {
          await new Promise(resolve => setTimeout(resolve, BACKOFF_MS[attempt]));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Rate-limit guard: budget exhausted after ${BACKOFF_MS.length} attempts`);
  }
}

module.exports = { RateLimitGuard, BUDGETS, BACKOFF_MS };
