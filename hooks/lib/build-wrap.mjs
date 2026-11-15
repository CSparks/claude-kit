// build-wrap.mjs — put the build-budget shims ahead of cargo for one shell command (KIT-D135).
//
//   shimmedCommand(command, toolName, shimDir?, writer?) -> the command with PATH led by bin/build-shims, or null when it needs none
// The shims (cargo, cargo-nextest, cargo-ndk) take cores from the machine build budget before the real tool runs.
// `writer` (session|agent, lib/tool-writes.mjs) is exported as CLAUDE_KIT_BUILD_WRITER so the build's hold names who started
// it and that writer's own edits pass the write-time build guard (hooks/lib/build-write-hold.mjs, KIT-T1114).
// A command that runs a broker script is left alone: the broker holds its own cores and the shims would queue it twice.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brokerCalls, usesTool } from './broker-calls.mjs';

const BUILD_TOOL = /^cargo(?:-nextest|-ndk)?(?:\.exe)?$/i;
const SHIM_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'build-shims');
const WRITER_ENV = 'CLAUDE_KIT_BUILD_WRITER';
const posixPath = (p) => p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);
const safeWriter = (w) => String(w || '').replace(/[^\w.|-]/g, '_');

// `builds --wait` needs the writer too: a wait without it opens windows no build of the same agent can tell are its own (KIT-T1281).
const BUILDS_WAIT = /(?:^|[\s;&|(])builds(?:\.cmd)?\s+(?:"[^"]*"\s+)*--wait\b/;

export function shimmedCommand(command, toolName, shimDir = SHIM_DIR, writer = '') {
  const text = String(command || '');
  const who = safeWriter(writer);
  if (who && BUILDS_WAIT.test(text) && !usesTool(text, BUILD_TOOL) && !text.includes(WRITER_ENV)) {
    return toolName === 'PowerShell' ? `$env:${WRITER_ENV} = '${who}'; ${text}` : `export ${WRITER_ENV}='${who}'; ${text}`;
  }
  if (!usesTool(text, BUILD_TOOL) || brokerCalls(text).length) return null;
  if (text.includes('build-shims')) return null;
  if (toolName === 'PowerShell') return `${who ? `$env:${WRITER_ENV} = '${who}'; ` : ''}$env:PATH = '${shimDir};' + $env:PATH; ${text}`;
  const dir = process.platform === 'win32' ? posixPath(shimDir) : shimDir;
  return `${who ? `export ${WRITER_ENV}='${who}'; ` : ''}export PATH="${dir}:$PATH"; ${text}`;
}
