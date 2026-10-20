// A shell command or node script that WRITES the .ai work store by hand (redirect, mv/rm/cp, sed -i, a
// PowerShell cmdlet, `node -e`, a heredoc or scratch script). The store changes through t, cap and rem;
// this is the shell twin of pre-write's `store-write` check.
//
//   shellStoreWrite(command, { readScript }) -> null | { path, hint }

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { segments } from './shell-segments.mjs';

const ITEM_DIRS = 'tickets|decisions|questions|notes|epics|requests|inbox|resolved|reminders';
const STORE_PATH = new RegExp(`(?:\\.ai|projects[\\\\/][^\\\\/\\s"']+)[\\\\/](?:(${ITEM_DIRS})[\\\\/]|SESSION\\.md|agents\\.jsonl|read-receipts\\.json|REGRESSIONS\\.md|SUPERSEDED\\.md)`, 'i');
const BUILT_PATH = new RegExp(`['"]\\.ai['"][\\s\\S]*['"](?:${ITEM_DIRS}|SESSION\\.md)['"]`, 'i');
const KIT_TOOL = /^(?:t|cap|rem|q|code-graph|t\.mjs|cap\.mjs|rem\.mjs|q\.mjs|index-tickets\.mjs|triage\.mjs|code-graph\.mjs)$/i;
const WRITING_CMD = /^(?:mv|rm|del|erase|ren|rename|rmdir|tee|touch|truncate|remove-item|move-item|rename-item|new-item|set-content|add-content|out-file|clear-content)$/i;
const COPY_CMD = /^(?:cp|copy|copy-item)$/i;
const FS_WRITE = /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|renameSync|rename|rmSync|rmdirSync|unlinkSync|copyFileSync|cpSync|createWriteStream|WriteAllText|WriteAllLines|WriteAllBytes)\b|\bopen\([^)]*['"][wax]b?['"]/;
const REDIRECT = /(?<![-=])>>?\s*(["']?)([^\s"'|;&<>]+)/g;
const HEREDOC_CODE = /\b(?:node|python3?)(?:\.exe)?\s+-?\s*<<-?/i;
const UNQUOTE = /^["']|["']$/g;

const HINTS = {
  tickets: 't new | t status | t tick | t criterion | t link | t comment | t notes <id> "<prose>"  (prose sections: the Edit tool)',
  decisions: 't decide --file <draft.md> (new) | t revise <id> [--status-to <s>] [--summary "<text>"] [--file <draft.md>] (change)',
  inbox: 'cap [type] "<text>" (capture) | t triage <inbox-file> [--type <t>] (promote and file the capture)',
  questions: 't question | t ask <id> | t resolve <id> "<answer>"',
  notes: 't note "<title>" | t notes <id> "<prose>"',
  epics: 't epic "<title>" | t status <id> <state>',
  requests: 't request "<title>" | t status <id> <state>',
  resolved: 'cap --done [type] "<text>"',
  reminders: 'rem add "<title>" --every <days>',
  session: 't session "<text>" | --append | --replace --file <draft> | --fix "<old>" "<new>" | --drop "<text>"',
  other: 'the verb that owns this file (t, cap, rem); t move <id> <repo-path> moves an item between repos',
};

function hintFor(path) {
  const m = STORE_PATH.exec(path);
  if (!m) return HINTS.other;
  if (m[1]) return HINTS[m[1].toLowerCase()];
  return /SESSION\.md/i.test(m[0]) ? HINTS.session : HINTS.other;
}

const hit = (path) => (STORE_PATH.test(path) ? { path, hint: hintFor(path) } : null);

function readTempScript(path) {
  try {
    const abs = resolve(path);
    const rel = relative(resolve(tmpdir()), abs);
    if (rel.startsWith('..') || isAbsolute(rel)) return '';
    return readFileSync(abs, 'utf8');
  } catch { return ''; }
}

function codeWrites(code) {
  if (!FS_WRITE.test(code)) return null;
  const named = STORE_PATH.exec(code);
  if (!named && !BUILT_PATH.test(code)) return null;
  return { path: named ? named[0] : '.ai/…', hint: named ? hintFor(named[0]) : HINTS.other };
}

function judgeSegment(text, readScript) {
  const tok = text.trim().match(/"[^"]*"|'[^']*'|\S+/g) || [];
  if (!tok.length) return null;
  const leader = tok[0].replace(/.*[\\/]/, '').replace(UNQUOTE, '');
  const args = tok.slice(1).map((a) => a.replace(UNQUOTE, ''));
  const isNode = /^node(?:\.exe)?$/i.test(leader);
  if (isNode && args.some((a) => KIT_TOOL.test(a.replace(/.*[\\/]/, '')))) return null;
  if (KIT_TOOL.test(leader) || /^git$/i.test(leader)) return null;

  for (const m of text.matchAll(REDIRECT)) { const h = hit(m[2]); if (h) return h; }
  if (WRITING_CMD.test(leader)) return args.map(hit).find(Boolean) || null;
  if (COPY_CMD.test(leader)) return hit(args.filter((a) => !a.startsWith('-')).at(-1) || '');
  if (/^sed$/i.test(leader) && args.some((a) => /^-[A-Za-z]*i/.test(a))) return args.map(hit).find(Boolean) || null;
  if (isNode || /^(?:python3?|py|powershell|pwsh)(?:\.exe)?$/i.test(leader)) {
    const inline = args.findIndex((a) => /^(?:-e|--eval|-p|--print|-c|-command)$/i.test(a));
    if (inline >= 0) return codeWrites(args.slice(inline + 1).join(' '));
    const script = args.find((a) => /\.(?:m?js|cjs|py|ps1)$/i.test(a));
    return script ? codeWrites(readScript(script)) : null;
  }
  return null;
}

export function shellStoreWrite(command, { readScript = readTempScript } = {}) {
  if (HEREDOC_CODE.test(String(command || ''))) return codeWrites(String(command));
  for (const { text } of segments(String(command || ''))) {
    const found = judgeSegment(text, readScript);
    if (found) return found;
  }
  return null;
}
