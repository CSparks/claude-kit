// unreachable-source.mjs — a Rust source file no build can read (KIT-T1123, KIT-T1189, KIT-T1190). Cargo reads a file only
// through a target location (src/main.rs, src/lib.rs, build.rs, src/bin, tests, examples, benches) or through a chain of
// `mod name;` declarations from one. A file outside that chain, new or existing, cannot change the build compiling its crate.
//
//   isUnreachableSource(file) -> boolean   true only when the answer is certain; any doubt is false (the write stays held)
//
// The chain follows the module path rules: `mod x;` in lib.rs, main.rs, mod.rs or a target file names `x.rs` or `x/mod.rs`
// beside it; in any other `y.rs` it names `y/x.rs` or `y/x/mod.rs`. A crate that uses `#[path]`, `include!`, a custom target
// `path =` in its manifest, or a `mod x;` inside an inline `mod {}` is not walked: there a file is unreachable only when no
// file of the crate names its module at all.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const MANIFEST = 'Cargo.toml';
const SKIPPED_DIRS = new Set(['target', '.git', 'node_modules']);
const ROOT_TARGETS = new Set(['main.rs', 'lib.rs', 'build.rs']);
const DISCOVERED_DIRS = [['src', 'bin'], ['tests'], ['examples'], ['benches']];
const MOD_ROOTS = new Set(['mod.rs', 'lib.rs', 'main.rs']);
const RUST_FILE = /\.rs$/i;
const NOT_WALKABLE = /#\[\s*path\s*=|\binclude!\s*\(/;
const CUSTOM_TARGET_PATH = /^\s*path\s*=/m;
const COMMENTS_AND_LITERALS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|\br(#*)"[\s\S]*?"\1|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[^']+|[^\\'])'/g;
const MOD_DECLARATION = /\bmod\s+([A-Za-z_]\w*)\s*(;|\{)/g;

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (path) => resolve(path).toLowerCase();

function crateRoot(file) {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (existsSync(join(dir, MANIFEST))) return dir;
    if (dirname(dir) === dir) return null;
  }
}

function rustFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : rustFiles(join(dir, entry.name));
    return entry.isFile() && RUST_FILE.test(entry.name) ? [join(dir, entry.name)] : [];
  });
}

const startsWithSegments = (segments, prefix) => prefix.every((part, i) => segments[i] === part);

function isDiscoveredByCargo(segments) {
  return (segments.length === 1 && ROOT_TARGETS.has(segments[0]))
    || (segments.length === 2 && segments[0] === 'src' && ROOT_TARGETS.has(segments[1]))
    || DISCOVERED_DIRS.some((prefix) => startsWithSegments(segments, prefix));
}

function moduleNameOf(file) {
  const name = basename(file);
  return name.toLowerCase() === 'mod.rs' ? basename(dirname(file)) : name.replace(RUST_FILE, '');
}

/** The `mod name;` declarations of a source text, and whether any sits inside an inline block (a layout this walk cannot place). */
function declarations(source) {
  const text = source.replace(COMMENTS_AND_LITERALS, ' ');
  const names = [];
  let nested = false;
  let depth = 0;
  let at = 0;
  for (const m of text.matchAll(MOD_DECLARATION)) {
    for (const ch of text.slice(at, m.index)) depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
    at = m.index;
    if (m[2] === ';') { names.push(m[1]); nested ||= depth > 0; }
  }
  return { names, nested };
}

const modulesDir = (file, roots) => (roots.has(norm(file)) || MOD_ROOTS.has(basename(file).toLowerCase()) ? dirname(file) : join(dirname(file), basename(file).replace(RUST_FILE, '')));

function walkedFrom(entries, texts, target) {
  const roots = new Set(entries.map(norm));
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(norm(file))) continue;
    seen.add(norm(file));
    const dir = modulesDir(file, roots);
    for (const name of declarations(texts.get(norm(file)) ?? '').names) {
      const child = [join(dir, `${name}.rs`), join(dir, name, 'mod.rs')].find((c) => texts.has(norm(c)) || norm(c) === norm(target));
      if (child) queue.push(child);
    }
  }
  return seen;
}

export function isUnreachableSource(file) {
  try {
    if (!RUST_FILE.test(file)) return false;
    const root = crateRoot(file);
    if (!root) return false;
    if (isDiscoveredByCargo(relative(root, file).split(sep))) return false;
    const files = rustFiles(root);
    const texts = new Map(files.map((f) => [norm(f), readFileSync(f, 'utf8')]));
    const sources = [...texts.values()];
    const loose = sources.some((s) => NOT_WALKABLE.test(s) || declarations(s).nested) || CUSTOM_TARGET_PATH.test(readFileSync(join(root, MANIFEST), 'utf8'));
    if (loose) {
      const named = new RegExp(`\\bmod\\s+${escaped(moduleNameOf(file))}\\b|${escaped(basename(file))}`);
      return !files.some((f) => norm(f) !== norm(file) && named.test(texts.get(norm(f))));
    }
    const entries = files.filter((f) => isDiscoveredByCargo(relative(root, f).split(sep)));
    return !walkedFrom(entries, texts, file).has(norm(file));
  } catch {
    return false;
  }
}
