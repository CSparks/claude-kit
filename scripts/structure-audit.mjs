#!/usr/bin/env node
// structure-audit.mjs — structural smells in a code tree (KIT-T282). Reads the tree through the
// shared walker (tree-walk.mjs) and units (doc-tree.mjs); reports each finding as
// `rule  path  message`, grouped by rule. Exit 1 when anything is found.
//
//   node scripts/structure-audit.mjs [root] [--json]
//
// Rules:
//   name-doubling        <dir>/<dir>/, or a folder / module file at any depth under a crate's src
//                        named after the crate (minus rg-, - as _)
//   single-file-folder   a folder holding exactly one source file and nothing else
//   ungrouped-folder     more than FLAT_MAX source files directly in one folder
//   two-homes            equivalent folder names inside one unit (util/utils/helpers/common…)
//   orphan-module        a Rust file no `mod x;` declares
//   file-over-hard/soft  source file past the pre-write size gate (hooks/lib/limits.mjs)
//   style-drift          sibling crates that differ in layout or module style
// Orphan detection is Rust-only; JS/TS importers come from code-graph (`importers-of`).

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkTree, isSource, extOf, MANIFESTS } from './tree-walk.mjs';
import { findUnits } from './doc-tree.mjs';
import { FILE_SOFT, FILE_HARD } from '../hooks/lib/limits.mjs';

const FLAT_MAX = 20;
const DRIFT_MIN_SIBLINGS = 3;
const DRIFT_MAJORITY = 2 / 3;
const SPECIAL_DIRS = new Set(['tests', 'test', 'benches', 'examples', 'fixtures', 'assets', 'bin', '__tests__', 'src', 'lib']);
const RUST_ENTRY = new Set(['lib.rs', 'main.rs', 'mod.rs', 'build.rs']);
const SYNONYMS = ['util', 'utils', 'helper', 'helpers', 'common', 'shared', 'misc'];

const parentOf = (rel) => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
const baseOf = (rel) => rel.slice(rel.lastIndexOf('/') + 1);
const at = (dir, name) => (dir ? `${dir}/${name}` : name);
const stem = (n) => n.toLowerCase().replace(/[-_]/g, '').replace(/s$/, '');
const homeKey = (n) => (SYNONYMS.includes(n.toLowerCase()) ? 'util-like' : stem(n));
const srcFiles = (e) => e.files.filter(isSource);

const crateWord = (dir) => baseOf(dir).toLowerCase().replace(/^rg-/, '').replace(/-/g, '_');

// Folders and module files anywhere under a crate's src whose name is the crate's name.
function crateNameRepeats(tree) {
  const out = [];
  for (const [crate, entry] of tree) {
    if (!crate || !entry.files.some((f) => MANIFESTS.has(f)) || !tree.has(at(crate, 'src'))) continue;
    const word = crateWord(crate);
    const src = at(crate, 'src');
    for (const [rel, e] of tree) {
      if (rel !== src && !rel.startsWith(src + '/')) continue;
      if (rel !== src && baseOf(rel).toLowerCase().replace(/-/g, '_') === word) out.push({ rule: 'name-doubling', path: rel, msg: `folder repeats the crate name "${word}" (${crate})` });
      for (const f of e.files.filter((n) => extOf(n) === 'rs' && n.slice(0, -3).toLowerCase() === word)) {
        out.push({ rule: 'name-doubling', path: at(rel, f), msg: `module file repeats the crate name "${word}" (${crate})` });
      }
    }
  }
  return out;
}

function nameDoubling(tree) {
  const out = [];
  for (const rel of tree.keys()) {
    if (!rel.includes('/')) continue;
    const parent = parentOf(rel);
    const base = baseOf(rel);
    if (stem(base) === stem(baseOf(parent)) && base.length > 1) out.push({ rule: 'name-doubling', path: rel, msg: `repeats its parent folder name "${baseOf(parent)}"` });
    if (baseOf(parent) === 'src') {
      const crate = parentOf(parent);
      const entry = tree.get(crate);
      if (entry && entry.files.some((f) => MANIFESTS.has(f)) && stem(base) === stem(baseOf(crate))) {
        out.push({ rule: 'name-doubling', path: rel, msg: `crate/src/<crate-name> doubling (${crate})` });
      }
    }
  }
  const seen = new Set(out.map((f) => f.path));
  return [...out, ...crateNameRepeats(tree).filter((f) => !seen.has(f.path))];
}

function singleFileFolders(tree) {
  const out = [];
  for (const [rel, e] of tree) {
    if (!rel || SPECIAL_DIRS.has(baseOf(rel)) || e.dirs.length || e.files.length !== 1) continue;
    if (isSource(e.files[0]) && !MANIFESTS.has(e.files[0])) out.push({ rule: 'single-file-folder', path: rel, msg: `only ${e.files[0]} — fold into the parent or grow the concern` });
  }
  return out;
}

function ungrouped(tree) {
  const out = [];
  for (const [rel, e] of tree) {
    const n = srcFiles(e).length;
    if (n > FLAT_MAX) out.push({ rule: 'ungrouped-folder', path: rel || '.', msg: `${n} source files in one folder — group by concern` });
  }
  return out;
}

function twoHomes(tree, units) {
  const unitOf = (rel) => units.filter((u) => u.kind !== 'concern' && (u.dir === '' || rel === u.dir || rel.startsWith(u.dir + '/'))).map((u) => u.dir).sort((a, b) => b.length - a.length)[0] ?? '';
  const groups = new Map();
  for (const [rel, e] of tree) {
    if (!rel || !srcFiles(e).length || SPECIAL_DIRS.has(baseOf(rel))) continue;
    const key = `${unitOf(rel)}|${homeKey(baseOf(rel))}`;
    groups.set(key, [...(groups.get(key) || []), rel]);
  }
  const out = [];
  for (const paths of groups.values()) {
    if (paths.length < 2) continue;
    for (const p of paths) out.push({ rule: 'two-homes', path: p, msg: `one concern, ${paths.length} homes: ${paths.join(', ')}` });
  }
  return out;
}

function orphanModules(root, tree) {
  const out = [];
  const text = (rel) => { try { return readFileSync(join(root, rel), 'utf8'); } catch { return ''; } };
  for (const [dir, e] of tree) {
    if (dir.split('/').some((s) => SPECIAL_DIRS.has(s) && s !== 'src' && s !== 'lib')) continue;
    for (const f of e.files.filter((n) => extOf(n) === 'rs' && !RUST_ENTRY.has(n))) {
      const mod = f.slice(0, -3);
      const hosts = e.files.filter((n) => extOf(n) === 'rs' && n !== f).map((n) => at(dir, n));
      const sibling = parentOf(dir) !== undefined && tree.get(parentOf(dir))?.files.includes(`${baseOf(dir)}.rs`) ? [at(parentOf(dir), `${baseOf(dir)}.rs`)] : [];
      const modDecl = new RegExp(String.raw`\bmod\s+${mod}\s*;`);
      const pathAttr = new RegExp(String.raw`#\[path\s*=\s*"(?:[^"]*/)?${f.replace('.', String.raw`\.`)}"`);
      const declared = [...hosts, ...sibling].some((h) => modDecl.test(text(h)) || pathAttr.test(text(h)));
      if (!declared) out.push({ rule: 'orphan-module', path: at(dir, f), msg: `no \`mod ${mod};\` declares this file` });
    }
    if (dir && e.files.includes('mod.rs')) {
      const parent = tree.get(parentOf(dir));
      const hosts = (parent?.files || []).filter((n) => extOf(n) === 'rs').map((n) => at(parentOf(dir), n));
      const grand = tree.get(parentOf(parentOf(dir)))?.files.includes(`${baseOf(parentOf(dir))}.rs`) ? [at(parentOf(parentOf(dir)), `${baseOf(parentOf(dir))}.rs`)] : [];
      if (!hosts.concat(grand).some((h) => new RegExp(String.raw`\bmod\s+${baseOf(dir)}\s*;`).test(text(h)))) {
        out.push({ rule: 'orphan-module', path: at(dir, 'mod.rs'), msg: `no \`mod ${baseOf(dir)};\` declares this folder` });
      }
    }
  }
  return out;
}

function fileSizes(root, tree) {
  const out = [];
  for (const [dir, e] of tree) {
    for (const f of srcFiles(e)) {
      let lines = 0;
      try { lines = readFileSync(join(root, dir, f), 'utf8').split('\n').length; } catch { continue; }
      if (lines > FILE_HARD) out.push({ rule: 'file-over-hard', path: at(dir, f), msg: `${lines} lines (hard limit ${FILE_HARD})` });
      else if (lines > FILE_SOFT) out.push({ rule: 'file-over-soft', path: at(dir, f), msg: `${lines} lines (soft limit ${FILE_SOFT})` });
    }
  }
  return out;
}

function moduleStyle(tree, crate) {
  let modRs = false;
  let named = false;
  for (const [rel, e] of tree) {
    if (rel !== crate && !rel.startsWith(crate + '/')) continue;
    if (e.files.includes('mod.rs')) modRs = true;
    for (const f of e.files) if (extOf(f) === 'rs' && !RUST_ENTRY.has(f) && e.dirs.includes(f.slice(0, -3))) named = true;
  }
  return modRs && named ? 'mixed' : modRs ? 'mod.rs' : named ? 'named' : '';
}

function styleDrift(tree, units) {
  const out = [];
  const byParent = new Map();
  for (const u of units.filter((x) => x.kind === 'crate')) byParent.set(parentOf(u.dir), [...(byParent.get(parentOf(u.dir)) || []), u.dir]);
  for (const crates of byParent.values()) {
    for (const c of crates) {
      if (moduleStyle(tree, c) === 'mixed') out.push({ rule: 'style-drift', path: c, msg: 'mixes mod.rs folders with name.rs + name/ modules' });
    }
    if (crates.length < DRIFT_MIN_SIBLINGS) continue;
    const withSrc = crates.filter((c) => tree.has(at(c, 'src')));
    if (withSrc.length / crates.length >= DRIFT_MAJORITY) {
      for (const c of crates.filter((x) => !withSrc.includes(x))) out.push({ rule: 'style-drift', path: c, msg: `no src/ while ${withSrc.length}/${crates.length} sibling crates have one` });
    }
    const styles = crates.map((c) => [c, moduleStyle(tree, c)]).filter(([, s]) => s === 'mod.rs' || s === 'named');
    for (const kind of ['mod.rs', 'named']) {
      const same = styles.filter(([, s]) => s === kind).length;
      if (styles.length >= DRIFT_MIN_SIBLINGS && same / styles.length >= DRIFT_MAJORITY) {
        for (const [c] of styles.filter(([, s]) => s !== kind)) out.push({ rule: 'style-drift', path: c, msg: `module style differs from ${same}/${styles.length} sibling crates (${kind})` });
      }
    }
  }
  return out;
}

/** Findings [{ rule, path, msg }] for `root`, sorted by rule then path. */
export function auditStructure(root) {
  const tree = walkTree(root);
  const units = findUnits(root, tree);
  const all = [
    ...nameDoubling(tree), ...singleFileFolders(tree), ...ungrouped(tree), ...twoHomes(tree, units),
    ...orphanModules(root, tree), ...fileSizes(root, tree), ...styleDrift(tree, units),
  ];
  return all.sort((a, b) => a.rule.localeCompare(b.rule) || a.path.localeCompare(b.path));
}

function main(argv) {
  const root = resolve(argv.find((a) => !a.startsWith('--')) || process.cwd());
  const found = auditStructure(root);
  if (argv.includes('--json')) { process.stdout.write(JSON.stringify(found, null, 2) + '\n'); return found.length ? 1 : 0; }
  let last = '';
  for (const f of found) {
    if (f.rule !== last) { process.stdout.write(`\n[${f.rule}]\n`); last = f.rule; }
    process.stdout.write(`  ${f.path}  ${f.msg}\n`);
  }
  process.stdout.write(found.length ? `\n${found.length} finding(s)\n` : 'structure clean\n');
  return found.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
