// turn-text.mjs — the newest maintainer message and the assistant text after it, read from a transcript file.
//
//   Assistant prose is every text block plus every narration block: Claude Code records the commentary it shows the
//   maintainer between tool calls as a thinking block whose signature names "narration" and whose text is filled;
//   ordinary thinking blocks carry an empty text and are never prose.
//
//   turnText(file) -> { lastUser, prose, newestProse, blocks } | null
//     lastUser      the newest maintainer message (tool results, harness notices, compaction summaries and meta entries skipped), '' when none
//     prose         every assistant text or narration block after it, oldest first, joined by blank lines
//     newestProse   the newest of those blocks, '' when none
//     blocks        those blocks, oldest first: [{ kind: 'text' | 'narration', text }]
//   null when the file cannot be read.
//
//   turnText(file, { beforeToolUseId }) reads only what precedes the entry holding that tool call: the text a call
//   was made after, never text written later. Null when the file is unreadable or the call is not in it (a PreToolUse
//   hook runs before Claude Code writes the call's own reply).
//
//   turnCalls(file, toolNames) -> [{ id, name, input, denied }] the calls of those tools made in the current turn,
//     oldest first; denied is true when a PreToolUse hook refused the call, so it never reached the maintainer.

import { readFileSync } from 'node:fs';
import { assistantBlocksOf } from './assistant-text.mjs';

const NOTICE = /^\s*(?:<task-notification\b|<system-reminder\b|<local-command-(?:stdout|caveat)\b|\[SYSTEM NOTIFICATION\b|Stop hook feedback:)/i;
const COMPACT = /^\s*This session is being continued from a previous conversation that ran out of context\b/;

const textOf = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
};
const isToolResult = (content) => Array.isArray(content) && content.some((b) => b && b.type === 'tool_result');
const isHarness = (entry, text) => entry.isMeta === true || entry.isCompactSummary === true || NOTICE.test(text) || COMPACT.test(text);

const HOOK_DENIAL = /^\s*PreToolUse:\S+ hook error/;
const toolResults = (entry) => (entry?.type === 'user' && Array.isArray(entry.message?.content) ? entry.message.content.filter((b) => b?.type === 'tool_result') : []);
const resultText = (b) => (typeof b.content === 'string' ? b.content : textOf(b.content));

const toolUses = (entry) => (entry?.type === 'assistant' && Array.isArray(entry.message?.content) ? entry.message.content.filter((b) => b?.type === 'tool_use') : []);
const parsed = (line) => { try { return JSON.parse(line); } catch { return null; } };

function readLines(file) {
  try { return readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch { return null; }
}

export function turnText(file, { beforeToolUseId } = {}) {
  let lines = readLines(file);
  if (!lines) return null;
  if (beforeToolUseId) {
    const at = lines.findIndex((l) => l.includes(beforeToolUseId) && toolUses(parsed(l)).some((b) => b.id === beforeToolUseId));
    if (at === -1) return null;
    lines = lines.slice(0, at);
  }
  const blocks = [];
  const result = (lastUser) => ({ lastUser, prose: blocks.map((b) => b.text).join('\n\n'), newestProse: blocks.at(-1)?.text || '', blocks });
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }
    const role = entry?.type || entry?.message?.role;
    const content = entry?.message?.content;
    if (role === 'assistant') {
      const entryBlocks = assistantBlocksOf(content).map((b) => ({ kind: b.kind, text: b.text.trim() })).filter((b) => b.text);
      blocks.unshift(...entryBlocks);
    } else if (role === 'user') {
      const text = textOf(content).trim();
      if (!isToolResult(content) && text && !isHarness(entry, text)) return result(text);
    }
  }
  return result('');
}

export function turnCalls(file, toolNames) {
  const lines = readLines(file);
  if (!lines) return [];
  const entries = lines.map(parsed);
  const denied = new Set(entries.flatMap(toolResults).filter((b) => HOOK_DENIAL.test(resultText(b))).map((b) => b.tool_use_id));
  const calls = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (!entry) continue;
    const content = entry.message?.content;
    if (entry.type === 'user' && !isToolResult(content)) {
      const text = textOf(content).trim();
      if (text && !isHarness(entry, text)) break;
    }
    calls.unshift(...toolUses(entry).filter((b) => toolNames.has(b.name)).map((b) => ({ id: b.id, name: b.name, input: b.input, denied: denied.has(b.id) })));
  }
  return calls;
}
