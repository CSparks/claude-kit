// red-by-design — the named-debt tests of a project: a test written to fail on today's world (a measurement or acceptance
// test whose fix is not yet signed) or one the maintainer ruled stays red. One file per entry in `<root>/.ai/red-by-design/`,
// written only by `t red-by-design`; the red-test-dispatch gate reads the list and orient reports entries gone stale.
//
//   readEntries(root)                    -> [{ test, decidedBy[], reason, owner, date, file }]; [] on any read error
//   writeEntry(root, entry, { now })     adds or renews the entry for `test`; throws on a missing id, reason or unknown id
//   removeEntry(root, test)              deletes the entry; throws when none exists
//   ageDays(entry, now)                  whole days since the entry was written or renewed
//   STALE_DAYS                           an entry older than this is a notice in orient

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { field, frontmatterBlock, listField } from '../../scripts/frontmatter.mjs';
import { idExists } from '../../scripts/id-utils.mjs';

export const RED_DIR = 'red-by-design';
export const STALE_DAYS = 14;
export const UNSIGNED = 'unsigned';
const MS_PER_DAY = 86_400_000;
const ID_SHAPE = /^[A-Za-z][A-Za-z0-9]*-[DT]\d+$/;
const DATE_CHARS = 10;
const BODY = 'Red by design: written by `t red-by-design`, never by hand. Renew with `t red-by-design add`, clear with `t red-by-design remove`.';

const dirOf = (root) => join(root, '.ai', RED_DIR);
const slugOf = (test) => test.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const oneLine = (text) => String(text || '').replace(/\s+/g, ' ').replace(/"/g, "'").trim();

function parseEntry(text, file) {
  const fm = frontmatterBlock(text);
  const test = field(fm, 'test');
  const decidedBy = listField(fm, 'decided_by');
  if (!test || !decidedBy.length) return null;
  return { test, decidedBy, reason: field(fm, 'reason'), owner: field(fm, 'owner') || UNSIGNED, date: field(fm, 'date'), file };
}

export function readEntries(root) {
  try {
    const dir = dirOf(root);
    return readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
      .flatMap((f) => parseEntry(readFileSync(join(dir, f), 'utf8'), f) || []);
  } catch {
    return [];
  }
}

export const ageDays = (entry, now = Date.now()) => Math.floor((now - Date.parse(`${entry.date}T00:00:00Z`)) / MS_PER_DAY);

export function writeEntry(root, { test, decidedBy = [], reason, owner }, { now = Date.now() } = {}) {
  const named = oneLine(test);
  if (!named) throw new Error('red-by-design: a test name or file is required');
  if (!decidedBy.length) throw new Error('red-by-design: --decided-by <decision or ticket id,...> is required: every entry cites the id that rules it red');
  const bad = decidedBy.find((id) => !ID_SHAPE.test(id));
  if (bad) throw new Error(`red-by-design: '${bad}' is not a decision or ticket id (KEY-D### or KEY-T###)`);
  const unknown = decidedBy.find((id) => !idExists(join(root, '.ai'), id));
  if (unknown) throw new Error(`red-by-design: ${unknown} is not in this store (cite an id the store holds)`);
  if (!oneLine(reason)) throw new Error('red-by-design: --reason "<one line>" is required');
  const file = `${slugOf(named)}.md`;
  const dir = dirOf(root);
  const replaced = existsSync(join(dir, file));
  mkdirSync(dir, { recursive: true });
  const date = new Date(now).toISOString().slice(0, DATE_CHARS);
  writeFileSync(join(dir, file), `---\ntest: "${oneLine(named)}"\ndecided_by: [${decidedBy.join(', ')}]\nreason: "${oneLine(reason)}"\nowner: "${oneLine(owner) || UNSIGNED}"\ndate: ${date}\n---\n\n${BODY}\n`);
  return { file: join(dir, file), replaced, date };
}

export function removeEntry(root, test) {
  const path = join(dirOf(root), `${slugOf(oneLine(test))}.md`);
  if (!existsSync(path)) throw new Error(`red-by-design: no entry for '${test}' (t red-by-design list)`);
  rmSync(path);
  return { file: path };
}
