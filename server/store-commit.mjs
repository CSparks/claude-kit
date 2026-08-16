// Auto-commit for API markdown writes (KIT-T160). A UI write lands in the markdown truth, and
// markdown truth includes git (KIT-D044) — without this the write sits machine-local until some
// session happens to commit it.
//
// Contract:
//   scheduleStoreCommit(storeDir, label) — after a successful write, queue a debounced commit of
//     exactly that store's pathspec. Bursts coalesce into one commit per repo. Returns true when
//     queued, false when it no-ops (not a git repo, or the switch is off).
//   flushStoreCommits() — run every pending commit NOW; resolves when they are done (tests, shutdown).
// Never pushes: publishing from a web write is a policy call, not a side effect.
// Never throws: a git failure warns on stderr and leaves the API response alone.
// Disable with KIT_API_AUTOCOMMIT=0; window overridable with KIT_API_AUTOCOMMIT_DELAY_MS.

import { spawnSync } from 'node:child_process';
import { isDataRepo, DATA_PROJECTS_DIR } from '../hooks/data-repo.mjs';

const DEFAULT_DELAY_MS = 4000;
const NO_LOG_TOKEN = '[no-log: api write]';

const delayMs = () => {
  const raw = Number(process.env.KIT_API_AUTOCOMMIT_DELAY_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_DELAY_MS;
};

const enabled = () => process.env.KIT_API_AUTOCOMMIT !== '0';

function gitTry(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { ok: r.status === 0, out };
}

// Repo root + the pathspec every stage/commit is limited to. In the shared data repo that is the
// single `projects/<name>` subtree (KIT-T230: other sessions edit theirs concurrently); in a
// project repo it is the store dir itself. null when the dir is not inside a git repo.
function scopeOf(storeDir) {
  const top = gitTry(['rev-parse', '--show-toplevel'], storeDir);
  if (!top.ok) return null;
  const root = top.out.trim();
  const prefix = gitTry(['rev-parse', '--show-prefix'], storeDir);
  if (!prefix.ok) return null;
  const rel = prefix.out.trim().replace(/\/+$/, '');
  if (isDataRepo(root)) {
    const seg = rel.split('/');
    if (seg[0] === DATA_PROJECTS_DIR && seg[1]) return { root, pathspec: `${DATA_PROJECTS_DIR}/${seg[1]}` };
  }
  return { root, pathspec: rel || '.' };
}

const pending = new Map();

function subjectFor(labels) {
  const head = labels.length === 1 ? labels[0] : `${labels.length} api writes`;
  return `ui: ${head} ${NO_LOG_TOKEN}`;
}

function commitNow(entry) {
  const { root, pathspec, labels } = entry;
  const spec = ['--', pathspec];
  const staged = gitTry(['add', ...spec], root);
  if (!staged.ok) {
    process.stderr.write(`[api] auto-commit stage failed in ${root}: ${staged.out.trim()}\n`);
    return;
  }
  if (!gitTry(['status', '--porcelain', ...spec], root).out.trim()) return;
  const commit = gitTry(['commit', '-m', subjectFor(labels), ...spec], root);
  if (!commit.ok) process.stderr.write(`[api] auto-commit failed in ${root}: ${commit.out.trim()}\n`);
}

function run(key) {
  const entry = pending.get(key);
  if (!entry) return;
  pending.delete(key);
  if (entry.timer) clearTimeout(entry.timer);
  try {
    commitNow(entry);
  } catch (e) {
    process.stderr.write(`[api] auto-commit errored: ${(e && e.message) || e}\n`);
  }
}

export function scheduleStoreCommit(storeDir, label) {
  if (!enabled() || !storeDir) return false;
  let scope = null;
  try {
    scope = scopeOf(storeDir);
  } catch {
    return false;
  }
  if (!scope) return false;
  const key = `${scope.root}::${scope.pathspec}`;
  const entry = pending.get(key) || { ...scope, labels: [], timer: null };
  entry.labels.push(String(label || 'store write'));
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => run(key), delayMs());
  if (typeof entry.timer.unref === 'function') entry.timer.unref();
  pending.set(key, entry);
  return true;
}

export async function flushStoreCommits() {
  for (const key of [...pending.keys()]) run(key);
}
