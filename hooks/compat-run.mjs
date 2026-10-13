#!/usr/bin/env node
// Stable hook launcher: every hooks.json command is `node compat-run.mjs <hook>.mjs`. It loads the
// hook machinery (compat-core.mjs, and through it the hook scripts) from the sealed runtime's
// `current` when one is published, so a half-edited working tree never runs as a hook (KIT-T460).
// Writers who want their edits live pass `--live` as the first argument or set CLAUDE_KIT_LIVE=1.
// Keep this file tiny, dependency-free and rarely edited: it is the one hook file that always
// loads from wherever the plugin root points.

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE = 'compat-core.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));

if (process.argv[2] === '--live') {
  process.argv.splice(2, 1);
  process.env.CLAUDE_KIT_LIVE = '1';
}

function sealedHooksDir() {
  if (process.env.CLAUDE_KIT_LIVE === '1') return HERE;
  const home = process.env.CLAUDE_HOME || join(homedir(), '.claude');
  const dir = join(process.env.CLAUDE_KIT_RUNTIME || join(home, 'claude-kit-runtime'), 'current', 'hooks');
  return existsSync(join(dir, CORE)) ? dir : HERE;
}

const load = (dir) => import(pathToFileURL(join(dir, CORE)).href);
const core = await load(sealedHooksDir()).catch(() => load(HERE));
await core.main();
