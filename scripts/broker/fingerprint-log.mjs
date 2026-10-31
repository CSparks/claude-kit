// fingerprint-log.mjs — why cargo rebuilt a crate (KIT-Q005 lever 3, KIT-D121). Every broker command runs with
// CARGO_LOG=cargo::core::compiler::fingerprint=info, the narrowest target that prints cargo's dirty reasons. After the
// command, `harvestDirty` parses those lines into { crate, reason, count } and removes the raw lines from the log, so
// the log keeps its size and only the parsed reasons are kept.
//
//   FINGERPRINT_ENV            -> the environment variable that turns the lines on (a caller's own CARGO_LOG wins)
//   parseFingerprint(text)     -> { reasons: [{ crate, reason, count }], text: the log without fingerprint lines }
//   harvestDirty(result, log, tailOf) -> `result` with `dirty` set and `logTail` = tailOf(log), the log file rewritten without
//                                        the lines; `result` itself when the log holds none (nothing was rebuilt)
//
// Reasons: 'source changed: <path>', 'dependency rebuilt', 'missing file', 'rustflags changed', 'env changed: <NAME>',
// 'cold: no earlier fingerprint', otherwise 'variant: <cargo's variant name>'.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const FINGERPRINT_ENV = { CARGO_LOG: 'cargo::core::compiler::fingerprint=info' };
const MARKER = 'cargo::core::compiler::fingerprint';
const MAX_REASONS = 500;
const PATH_TAIL = 3;
const CRATE_NEW = /package_id=(\S+) v/;
const CRATE_OLD = /fingerprint (?:dirty|error) for (\S+) v/;
const DIRTY = /\bdirty: (.+)$/;
const STALE_FILE = /ChangedFile \{.*?stale: "((?:[^"\\]|\\.)*)"/;
const ENV_NAME = /EnvVarChanged \{ name: "([^"]+)"/;
const VARIANT = /^(\w+)/;
const CONTINUATION = /^(?:\s*$|Caused by:|\s{4,}\S)/;
const CARGO_STATUS = /^\s+(?:Compiling|Checking|Finished|Fresh|Running|Building|Blocking|Downloaded|Updating|Documenting|Doc-tested)\b/;

const slashes = (p) => p.replace(/\\\\/g, '/').replace(/\\/g, '/');
const tail = (p) => slashes(p).split('/').filter(Boolean).slice(-PATH_TAIL).join('/');

function reasonOf(body) {
  const file = STALE_FILE.exec(body);
  if (file) return `source changed: ${tail(file[1])}`;
  if (/StaleDepFingerprint/.test(body)) return 'dependency rebuilt';
  if (/MissingFile/.test(body)) return 'missing file';
  if (/RustflagsChanged/.test(body)) return 'rustflags changed';
  const env = ENV_NAME.exec(body);
  if (env) return `env changed: ${env[1]}`;
  return `variant: ${VARIANT.exec(body)?.[1] || 'unknown'}`;
}

export function parseFingerprint(log) {
  const kept = [];
  const counts = new Map();
  let crate = null;
  let inError = false;
  const note = (name, reason) => {
    const key = `${name}\0${reason}`;
    if (counts.has(key) || counts.size < MAX_REASONS) counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (const line of log.split('\n')) {
    if (!line.includes(MARKER)) {
      if (inError && CONTINUATION.test(line) && !CARGO_STATUS.test(line)) continue;
      inError = false;
      kept.push(line);
      continue;
    }
    inError = false;
    crate = CRATE_NEW.exec(line)?.[1] || CRATE_OLD.exec(line)?.[1] || crate;
    const dirty = DIRTY.exec(line);
    if (dirty && crate) note(crate, reasonOf(dirty[1]));
    else if (/\berr: failed to read\b/.test(line) && crate) { note(crate, 'cold: no earlier fingerprint'); inError = true; }
    else if (/fingerprint error for/.test(line)) inError = true;
  }
  const reasons = [...counts].map(([key, count]) => { const [name, reason] = key.split('\0'); return { crate: name, reason, count }; });
  return { reasons, text: kept.join('\n') };
}

export function harvestDirty(result, logPath, tailOf) {
  if (!existsSync(logPath)) return result;
  const raw = readFileSync(logPath, 'utf8');
  if (!raw.includes(MARKER)) return result;
  const { reasons, text } = parseFingerprint(raw);
  writeFileSync(logPath, text);
  return { ...result, dirty: reasons, logTail: tailOf(logPath) };
}
