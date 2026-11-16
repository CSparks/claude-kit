// claims-stamp.mjs — the main-thread stamp that lets `claims --release` run (KIT-T1288).
// The PreToolUse hook hooks/claims-release-gate.mjs sees which caller made a Bash or PowerShell call (the payload carries the
// subagent id). For a MAIN-THREAD call that runs `claims --release <id>` it issues a one-use stamp bound to <id> and exports its
// nonce to that command in CLAUDE_KIT_CLAIMS_STAMP. scripts/claims.mjs (releaseDead) consumes it: no stamp, an unknown or spent
// nonce, a stamp for another id or one older than STAMP_TTL_MS refuses. A subagent's call is never stamped.
//
//   issueStamp(id, now?)                          -> nonce   (a file under <turn state>/claims-stamps)
//   consumeStamp(nonce, id, now?)                 -> true once for a fresh stamp of `id`, false otherwise
//   stampedCommand(command, toolName, nonce)      -> the command with the nonce exported in that shell's syntax
//
// Limit: the stamp proves "the hook saw a main-thread call for this id", not who holds the nonce. Every file under the user's
// temp dir is readable by every process of that user, so a subagent that finds a live stamp inside its 60 s window can spend it
// for the SAME id the main thread asked to release. It cannot mint one, name another id, or reuse one.

import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const STAMP_ENV = 'CLAUDE_KIT_CLAIMS_STAMP';
export const STAMP_TTL_MS = 60000;
const STAMP_DIR = 'claims-stamps';
const NONCE_BYTES = 16;
const NONCE = new RegExp(`^[0-9a-f]{${NONCE_BYTES * 2}}$`);

const dir = () => join(process.env.CLAUDE_KIT_TURN_STATE || join(tmpdir(), 'claude-kit-turnstate'), STAMP_DIR);

function sweep(now) {
  try {
    for (const name of readdirSync(dir())) {
      const file = join(dir(), name);
      if (now - statSync(file).mtimeMs > STAMP_TTL_MS) rmSync(file, { force: true });
    }
  } catch { /* a missing dir has nothing to sweep */ }
}

export function issueStamp(id, now = Date.now()) {
  mkdirSync(dir(), { recursive: true });
  sweep(now);
  const nonce = randomBytes(NONCE_BYTES).toString('hex');
  writeFileSync(join(dir(), `${nonce}.json`), JSON.stringify({ id: String(id), at: now }), { flag: 'wx' });
  return nonce;
}

export function consumeStamp(nonce, id, now = Date.now()) {
  if (!NONCE.test(String(nonce || ''))) return false;
  const file = join(dir(), `${nonce}.json`);
  let stamp;
  try {
    stamp = JSON.parse(readFileSync(file, 'utf8'));
    rmSync(file);
  } catch { return false; }
  return stamp.id === String(id) && stamp.at <= now && now - stamp.at <= STAMP_TTL_MS;
}

export function stampedCommand(command, toolName, nonce) {
  return toolName === 'PowerShell' ? `$env:${STAMP_ENV} = '${nonce}'; ${command}` : `export ${STAMP_ENV}='${nonce}'; ${command}`;
}
