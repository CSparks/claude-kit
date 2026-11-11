// References to the frozen legacy directory that a write would ADD (KIT-T989): a Cargo workspace member or path
// dependency, an npm script, workspace or `file:` dependency, a JS/TS import or require, a Rust `#[path]` or
// `include!`. Only these manifest and import shapes are read, and a specifier is resolved to a path (relative ones
// against the file, bare ones against the repo root) before it is compared, so a `legacyDefaults` symbol, prose in a
// description or a `node_modules/x/legacy` path never counts. A Cargo `exclude` list names legacy on purpose.
//
//   legacyReferences({ root, dir, file, text, firstLine }) -> [{ line, text, what }]

import { basename, dirname, extname } from 'node:path';
import { underLegacy } from './legacy-paths.mjs';

const QUOTED = /"([^"\\\n]+)"|'([^'\\\n]+)'/g;
const SCRIPT_WORDS = /[^\s;&|<>()]+/g;
const JS_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.vue', '.svelte']);
const JS_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(?:"([^"\n]+)"|'([^'\n]+)')/g;
const RUST_PATH = /#\[\s*path\s*=\s*"([^"\n]+)"|\binclude(?:_str|_bytes)?!\s*\(\s*"([^"\n]+)"/g;
const PROSE_KEYS = new Set(['name', 'description', 'repository', 'homepage', 'keywords', 'author', 'license', 'bugs', 'version']);
const DEP_PREFIX = /^(?:file|link|path):/;
const TOML_KEY = /^\s*([A-Za-z][\w-]*)\s*=/;
const JSON_KEY = /^\s*"([^"]+)"\s*:/;

const strings = (line) => [...line.matchAll(QUOTED)].map((m) => m[1] ?? m[2]);

function cargoReferences(lines, hit) {
  let key = '';
  return lines.flatMap((line, i) => {
    const m = TOML_KEY.exec(line);
    if (m) key = m[1];
    return key !== 'exclude' && strings(line).some(hit) ? [{ i, what: 'a Cargo path or workspace member' }] : [];
  });
}

function packageReferences(lines, hit) {
  return lines.flatMap((line, i) => {
    const key = JSON_KEY.exec(line);
    if (key && PROSE_KEYS.has(key[1])) return [];
    const values = key ? strings(line.slice(line.indexOf(':') + 1)) : strings(line);
    const words = values.flatMap((v) => v.replace(DEP_PREFIX, '').match(SCRIPT_WORDS) || []);
    return words.some(hit) ? [{ i, what: 'an npm script target, workspace or dependency' }] : [];
  });
}

function patternReferences(lines, pattern, what, hit) {
  return lines.flatMap((line, i) => [...line.matchAll(pattern)].some((m) => hit(m[1] ?? m[2])) ? [{ i, what }] : []);
}

export function legacyReferences({ root, dir, file, text, firstLine = 1 }) {
  const lines = String(text).split(/\r?\n/);
  const here = dirname(file);
  const name = basename(file);
  const bareFromRoot = (path) => !path.startsWith('.') && path.includes('/') && underLegacy(root, dir, path, root);
  const hit = (path) => underLegacy(root, dir, path, here) || bareFromRoot(path);
  let found = [];
  if (name === 'Cargo.toml') found = cargoReferences(lines, hit);
  else if (name === 'package.json') found = packageReferences(lines, hit);
  else if (JS_EXT.has(extname(name).toLowerCase())) found = patternReferences(lines, JS_SPECIFIER, 'an import of legacy code', hit);
  else if (extname(name).toLowerCase() === '.rs') found = patternReferences(lines, RUST_PATH, 'a Rust path or include of legacy code', hit);
  return found.map(({ i, what }) => ({ line: firstLine + i, text: lines[i].trim(), what }));
}
