#!/usr/bin/env node
// registry-prune.mjs — drop machine-registry entries that cannot answer anything: a checkout that no
// longer exists on this machine, or one under the OS temp dir (a test fixture). A project with a
// central data store keeps its entry. Dry run unless --apply.
//
//   node scripts/registry-prune.mjs [--apply]

import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { isMain } from './is-main.mjs';
import { registryPath } from '../hooks/lib/registry.mjs';

const underTemp = (path) => {
  try {
    const rel = relative(realpathSync.native(tmpdir()), realpathSync.native(path));
    return rel !== '' && !rel.startsWith('..') && !/^[A-Za-z]:/.test(rel);
  } catch { return false; }
};

/** { keep, drop: [{ name, path, why }] } for a registry object. */
export function planPrune(registry) {
  const keep = {};
  const drop = [];
  for (const [name, path] of Object.entries(registry.projects || {})) {
    const central = registry.dataRoot && existsSync(join(registry.dataRoot, 'projects', name, 'config.yml'));
    if (central) keep[name] = path;
    else if (!existsSync(path)) drop.push({ name, path, why: 'checkout is gone' });
    else if (underTemp(path)) drop.push({ name, path, why: 'test fixture under the temp dir' });
    else keep[name] = path;
  }
  return { keep, drop };
}

if (isMain(import.meta.url)) {
  const file = registryPath();
  const registry = JSON.parse(readFileSync(file, 'utf8'));
  const { keep, drop } = planPrune(registry);
  for (const d of drop) console.log(`drop ${d.name}  ${d.path}  (${d.why})`);
  if (process.argv.includes('--apply') && drop.length) {
    writeFileSync(file, JSON.stringify({ ...registry, projects: keep }, null, 2) + '\n');
    console.log(`registry: ${drop.length} dropped, ${Object.keys(keep).length} kept (${file})`);
  } else {
    console.log(`registry: ${drop.length} would be dropped, ${Object.keys(keep).length} kept${drop.length ? ' (--apply to write)' : ''}`);
  }
}
