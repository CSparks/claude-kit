// apply.mjs — apply patch ops to file contents in memory, content-addressed (KIT-T276).
//
// `dryRun(ops, read, { onDisk })`: `read(path)` gives a file's current text or null when absent;
// `onDisk(path)` says whether an untracked file already sits at a path `read` reports absent.
// An edit applies while its SEARCH text matches exactly once, wherever the file has moved to.
// Returns { ok, files: Map(path → { existed, text }), stale: [{ index, path, reason, excerpt }] }
// where `text` null means the file is gone. Reasons: not-found · ambiguous xN · create-exists ·
// bad-path.

const EXCERPT_BEFORE = 3;
const EXCERPT_AFTER = 4;
const NEEDLE_CHARS = 30;

export const safePath = (p) => !!p && !/^([a-zA-Z]:|[\\/])/.test(p) && !p.split(/[\\/]/).includes('..');

// Lines of `text` around the one most like the first non-blank SEARCH line, numbered.
export function excerpt(text, search) {
  if (text == null) return '';
  const lines = text.split('\n');
  const needle = (search.split('\n').find((l) => l.trim()) || '').trim();
  let at = lines.findIndex((l) => l.trim() === needle);
  if (at < 0) at = lines.findIndex((l) => needle && l.includes(needle.slice(0, NEEDLE_CHARS)));
  const mid = Math.max(at, 0);
  const from = Math.max(0, mid - EXCERPT_BEFORE);
  return lines.slice(from, mid + EXCERPT_AFTER + 1).map((l, k) => `${from + k + 1}: ${l}`).join('\n');
}

function occurrences(text, search) {
  let n = 0;
  for (let at = text.indexOf(search); at >= 0; at = text.indexOf(search, at + search.length)) n++;
  return n;
}

export function dryRun(ops, read, { onDisk = () => false } = {}) {
  const files = new Map();
  const stale = [];
  const state = (path) => {
    if (!files.has(path)) { const text = read(path); files.set(path, { existed: text !== null, text }); }
    return files.get(path);
  };
  ops.forEach((op, index) => {
    const miss = (reason, text) => stale.push({ index, path: op.path, reason, excerpt: op.search ? excerpt(text, op.search) : '' });
    if (!safePath(op.path)) return miss('bad-path', null);
    const f = state(op.path);
    if (op.kind === 'write') {
      if (f.text !== null || onDisk(op.path)) return miss('create-exists', f.text);
      f.text = op.content;
    } else if (f.text === null) {
      miss('not-found', null);
    } else if (op.kind === 'delete') {
      f.text = null;
    } else {
      const n = occurrences(f.text, op.search);
      if (n !== 1) return miss(n ? `ambiguous x${n}` : 'not-found', f.text);
      const at = f.text.indexOf(op.search);
      f.text = f.text.slice(0, at) + op.replace + f.text.slice(at + op.search.length);
    }
  });
  return { ok: !stale.length, files, stale };
}
