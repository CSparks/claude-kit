// orient-budget.mjs — keep SessionStart orientation inside what the harness will inline.
//
// The harness spills hook output past ~10k BYTES to a file and shows only a short
// preview, so an over-long orientation is read as nothing. fitOrientation() takes the
// assembled text, and when it exceeds the budget it shortens the lowest-priority blocks to a
// header, a few lines and a pointer to the full text (which the caller writes to disk).
// Size is counted in bytes (a "—" is three), and the cost line the caller appends afterwards is
// reserved up front (COST_LINE_RESERVE_BYTES), so the printed text never passes ORIENT_BUDGET_BYTES.
// Blocks start at a line beginning "--- ", "!! " or "=== "; a block matching no DEMOTE rule is
// never shortened. A rule with a `command` leaves "(+N lines) — <command>" in place of the rows: a count and the
// one command that lists them.

export const ORIENT_BUDGET_BYTES = 9500;
export const COST_LINE_RESERVE_BYTES = 256;
const BLOCK_START = /^(--- |!! |=== )/;

// Lowest priority first. The framework contract is static and lives in the kit's frameworks/
// tree, so it yields before the session's own state does. `keep` is how many body lines a shortened block retains on the first
// pass; if the text still overflows, a second pass cuts every listed block to its header.
const DEMOTE = [
  { match: /^--- FRAMEWORK CONTRACT/, keep: 10 },
  { match: /^--- FRAMEWORK LESSONS/, keep: 12 },
  { match: /^--- OPEN, awaiting a bill of work/, keep: 2, command: '`q open`' },
  { match: /^--- RULED, NOT BUILT/, keep: 2, command: '`t revise <id> --ticket <ticket>`' },
  { match: /^--- RED BY DESIGN/, keep: 3, command: '`t red-by-design list`' },
  { match: /^--- UNPROMOTED KIT\/FRAMEWORK DECISIONS/, keep: 2, command: '`q recent 30d`' },
  { match: /^--- Decisions \(recent\)/i, keep: 1 },
  { match: /^--- Lineage/, keep: 0 },
  { match: /^--- Plan-of-record/, keep: 1 },
  { match: /^--- DOC TREE/, keep: 2 },
  { match: /^--- STANDING decisions/, keep: 2 },
  { match: /^--- Recent commits/, keep: 2 },
  { match: /^--- Working tree/, keep: 3 },
  { match: /^--- In-flight agents/, keep: 3 },
  { match: /^--- Open work/, keep: 5 },
  { match: /^--- \.ai\/SESSION\.md/, keep: 4 },
  { match: /^!! SESSION\.md is STALE/, keep: 3 },
  { match: /^!! FRESH COMMITS/, keep: 3 },
  { match: /^--- LIVE agents/, keep: 3 },
  { match: /^--- SEARCH WITH q/, keep: 4 },
];

function splitBlocks(lines) {
  const blocks = [];
  for (const line of lines) {
    if (!blocks.length || BLOCK_START.test(line)) blocks.push([line]);
    else blocks[blocks.length - 1].push(line);
  }
  return blocks;
}

const bytes = (s) => Buffer.byteLength(s, 'utf8');
const size = (blocks) => blocks.reduce((n, b) => n + bytes(b.join('\n')) + 1, 0);

/**
 * Returns { text, demoted }: `text` fits `budget` bytes when the demotable blocks allow
 * it (the default leaves room for the cost line); `demoted` lists the headers of the blocks
 * that were shortened (empty when nothing was cut). `pointer` is appended to each shortened
 * block, naming where the full text lives.
 */
export function fitOrientation(text, { budget = ORIENT_BUDGET_BYTES - COST_LINE_RESERVE_BYTES, pointer = '' } = {}) {
  if (bytes(text) <= budget) return { text, demoted: [] };
  const blocks = splitBlocks(text.split('\n'));
  const demoted = new Set();
  for (const pass of [(rule) => rule.keep, () => 0]) {
    for (const rule of DEMOTE) {
      const keep = pass(rule);
      blocks.forEach((b, i) => {
        if (size(blocks) <= budget || !rule.match.test(b[0])) return;
        const body = b.original || b.slice(1).filter((l) => l.trim());
        const kept = b.original ? b.cut : body.length;
        if (kept <= keep) return;
        const command = rule.command ? ` — ${rule.command}` : '';
        const cut = [b[0], ...body.slice(0, keep), `  … (+${body.length - keep} lines)${command}${pointer}`];
        cut.cut = keep;
        cut.original = body;
        blocks[i] = cut;
        demoted.add(b[0]);
      });
    }
  }
  return { text: blocks.map((b) => b.join('\n')).join('\n'), demoted: [...demoted] };
}
