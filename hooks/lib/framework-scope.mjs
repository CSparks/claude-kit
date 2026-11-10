// framework-scope — which decisions and stores belong to the framework (rapid-game) rather than to one game (KIT-T943).
//
//   isFrameworkDecision({ title, summary }) -> does the decision settle a framework concern (rapid-game, framework, shared crates, rg-*)
//   frameworkAiDir()                        -> the framework project's `.ai` store directory (repo or central data root), or ''
//   isFrameworkStore(root)                  -> does `root` carry the framework store: its ids.key is the framework project's key
//
// The framework is checked out as a submodule in several games and its store is the one the project registry names, so a
// session is a framework session by the store's id key, never by which checkout it runs in.

import { readIdConfig } from '../../scripts/id-utils.mjs';
import { projectAiDirs } from './registry.mjs';

export const FRAMEWORK_PROJECT = 'rapid-game';
const FRAMEWORK_CONCERN = /\b(?:rapid-game|framework|shared crates?|rg-[a-z]+)\b/i;

export const isFrameworkDecision = ({ title = '', summary = '' }) => FRAMEWORK_CONCERN.test(`${title} ${summary}`);

export const frameworkAiDir = () => projectAiDirs().find((p) => p.name === FRAMEWORK_PROJECT)?.aiDir || '';

export function isFrameworkStore(root) {
  const aiDir = frameworkAiDir();
  if (!root || !aiDir) return false;
  const framework = readIdConfig(aiDir, aiDir).key;
  return !!framework && readIdConfig(root).key === framework;
}
