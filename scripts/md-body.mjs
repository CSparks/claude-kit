// Markdown BODY primitives for the store writers: the History timestamp shape, appending a line
// under a `## Section`, and locating a section's line range. Deliberately separate from
// frontmatter.mjs (which owns the `---` block) so each half of a store file has one owner.

// `[2026-06-10 13:42]` — the timestamp shape db-parse.historyEvents parses (date + HH:MM).
export function stamp() {
  const iso = new Date().toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

// Append `line` under `## <heading>` in a markdown body, creating the section at the end when
// it is absent. The section ends at the next `## ` heading or EOF, so a History line lands
// inside History even when Notes follows it.
export function appendUnderSection(body, heading, line) {
  const h = `## ${heading}`;
  const idx = body.indexOf(`${h}\n`) === -1 ? body.indexOf(h) : body.indexOf(`${h}\n`);
  if (idx === -1) {
    return `${body.replace(/\s+$/, '')}\n\n${h}\n${line}\n`;
  }
  const after = body.indexOf('\n## ', idx + h.length);
  const end = after === -1 ? body.length : after;
  const section = body.slice(idx, end).replace(/\s+$/, '');
  return body.slice(0, idx) + section + `\n${line}\n` + (after === -1 ? '' : body.slice(end));
}

// The line span of a `## <heading>` section as [start, end) EXCLUDING the heading line itself —
// what a caller needs to mutate lines in place. null when the section is absent.
export function sectionRange(lines, heading) {
  const head = `## ${heading}`;
  const start = lines.findIndex((l) => l.trim() === head);
  if (start === -1) return null;
  const rel = lines.slice(start + 1).findIndex((l) => /^## /.test(l));
  return { start: start + 1, end: rel === -1 ? lines.length : start + 1 + rel };
}
