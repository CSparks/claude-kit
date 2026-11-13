#!/usr/bin/env node
// registry-set.mjs — change the machine registry on purpose. The hooks that record a project from repo content
// never replace the data repo or move a recorded project (hooks/lib/registry.mjs); this is the way to do either.
//
//   node scripts/registry-set.mjs data-root <path>            the central data repo
//   node scripts/registry-set.mjs project <name> <repo path>  where a project's checkout is
//
//   setDataRoot(path) / setProject(name, path) -> the registry written

import { resolve } from 'node:path';
import { isMain } from './is-main.mjs';
import { readRegistry, registryPath, writeRegistry } from '../hooks/lib/registry.mjs';

export const PROJECT_NAME = /^\w[\w.-]*$/;

export function setDataRoot(path) {
  if (!path) throw new Error('registry-set: data-root needs a path');
  const reg = { ...readRegistry(), dataRoot: resolve(path) };
  writeRegistry(reg);
  return reg;
}

export function setProject(name, path) {
  if (!PROJECT_NAME.test(name || '') || name.includes('..')) throw new Error(`registry-set: "${name}" is not a project name (word characters, dot, hyphen)`);
  if (!path) throw new Error('registry-set: project needs a repo path');
  const reg = readRegistry();
  reg.projects[name] = resolve(path);
  writeRegistry(reg);
  return reg;
}

if (isMain(import.meta.url)) {
  const [verb, ...rest] = process.argv.slice(2);
  try {
    if (verb === 'data-root') setDataRoot(rest[0]);
    else if (verb === 'project') setProject(rest[0], rest[1]);
    else throw new Error('usage: registry-set.mjs data-root <path> | project <name> <repo path>');
    console.log(`registry: updated (${registryPath()})`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
