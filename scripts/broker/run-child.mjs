// run-child.mjs — the child half of run-cancellable.mjs and run-pulsing.mjs: runs a command with
// the inherited descriptors, then writes its exit code to `<marker>` (renamed into place, so a
// reader never sees it half written).
// USE: node run-child.mjs <marker> <shell command>
//      node run-child.mjs <marker> --argv <json array>      (no shell: argv[0] with argv[1..])

import { spawnSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';

const [marker, command, json] = process.argv.slice(2);
const r = command === '--argv'
  ? (([file, ...args]) => spawnSync(file, args, { stdio: 'inherit', windowsHide: true }))(JSON.parse(json))
  : spawnSync(command, { shell: true, stdio: 'inherit', windowsHide: true });
writeFileSync(`${marker}.tmp`, String(r.status == null ? 1 : r.status));
renameSync(`${marker}.tmp`, marker);
