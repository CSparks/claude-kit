#!/usr/bin/env node
// PostToolUse (Write|Edit) — records the file an Edit or Write tool just wrote, with the hash of its content, in the
// accepted-writes ledger hand-write-detect reads (KIT-T888). A write that landed here passed pre-write; a shell call
// that overlapped it is not blamed for this file while it still holds this content. Never blocks; fails open.

import { payload, gitRootOfFile, adopted } from './lib.mjs';
import { repoRelative } from './turn-writes.mjs';
import { contentHashOf } from './lib/shell-snapshot.mjs';
import { recordToolWrite, writerId } from './lib/tool-writes.mjs';
import { subagentId } from './lib/subagent-id.mjs';

try {
  const p = await payload();
  const file = (p.tool_input && p.tool_input.file_path) || '';
  const root = file ? gitRootOfFile(file) : '';
  if (root && adopted(root)) {
    const rel = repoRelative(root, file);
    if (rel) recordToolWrite(root, rel, contentHashOf(root, rel), Date.now(), writerId(p.session_id, subagentId(p)));
  }
} catch {
  /* a ledger never wedges a tool call */
}
process.exit(0);
