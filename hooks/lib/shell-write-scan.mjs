// Finds the hand write in a shell command (redirect, mv/rm/cp, sed -i, a PowerShell cmdlet, `node -e`,
// a heredoc or scratch script) aimed at a path some gate protects. Callers supply the policy:
//
//   scanShellWrites(command, { hit, codeHit, readScript }) -> null | whatever hit/codeHit returned
//     hit(path)     judge one operand path of a writing command or redirect
//     codeHit(code) judge inline code, a heredoc body or a scratch script that writes files
//     readScript(p) the text of a script the command runs ('' when unreadable)
//
// The raw command is scanned and a write tool counts WHEREVER its name appears as a word (`sudo -u root sed -i`,
// `timeout -s KILL 5 sh -c "rm x"`, `ssh -i k host tee x`): no wrapper is parsed, no text is blanked, so a deny
// gate cannot be steered by how a wrapper takes its options. The cost is an occasional false positive, lifted
// through the exclusion surfaces. A segment led by a reader (grep, cat, git …) or a kit verb is not a write tool.

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { segments } from './shell-segments.mjs';

const KIT_TOOL = /^(?:t|cap|rem|q|code-graph|t\.mjs|cap\.mjs|rem\.mjs|q\.mjs|index-tickets\.mjs|triage\.mjs|code-graph\.mjs)$/i;
const READER = /^(?:grep|egrep|fgrep|rg|ag|ack|cat|less|more|head|tail|wc|ls|stat|file|diff|cmp)$/i;
const WRITING_CMD = /^(?:mv|rm|rd|del|erase|ren|rename|rmdir|unlink|tee|touch|truncate|remove-item|move-item|rename-item|new-item|set-content|add-content|out-file|clear-content)$/i;
const COPY_CMD = /^(?:cp|copy|copy-item|install)$/i;
const IN_PLACE_TOOL = /^(?:sed|perl)$/i;
const IN_PLACE_FLAG = /^(?:-[A-Za-z]*i[A-Za-z]*|--in-place(?:=.*)?)$/;
const INTERPRETER = /^(?:node|python3?|py|powershell|pwsh)$/i;
const INLINE_FLAG = /^(?:-e|--eval|-p|--print|-c|-command)$/i;
const SCRIPT_FILE = /\.(?:m?js|cjs|py|ps1)$/i;
const WORD = /[^\s'"`;|&()<>]+/g;
const REDIRECT = /(?<![-=])>>?\s*(["']?)([^\s"'|;&<>)`]+)/g;
const HEREDOC_CODE = /\b(?:node|python3?)(?:\.exe)?\s+-?\s*<<-?/i;
const PIPED_CODE = /\|\s*(?:node|python3?|py)(?:\.exe)?(?:\s+-)?\s*(?:$|[|;&\n])/i;

/** True when `code` calls a filesystem write API. */
export const FS_WRITE = /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|renameSync|rename|rmSync|rmdirSync|unlinkSync|copyFileSync|cpSync|createWriteStream|WriteAllText|WriteAllLines|WriteAllBytes)\b|\bopen\([^)]*['"][wax]b?['"]/;

const nameOf = (word) => word.replace(/.*[\\/]/, '').replace(/\.exe$/i, '');

function judgeTool(tool, rest, text, { hit, codeHit, readScript }) {
  const operands = rest.map((r) => r.w);
  if (WRITING_CMD.test(tool)) return operands.map(hit).find(Boolean) || null;
  if (COPY_CMD.test(tool)) return hit(operands.filter((a) => !a.startsWith('-')).at(-1) || '');
  if (IN_PLACE_TOOL.test(tool)) return operands.some((a) => IN_PLACE_FLAG.test(a)) ? operands.map(hit).find(Boolean) || null : null;
  if (!INTERPRETER.test(tool)) return null;
  const inline = rest.find((r) => INLINE_FLAG.test(r.w));
  if (inline) return codeHit(text.slice(inline.at + inline.w.length));
  const script = operands.find((a) => SCRIPT_FILE.test(a));
  return script ? codeHit(readScript(script)) : null;
}

function judgeSegment(text, ctx) {
  const words = [...text.matchAll(WORD)].map((m) => ({ w: m[0], at: m.index }));
  if (!words.length) return null;
  const leader = nameOf(words[0].w);
  if (/^node$/i.test(leader) && words.some((x) => KIT_TOOL.test(x.w.replace(/.*[\\/]/, '')))) return null;
  if (KIT_TOOL.test(leader) || /^git$/i.test(leader)) return null;

  for (const m of text.matchAll(REDIRECT)) { const h = ctx.hit(m[2]); if (h) return h; }
  if (READER.test(leader)) return null;
  for (let i = 0; i < words.length; i++) {
    const found = judgeTool(nameOf(words[i].w), words.slice(i + 1), text, ctx);
    if (found) return found;
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

export function scanShellWrites(command, { hit, codeHit, readScript = readTempScript }) {
  const text = String(command || '');
  if (HEREDOC_CODE.test(text) || PIPED_CODE.test(text)) return codeHit(text);
  const ctx = { hit, codeHit, readScript };
  for (const seg of segments(text)) {
    const found = judgeSegment(seg.text, ctx);
    if (found) return found;
  }
  return null;
}
