#!/usr/bin/env node
// UserPromptSubmit — persist the current prompt in machine-local turn state.
// Codex transcripts are not a stable hook interface, so request-gate uses this as
// its host-neutral fallback instead of parsing a Codex rollout file.

import { adopted, gitRoot, payload, writeTurnState } from './lib.mjs';

try {
  const p = await payload();
  const root = gitRoot();
  const prompt = typeof p.prompt === 'string' ? p.prompt : '';
  if (adopted(root) && prompt.trim()) {
    writeTurnState(root, { prompt, ts: Date.now() }, 'request-capture');
  }
} catch {
  // A capture snapshot is advisory; never block the user's prompt.
}
