// run-file.mjs — run one test file as `node <file>` from the kit root and time it (KIT-T570).
// A plain-script test and a node:test file both signal failure by exit code; the output is held
// and shown only when the file fails.
//
//   runFile(root, file, env) -> Promise<{ file, ok, ms, code, output }>

import { spawn } from 'node:child_process';

const OUTPUT_TAIL_BYTES = 200_000;

export function runFile(root, file, env = process.env) {
  return new Promise((resolve) => {
    const started = Date.now();
    let output = '';
    const child = spawn(process.execPath, [file], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const keep = (d) => { output = (output + d).slice(-OUTPUT_TAIL_BYTES); };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('error', (e) => resolve({ file, ok: false, ms: Date.now() - started, code: null, output: `spawn failed: ${e.message}` }));
    child.on('close', (code) => resolve({ file, ok: code === 0, ms: Date.now() - started, code, output }));
  });
}
