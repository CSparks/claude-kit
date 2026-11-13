// cargo-metadata-read.mjs — the `cargo metadata` document of the workspace a cargo command line builds (KIT-T1147).
//
//   readMetadata(args, cwd, cargo?) -> { meta, reason }
//     `meta` is the parsed document, or null with `reason` naming why not. The workspace is the one at `cwd`, or the one a
//     `--manifest-path` / `-C DIR` flag points at. The document is read for every platform first; when that fails (a
//     target-specific registry crate that is not downloaded fails an `--offline` read) it is read again filtered to the
//     command's `--target` or the host triple, which lists the packages this build can compile.
//   workspaceArgs(args, cwd) -> { cwd, manifest } the directory and manifest path the command line names

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const METADATA_TIMEOUT_MS = 20000;
const RUSTC_TIMEOUT_MS = 10000;
const METADATA_BUFFER_BYTES = 1 << 28;
const HOST_LINE = /^host:\s*(\S+)/m;

function flagValue(args, flags) {
  const list = [];
  for (const a of args) {
    if (String(a) === '--') break;
    list.push(String(a));
  }
  for (let i = 0; i < list.length; i += 1) {
    for (const flag of flags) {
      if (list[i] === flag) return list[i + 1] ?? '';
      if (list[i].startsWith(`${flag}=`)) return list[i].slice(flag.length + 1);
    }
  }
  return '';
}

export function workspaceArgs(args, cwd) {
  const dir = flagValue(args, ['-C']);
  const base = dir ? resolve(cwd, dir) : cwd;
  const manifest = flagValue(args, ['--manifest-path']);
  return { cwd: base, manifest: manifest ? resolve(base, manifest) : '' };
}

function hostTriple() {
  const r = spawnSync('rustc', ['-vV'], { encoding: 'utf8', timeout: RUSTC_TIMEOUT_MS, windowsHide: true });
  return r.status === 0 ? (HOST_LINE.exec(r.stdout) || [])[1] || '' : '';
}

function run(cargo, cwd, extra) {
  const r = spawnSync(cargo, ['metadata', '--offline', '--format-version', '1', ...extra], { cwd, encoding: 'utf8', timeout: METADATA_TIMEOUT_MS, maxBuffer: METADATA_BUFFER_BYTES, windowsHide: true, shell: /\.(cmd|bat)$/i.test(cargo) });
  if (r.status !== 0) return { meta: null, reason: String(r.stderr || r.error || 'no output').split('\n').find((l) => l.trim()) || 'no output' };
  try { return { meta: JSON.parse(r.stdout), reason: '' }; } catch { return { meta: null, reason: 'unparseable output' }; }
}

export function readMetadata(args, cwd, cargo = 'cargo') {
  const where = workspaceArgs(args, cwd);
  const manifest = where.manifest ? ['--manifest-path', where.manifest] : [];
  const first = run(cargo, where.cwd, manifest);
  if (first.meta) return first;
  const triple = flagValue(args, ['--target']) || hostTriple();
  const second = triple ? run(cargo, where.cwd, [...manifest, '--filter-platform', triple]) : first;
  return second.meta ? second : { meta: null, reason: `cargo metadata failed in ${where.cwd}: ${first.reason}` };
}
