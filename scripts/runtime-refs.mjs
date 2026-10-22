// runtime-refs.mjs — runtime copies that a live process names on its command line (KIT-T486 follow-up).
// A pin (runtime-pin.mjs) covers brokers and the q-server; any other process started as
// `node <runtime>/<sha>/scripts/x.mjs` (a session's t/cap/q call, a waiting `wait.mjs`) has no mark,
// yet deleting its sha directory breaks it with MODULE_NOT_FOUND.
//
// `commandLines()` → the command line of every live process (best effort, [] when the OS refuses).
// `referencedRuntimes(runtimeRoot, lines = commandLines())` → Set of sha directory names a line points into.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const SHA_DIR = /^[0-9a-f]{7,40}$/;
const MAX_LISTING_BYTES = 64 * 1024 * 1024;
const WINDOWS_LISTING = 'Get-CimInstance Win32_Process | ForEach-Object { $_.CommandLine }';

export function commandLines() {
  const r = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-Command', WINDOWS_LISTING], { encoding: 'utf8', windowsHide: true, maxBuffer: MAX_LISTING_BYTES })
    : spawnSync('ps', ['-eo', 'args'], { encoding: 'utf8', maxBuffer: MAX_LISTING_BYTES });
  return r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : [];
}

const slashed = (s) => s.replaceAll('\\', '/').toLowerCase();

export function referencedRuntimes(runtimeRoot, lines = commandLines()) {
  const root = slashed(runtimeRoot).replace(/\/+$/, '');
  const roots = [root, root.replace(/^([a-z]):/, '/$1')];
  const shas = readdirSync(runtimeRoot).filter((n) => SHA_DIR.test(n));
  const text = lines.map(slashed);
  const names = (line, sha) => roots.some((r) => line.includes(`${r}/${sha}/`) || line.endsWith(`${r}/${sha}`));
  return new Set(shas.filter((sha) => text.some((line) => names(line, sha))));
}
