// turn-text.mjs — the newest maintainer message and the assistant text after it, read from a transcript file.
//
//   turnText(file) -> { lastUser, prose, newestProse, replyHasText } | null
//     lastUser      the newest maintainer message (tool results, harness notices, compaction summaries and meta entries skipped), '' when none
//     prose         every assistant text block after it, oldest first, joined by blank lines
//     newestProse   the newest of those text blocks, '' when none
//     replyHasText  the newest reply (the assistant entries after the last tool result or user entry) holds a text block
//   null when the file cannot be read.
//
//   turnTextForCall(file, toolUseId) -> Promise<same + replyUnflushed>
//     A PreToolUse hook runs while the transcript writer is still behind: the reply the call sits in can be
//     unflushed. The transcript is ordered, so once it holds the call's own tool_use entry every earlier block of
//     the reply is in it. This waits up to SETTLE_MS for that entry, then reads; with no id it reads at once.
//     replyUnflushed  an id was given and its entry never appeared: the call's own reply is not in what was read,
//                     so replyHasText and prose describe earlier replies only.

import { existsSync, readFileSync } from 'node:fs';

const SETTLE_MS = 3000;
const POLL_MS = 100;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const holdsCall = (file, toolUseId) => {
  try { return readFileSync(file, 'utf8').includes(toolUseId); } catch { return false; }
};

const NOTICE = /^\s*(?:<task-notification\b|<system-reminder\b|<local-command-(?:stdout|caveat)\b|\[SYSTEM NOTIFICATION\b|Stop hook feedback:)/i;
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
  let inReply = true;
  let replyHasText = false;
  const result = (lastUser) => ({ lastUser, prose: prose.join('\n\n'), newestProse: prose.at(-1) || '', replyHasText });
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }
    const role = entry?.type || entry?.message?.role;
    const content = entry?.message?.content;
    if (role === 'assistant') {
      const text = textOf(content).trim();
      if (text) prose.unshift(text);
      if (text && inReply) replyHasText = true;
    } else if (role === 'user') {
      inReply = false;
      const text = textOf(content).trim();
      if (!isToolResult(content) && text && !isHarness(entry, text)) return result(text);
    }
  }
  return result('');
}

export async function turnTextForCall(file, toolUseId) {
  let replyUnflushed = false;
  if (toolUseId && existsSync(file)) {
    for (let waited = 0; waited < SETTLE_MS && !holdsCall(file, toolUseId); waited += POLL_MS) await sleep(POLL_MS);
    replyUnflushed = !holdsCall(file, toolUseId);
  }
  const turn = turnText(file);
  return turn && { ...turn, replyUnflushed };
}
