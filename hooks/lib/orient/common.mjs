// common.mjs — the budgets and text helpers every orientation section shares (KIT-T071).

import { existsSync, readFileSync } from 'node:fs';

export const COMMITS = 6;
export const SESSION_GIST_LINES = 6; // first lines of SESSION.md shown inline
export const DECISIONS_GIST_LINES = 5; // last N lines of legacy DECISIONS.md shown inline
export const DECISIONS_DIR_RECENT = 6; // ids shown from decisions/ directory
export const ROADMAP_GIST_LINES = 8; // first lines of ROADMAP.md shown inline
export const ORIENT_DOING_STALE_MS = 2 * 60 * 60 * 1000; // a `doing` ticket with no update for this long is a zombie (KIT-T028)
export const ORIENT_TRAIL_LINES = 5; // antecedents shown per in-flight `doing` ticket (KIT-T048)
export const MENTIONS_SHOWN = 3; // unread @mentions listed inline before the pointer (KIT-T130)
export const LINE_MAX = 120; // clip for any one free-text line (commit subject, mention, ticket title)
export const INFLIGHT_SHOWN = 5; // in-flight (doing/review) tickets listed inline; the rest behind `q open`
export const TRAILS_SHOWN = 2; // `doing` tickets that get an antecedent trail inline
export const WIP_FILES_SHOWN = 8; // uncommitted files listed per repo before "+N more"
export const WIP_COMMITS_SHOWN = 5; // unpushed commits listed per repo
export const CODEX = Boolean(process.env.PLUGIN_ROOT);

export const firstExisting = (...c) => c.find((f) => existsSync(f)) || null;

export const head = (f, n) => {
  try {
    return readFileSync(f, 'utf8').split('\n').slice(0, n).join('\n');
  } catch {
    return '';
  }
};

export const tail = (f, n) => {
  try {
    const l = readFileSync(f, 'utf8').split('\n');
    return l.slice(Math.max(0, l.length - n)).join('\n');
  } catch {
    return '';
  }
};

export const lineCount = (f) => {
  try { return readFileSync(f, 'utf8').split('\n').length; } catch { return 0; }
};

export const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
