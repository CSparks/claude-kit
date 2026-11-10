// framework-scope — which decisions and stores belong to the framework (rapid-game) rather than to one game (KIT-T943).
//
//   isFrameworkDecision({ title, summary }) -> does the decision settle a framework concern (rapid-game, framework, shared crates, rg-*)
//   frameworkRoot(registry?)                -> the framework project's repo path from the machine registry, or ''
//   isFrameworkStore(root, registry?)       -> is `root` that project (compared by the real path of its .ai store)

import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readRegistry } from './registry.mjs';

export const FRAMEWORK_PROJECT = 'rapid-game';
const FRAMEWORK_CONCERN = /\b(?:rapid-game|framework|shared crates?|rg-[a-z]+)\b/i;

export const isFrameworkDecision = ({ title = '', summary = '' }) => FRAMEWORK_CONCERN.test(`${title} ${summary}`);

export const frameworkRoot = (registry = readRegistry()) => registry.projects?.[FRAMEWORK_PROJECT] || '';

const realStore = (root) => {
  const store = join(resolve(root), '.ai');
  try { return realpathSync.native(store).replace(/\\/g, '/').toLowerCase(); } catch { return store.replace(/\\/g, '/').toLowerCase(); }
};

export function isFrameworkStore(root, registry = readRegistry()) {
  const framework = frameworkRoot(registry);
  return !!root && !!framework && existsSync(join(framework, '.ai')) && realStore(root) === realStore(framework);
}
