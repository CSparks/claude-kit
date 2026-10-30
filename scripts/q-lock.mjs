// q-lock.mjs — bounded wait-and-retry for SQLite lock contention on q's read path (KIT-T487).
//
// A reader that finds the store locked by another q or session waits (SQLite busy_timeout on
// the handle, plus this backoff around the steps SQLite cannot wait inside: opening and the
// stale-cache rehydrate). Past the timeout it fails with a message that names the cause.

const DEFAULT_TIMEOUT_MS = 10000;
const FIRST_DELAY_MS = 25;
const MAX_DELAY_MS = 400;
const LOCKED = /database is locked|SQLITE_BUSY|SQLITE_LOCKED/i;

/** Lock-wait budget in ms; CLAUDE_KIT_Q_LOCK_TIMEOUT_MS overrides the default. */
export function lockTimeoutMs() {
  const raw = process.env.CLAUDE_KIT_Q_LOCK_TIMEOUT_MS;
  const n = Number(raw);
  return raw && Number.isFinite(n) && n >= 0 ? n : DEFAULT_TIMEOUT_MS;
}

export function isLockError(e) {
  return LOCKED.test(`${(e && e.code) || ''} ${(e && e.message) || e}`);
}

/** Run `fn` (sync or async), retrying lock errors with doubling backoff until the budget is spent. */
export async function withLockRetry(fn, timeoutMs = lockTimeoutMs()) {
  const deadline = Date.now() + timeoutMs;
  let delay = FIRST_DELAY_MS;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (!isLockError(e)) throw e;
      if (Date.now() + delay > deadline) {
        throw new Error(`database is locked — another q or session held the store for over ${timeoutMs}ms; retry shortly, or raise CLAUDE_KIT_Q_LOCK_TIMEOUT_MS.`);
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, MAX_DELAY_MS);
    }
  }
}
