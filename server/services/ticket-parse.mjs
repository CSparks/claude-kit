// Pure parsers over a ticket's markdown BODY (the frontmatter-stripped text the cache stores
// in items_fts). Splits the named sections and reads acceptance-criteria checkbox state — no
// I/O, no SQLite, so it is trivially unit-testable and shared by the detail assembler.

import { listCriteria } from '../../scripts/criteria.mjs';

// Text of the `## <heading>` section: everything until the next `## ` heading or EOF, trimmed.
export function sectionText(body, heading) {
  const lines = String(body || '').split('\n');
  const head = `## ${heading}`;
  const start = lines.findIndex((l) => l.trim() === head);
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

// Acceptance-criteria checkboxes, in order — delegated to the store's own criteria module so the
// `index` a client renders is THE index its tick/untick request addresses (KIT-T153). Reading and
// writing a criterion therefore cannot disagree about which line row N is.
export const parseAcceptance = (body) => listCriteria(body);

export function parseTicketBody(body) {
  return {
    description: sectionText(body, 'Description'),
    acceptanceCriteria: parseAcceptance(body),
    notes: sectionText(body, 'Notes'),
  };
}
