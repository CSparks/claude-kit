#!/usr/bin/env node
// q.mjs — CLI entry for q. `code`/`sym`/`file` go to the resident server when one is up
// (q-client.mjs); everything else, and the first call with no server, runs in q-lib.mjs.

import { tryServer } from './q-client.mjs';

if (!(await tryServer(process.argv.slice(2), process.cwd()))) {
  const { runCli } = await import('./q-lib.mjs');
  await runCli();
}
