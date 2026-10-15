// `t session` — write the resume anchor `.ai/SESSION.md` through the CLI (KIT-T509), so a session
// flush is a command and never a hand Edit of the file. The default replaces the file (the anchor
// is working memory, one screen: overwrite stale content); `--append` adds a block instead.
//
//   writeSession(root, text, { append }) -> { path, lines }

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function writeSession(root, text, opts = {}) {
  const body = String(text ?? '').replace(/\s+$/, '');
  if (!body.trim()) throw new Error('t session: non-empty "<text>" (or --file <path>) is required');
  const dir = join(root, '.ai');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'SESSION.md');
  if (opts.append && existsSync(path)) appendFileSync(path, `\n${body}\n`);
  else writeFileSync(path, `${body}\n`);
  return { path, lines: body.split('\n').length };
}
