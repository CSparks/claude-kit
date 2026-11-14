// write-window.mjs — a short window in which one writer's refused or released edit goes ahead of the next build start
// (KIT-T1175). A build hold refuses another writer's edit into its scope (hooks/lib/build-write-hold.mjs); a writer whose
// edit was refused, or whose `builds --wait` returned free, then needs a few seconds to land that edit. A build that
// starts inside those seconds would hold the file again, and back-to-back builds of one writer would starve the other.
// A build about to take its hold waits, up to START_WAIT_S, while another writer's window covers its scope.
//
//   openWindow({ file, writer, seconds, kind, now? })  -> record   a window on `file` for `writer`, `seconds` long
//   closeWindow({ file, writer })                       -> void     the writer's edit of `file` landed: its window ends
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

export const REFUSED_WINDOW_S = 10;
export const FREE_WINDOW_S = 90;
export const START_WAIT_S = 90;
export const KIND = { REFUSED: 'refused', FREE: 'free' };
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
