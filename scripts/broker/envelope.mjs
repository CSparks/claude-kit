// envelope.mjs — parse the patch envelope a worker pipes to submit.mjs (KIT-T276).
//
//   *** edit <path>            one or more search/replace blocks
//   <<<<<<< SEARCH
//   exact old text
//   =======
//   new text
//   >>>>>>> REPLACE
//   *** write <path>           new file: every following line up to the next header
//   *** delete <path>
//
// `parseEnvelope(text)` → ops `{ kind: 'edit', path, search, replace } | { kind: 'write', path,
// content } | { kind: 'delete', path }`, in order. Malformed input throws EnvelopeError naming
// the line, so a worker fixes the envelope instead of getting a silent partial patch.

const HEADER = /^\*\*\* (edit|write|delete) (.+?)\s*$/;
const SEARCH = '<<<<<<< SEARCH';
const DIVIDER = '=======';
const REPLACE = '>>>>>>> REPLACE';

export class EnvelopeError extends Error {}

export function parseEnvelope(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const ops = [];
  let i = 0;
  const fail = (msg) => { throw new EnvelopeError(`envelope line ${i + 1}: ${msg}`); };
  const skipBlank = () => { while (i < lines.length && lines[i].trim() === '') i++; };

  skipBlank();
  while (i < lines.length) {
    const m = HEADER.exec(lines[i]);
    if (!m) fail(`expected "*** edit|write|delete <path>", got "${lines[i]}"`);
    const [, kind, path] = m;
    i++;
    if (kind === 'delete') ops.push({ kind, path });
    else if (kind === 'write') ops.push({ kind, path, content: readWrite() });
    else readEdits(path);
    skipBlank();
  }
  if (!ops.length) fail('no operations');
  return ops;

  function readWrite() {
    const body = [];
    while (i < lines.length && !HEADER.test(lines[i])) body.push(lines[i++]);
    while (body.length && body[body.length - 1] === '') body.pop();
    return body.length ? `${body.join('\n')}\n` : '';
  }

  function readEdits(path) {
    let blocks = 0;
    for (skipBlank(); i < lines.length && !HEADER.test(lines[i]); skipBlank()) {
      if (lines[i] !== SEARCH) fail(`expected "${SEARCH}", got "${lines[i]}"`);
      i++;
      const search = until(DIVIDER);
      const replace = until(REPLACE);
      if (search === '') fail('empty SEARCH text');
      ops.push({ kind: 'edit', path, search, replace });
      blocks++;
    }
    if (!blocks) fail(`"*** edit ${path}" has no SEARCH/REPLACE block`);
  }

  function until(marker) {
    const out = [];
    while (i < lines.length && lines[i] !== marker) out.push(lines[i++]);
    if (i >= lines.length) fail(`missing "${marker}"`);
    i++;
    return out.join('\n');
  }
}
