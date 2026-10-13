// runtime-path.mjs — where the sealed, tested kit copy lives (KIT-T450, KIT-D0xx).
//
// `npm run publish:runtime` exports the committed tree to <runtime>/<sha>/ and repoints
// <runtime>/current. Sessions run the kit from `current`, never from a writer's checkout.
//
//   runtimeRoot(env)    -> the runtime directory (CLAUDE_KIT_RUNTIME, else <CLAUDE_HOME|~/.claude>/claude-kit-runtime)
//   runtimeCurrent(env) -> <runtime>/current when a published copy is there, else ''

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROBE = join('scripts', 'q.mjs');

export function runtimeRoot(env = process.env) {
  return env.CLAUDE_KIT_RUNTIME || join(env.CLAUDE_HOME || join(homedir(), '.claude'), 'claude-kit-runtime');
}

export function runtimeCurrent(env = process.env) {
  const current = join(runtimeRoot(env), 'current');
  return existsSync(join(current, PROBE)) ? current : '';
}
