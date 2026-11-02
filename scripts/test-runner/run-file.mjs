// run-file.mjs — run one test file as `node <file>` from the kit root and time it (KIT-T570).
// A plain-script test and a node:test file both signal failure by exit code; the output is held
// and shown only when the file fails.
//
//   runFile(root, file, env) -> Promise<{ file, ok, ms, code, output }>

import { spawn } from 'node:child_process';

const OUTPUT_TAIL_BYTES = 200_000;
const STREAM_GRACE_MS = 500;

// The file is done when its process exits: a daemon the test left behind keeps the inherited stdout open until it idles
// out, and waiting for that blocks a worker slot and records minutes of wall time the file never used.
export function runFile(root, file, env = process.env) {
  return new Promise((resolve) => {
    const started = Date.now();
    let output = '';
    let settled = false;
    let grace;
    const child = spawn(process.execPath, [file], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const keep = (d) => { output = (output + d).slice(-OUTPUT_TAIL_BYTES); };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(grace);
      child.stdout.destroy();
      child.stderr.destroy();
      resolve({ file, ms: Date.now() - started, ...result });
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('error', (e) => finish({ ok: false, code: null, output: `spawn failed: ${e.message}` }));
    child.on('exit', (code) => { grace = setTimeout(() => finish({ ok: code === 0, code, output }), STREAM_GRACE_MS); });
    child.on('close', (code) => finish({ ok: code === 0, code, output }));
  });
}
