// store-write-verb.mjs — the one command that makes a refused hand Edit of an existing store item (KIT-T1596).
// The store-write block lists every verb of the item's folder; this names the verb for the part the Edit touches,
// with the item's id filled in, so the right command is the first line the writer reads.
//
//   exactVerb(file, toolInput) -> { part, command } | null
//     part      'frontmatter' or the `## <Section>` heading above the Edit's old text
//     command   the command line, id filled in; null when the Edit's old text is not in the file, the id is unknown,
//               or the part has no single verb (a Write of the whole file gets the folder's menu)

import { readFileSync } from 'node:fs';

const DRAFT = '<draft holding the whole new section>';
const SECTION_VERBS = {
  description: (id) => `t edit ${id} --section Description --file ${DRAFT}`,
  plan: (id) => `t edit ${id} --section Plan --file ${DRAFT}`,
  notes: (id) => `t notes ${id} "<prose>" (append) | t edit ${id} --section Notes --file ${DRAFT} (replace)`,
  'acceptance criteria': (id) => `t criterion ${id} "<text>" (add) | t tick ${id} <ordinal|match> (check one off)`,
  history: () => '(History is stamped by the t verbs; no hand edit)',
};
const STATUS_LINE = /^status:/m;
const FRONTMATTER_END = /^---\s*$/m;

function readText(file) {
  try { return readFileSync(file, 'utf8'); } catch { return ''; }
}

export function exactVerb(file, toolInput) {
  const old = toolInput?.old_string;
  if (typeof old !== 'string' || !old || typeof toolInput.content === 'string') return null;
  const text = readText(file);
  const at = text.indexOf(old);
  const id = /^id:[ \t]*(\S+)/m.exec(text)?.[1];
  if (at === -1 || !id) return null;
  const close = text.startsWith('---') ? text.slice(3).search(FRONTMATTER_END) : -1;
  if (close !== -1 && at < close + 3) return STATUS_LINE.test(old) ? { part: 'frontmatter', command: `t status ${id} <state>` } : null;
  const heading = [...text.slice(0, at).matchAll(/^## (.+?)\s*$/gm)].at(-1)?.[1];
  const verb = heading && SECTION_VERBS[heading.toLowerCase()];
  return verb ? { part: heading, command: verb(id) } : null;
}
