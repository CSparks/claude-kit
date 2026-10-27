// binary-flag.mjs — `submit.mjs --binary <dest>=<file>` (repeatable) turns files on disk into
// `*** write-binary` envelope sections, so a worker never base64-encodes a glb or a png by hand.
//
// `binaryEnvelope(specs, { cwd })` → { text } | { error }: `dest` is the repo path the bytes land at,
// `file` is read relative to `cwd`. The text is appended to the stdin envelope.

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const LINE_CHARS = 76;
export const MAX_BINARY_BYTES = 64 * 1024 * 1024;

export function binaryEnvelope(specs, { cwd }) {
  const sections = [];
  for (const spec of specs.map(String)) {
    const at = spec.indexOf('=');
    if (at <= 0 || at === spec.length - 1) return { error: `--binary wants <dest>=<file>, got "${spec}"` };
    const dest = spec.slice(0, at);
    const file = resolve(cwd, spec.slice(at + 1));
    let size;
    try { size = statSync(file).size; } catch { return { error: `--binary ${dest}: cannot read ${file}` }; }
    if (size > MAX_BINARY_BYTES) return { error: `--binary ${dest}: ${file} is ${size} bytes, over the ${MAX_BINARY_BYTES} byte limit a queued job carries` };
    const rows = readFileSync(file).toString('base64').match(new RegExp(`.{1,${LINE_CHARS}}`, 'g')) || [];
    if (!rows.length) return { error: `--binary ${dest}: ${file} is empty` };
    sections.push(`*** write-binary ${dest}\n${rows.join('\n')}\n`);
  }
  return { text: sections.join('') };
}
