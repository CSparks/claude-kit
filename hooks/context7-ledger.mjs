#!/usr/bin/env node
// PostToolUse (mcp__*context7*) — the usage ledger for the one METERED docs source (KIT-T182).
// Context7 cut its free tier ~92% (KIT-D055), so every call is spend; spend that leaves no trace
// can't be budgeted. One JSONL line per call — ts, tool, library/query extract — is the record
// that makes "how much context7 did this month cost, and on what?" answerable from disk.
//
// DELIBERATELY NOT opt-in-gated on `.ai/` (the guard every enforcement hook opens with): the
// quota is per-MACHINE, not per-project, so a call from an unadopted repo spends the same
// budget and must land in the same ledger — which is why the ledger lives under ~/.claude.
//
// The KB check is WARN-ONLY and always exits 0: KIT-D055 puts the kit knowledgebase before a
// paid call, and a stderr line naming the doc is enough to redirect the next lookup. Blocking a
// call that already happened would be theatre — PostToolUse fires after the spend.

import { existsSync, appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { payload } from './lib.mjs';

const CONTEXT7_TOOL = /^mcp__.*context7/i;
// Input keys the context7 tools actually carry (`resolve-library-id`: libraryName + query;
// `query-docs`: libraryId + query), plus the older spellings, so a server rename degrades to a
// thinner extract rather than an empty one.
const LIBRARY_KEYS = ['libraryName', 'libraryId', 'library', 'context7CompatibleLibraryID'];
const QUERY_KEYS = ['query', 'topic', 'prompt'];
const EXTRACT_MAX = 200; // a ledger row is an index entry, not a transcript
const MIN_TOKEN = 3; // 1-2 char doc-name fragments ("js", "3") match everything — useless as a signal

// CLAUDE_KIT_CONTEXT7_LEDGER overrides the path so a test never appends to the real ledger
// (the CLAUDE_KIT_REGISTRY idiom). Resolved at call time, not frozen at import.
export function ledgerPath() {
  return process.env.CLAUDE_KIT_CONTEXT7_LEDGER || join(homedir(), '.claude', 'context7-ledger.jsonl');
}

// The KB index ships INSIDE the plugin tree, so it is found relative to this file (or the
// installed plugin root) — never an absolute dev path, which would be a lie on any other machine.
export function kbIndexPath() {
  const probes = [
    process.env.CLAUDE_PLUGIN_ROOT && join(process.env.CLAUDE_PLUGIN_ROOT, 'research', 'README.md'),
    join(dirname(fileURLToPath(import.meta.url)), '..', 'research', 'README.md'),
  ].filter(Boolean);
  return probes.find((p) => existsSync(p)) || null;
}

// The library + query the call spent on, as one short string. Both halves are kept because the
// library alone loses what was asked and the query alone loses which docs were billed.
export function extractQuery(input) {
  const pick = (keys) => {
    for (const k of keys) {
      const v = input && input[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };
  return [pick(LIBRARY_KEYS), pick(QUERY_KEYS)].filter(Boolean).join(' | ').slice(0, EXTRACT_MAX);
}

// Doc rows of the index table: a first cell carrying `[title](name.md)` or a bare `name.md`.
// The table's placeholder row has neither, so it filters itself out — no special case needed.
export function kbDocs(indexText) {
  const docs = [];
  for (const line of String(indexText).split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cell = line.split('|')[1] || '';
    const m = cell.match(/\[[^\]]*\]\(([^)]+\.md)\)/) || cell.match(/([\w.-]+\.md)/);
    if (!m) continue;
    const file = m[1];
    const tokens = basename(file, '.md')
      .toLowerCase()
      .replace(/^lib-/, '')
      .split(/[-_.]/)
      .filter((t) => t.length >= MIN_TOKEN);
    if (tokens.length) docs.push({ file, tokens });
  }
  return docs;
}

// Loose on purpose (KIT-T182: no tuning loop) — one shared name token is enough to surface the
// doc, because the cost of an ignored warning is one line of stderr.
export function matchKbDoc(query, docs) {
  const q = String(query).toLowerCase();
  return docs.find((d) => d.tokens.some((t) => q.includes(t))) || null;
}

try {
  const p = await payload();
  const tool = String(p.tool_name || '');
  if (!CONTEXT7_TOOL.test(tool)) process.exit(0);

  const query = extractQuery(p.tool_input || {});
  const row = { ts: new Date().toISOString(), tool, query };
  try {
    const file = ledgerPath();
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify(row) + '\n');
  } catch {
    /* an unwritable ledger dir must never wedge the tool call */
  }

  if (query) {
    try {
      const index = kbIndexPath();
      const hit = index && matchKbDoc(query, kbDocs(readFileSync(index, 'utf8')));
      if (hit) {
        process.stderr.write(
          `[context7-ledger] KB already covers this: research/${hit.file} — read it before the next metered call (KIT-D055: kit KB first, context7 last). Distil this answer back into that doc.\n`,
        );
      }
    } catch {
      /* no KB index / unreadable — the ledger row is the part that matters */
    }
  }
} catch {
  /* fail-open — a metered call is already paid for; nothing here may block its result */
}
process.exit(0);
