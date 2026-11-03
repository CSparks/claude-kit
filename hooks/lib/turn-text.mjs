// turn-text.mjs — the newest maintainer message and the assistant text after it, read from a transcript file.
//
//   turnText(file) -> { lastUser, prose } | null
//     lastUser  the newest maintainer message (tool results, harness notices, compaction summaries and meta entries skipped), '' when none
//     prose     every assistant text block after it, oldest first, joined by blank lines
//   null when the file cannot be read.

import { readFileSync } from 'node:fs';

const NOTICE = /^\s*(?:<task-notification\b|<system-reminder\b|\[SYSTEM NOTIFICATION\b|Stop hook feedback:)/i;
const COMPACT = /^\s*This session is being continued from a previous conversation that ran out of context\b/;

const textOf = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
};
const isToolResult = (content) => Array.isArray(content) && content.some((b) => b && b.type === 'tool_result');
const isHarness = (entry, text) => entry.isMeta === true || entry.isCompactSummary === true || NOTICE.test(text) || COMPACT.test(text);

export function turnText(file) {
  let lines;
  try { lines = readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch { return null; }
  const prose = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }
    const role = entry?.type || entry?.message?.role;
    const content = entry?.message?.content;
    if (role === 'assistant') {
      const text = textOf(content).trim();
      if (text) prose.unshift(text);
    } else if (role === 'user' && !isToolResult(content)) {
      const text = textOf(content).trim();
      if (text && !isHarness(entry, text)) return { lastUser: text, prose: prose.join('\n\n') };
    }
  }
  return { lastUser: '', prose: prose.join('\n\n') };
}
