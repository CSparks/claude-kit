// q-legacy.mjs — frozen legacy code stays out of `q` answers unless asked for (KIT-T989). A repo names its legacy
// directory with `legacy_dir` in .ai/config.yml; `--legacy` brings it back, and so does a `--path` that points inside it.
//
//   dropLegacy(flags, root)   adds the legacy directory to flags.notPaths unless `--legacy` or a --path inside it asks for it
//   legacyTest(root)          (repoRelativePath) -> true for a path in the repo's legacy directory, for callers that filter rows themselves

import { legacyDir } from '../hooks/lib/config.mjs';

const inside = (dir, path) => path === dir || path.startsWith(`${dir}/`);

export const legacyTest = (root) => {
  const dir = legacyDir(root);
  return (path) => Boolean(dir) && inside(dir, path);
};

export function dropLegacy(flags, root) {
  const dir = legacyDir(root);
  if (!dir || flags.legacy) return;
  if ([flags.path, ...(flags.anyPaths || [])].filter(Boolean).some((p) => inside(dir, p))) return;
  flags.notPaths.push(dir);
}
