// isolate.mjs — the private state of one concurrently running test file (KIT-T570). Two files that
// share a SQLite cache, a code index, a registry, a turn-state dir or a temp dir race each other, so
// each file gets its own set under the run's scratch directory.
//
//   isolatedEnv(baseEnv, scratchRoot, file, attempt, { keepDefaults }) -> env for `node <file>`; the dirs exist.
//   keepDefaults leaves the DB, code-index and cache paths unset, for the files that assert the install's default locations.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UNSAFE = /[^A-Za-z0-9_-]/g;

export function isolatedEnv(baseEnv, scratchRoot, file, attempt = 1, { keepDefaults = false } = {}) {
  const dir = join(scratchRoot, `${file.replace(UNSAFE, '_')}.${attempt}`);
  const tmp = join(dir, 'tmp');
  mkdirSync(tmp, { recursive: true });
  const registry = join(dir, 'registry.json');
  writeFileSync(registry, '{}\n');
  const stores = keepDefaults ? {} : {
    CLAUDE_KIT_DB: join(dir, 'kit.sqlite'),
    CLAUDE_KIT_CODE_INDEX_DIR: join(dir, 'code-index'),
    CLAUDE_KIT_CACHE_DIR: join(dir, 'cache'),
  };
  return {
    ...baseEnv,
    ...stores,
    BROKER_NO_AUTOSTART: '1',
    CLAUDE_KIT_REGISTRY: registry,
    CLAUDE_KIT_TURN_STATE: join(dir, 'turn-state'),
    CLAUDE_KIT_SEARCH_LOG_DIR: join(dir, 'search-log'),
    TMP: tmp,
    TEMP: tmp,
    TMPDIR: tmp,
  };
}
