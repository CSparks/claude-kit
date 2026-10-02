// q-server-session.mjs — one resident code index for one root (KIT-T290): the SQLite handle
// held open plus a recursive file watcher that says whether anything may have changed.
//
// Freshness is exact, not timed. index() first writes a uniquely named barrier file inside the
// git dir and waits for the watcher to report it; the OS delivers a watcher's events in order,
// so every edit made before the call has been reported by then. A reported edit marks the
// session dirty and the next index() runs the normal git-signalled refresh; a clean session
// answers from memory with no git call. start() throws when the root cannot be watched that
// way (not a git checkout, git dir outside the root, no recursive watch, no SQLite engine);
// the caller then answers in-process.

import { readFileSync, statSync, unlinkSync, watch, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { openIndex, refreshIndex } from './code-index.mjs';

const BARRIER_MS = 1500;
const GIT_SEGMENT = '.git';

function gitDirOf(root) {
  const dot = join(root, GIT_SEGMENT);
  if (statSync(dot).isDirectory()) return dot;
  const m = /^gitdir:\s*(.+)$/m.exec(readFileSync(dot, 'utf8'));
  const dir = m && resolve(root, m[1].trim());
  const rel = dir && relative(root, dir);
  if (!dir || rel.startsWith('..') || isAbsolute(rel)) throw new Error('git dir outside the watched root');
  return dir;
}

export class Session {
  constructor(root) {
    this.root = root;
    this.dirty = true;
    this.last = null;
    this.seq = 0;
    this.waiting = new Map();
    this.onGone = () => {};
  }

  async start() {
    this.gitDir = gitDirOf(this.root);
    this.db = await openIndex(this.root);
    if (!this.db) throw new Error('no SQLite engine');
    this.watcher = watch(this.root, { recursive: true }, (_type, name) => this.#event(name));
    this.watcher.on('error', () => { this.close(); this.onGone(); });
    return this;
  }

  #event(name) {
    const segments = String(name || '').split(/[\\/]/);
    if (segments[0] === GIT_SEGMENT) {
      const wake = this.waiting.get(basename(segments[segments.length - 1]));
      if (wake) wake();
      return;
    }
    if (!segments.includes(GIT_SEGMENT)) this.dirty = true;
  }

  async #barrier() {
    const name = `ckq-barrier-${process.pid}-${++this.seq}`;
    let timer;
    const seen = new Promise((resolveSeen) => {
      this.waiting.set(name, () => resolveSeen(true));
      timer = setTimeout(() => resolveSeen(false), BARRIER_MS);
    });
    const file = join(this.gitDir, name);
    writeFileSync(file, '');
    const reported = await seen;
    clearTimeout(timer);
    this.waiting.delete(name);
    try { unlinkSync(file); } catch { /* already gone */ }
    if (!reported) this.dirty = true;
  }

  /** The refreshed index for a query; `tickets` queries always refresh (the work stores sit outside the watch). */
  async index({ tickets = true } = {}) {
    await this.#barrier();
    if (this.last && !this.dirty && !tickets) return this.last;
    this.dirty = false;
    this.last = await refreshIndex(this.root, { tickets, db: this.db });
    return this.last;
  }

  close() {
    try { this.watcher?.close(); } catch { /* closed */ }
    try { this.db?.close(); } catch { /* closed */ }
    this.watcher = null;
    this.db = null;
  }
}
