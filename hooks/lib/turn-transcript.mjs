// turn-transcript — where the current turn starts and what the assistant last said, read from the session transcript.
// A turn starts at the newest user entry that is typed text: not a tool result, a meta entry or a system notice.
// Shared by the landing-alert Stop hook and the receipt note (hooks/receipt-note.mjs).
//
//   parseTranscript(file) -> { turnStartMs, lastAssistant }   {} when the file is unreadable; a zero or null field when absent

import { readFileSync } from 'node:fs';
import { assistantTextOf } from './assistant-text.mjs';

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
  }
  return '';
}

function isToolResult(content) {
  return Array.isArray(content) && content.some((b) => b && b.type === 'tool_result');
}

function isSystemNotice(text) {
  return /^\s*(?:<task-notification\b|<system-reminder\b|\[SYSTEM NOTIFICATION\b|Stop hook feedback:)/i.test(text);
}

export function parseTranscript(file) {
  let lines;
  try {
    lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  } catch {
    return {};
  }
  let turnStartMs = 0;
  let lastAssistant = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    let e;
    try { e = JSON.parse(lines[i]); } catch { continue; }
    const role = e?.type || e?.message?.role;
    const content = e?.message?.content;
    if (!lastAssistant && role === 'assistant') {
      lastAssistant = assistantTextOf(content);
      continue;
    }
    if (!turnStartMs && role === 'user' && e?.isMeta !== true && !isToolResult(content)) {
      const text = extractText(content);
      if (text && text.trim() && !isSystemNotice(text)) turnStartMs = Date.parse(e?.timestamp || '') || 0;
    }
    if (turnStartMs && lastAssistant) break;
  }
  return { turnStartMs, lastAssistant };
}
