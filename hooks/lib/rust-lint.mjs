// Rust lint for one edited file, with no cargo build (KIT-D135, KIT-D162).
//   rustEdition(file) -> the edition the file's crate declares, resolving `edition.workspace = true`
//                        through the workspace manifest's [workspace.package]; DEFAULT_EDITION if none
//   rustLintCommand(file) -> [cmd, args]: rustfmt --check on that file alone
//
// A workspace-wide `cargo clippy` or `cargo fmt` per edit is an unbudgeted build that waits on
// the target-dir lock behind other writers' builds (KIT-T1421).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const DEFAULT_EDITION = '2021';

const HEADER = /^\s*\[([^\]]+)\]\s*$/;
const LITERAL = /^\s*edition\s*=\s*"(\d{4})"/;
const INHERITED = /^\s*edition\s*(\.\s*workspace\s*=\s*true|=\s*\{\s*workspace\s*=\s*true\s*\})/;

function editionIn(text, section) {
  let current = '';
  for (const line of text.split(/\r?\n/)) {
    const header = HEADER.exec(line);
    if (header) {
      current = header[1].trim();
      continue;
    }
    if (current !== section) continue;
    const literal = LITERAL.exec(line);
    if (literal) return literal[1];
    if (INHERITED.test(line)) return 'workspace';
  }
  return null;
}

function* manifestsAbove(dir) {
  for (let at = dir; ; ) {
    const manifest = join(at, 'Cargo.toml');
    if (existsSync(manifest)) yield manifest;
    const up = dirname(at);
    if (up === at) return;
    at = up;
  }
}

export function rustEdition(file) {
  let section = 'package';
  for (const manifest of manifestsAbove(dirname(file))) {
    let text;
    try {
      text = readFileSync(manifest, 'utf8');
    } catch {
      continue;
    }
    const found = editionIn(text, section);
    if (found === 'workspace') section = 'workspace.package';
    else if (found) return found;
  }
  return DEFAULT_EDITION;
}

export const rustLintCommand = (file) => ['rustfmt', ['--check', '--edition', rustEdition(file), file]];
