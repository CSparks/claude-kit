// Finds the hand write in a shell command (redirect, mv/rm/cp, sed -i, a PowerShell cmdlet, `node -e`,
// a heredoc or scratch script) aimed at a path some gate protects. Callers supply the policy:
//
//   scanShellWrites(command, { hit, codeHit, readScript, deep }) -> null | whatever hit/codeHit returned
//     hit(path)     judge one operand path of a writing command or redirect
//     codeHit(code) judge inline code, a heredoc body or a scratch script that writes files
//     readScript(p) the text of a script the command runs ('' when unreadable)
//     deep(path)    the verdict for a command nested past MAX_WRAPPER_DEPTH shells/wrappers: it is blocked unread
//
// The command is scanned RAW: quoted text is never blanked, so a deny gate cannot be fooled by a parser difference.
// Kit verbs (t, cap, rem, q, code-graph) and git never count as hand writes.

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { segments } from './shell-segments.mjs';

const KIT_TOOL = /^(?:t|cap|rem|q|code-graph|t\.mjs|cap\.mjs|rem\.mjs|q\.mjs|index-tickets\.mjs|triage\.mjs|code-graph\.mjs)$/i;
const WRITING_CMD = /^(?:mv|rm|del|erase|ren|rename|rmdir|tee|touch|truncate|remove-item|move-item|rename-item|new-item|set-content|add-content|out-file|clear-content)$/i;
const COPY_CMD = /^(?:cp|copy|copy-item)$/i;
const REDIRECT = /(?<![-=])>>?\s*(["']?)([^\s"'|;&<>)`]+)/g;
const HEREDOC_CODE = /\b(?:node|python3?)(?:\.exe)?\s+-?\s*<<-?/i;
const PIPED_CODE = /\|\s*(?:node|python3?|py)(?:\.exe)?(?:\s+-)?\s*(?:$|[|;&\n])/i;
const WRAPPER = /^(?:bash|sh|zsh|dash|ksh|fish|cmd|su|sudo|wsl|ssh|eval|xargs|env|nohup|time|timeout|exec|command|pwsh|powershell)(?:\.exe)?$/i;
const UNQUOTE = /^["']|["']$/g;
const ASSIGNMENT = /^[A-Za-z_]\w*=/;
const DURATION = /^\d+(?:\.\d+)?[smhd]?$/;
const WRAPPER_FLAG = /^-|^\/[a-z]$/i;
const MAX_WRAPPER_DEPTH = 4;
export const DEEP_NESTING = 'a command nested more than 4 shells or wrappers deep';

/** True when `code` calls a filesystem write API. */
export const FS_WRITE = /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|renameSync|rename|rmSync|rmdirSync|unlinkSync|copyFileSync|cpSync|createWriteStream|WriteAllText|WriteAllLines|WriteAllBytes)\b|\bopen\([^)]*['"][wax]b?['"]/;

/** The command a wrapper runs: its flags, assignments, durations (and ssh's host) stripped. */
function wrapped(leader, args) {
  let i = 0;
  while (i < args.length && (WRAPPER_FLAG.test(args[i]) || ASSIGNMENT.test(args[i]) || DURATION.test(args[i]))) i++;
  if (/^ssh(?:\.exe)?$/i.test(leader)) i++;
  return args.slice(i).join(' ');
}

function judgeSegment(text, ctx) {
  const { hit, codeHit, readScript } = ctx;
  const tok = text.trim().match(/"[^"]*"|'[^']*'|\S+/g) || [];
  if (!tok.length) return null;
  const leader = tok[0].replace(/.*[\\/]/, '').replace(UNQUOTE, '');
  const args = tok.slice(1).map((a) => a.replace(UNQUOTE, ''));
  const isNode = /^node(?:\.exe)?$/i.test(leader);
  if (isNode && args.some((a) => KIT_TOOL.test(a.replace(/.*[\\/]/, '')))) return null;
  if (KIT_TOOL.test(leader) || /^git$/i.test(leader)) return null;

  for (const m of text.matchAll(REDIRECT)) { const h = hit(m[2]); if (h) return h; }
  if (WRAPPER.test(leader)) {
    const nested = scanShellWrites(wrapped(leader, args), ctx, ctx.depth + 1);
    if (nested) return nested;
  }
  if (WRITING_CMD.test(leader)) return args.map(hit).find(Boolean) || null;
  if (COPY_CMD.test(leader)) return hit(args.filter((a) => !a.startsWith('-')).at(-1) || '');
  if (/^(?:sed|perl)$/i.test(leader) && args.some((a) => /^-[A-Za-z]*i/.test(a))) return args.map(hit).find(Boolean) || null;
  if (isNode || /^(?:python3?|py|powershell|pwsh)(?:\.exe)?$/i.test(leader)) {
    const inline = args.findIndex((a) => /^(?:-e|--eval|-p|--print|-c|-command)$/i.test(a));
    if (inline >= 0) return codeHit(args.slice(inline + 1).join(' '));
    const script = args.find((a) => /\.(?:m?js|cjs|py|ps1)$/i.test(a));
    return script ? codeHit(readScript(script)) : null;
  }
  return null;
}

/** The text of a script under the temp dir ('' elsewhere or when unreadable): scratch scripts are judged, repo scripts are not. */
export function readTempScript(path) {
  try {
    const abs = resolve(path);
    const rel = relative(resolve(tmpdir()), abs);
    if (rel.startsWith('..') || isAbsolute(rel)) return '';
    return readFileSync(abs, 'utf8');
  } catch { return ''; }
}

export function scanShellWrites(command, { hit, codeHit, readScript = readTempScript, deep = (path) => ({ path }), depth = 0 }, nesting = depth) {
  if (nesting > MAX_WRAPPER_DEPTH) return deep(DEEP_NESTING);
  const text = String(command || '');
  if (HEREDOC_CODE.test(text) || PIPED_CODE.test(text)) return codeHit(text);
  const ctx = { hit, codeHit, readScript, deep, depth: nesting };
  for (const seg of segments(text)) {
    const found = judgeSegment(seg.text, ctx);
    if (found) return found;
  }
  return null;
}
