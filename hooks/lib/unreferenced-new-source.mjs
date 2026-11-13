// unreferenced-new-source.mjs — a Rust file that does not exist yet and that no build can reach (KIT-T1123). Cargo reads a
// source file only through a `mod` declaration, a `#[path]` attribute, an `include!`, or by finding it at a target
// location (src/main.rs, src/lib.rs, build.rs, src/bin, tests, examples, benches). A Write that creates a file outside
// those locations, which no .rs file of its crate names, cannot change the build that is compiling the crate.
//
//   isUnreferencedNewSource(file) -> boolean   true only when the answer is certain; any doubt is false (the write stays held)

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

const MANIFEST = 'Cargo.toml';
const SKIPPED_DIRS = new Set(['target', '.git', 'node_modules']);
const ROOT_TARGETS = new Set(['main.rs', 'lib.rs', 'build.rs']);
const DISCOVERED_DIRS = [['src', 'bin'], ['tests'], ['examples'], ['benches']];
const MODULE_FILE = 'mod.rs';
const RUST_FILE = /\.rs$/i;

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  return name.toLowerCase() === MODULE_FILE ? basename(dirname(file)) : name.replace(RUST_FILE, '');
}

export function isUnreferencedNewSource(file) {
  try {
    if (!RUST_FILE.test(file) || existsSync(file)) return false;
    const root = crateRoot(file);
    if (!root) return false;
    const segments = relative(root, file).split(sep);
    if (isDiscoveredByCargo(segments)) return false;
    const named = new RegExp(`\\bmod\\s+${escaped(moduleNameOf(file))}\\b|${escaped(basename(file))}`);
    return !rustFiles(root).some((other) => named.test(readFileSync(other, 'utf8')));
  } catch {
    return false;
  }
}
