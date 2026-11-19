// write-window.mjs — a short window in which one writer's refused or released edit goes ahead of the next build start
// (KIT-T1175). A build hold refuses another writer's edit into its scope (hooks/lib/build-write-hold.mjs); a writer whose
// edit was refused, or whose `builds --wait` returned free, then needs a few seconds to land that edit. A build that
// starts inside those seconds would hold the file again, and back-to-back builds of one writer would starve the other.
// A build about to take its hold waits, up to START_WAIT_S, while another writer's window covers its scope.
// A writer's edits come in batches: an edit that lands while the writer holds a window does not end it, it shortens it to
// EDIT_GAP_S past that edit, so the next edit of the batch (any file of the crate) lands before a build can take the scope
// (KIT-T1219). While an edit the guard passed is still on its way to landing, the writer's windows stay open at least
// IN_FLIGHT_S (KIT-T1404). A writer with no window opens none by editing.
//
//   openWindow({ file, writer, seconds, kind, now? })  -> record   a window on `file` for `writer`, `seconds` long
//   closeWindow({ file, writer })                       -> void     the writer's window on `file` ends at once
//   holdWindowsInFlight({ writer, seconds?, now? })     -> void     an edit of the writer passed the guard: its live windows end
//                                                                   no sooner than IN_FLIGHT_S from now, until the batch has
//                                                                   spent BATCH_IDLE_S write-idle, never past BATCH_CEILING_S
//                                                                   after its first edit (batchStart)
// A window holds a crate, not one file: a build waits while a window's file lies in its scope, and a build's scope is the
// packages it compiles with their dependencies (cargo-scope-dirs.mjs), so a dependent's build waits too.
//   settleWindows({ file, writer, seconds?, now? })     -> void     the writer's edit of `file` landed: every live window of the
//                                                                   writer now ends EDIT_GAP_S later, and `file` gains one
//   windowFor({ file, now? })                           -> record | null   the newest live window on `file`
//   blockingWindows({ scope, writer, now? })            -> [record] live windows of OTHER writers on a file inside `scope`
//   waitOutWindows({ scope, writer, capS?, onWait?, sleep?, now? }) -> { waitedMs, window }
//     blocks until no other writer's window covers `scope` or START_WAIT_S passes; `window` is the one waited on last
// Windows live as `<hash>.json` under the build-slot directory's `windows/` (build-slot-store.mjs).

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inScope } from './cargo-scope-dirs.mjs';
import { slotDir } from './build-slot-store.mjs';
import { toPath } from '../../hooks/lib/shell-segments.mjs';
import { LONG_LIMIT_MS } from '../../hooks/lib/hook-limits.mjs';

export const REFUSED_WINDOW_S = 10;
export const FREE_WINDOW_S = 90;
export const EDIT_GAP_S = 30;
// One edit's hooks run up to the PreToolUse limit, then the PostToolUse limit, before it lands.
export const IN_FLIGHT_S = (2 * LONG_LIMIT_MS) / 1000;
// A batch keeps the writer's windows while it spends at most BATCH_IDLE_S write-idle (between an edit landing and the guard
// passing the next) and never past BATCH_CEILING_S from its first edit (KIT-T1408, KIT-T1425); time an edit spends in its
// hooks is not idle. A build start waits long enough for such a batch to land and settle, never longer.
export const BATCH_IDLE_S = 120;
export const BATCH_CEILING_S = 600;
export const START_WAIT_S = BATCH_CEILING_S + EDIT_GAP_S;
export const KIND = { REFUSED: 'refused', FREE: 'free', SETTLE: 'settle' };
const MS_PER_SECOND = 1000;
const POLL_MS = 250;
const HASH_CHARS = 16;
const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const windowsDir = () => join(slotDir(), 'windows');
const normalized = (file) => resolve(toPath(file)).replace(/\\/g, '/');
const fileKey = (file) => normalized(file).toLowerCase();
const pathOf = (file, writer) => join(windowsDir(), `${createHash('sha1').update(`${fileKey(file)}|${writer}`).digest('hex').slice(0, HASH_CHARS)}.json`);

function read(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function liveWindows(now) {
  mkdirSync(windowsDir(), { recursive: true });
  return readdirSync(windowsDir()).flatMap((name) => {
    const path = join(windowsDir(), name);
    const rec = read(path);
    if (rec && rec.until > now) return [rec];
    rmSync(path, { force: true });
    return [];
  });
}

export function openWindow({ file, writer = '', seconds, kind, now = Date.now() }) {
  mkdirSync(windowsDir(), { recursive: true });
  const rec = { file: normalized(file), writer, kind, ts: new Date(now).toISOString(), until: now + seconds * MS_PER_SECOND };
  writeFileSync(pathOf(file, writer), JSON.stringify(rec));
  return rec;
}

export const closeWindow = ({ file, writer = '' }) => rmSync(pathOf(file, writer), { force: true });

const ceilingOf = (w, now) => (w.batchStart ?? now) + BATCH_CEILING_S * MS_PER_SECOND;

// An edit the guard let through but that has not landed yet keeps every live window of its writer open at least
// IN_FLIGHT_S, never shorter (KIT-T1404): an edit can spend minutes in its hooks before it lands. The gap since the last
// landing counts toward the batch's idle budget; once BATCH_IDLE_S is spent, an edit in flight extends nothing.
export function holdWindowsInFlight({ writer = '', seconds = IN_FLIGHT_S, now = Date.now() }) {
  for (const w of liveWindows(now).filter((rec) => rec.writer === writer)) {
    const batchStart = w.batchStart ?? now;
    const idleMs = (w.idleMs ?? 0) + (Number.isFinite(w.idleSince) ? Math.max(0, now - w.idleSince) : 0);
    const spent = idleMs >= BATCH_IDLE_S * MS_PER_SECOND;
    const until = spent ? w.until : Math.max(w.until, Math.min(now + seconds * MS_PER_SECOND, ceilingOf({ batchStart }, now)));
    writeFileSync(pathOf(w.file, writer), JSON.stringify({ ...w, batchStart, idleMs, idleSince: null, until }));
  }
}

// The writer's edit of `file` landed (or failed): its write-idle clock starts, and every window ends EDIT_GAP_S later,
// never past the batch ceiling.
export function settleWindows({ file, writer = '', seconds = EDIT_GAP_S, now = Date.now() }) {
  const mine = liveWindows(now).filter((w) => w.writer === writer);
  if (!mine.length) return;
  const settled = (w) => ({ ...w, idleSince: now, until: Math.min(now + seconds * MS_PER_SECOND, ceilingOf(w, now)) });
  for (const w of mine) writeFileSync(pathOf(w.file, writer), JSON.stringify(settled(w)));
  if (mine.some((w) => fileKey(w.file) === fileKey(file))) return;
  const starts = mine.map((w) => w.batchStart).filter(Number.isFinite);
  const batch = starts.length ? { batchStart: Math.min(...starts), idleMs: Math.max(...mine.map((w) => w.idleMs ?? 0)) } : {};
  const rec = { ...openWindow({ file, writer, seconds, kind: KIND.SETTLE, now }), ...batch };
  writeFileSync(pathOf(file, writer), JSON.stringify(settled(rec)));
}

export function windowFor({ file, now = Date.now() }) {
  const key = fileKey(file);
  return liveWindows(now).filter((w) => fileKey(w.file) === key).sort((a, b) => String(b.ts).localeCompare(String(a.ts)))[0] || null;
}

export const blockingWindows = ({ scope, writer = '', now = Date.now() }) => liveWindows(now).filter((w) => w.writer !== writer && inScope(w.file, scope));

export function waitOutWindows({ scope, writer = '', capS = START_WAIT_S, onWait = () => {}, sleep = sleepMs, now = Date.now }) {
  const begun = now();
  let last = null;
  for (;;) {
    const blocking = blockingWindows({ scope, writer, now: now() });
    if (!blocking.length) return { waitedMs: now() - begun, window: last };
    if (now() - begun >= capS * MS_PER_SECOND) return { waitedMs: now() - begun, window: last };
    if (!last) onWait(blocking[0]);
    last = blocking[0];
    sleep(POLL_MS);
  }
}
