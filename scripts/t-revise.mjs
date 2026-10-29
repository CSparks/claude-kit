// `t revise <decision-id> [--status-to <s>] [--summary "<text>"] [--promoted "<KIT-D###|RG-D###|none (why)>"] [--file <draft.md>]`: change a decision
// through the CLI. A draft (the `t decide` shape, every part optional) replaces the frontmatter keys it
// carries and, when non-empty, the body (which keeps **Decision:** and **Why:**). Flags win over the draft;
// `id:` never changes and `revised:` is stamped with the date.
//
//   reviseDecision(root, id, { status, summary, promoted, draftText, now }) -> { id, path, changed: string[] }
// `promoted` records where a project decision about kit or framework concerns was promoted to (KIT-D111).

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { field, frontmatterBlock, splitFrontmatter } from './frontmatter.mjs';

const DRAFT_KEYS = ['title', 'summary', 'date', 'supersedes', 'source', 'status', 'promoted'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID_KEY_RE = /^([A-Za-z][A-Za-z0-9]*-D\d+)$/;

function decisionFile(root, id) {
  if (!ID_KEY_RE.test(id)) throw new Error(`t revise: '${id}' is not a decision id (KEY-D###)`);
  const dir = join(root, '.ai', 'decisions');
  const name = readdirSync(dir).find((n) => n.endsWith('.md') && (n === `${id}.md` || n.startsWith(`${id}-`)));
  if (!name) throw new Error(`t revise: no decision ${id} in ${dir}`);
  return join(dir, name);
}

function draftChanges(draftText) {
  if (!draftText) return { fields: {}, body: '' };
  const fm = frontmatterBlock(draftText);
  const split = splitFrontmatter(draftText);
  const fields = {};
  if (fm) for (const k of DRAFT_KEYS) if (field(fm, k) !== null && field(fm, k) !== undefined && field(fm, k).trim() !== '') fields[k] = field(fm, k).trim();
  const body = (split ? split.rest : draftText).replace(/^\r?\n/, '').trimEnd();
  return { fields, body };
}

function setLine(frontLines, key, value) {
  const at = frontLines.findIndex((l) => l.startsWith(`${key}:`));
  const line = `${key}: ${value}`;
  if (at >= 0) frontLines[at] = line;
  else frontLines.push(line);
}

export function reviseDecision(root, id, { status, summary, promoted, draftText, now = new Date() } = {}) {
  const path = decisionFile(root, id);
  const text = readFileSync(path, 'utf8');
  const split = splitFrontmatter(text);
  if (!split) throw new Error(`t revise: ${id} has no frontmatter block`);
  const { fields, body } = draftChanges(draftText);
  if (status) fields.status = status;
  if (summary !== undefined && summary !== null) fields.summary = summary;
  if (promoted) fields.promoted = promoted;
  if (!Object.keys(fields).length && !body) throw new Error('t revise: nothing to change (give --status, --summary, --promoted or --file)');
  if (fields.title && /[\r\n]/.test(fields.title)) throw new Error('t revise: title is one line');
  if (fields.date && !DATE.test(fields.date)) throw new Error(`t revise: date '${fields.date}' is not YYYY-MM-DD`);
  if (body && !(/\*\*Decision:\*\*/.test(body) && /\*\*Why:\*\*/.test(body))) throw new Error('t revise: a replacement body needs **Decision:** and **Why:** paragraphs');

  const block = frontmatterBlock(text);
  const frontLines = block.split(/\r?\n/);
  for (const [k, v] of Object.entries(fields)) setLine(frontLines, k, v);
  setLine(frontLines, 'revised', now.toISOString().slice(0, 10));
  writeFileSync(path, `---\n${frontLines.join('\n')}\n---${body ? `\n\n${body}\n` : split.rest}`);
  return { id, path, changed: [...Object.keys(fields), ...(body ? ['body'] : [])] };
}
