// `t move <id> <repo-path>` — PROMOTE an item out of one store into a managed repo's `.ai/`
// (KIT-T189). The unbounded catch-all is where a session with no repo cwd captures; the item
// belongs to a project as soon as one is identified, and it has to get there without a
// copy-paste that drops its history.
//
// What is preserved: the body and the whole `## History` section, verbatim. What changes: a
// durable item is re-keyed to the destination's id scheme (an id carries its project's prefix,
// so keeping the old one would put a foreign scope on the destination's board) and the old id
// is recorded as `aka:`, which is the kit's established "was <id>" alias — `q` still resolves
// it. A capture in `inbox/` keeps its filename and lands in the destination's inbox, so the
// destination's triage routes it like any other capture.
//
// What is LEFT BEHIND: a pointer. A durable source goes `status: superseded` with `moved_to:`,
// so it drops off its board without being deleted; an inbox source moves to `inbox/triaged/`
// carrying `moved-to:`, which keeps the inbox = open-queue invariant (KIT-D036).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { collectItems } from './db-parse.mjs';
import { splitFrontmatter } from './frontmatter.mjs';
import { nextId, STORE_TYPE } from './id-utils.mjs';
import { appendUnderSection, stamp } from './md-body.mjs';
import { storeRoot, writeItemFile } from '../hooks/lib.mjs';

const HISTORY = 'History'; // appendUnderSection adds the `## ` itself

function findItem(root, id) {
  const want = String(id || '').toLowerCase();
  const hit = collectItems(root).find((i) => String(i.id).toLowerCase() === want);
  if (!hit) {
    throw new Error(`t move: no item '${id}' in ${join(root, '.ai')} — ids come from q (q inbox / q open), never guessed`);
  }
  return hit;
}

function destinationRoot(path) {
  const root = storeRoot(resolve(path));
  if (!root) throw new Error(`t move: '${path}' has no .ai/config.yml above it — it is not an adopted repo`);
  return root;
}

// Set a frontmatter scalar in place, appending the key when absent. Mirrors t.mjs's setField;
// kept local so this module stays importable without pulling the whole CLI in.
function setField(fm, key, value) {
  const re = new RegExp(`^(${key}:)[ \\t]*.*$`, 'm');
  return re.test(fm) ? fm.replace(re, `$1 ${value}`) : `${fm}\n${key}: ${value}`;
}

function addAka(fm, id) {
  const m = fm.match(/^(aka:)[ \t]*(.*)$/m);
  const cur = m ? m[2].trim().replace(/^\[|\]$/g, '').split(',').map((x) => x.trim()).filter(Boolean) : [];
  if (!cur.includes(id)) cur.push(id);
  return setField(fm, 'aka', `[${cur.join(', ')}]`);
}

// Move a capture: same filename, into the destination's inbox; the source copy is retired to
// inbox/triaged/ with a pointer line.
function moveCapture(srcAi, destAi, item, destName, srcName) {
  const file = basename(item.file);
  const srcAbs = join(srcAi, item.file);
  const text = readFileSync(srcAbs, 'utf8');
  const destAbs = join(destAi, 'inbox', file);
  if (existsSync(destAbs)) throw new Error(`t move: ${destAbs} already exists`);
  mkdirSync(join(destAi, 'inbox'), { recursive: true });
  mkdirSync(join(srcAi, 'inbox', 'triaged'), { recursive: true });
  writeFileSync(srcAbs, `${text.trimEnd()}\nmoved-to: ${destName}/inbox/${file}\n`);
  renameSync(srcAbs, join(srcAi, 'inbox', 'triaged', file));
  return {
    content: `${text.trimEnd()}\nmoved-from: ${srcName} ${item.id}\n`,
    destAbs,
    newId: '',
    pointer: `inbox/triaged/${file}`,
  };
}

// Move a durable item: re-keyed into the destination's store, the old id kept as an alias.
function moveDurable(srcAi, destRoot, destAi, item, srcName) {
  const newId = nextId(destRoot, item.store);
  const srcAbs = join(srcAi, item.file);
  const text = readFileSync(srcAbs, 'utf8');
  const parts = splitFrontmatter(text);
  if (!parts) throw new Error(`t move: ${item.file} has no frontmatter — a durable item needs one to be re-keyed`);
  let fm = setField(parts.fm, 'id', newId);
  fm = addAka(fm, item.id);
  const slug = basename(item.file).replace(/\.md$/, '').replace(/^[A-Za-z][A-Za-z0-9]*-[A-Za-z]?\d+-?/, '') || 'item';
  const destAbs = join(destAi, item.store, `${newId}-${slug}.md`);
  if (existsSync(destAbs)) throw new Error(`t move: ${destAbs} already exists`);
  mkdirSync(join(destAi, item.store), { recursive: true });

  const moved = `- [${stamp()}] (comment) moved from ${srcName} as ${item.id}`;
  const content = appendUnderSection(`${parts.open}${fm}${parts.close}${parts.rest}`, HISTORY, moved);

  const ptr = setField(setField(parts.fm, 'moved_to', newId), 'status', 'superseded');
  const pointerText = appendUnderSection(
    `${parts.open}${ptr}${parts.close}${parts.rest}`,
    HISTORY,
    `- [${stamp()}] (comment) moved to ${newId} — this copy is a pointer`,
  );
  writeFileSync(srcAbs, pointerText);
  return { content, destAbs, newId, pointer: item.file };
}

// Move `id` from the store at `srcRoot` into the adopted repo at `destPath`.
export async function moveItem(srcRoot, id, destPath) {
  const item = findItem(srcRoot, id);
  const destRoot = destinationRoot(destPath);
  if (resolve(destRoot) === resolve(srcRoot)) throw new Error('t move: source and destination are the same store');
  if (item.store !== 'inbox' && !STORE_TYPE[item.store]) {
    throw new Error(`t move: store '${item.store}' mints no ids — only captures and keyed items move`);
  }
  const srcAi = join(srcRoot, '.ai');
  const destAi = join(destRoot, '.ai');
  const srcName = basename(srcRoot);
  const destName = basename(destRoot);

  const r = item.store === 'inbox'
    ? moveCapture(srcAi, destAi, item, destName, srcName)
    : moveDurable(srcAi, destRoot, destAi, item, srcName);

  await writeItemFile(r.destAbs, r.content);
  return { from: item.id, to: r.newId || basename(r.destAbs), destRoot, pointer: r.pointer, store: item.store };
}
