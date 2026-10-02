// q-server-proto.mjs — what the q client and the resident q server (q-server.mjs) agree on
// (KIT-T290): the endpoint, the code-version stamp, the verbs served and the wire framing.
// Imports only node builtins so the thin client stays cheap to load.
//
// Wire: one JSON line each way. Request { argv, cwd, env, stamp } / reply { rows } |
// { fallback: true } (the client then answers in-process). One server per index cache dir.

import { statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVED_VERBS = new Set(['code', 'sym', 'file']);
const STAMPED = ['q-server.mjs', 'q-server-session.mjs', 'q-server-proto.mjs', 'q-lib.mjs', 'code-index.mjs', 'code-index-query.mjs', 'code-index-source.mjs', 'code-index-extract.mjs'];
const HERE = dirname(fileURLToPath(import.meta.url));

/** The index cache directory (CLAUDE_KIT_CODE_INDEX_DIR overrides); one server serves one. */
export function cacheDir() {
  return process.env.CLAUDE_KIT_CODE_INDEX_DIR || join(homedir(), '.claude', 'cache', 'code-index');
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Named pipe (Windows) or unix socket path of the server for this cache dir. */
export function endpoint(dir = cacheDir()) {
  const key = hash(process.platform === 'win32' ? dir.toLowerCase() : dir);
  return process.platform === 'win32' ? String.raw`\\.\pipe\claude-kit-q-${key}` : join(tmpdir(), `ckq-${key}.sock`);
}

/** Newest mtime of the files a server's behaviour depends on: a mismatch means it runs old code. */
export function stamp() {
  let newest = 0;
  for (const f of STAMPED) {
    try { newest = Math.max(newest, statSync(join(HERE, f)).mtimeMs); } catch { /* absent */ }
  }
  return newest;
}

/** The CLAUDE_KIT_* environment a request carries, so the server answers as the caller would. */
export const kitEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('CLAUDE_KIT_')));
