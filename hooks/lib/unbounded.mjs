// The UNBOUNDED store: the catch-all `.ai` a session falls back to when the cwd has no
// store above it (a home directory, a scratch dir). Without it the CLIs and hooks no-op
// and a found-but-unapplied fact has nowhere durable to go (KIT-T189).
//
// Location, first hit wins:
//   1. CLAUDE_KIT_UNBOUNDED_AI  — absolute path to the store's `.ai` directory
//   2. registry `unbounded`     — same, from ~/.claude/claude-kit-projects.json
//   3. <registry dataRoot>/unbounded/.ai
// The path is machine-specific, so it is configured where the other machine-specific
// workflow paths already live (the registry), never committed to the kit.

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { readRegistry } from './registry.mjs';
import { storeRoot } from './paths.mjs';

export const UNBOUNDED_DIR = 'unbounded';

// The configured `.ai` directory of the unbounded store — WITHOUT asserting it exists.
// '' when no data root is configured and no override is set.
export function unboundedAiDir() {
  const env = process.env.CLAUDE_KIT_UNBOUNDED_AI;
  if (env) return resolve(env);
  const reg = readRegistry();
  if (reg.unbounded) return resolve(reg.unbounded);
  return reg.dataRoot ? join(resolve(reg.dataRoot), UNBOUNDED_DIR, '.ai') : '';
}

// The unbounded store's ROOT (the parent of its `.ai`), or null when it is unconfigured or
// not yet initialized. Only an initialized store counts: a config.yml is what every other
// resolver treats as "a store lives here", so an absent one must degrade to today's no-op
// rather than invent a half-store.
export function unboundedRoot() {
  const ai = unboundedAiDir();
  return ai && existsSync(join(ai, 'config.yml')) ? dirname(ai) : null;
}

export function isUnbounded(root) {
  const u = unboundedRoot();
  return !!u && !!root && resolve(root) === resolve(u);
}

// THE resolution rule, shared by every entry point (cap, t, q, orient, flush): the nearest
// store above `start`, else the unbounded catch-all, else null (nothing configured — the
// caller keeps its historical no-op). Never guesses a project: the unbounded store is a
// deliberate catch-all, not an inference.
export function resolveStoreRoot(start = process.cwd()) {
  return storeRoot(resolve(start)) || unboundedRoot();
}

// Why a cwd resolved to NO store at all: nothing above it, and no unbounded catch-all ready.
// One sentence, one home — every entry point that has to refuse says the same thing.
export function noStoreMessage() {
  const ai = unboundedAiDir();
  return ai
    ? `the unbounded store at ${ai} is not initialized — run scripts/init-unbounded.mjs`
    : 'no .ai/ above the cwd and no unbounded store configured'
      + ' (set CLAUDE_KIT_UNBOUNDED_AI, or `unbounded` in the project registry)';
}
