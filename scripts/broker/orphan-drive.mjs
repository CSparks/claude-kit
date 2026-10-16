// orphan-drive.mjs — a stand-in daemon for crash-recovery.test.mjs. NOT a test.
//   node orphan-drive.mjs <home> <logPath>   starts a long-running command the way run-cancellable does and records it, then idles
// The child is detached so it outlives this process whatever job object the platform ties children to;
// the test kills this process hard and a replacement daemon must reap the command.

import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { setChildRegistry, trackChild } from './children.mjs';

const [home, logPath] = process.argv.slice(2);
setChildRegistry(join(home, 'children.json'));
const marker = `${logPath}.exit`;
const cmd = `node -e "console.log('started'); setTimeout(() => {}, 120000)"`;
const fd = openSync(logPath, 'w');
const child = spawn(process.execPath, [join(import.meta.dirname, 'run-child.mjs'), marker, cmd], { cwd: home, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
child.unref();
closeSync(fd);
trackChild({ pid: child.pid, marker, logPath, cmd });
setInterval(() => {}, 1000);
