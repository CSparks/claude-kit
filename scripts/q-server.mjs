// q-server.mjs — the resident q server (KIT-T290). Holds one Session per root (index open,
// watcher running) and answers `q code|sym|file` for the thin client (q-client.mjs) over a
// named pipe / unix socket, one server per index cache dir (q-server-proto.mjs). Requests run
// one at a time. It exits after CLAUDE_KIT_Q_SERVER_IDLE_MS (default 30 min) without a request,
// on a `stop` request, or when its own code changed on disk. Started detached by the client.

import { createConnection, createServer } from 'node:net';
import { chmodSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { codeVerbRows } from './code-index-query.mjs';
import { resolveStoreRoot } from '../hooks/lib/unbounded.mjs';
import { unsupportedFlags } from './q-gap.mjs';
import { endpoint, kitEnv, SERVED_VERBS, stamp } from './q-server-proto.mjs';
import { Session } from './q-server-session.mjs';

const IDLE_MS = Number(process.env.CLAUDE_KIT_Q_SERVER_IDLE_MS) || 30 * 60 * 1000;
const PATH = endpoint();
const STAMP = stamp();
const sessions = new Map();
let idle;
let queue = Promise.resolve();
let served = 0;

const retime = () => { clearTimeout(idle); idle = setTimeout(shutdown, IDLE_MS); };

function shutdown() {
  for (const s of sessions.values()) s.close();
  try { server.close(); if (process.platform !== 'win32') unlinkSync(PATH); } catch { /* gone */ }
  process.exit(0);
}

async function sessionFor(root) {
  let s = sessions.get(root);
  if (!s) {
    s = new Session(root);
    s.onGone = () => sessions.delete(root);
    await s.start();
    sessions.set(root, s);
  }
  return s;
}

// Run `fn` as the caller: its CLAUDE_KIT_* environment, then the server's own again.
async function asCaller(env, fn) {
  const mine = kitEnv();
  for (const k of Object.keys(mine)) delete process.env[k];
  Object.assign(process.env, env);
  try { return await fn(); } finally {
    for (const k of Object.keys(kitEnv())) delete process.env[k];
    Object.assign(process.env, mine);
  }
}

async function answer(req) {
  const [cmd, ...args] = req.argv;
  if (!SERVED_VERBS.has(cmd) || unsupportedFlags(cmd, args).length) return { fallback: true };
  return asCaller(req.env || {}, async () => {
    const root = req.root || resolveStoreRoot(req.cwd) || req.cwd;
    const session = await sessionFor(root);
    return { rows: await codeVerbRows(cmd, args, root, (_r, o) => session.index(o)) };
  });
}

async function handle(req) {
  if (req.stop) return { stopped: true, exit: true };
  if (req.stats) return { stats: { pid: process.pid, served, sessions: sessions.size, rss: process.memoryUsage().rss } };
  if (req.stamp !== STAMP) return { restart: true, exit: true };
  try {
    const reply = await answer(req);
    if (reply.rows) served++;
    return reply;
  } catch { return { fallback: true }; }
}

function serve(sock) {
  let buf = '';
  sock.setEncoding('utf8');
  sock.on('error', () => {});
  sock.on('data', (d) => {
    buf += d;
    if (!buf.includes('\n')) return;
    let req;
    try { req = JSON.parse(buf); } catch { sock.end(JSON.stringify({ fallback: true })); return; }
    buf = '';
    queue = queue.then(() => handle(req)).then((reply) => {
      retime();
      sock.end(JSON.stringify(reply), () => { if (reply.exit) shutdown(); });
    });
  });
}

const server = createServer(serve);
server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') process.exit(1);
  const probe = createConnection(PATH);
  probe.on('connect', () => process.exit(0)); // a live server owns the endpoint
  probe.on('error', () => { try { unlinkSync(PATH); } catch { /* raced */ } server.listen(PATH); });
});
server.listen(PATH, () => {
  if (process.platform !== 'win32') try { chmodSync(PATH, 0o600); } catch { /* best effort */ }
  retime();
});
process.on('uncaughtException', () => shutdown());
process.chdir(homedir());
