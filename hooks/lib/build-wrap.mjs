// build-wrap.mjs — put the build-budget shims ahead of cargo for one shell command (KIT-D135).
//
//   shimmedCommand(command, toolName) -> the command with PATH led by bin/build-shims, or null when it needs none
// The shims (cargo, cargo-nextest, cargo-ndk) take cores from the machine build budget before the real tool runs.
// A command that runs a broker script is left alone: the broker holds its own cores and the shims would queue it twice.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brokerCalls, usesTool } from './broker-calls.mjs';

const BUILD_TOOL = /^cargo(?:-nextest|-ndk)?(?:\.exe)?$/i;
const SHIM_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'build-shims');
const posixPath = (p) => p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);

export function shimmedCommand(command, toolName, shimDir = SHIM_DIR) {
  const text = String(command || '');
  if (!usesTool(text, BUILD_TOOL) || brokerCalls(text).length) return null;
  if (text.includes('build-shims')) return null;
  if (toolName === 'PowerShell') return `$env:PATH = '${shimDir};' + $env:PATH; ${text}`;
  const dir = process.platform === 'win32' ? posixPath(shimDir) : shimDir;
  return `export PATH="${dir}:$PATH"; ${text}`;
}
