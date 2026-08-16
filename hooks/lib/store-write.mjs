// Write-through item file primitive (KIT-T096): write the file, then hydrate that item's
// store into the SQLite cache synchronously at the mutation site — never deferred to Stop
// or startup. The file write always succeeds and is NEVER inside the hydrate try/catch.
// Fail-open on the hydrate only: a missing engine or any runtime error degrades to the
// markdown fallback and is logged to stderr. No-ops the hydrate cleanly when the path is
// not under a managed .ai/ store or no SQLite engine exists.

import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { storeRoot } from './paths.mjs';

export async function writeItemFile(absFile, content) {
  writeFileSync(absFile, content); // always; never inside the hydrate guard
  const root = storeRoot(dirname(absFile));
  if (!root) return; // not under a managed .ai/ store — nothing to hydrate
  try {
    const { hydrate } = await import('../../scripts/hydrate-db.mjs');
    await hydrate({ root }); // incremental manifest-diff; NOT ifStale
  } catch (e) {
    process.stderr.write(
      `writeItemFile: hydrate failed for ${absFile} — cache may be stale (${e && e.message ? e.message : e})\n`,
    );
  }
}
