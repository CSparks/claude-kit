// build-audit.mjs — project settings that ask for more cores than the machine build budget (KIT-D135). Read only:
// the build runner already cuts them to the budget when they run; changing a project's file is the maintainer's call.
//
//   auditProjects(budget, { roots? }) -> [{ project, file, line, jobs, text }]
//   formatAudit(findings)             -> text
// Scans every registered project and its sibling directories for `[build] jobs` in `.cargo/config.toml`, `jobs:` in
// `.ai/config.yml`, and `-j N` / `--jobs N` on any cargo, nextest or ndk line of the usual script files.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { readRegistry } from '../../hooks/lib/registry.mjs';

const SCRIPT_FILES = ['package.json', 'justfile', 'Makefile'];
const SCRIPT_DIRS = ['scripts', '.githooks', '.husky', '.github/workflows', '.cargo'];
const SCRIPT_EXT = /\.(sh|ps1|mjs|js|json|ya?ml|toml|bat|cmd)$/i;
const BUILD_LINE = /\b(cargo|nextest|ndk)\b/i;
const JOBS_ARG = /(?:^|\s)(?:-j\s?|--jobs[ =])(\d+)\b/;
const CONFIG_JOBS = /^\s*jobs\s*[:=]\s*(\d+)/;
const SNIPPET_CHARS = 90;

const filesIn = (root, dir) => {
  const path = join(root, dir);
  try { return readdirSync(path).map((n) => join(path, n)).filter((f) => SCRIPT_EXT.test(f) && statSync(f).isFile()); } catch { return []; }
};

function scanFile(project, file, budget, keyed) {
  const found = [];
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((text, i) => {
    const m = (keyed && CONFIG_JOBS.exec(text)) || (BUILD_LINE.test(text) && JOBS_ARG.exec(text));
    if (m && Number(m[1]) > budget) found.push({ project, file, line: i + 1, jobs: Number(m[1]), text: text.trim().slice(0, SNIPPET_CHARS) });
  });
  return found;
}

function projectRoots() {
  const registered = Object.values(readRegistry().projects).map(String);
  const siblings = registered.flatMap((p) => { try { return readdirSync(dirname(p)).map((n) => join(dirname(p), n)); } catch { return []; } });
  const unique = new Map([...registered, ...siblings].map((p) => [resolve(p).toLowerCase(), resolve(p)]));
  return [...unique.values()].filter((r) => existsSync(join(r, '.cargo')) || existsSync(join(r, 'Cargo.toml')) || existsSync(join(r, '.ai', 'config.yml')));
}

export function auditProjects(budget, { roots = projectRoots() } = {}) {
  return roots.flatMap((root) => {
    const project = basename(root);
    const keyed = [join(root, '.cargo', 'config.toml'), join(root, '.ai', 'config.yml')].filter(existsSync);
    const scripts = [...SCRIPT_FILES.map((f) => join(root, f)).filter(existsSync), ...SCRIPT_DIRS.flatMap((d) => filesIn(root, d))];
    const keyedFindings = keyed.flatMap((f) => scanFile(project, f, budget, true));
    const lineFindings = scripts.filter((f) => !keyed.includes(f)).flatMap((f) => scanFile(project, f, budget, false));
    return [...keyedFindings, ...lineFindings].filter((f, i, all) => all.findIndex((g) => g.file === f.file && g.line === f.line) === i);
  });
}

export function formatAudit(findings) {
  if (!findings.length) return 'settings over the budget: none';
  return ['settings over the budget (clamped when they run, never edited):', ...findings.map((f) => `  ${f.project}  jobs ${f.jobs}  ${f.file}:${f.line}  ${f.text}`)].join('\n');
}
