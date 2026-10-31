// command-summary.mjs — one result command as an agent should read it (KIT-D116): the exit code, each failed test with its
// panic location, the key metric lines (DRIVE, SUMMARY, test result) and the log path. Never the raw log, never a repeated
// progress line (collapse-repeats.mjs). report.mjs and result-summary.mjs print these lines.
//
//   commandSummary(command, { readLog? }) -> lines for one result command; readLog(path) -> the log text ('' when absent)
//   panicLine(logLines, name)            -> "panicked at file:line:col: message" for the failed test `name`, or ''
//   resultSummary(result, opts)          -> the verdict line and every command's lines; opts.outside: Set of the result's
//                                           commands outside the change's reach (timing-reach.mjs), each noted as advisory

import { existsSync, readFileSync, statSync } from 'node:fs';
import { collapseRepeats } from './collapse-repeats.mjs';

const MAX_LOG_BYTES = 32 * 1024 * 1024;
const PANIC_LOOKAHEAD = 40;
const MAX_METRICS = 12;
const METRIC = /^\s*(DRIVE\b|SUMMARY\b|summary\b|PROBE\b|METRIC\b|test result:)/;
const PANIC = /panicked at (.+)/;
const OUTSIDE_NOTE = '    outside the change\'s reach: no crate this change touches is among its dependencies (advisory)';

const readText = (file) => {
  try { return existsSync(file) && statSync(file).size <= MAX_LOG_BYTES ? readFileSync(file, 'utf8') : ''; } catch { return ''; }
};

export function panicLine(logLines, name) {
  const start = logLines.findIndex((l) => l.includes(`---- ${name} stdout ----`) || (/^\s*FAIL\b/.test(l) && l.includes(name)));
  if (start < 0) return '';
  for (let i = start; i < Math.min(logLines.length, start + PANIC_LOOKAHEAD); i++) {
    const m = PANIC.exec(logLines[i]);
    if (m) return `panicked at ${m[1].replace(/:$/, '')}${logLines[i + 1] ? `: ${logLines[i + 1].trim()}` : ''}`;
  }
  return '';
}

export function commandSummary(c, { readLog = readText } = {}) {
  const out = [`  $ ${c.composed || c.cmd}  → exit ${c.exit} (${c.durationMs}ms)`];
  for (const f of c.foreign || []) out.push(`    foreign (also fails without the patch): ${f.test} — ${f.reason}`);
  if (c.unattributed) out.push(`    ${c.unattributed}`);
  for (const f of c.suspect || []) out.push(`    ${f.reason}: ${f.test}`);
  const logLines = c.log ? readLog(c.log).split(/\r?\n/) : [];
  for (const m of collapseRepeats(logLines.filter((l) => METRIC.test(l))).slice(0, MAX_METRICS)) out.push(`    ${m.trim()}`);
  if (c.exit !== 0 && !(c.foreign || []).length) {
    for (const t of c.failedTests || []) {
      const panic = panicLine(logLines, t);
      out.push(`    failed test: ${t}${panic ? ` — ${panic}` : ''}`);
    }
    for (const [file, blocks] of Object.entries(c.errors || {})) for (const b of blocks) out.push(`    ${file}:`, ...b.split('\n').map((l) => `      ${l}`));
    if (!(c.failedTests || []).length && !Object.keys(c.errors || {}).length) out.push(...collapseRepeats(c.logTail || []).map((l) => `    | ${l}`));
  }
  if (c.log) out.push(`    log: ${c.log}`);
  return out;
}

export function resultSummary(r, opts) {
  const verdict = `${r.id} [${r.repo || ''}] → ${r.status}${r.phase ? ` at ${r.phase}` : ''}${r.landed ? ` landed ${r.landed.sha}` : ''}`;
  const outside = opts?.outside || new Set();
  const lines = (c) => {
    const [head, ...rest] = commandSummary(c, opts);
    return outside.has(c) ? [head, OUTSIDE_NOTE, ...rest] : [head, ...rest];
  };
  return [verdict, ...(r.message ? [`  ${r.message}`] : []), ...(r.commands || []).flatMap(lines)];
}
