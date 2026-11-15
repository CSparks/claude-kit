// batch-refusal.mjs — an edit batch lands whole or not at all (KIT-T1281). An agent edits a crate in a batch (one message, many
// Edit calls). When the write guard refuses one of them because another writer's build is compiling the crate, the rest of the
// batch must not slip through after that build ends: half a change (a trait method refused, its users written) leaves the crate
// uncompilable for everyone. The first refusal opens a short marker for the writer on the held scope; every later edit by the
// same writer inside that scope is refused too until the marker lapses or the writer's `builds --wait` returns free.
//
//   noteBatchRefusal({ file, writer, scope, now? })   -> record   the writer's marker on `scope` (refreshed only by a build hold)
//   refusedEarlierInBatch({ file, writer, now? })     -> record | null   the writer's live marker whose scope holds `file`
//   closeBatchRefusals({ writer })                    -> void     the writer's markers end (its wait returned free)
// Markers live as `<hash>.json` under the build-slot directory's `batch-refusals/`; they are no build-start window
// (write-window.mjs), so they never hold another writer's build.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inScope } from './cargo-scope-dirs.mjs';
import { slotDir } from './build-slot-store.mjs';

export const BATCH_REFUSAL_S = 30;
const MS_PER_SECOND = 1000;
const HASH_CHARS = 16;

const dir = () => join(slotDir(), 'batch-refusals');
const pathOf = (writer, key) => join(dir(), `${createHash('sha1').update(`${writer}|${key}`).digest('hex').slice(0, HASH_CHARS)}.json`);
const read = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } };

function live(now) {
  mkdirSync(dir(), { recursive: true });
  return readdirSync(dir()).flatMap((name) => {
    const path = join(dir(), name);
    const rec = read(path);
    if (rec && rec.until > now) return [rec];
    rmSync(path, { force: true });
    return [];
  });
}

export function noteBatchRefusal({ file, writer = '', scope = [], now = Date.now() }) {
  if (!writer || !scope.length) return null;
  mkdirSync(dir(), { recursive: true });
  const rec = { file, writer, scope, ts: new Date(now).toISOString(), until: now + BATCH_REFUSAL_S * MS_PER_SECOND };
  writeFileSync(pathOf(writer, scope.join('|')), JSON.stringify(rec));
  return rec;
}

export const refusedEarlierInBatch = ({ file, writer = '', now = Date.now() }) => (writer ? live(now).find((r) => r.writer === writer && inScope(file, r.scope)) || null : null);

export function closeBatchRefusals({ writer = '' }) {
  if (!writer) return;
  mkdirSync(dir(), { recursive: true });
  for (const name of readdirSync(dir()).filter((n) => n.endsWith('.json'))) {
    const path = join(dir(), name);
    if (read(path)?.writer === writer) rmSync(path, { force: true });
  }
}
