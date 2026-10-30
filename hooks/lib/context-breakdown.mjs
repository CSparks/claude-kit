// context-breakdown.mjs — what an agent's context is made of (KIT-D116). When an agent nears the ceiling the orchestrator
// gets one line it can relay: shares by source, the five biggest single tool results, and a verdict "mostly garbage
// input" when bulk tool output (build/test logs, broker output, bash dumps, re-reads of a file) is the majority.
//
//   contextBreakdown(path)            -> { total, shares: { source: tokens }, top: [{ label, tokens }], garbage, hints } from a transcript JSONL, or null
//   breakdownLine(path, tokens, id)   -> the one-line report for the orchestrator, or '' when the transcript is unreadable
//
// Sizes are estimates (CHARS_PER_TOKEN); shares are relative to the transcript's own estimated total.

import { readFileSync, statSync } from 'node:fs';
import { collapseRepeats } from '../../scripts/broker/collapse-repeats.mjs';

const MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024;
const CHARS_PER_TOKEN = 4;
const TOP_RESULTS = 5;
const SHOWN_SOURCES = 3;
const BULK_MIN_TOKENS = 2000;
const GARBAGE_MAJORITY = 0.5;
const PERCENT = 100;
const TOKENS_PER_K = 1000;
const LABEL_CHARS = 48;

export const SOURCE = {
  BRIEF: 'brief', AGENT: 'agent reasoning and text', WHOLE_READ: 'whole-file reads', PART_READ: 'ranged file reads', RE_READ: 'file re-reads',
  TEST_LOG: 'build/test logs', BROKER: 'broker output', Q: 'q results', SEARCH: 'search results', DUMP: 'bash dumps', OTHER: 'other tool results',
  REPEAT: 'repeated task output',
};
const GARBAGE = new Set([SOURCE.TEST_LOG, SOURCE.BROKER, SOURCE.DUMP, SOURCE.RE_READ]);
const FIX = {
  [SOURCE.REPEAT]: 'the same line repeated (Compiling walls, queued/running ticks): read result-summary.mjs <job>, never the raw log or a polled wait',
  [SOURCE.TEST_LOG]: 'read the failing test lines, not the whole log (run the one test by name; filter the log)',
  [SOURCE.BROKER]: 'print only the verdict line of broker output',
  [SOURCE.DUMP]: 'filter a command (head, a pattern) before its output reaches the context',
  [SOURCE.RE_READ]: 'read each file once; keep line ranges or the code graph for the second look',
};

const BROKER_CMD = /\b(submit|wait|watch)\.mjs\b|\bbroker\b/;
const Q_CMD = /\bq\.mjs\b|\bcode-graph\b/;
const TEST_CMD = /\bcargo\b|\bnpm\b|node --test|\.test\.mjs|\bpytest\b|\bgo test\b|\bmake\b|\btsc\b|\bnode hooks\/\S*test/;

const tokensOf = (text) => Math.ceil(String(text).length / CHARS_PER_TOKEN);
const blocksOf = (content) => (Array.isArray(content) ? content : [{ type: 'text', text: String(content ?? '') }]);
const textOf = (content) => blocksOf(content).map((b) => (typeof b === 'string' ? b : b?.text ?? (b?.type === 'image' ? '' : JSON.stringify(b)))).join('\n');
const clip = (text) => (text.length > LABEL_CHARS ? `${text.slice(0, LABEL_CHARS)}...` : text);

function bashSource(command) {
  if (BROKER_CMD.test(command)) return SOURCE.BROKER;
  if (Q_CMD.test(command)) return SOURCE.Q;
  return TEST_CMD.test(command) ? SOURCE.TEST_LOG : SOURCE.DUMP;
}

// The source and short label of the result a tool call produced; `seen` holds the paths already read.
function classify(call, seen) {
  const input = call.input || {};
  if (call.name === 'Read') {
    const path = String(input.file_path || '');
    const again = seen.has(path);
    seen.add(path);
    const part = input.offset !== undefined || input.limit !== undefined;
    return { source: again ? SOURCE.RE_READ : part ? SOURCE.PART_READ : SOURCE.WHOLE_READ, label: `Read ${clip(path)}` };
  }
  if (call.name === 'Bash') return { source: bashSource(String(input.command || '')), label: `Bash ${clip(String(input.command || ''))}` };
  if (call.name === 'Grep' || call.name === 'Glob') return { source: SOURCE.SEARCH, label: `${call.name} ${clip(String(input.pattern || ''))}` };
  return { source: SOURCE.OTHER, label: call.name || 'tool' };
}

function parse(path) {
  if (statSync(path).size > MAX_TRANSCRIPT_BYTES) return [];
  return readFileSync(path, 'utf8').split('\n').flatMap((line) => { try { return line.trim() ? [JSON.parse(line)] : []; } catch { return []; } });
}

export function contextBreakdown(path) {
  try {
    const shares = {};
    const results = [];
    const calls = new Map();
    const seen = new Set();
    const add = (source, tokens) => { shares[source] = (shares[source] || 0) + tokens; };
    for (const row of parse(path)) {
      const msg = row?.message;
      if (!msg) continue;
      for (const block of blocksOf(msg.content)) {
        if (row.type === 'assistant') {
          if (block.type === 'tool_use') { calls.set(block.id, block); add(SOURCE.AGENT, tokensOf(JSON.stringify(block.input ?? {}))); } else add(SOURCE.AGENT, tokensOf(block.text ?? block.thinking ?? ''));
        } else if (block.type === 'tool_result') {
          const { source, label } = classify(calls.get(block.tool_use_id) || {}, seen);
          const text = textOf(block.content);
          const tokens = tokensOf(text);
          const repeated = Math.max(0, tokens - tokensOf(collapseRepeats(text.split('\n')).join('\n')));
          add(source, tokens - repeated);
          add(SOURCE.REPEAT, repeated);
          results.push({ label, tokens, repeated, source });
        } else add(SOURCE.BRIEF, tokensOf(typeof block === 'string' ? block : block.text ?? ''));
      }
    }
    const total = Object.values(shares).reduce((n, t) => n + t, 0);
    if (!total) return null;
    const bulk = results.filter((r) => GARBAGE.has(r.source) && r.tokens - r.repeated >= BULK_MIN_TOKENS);
    const garbage = (bulk.reduce((n, r) => n + r.tokens - r.repeated, 0) + (shares[SOURCE.REPEAT] || 0)) / total;
    const hints = [...new Set([...(shares[SOURCE.REPEAT] ? [SOURCE.REPEAT] : []), ...bulk.sort((a, b) => b.tokens - a.tokens).map((r) => r.source)].map((s) => FIX[s]))];
    return { total, shares, top: results.sort((a, b) => b.tokens - a.tokens).slice(0, TOP_RESULTS), garbage, hints };
  } catch {
    return null;
  }
}

const k = (n) => `${Math.round(n / TOKENS_PER_K)}k`;
const pct = (part, whole) => `${Math.round((part / whole) * PERCENT)}%`;

export function breakdownLine(path, contextTokens, id) {
  const b = path ? contextBreakdown(path) : null;
  if (!b) return '';
  const sources = Object.entries(b.shares).sort((a, c) => c[1] - a[1]).slice(0, SHOWN_SOURCES).map(([name, t]) => `${pct(t, b.total)} ${name}`).join(', ');
  const top = b.top.map((r) => `${r.label} ${k(r.tokens)}`).join('; ');
  const verdict = b.garbage > GARBAGE_MAJORITY ? ` MOSTLY GARBAGE INPUT (${pct(b.garbage, 1)} bulk tool output); fix: ${b.hints.join('; ')}` : b.hints.length ? ` avoidable: ${b.hints[0]}` : '';
  return `agent ${id} at ${k(contextTokens)}: ${sources}; top: ${top}.${verdict}`;
}
