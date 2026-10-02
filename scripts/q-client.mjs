// q-client.mjs — the thin front of q.mjs (KIT-T290): answer `q code|sym|file` through the
// resident server (q-server.mjs) when one is up, else start one detached and let the caller
// answer in-process this once. Imports builtins and q-server-proto/q-print only.
//
// CLAUDE_KIT_Q_SERVER=off disables both the lookup and the auto-start.

import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { endpoint, kitEnv, SERVED_VERBS, stamp } from './q-server-proto.mjs';
import { printRows } from './q-print.mjs';

const SERVER = join(import.meta.dirname, 'q-server.mjs');
const FLAG_VALUES = new Set(['--root']);

function ask(request, path) {
  return new Promise((resolve) => {
    const sock = createConnection(path);
    let buf = '';
    sock.setEncoding('utf8');
    sock.on('connect', () => sock.write(JSON.stringify(request) + '\n'));
    sock.on('data', (d) => { buf += d; });
    sock.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(null); } });
    sock.on('error', (e) => resolve({ down: e.code === 'ENOENT' || e.code === 'ECONNREFUSED' }));
  });
}

/** Ask the server for this cache dir to exit; true when one was up. */
export async function stopServer() {
  const reply = await ask({ stop: true }, endpoint());
  return !!reply?.stopped;
}

/** { pid, served, sessions, rss } of the running server, or null. */
export async function serverStats() {
  return (await ask({ stats: true }, endpoint()))?.stats || null;
}

export function startServer() {
  try {
    spawn(process.execPath, [SERVER], { detached: true, stdio: 'ignore', windowsHide: true, env: process.env }).unref();
  } catch { /* the in-process answer still stands */ }
}

/** The server's reply to a q command line (null for an unserved verb): { rows } | { fallback } | { down } | { restart }. */
export async function serverReply(argv, cwd) {
  const env = process.env;
  if (env.CLAUDE_KIT_Q_SERVER === 'off' || env.CLAUDE_KIT_CODE_INDEX_FORCE_SCAN) return null;
  const rest = argv.filter((a, i) => a !== '--json' && !FLAG_VALUES.has(a) && !FLAG_VALUES.has(argv[i - 1]));
  if (!SERVED_VERBS.has(rest[0]) || argv.includes('--no-db')) return null;
  const ri = argv.indexOf('--root');
  return ask({ argv: rest, root: ri >= 0 ? argv[ri + 1] : null, cwd, env: kitEnv(), stamp: stamp() }, endpoint());
}

/** True when the server answered and its rows were printed; false means answer in-process. */
export async function tryServer(argv, cwd) {
  const reply = await serverReply(argv, cwd);
  if (reply?.rows) { printRows(reply.rows, argv.includes('--json')); return true; }
  if (reply?.down || reply?.restart) startServer();
  return false;
}
