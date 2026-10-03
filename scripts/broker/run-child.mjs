// run-child.mjs — the child half of run-cancellable.mjs: runs `<command>` through the platform
// shell with the inherited log descriptors, then writes its exit code to `<marker>`.
// USE: node run-child.mjs <marker> <command>

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [marker, command] = process.argv.slice(2);
const r = spawnSync(command, { shell: true, stdio: 'inherit', windowsHide: true });
writeFileSync(marker, String(r.status == null ? 1 : r.status));
