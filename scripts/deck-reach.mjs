// deck-reach.mjs — is the Deck there, answered in seconds (KIT-T480). deck-deploy asks before any
// build or push, and its watcher before each redeploy: an unreachable Deck is a maintainer action
// (wake it, join Wi-Fi), never a wait. The answer is a TCP connect to the Deck's ssh port.
//
// `reachable({ host, port }, timeoutMs)` → Promise<boolean>.
// `requireDeck(target, retry, { timeoutMs })` → Promise<boolean>; when false it has printed the
//   MAINTAINER ACTION line on stderr and written it to the alert file orient shows; when true it
//   clears that file.
// `deckAlert()` → the pending alert line or null.  `UNREACHABLE` is the exit status for "no Deck".

import { connect } from 'node:net';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const REACH_TIMEOUT_MS = 5000;
export const UNREACHABLE = 3;
const MS_PER_SEC = 1000;

export const deckHome = () => process.env.CLAUDE_KIT_DECK_HOME || join(homedir(), '.claude', 'deck-deploy');
const alertPath = () => join(deckHome(), 'alert.txt');

export function reachable({ host, port = 22 }, timeoutMs = REACH_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (ok) => { socket.destroy(); resolve(ok); };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

export const unreachableLine = (t, retry, timeoutMs) =>
  `MAINTAINER ACTION: Deck unreachable (${t.user}@${t.host}:${t.port ?? 22} gave no answer in ${timeoutMs / MS_PER_SEC} s) — wake it and connect Wi-Fi, then re-run: ${retry}`;

export async function requireDeck(target, retry, { timeoutMs = REACH_TIMEOUT_MS } = {}) {
  if (await reachable(target, timeoutMs)) {
    rmSync(alertPath(), { force: true });
    return true;
  }
  const line = unreachableLine(target, retry, timeoutMs);
  console.error(line);
  mkdirSync(deckHome(), { recursive: true });
  writeFileSync(alertPath(), `${new Date().toISOString()} ${line}\n`);
  return false;
}

export function deckAlert() {
  try { return readFileSync(alertPath(), 'utf8').trim() || null; } catch { return null; }
}
