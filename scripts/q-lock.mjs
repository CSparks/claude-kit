// q-lock.mjs — bounded wait-and-retry for SQLite lock contention on q's read path (KIT-T487).
//
// A reader that finds the store locked by another q or session waits (SQLite busy_timeout on
// the handle, plus this backoff around the steps SQLite cannot wait inside: opening and the
// stale-cache rehydrate). Past the timeout it fails with a message that names the cause. A
// stale-cache rehydrate is the one wait a read does not sit out: see refreshOrServeSnapshot.

const DEFAULT_TIMEOUT_MS = 10000;
const REFRESH_WAIT_MS = 750;
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

/** One stderr line for a read answered from a cache another session is still rewriting. */
export const STALE_SNAPSHOT_NOTE = 'q: another session is rehydrating the cache — answered from its last snapshot; very recent edits may be missing.\n';

/**
 * Bring a stale cache up to date without making a read wait on a writer (KIT-T1042). The refresh
 * waits at most REFRESH_WAIT_MS for the write lock; past that a read of an existing cache goes on
 * from its WAL snapshot (readers never take the write lock) and this returns true. With no cache
 * to read the refresh keeps the full budget. Resolves false when the refresh ran.
 */
export async function refreshOrServeSnapshot(refresh, haveCache) {
  const total = lockTimeoutMs();
  try {
    await withLockRetry(refresh, haveCache ? Math.min(REFRESH_WAIT_MS, total) : total);
    return false;
  } catch (e) {
    if (haveCache && isLockError(e)) return true;
    throw e;
  }
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
