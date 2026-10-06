// What a delegation cost and which job it served — the outcome fields of a roster row (KIT-D080).
// The orchestrator routes from a dated capability table; these rows are its second input, summarised
// per family and job by scripts/dispatch-outcomes.mjs.
//
//   declaredJob(prompt)             -> the `[job: <name>]` token a dispatcher put in the brief, or ''
//   outcomeFromResponse(response)   -> outcome from a PostToolUse Agent tool_response (a synchronous
//                                      agent returns resolvedModel, totalDurationMs, totalTokens,
//                                      totalToolUseCount; an async launch returns resolvedModel only)
//   outcomeFromTranscript(path)     -> outcome from a subagent transcript JSONL (SubagentStop carries
//                                      agent_transcript_path)
//
// An outcome is { resolvedModel?, durationMs?, tokens?, outputTokens?, toolCalls? }: only fields the
// source carries. `tokens` is the final request's total (input + cache + output), the figure the
// harness reports as totalTokens; `outputTokens` sums output across every turn. Never throws.

import { readFileSync, statSync } from 'node:fs';

const MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024;
const JOB_TOKEN = /\[job:\s*([\w-]+)\s*\]/i;

export function declaredJob(prompt) {
  const m = String(prompt || '').match(JOB_TOKEN);
  return m ? m[1].toLowerCase() : '';
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function compact(outcome) {
  return Object.fromEntries(Object.entries(outcome).filter(([, v]) => v !== undefined && v !== ''));
}

export function outcomeFromResponse(response) {
  const r = response && typeof response === 'object' ? response : {};
  return compact({
    resolvedModel: typeof r.resolvedModel === 'string' ? r.resolvedModel : undefined,
    durationMs: isNum(r.totalDurationMs) ? r.totalDurationMs : undefined,
    tokens: isNum(r.totalTokens) ? r.totalTokens : undefined,
    toolCalls: isNum(r.totalToolUseCount) ? r.totalToolUseCount : undefined,
  });
}

const usageTotal = (u) => (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.output_tokens || 0);

export function outcomeFromTranscript(path) {
  try {
    if (!path || statSync(path).size > MAX_TRANSCRIPT_BYTES) return {};
    const turns = new Map();
    const toolIds = new Set();
    let first = Infinity;
    let last = -Infinity;
    let model = '';
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let row;
      try { row = JSON.parse(line); } catch { continue; }
      const t = Date.parse(row && row.timestamp);
      if (Number.isFinite(t)) { first = Math.min(first, t); last = Math.max(last, t); }
      const msg = row && row.type === 'assistant' && row.message;
      if (!msg) continue;
      if (msg.model && !String(msg.model).startsWith('<')) model = msg.model;
      if (msg.usage) turns.set(msg.id || row.uuid, msg.usage);
      for (const block of Array.isArray(msg.content) ? msg.content : []) {
        if (block && block.type === 'tool_use') toolIds.add(block.id);
      }
    }
    const usages = [...turns.values()];
    return compact({
      resolvedModel: model,
      durationMs: last >= first ? last - first : undefined,
      tokens: usages.length ? usageTotal(usages[usages.length - 1]) : undefined,
      outputTokens: usages.length ? usages.reduce((n, u) => n + (u.output_tokens || 0), 0) : undefined,
      toolCalls: toolIds.size,
    });
  } catch {
    return {};
  }
}
