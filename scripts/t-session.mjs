// `t session` — write the resume anchor `.ai/SESSION.md` through the CLI (KIT-T509), so a session
// flush is a command and never a hand Edit of the file. It never deletes existing content (KIT-T521):
//   default    a dated line goes in under the anchor's top section (newest first)
//   --append   the text becomes a block at the end of the file
//   --replace  the whole file is replaced; allowed only with --file (a complete draft)
//   --fix <old> <new>  the one place <old> occurs becomes <new> (zero or several occurrences refuse)
//   --drop <text>      every entry whose first line holds <text> goes, with its indented continuation lines
// Every write first copies the previous file to `.ai/.session-backups/SESSION-<timestamp>.md`
// (the last 20 are kept; the folder ignores itself in git).
//
//   writeSession(root, text, { append, replace, fromFile, now }) -> { path, lines, backup }
//   editSession(root, { fix: [old, new] | drop: text, now }) -> { path, changed, backup }

import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEEP_BACKUPS = 20;
const SECTION = /^##\s/;
const TITLE = /^#\s/;

const stamp = (d) => d.toISOString().slice(0, 16).replace('T', ' ');

function backup(dir, path, now) {
  if (!existsSync(path)) return null;
  const folder = join(dir, '.session-backups');
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, '.gitignore'), '*\n');
  const base = `SESSION-${now.toISOString().replace(/[:.]/g, '-')}`;
  let file = join(folder, `${base}.md`);
  for (let n = 1; existsSync(file); n++) file = join(folder, `${base}-${n}.md`);
  copyFileSync(path, file);
  const all = readdirSync(folder).filter((f) => /^SESSION-.*\.md$/.test(f)).sort();
  for (const f of all.slice(0, Math.max(0, all.length - KEEP_BACKUPS))) rmSync(join(folder, f), { force: true });
  return file;
}

const datedLine = (body, now) => body.split('\n').map((l, i) => (i === 0 ? `- [${stamp(now)}] ${l}` : `  ${l}`)).join('\n');

// `line` straight below the first `##` heading, else the first `#` title, else at the top.
function insertUnderTop(existing, line) {
  const rows = existing.split('\n');
  let at = rows.findIndex((r) => SECTION.test(r));
  if (at < 0) at = rows.findIndex((r) => TITLE.test(r));
  if (at < 0) return [line, '', ...rows].join('\n');
  const head = rows.slice(0, at + 1);
  const rest = rows.slice(at + 1);
  if (rest.length && rest[0].trim() === '') head.push(rest.shift());
  else head.push('');
  const entry = rest.length && rest[0].trim() !== '' && !rest[0].startsWith('- ') ? [line, ''] : [line];
  return [...head, ...entry, ...rest].join('\n');
}

export function writeSession(root, text, opts = {}) {
  const body = String(text ?? '').replace(/\s+$/, '');
  if (!body.trim()) throw new Error('t session: non-empty "<text>" (or --file <path>) is required');
  if (opts.replace && !opts.fromFile) throw new Error('t session: --replace replaces the whole anchor and needs a complete draft: t session --replace --file <path>');
  const now = opts.now || new Date();
  const dir = join(root, '.ai');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'SESSION.md');
  const saved = backup(dir, path, now);
  if (opts.replace) writeFileSync(path, `${body}\n`);
  else if (!existsSync(path)) writeFileSync(path, `# SESSION\n\n${datedLine(body, now)}\n`);
  else if (opts.append) appendFileSync(path, `\n${body}\n`);
  else writeFileSync(path, insertUnderTop(readFileSync(path, 'utf8'), datedLine(body, now)));
  return { path, lines: body.split('\n').length, backup: saved };
}

function dropEntries(text, needle) {
  const kept = [];
  let dropped = 0;
  let skipping = false;
  for (const line of text.split('\n')) {
    if (skipping && /^\s+\S/.test(line)) continue;
    skipping = !/^\s/.test(line) && line.includes(needle);
    if (skipping) dropped++;
    else kept.push(line);
  }
  return { text: kept.join('\n'), dropped };
}

export function editSession(root, { fix, drop, now = new Date() }) {
  const dir = join(root, '.ai');
  const path = join(dir, 'SESSION.md');
  if (!existsSync(path)) throw new Error('t session: there is no .ai/SESSION.md to edit');
  const current = readFileSync(path, 'utf8');
  let next;
  let changed;
  if (fix) {
    const [oldText, newText] = fix;
    if (!oldText) throw new Error('t session --fix: <old> must be non-empty');
    const count = current.split(oldText).length - 1;
    if (count !== 1) throw new Error(`t session --fix: "${oldText}" occurs ${count} times in SESSION.md; it must occur exactly once (quote more of the line)`);
    next = current.replace(oldText, () => newText);
    changed = 1;
  } else {
    if (!drop) throw new Error('t session --drop: <text> must be non-empty');
    const r = dropEntries(current, drop);
    if (!r.dropped) throw new Error(`t session --drop: no entry in SESSION.md holds "${drop}"`);
    next = r.text;
    changed = r.dropped;
  }
  const saved = backup(dir, path, now);
  writeFileSync(path, next);
  return { path, changed, backup: saved };
}
