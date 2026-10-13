// is-main.mjs — is this module the script node was started with?
//
//   if (isMain(import.meta.url)) main();
//
// Compares real paths: `node current/scripts/t.mjs` through the sealed-runtime junction or a
// plugin-install link has an argv[1] that differs from the module's resolved URL, and a plain
// string compare silently skips main().

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function isMain(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
}
