#!/usr/bin/env node
// PostToolUse (Write|Edit) — records the file an Edit or Write tool just wrote, with the hash of its content, in the
// accepted-writes ledger hand-write-detect reads (KIT-T888). A write that landed here passed pre-write; a shell call
// that overlapped it is not blamed for this file while it still holds this content. A file outside every adopted repo
// goes to the file-writer record commit-gate checks a `-F` message against (KIT-T1135). Never blocks; fails open.

import { payload, gitRootOfFile, adopted } from './lib.mjs';
import { repoRelative } from './turn-writes.mjs';
import { contentHashOf } from './lib/shell-snapshot.mjs';
import { recordToolWrite, writerId } from './lib/tool-writes.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { recordFileWrite } from './lib/message-file-owner.mjs';

try {
  const p = await payload();
  const file = (p.tool_input && p.tool_input.file_path) || '';
  const root = file ? gitRootOfFile(file) : '';
  const writer = writerId(p.session_id, subagentId(p));
  if (root && adopted(root)) {
    const rel = repoRelative(root, file);
    if (rel) recordToolWrite(root, rel, contentHashOf(root, rel), Date.now(), writer);
  } else if (file) {
    recordFileWrite(file, contentHashOf('', file), writer);
  }
} catch {
  /* a ledger never wedges a tool call */
}
process.exit(0);
