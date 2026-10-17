// directive.mjs — a directive decision names the tests that keep it true (KIT-T554). A decision
// whose frontmatter says `directive: true` carries `enforced_by:` (a YAML list or inline list of
// repo-relative test paths), and every path must exist. A rule Chris states is a record until a
// test enforces it.
//
//   directiveProblem(root, text)       -> null, or why a directive decision is not enforced
//   decisionPaths(files)               -> the decision files among repo-relative `files`
//   unenforcedDirectives(root)         -> [{ id, title, problem }] over every decision in root/.ai/decisions

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DECISION = /(^|\/)\.ai\/decisions\/[^/]+\.md$/;
const SKIP = /(^|\/)(README|_TEMPLATE)\.md$/i;

export const decisionPaths = (files) => files.filter((f) => DECISION.test(f) && !SKIP.test(f));

const frontmatter = (text) => (/^---\r?\n([\s\S]*?)\r?\n---/.exec(text) || [, ''])[1];
const scalar = (fm, key) => ((new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(fm) || [, ''])[1]).trim().replace(/^["']|["']$/g, '');

function listField(fm, key) {
  const lines = fm.split(/\r?\n/);
  const at = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (at < 0) return [];
  const inline = lines[at].slice(key.length + 1).trim();
  if (inline) return inline.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  const out = [];
  for (const l of lines.slice(at + 1)) {
    const m = /^\s+-\s*(.+?)\s*$/.exec(l);
    if (!m) break;
    out.push(m[1].replace(/^["']|["']$/g, ''));
  }
  return out;
}

export function directiveProblem(root, text) {
  const fm = frontmatter(text);
  if (!/^(true|yes)$/i.test(scalar(fm, 'directive'))) return null;
  const paths = listField(fm, 'enforced_by');
  if (!paths.length) return 'a directive decision needs `enforced_by: <test paths>` naming the tests that keep it true';
  const missing = paths.filter((p) => !existsSync(join(root, p)));
  return missing.length ? `enforced_by names tests that do not exist: ${missing.join(', ')}` : null;
}

export function unenforcedDirectives(root) {
  const dir = join(root, '.ai', 'decisions');
  if (!existsSync(dir)) return [];
  const rows = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md') || SKIP.test(name)) continue;
    const text = readFileSync(join(dir, name), 'utf8');
    const problem = directiveProblem(root, text);
    if (problem) rows.push({ id: scalar(frontmatter(text), 'id') || name, title: scalar(frontmatter(text), 'title'), problem });
  }
  return rows;
}
