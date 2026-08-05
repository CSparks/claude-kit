// The MODEL of a delegation — resolved once, displayed one way, everywhere it is watched.
//
// A dispatch's model decides what it costs, and it was invisible on every surface: the native
// activity line shows `general-purpose  Build CRX-T024 …` with no tier, and the roster recorded
// scope/background/isolation/targetRoot but not model. This module is the single place that
// answers "which model is this delegation on?" and "what do we call it?", so the activity line,
// the roster, orient and the dispatch gate cannot drift apart (KIT-T179).
//
// It is also where dispatch-guard's two resolvers now live (they were private to that hook and
// the tag needs the same answer) — one implementation, two consumers.

import { readFileSync, statSync, openSync, readSync, closeSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const TRANSCRIPT_TAIL_BYTES = 256 * 1024; // enough JSONL tail to find the latest assistant turn
const DEFINITION_HEAD_BYTES = 4 * 1024; // frontmatter lives at the top of an agent .md
const TAG_LABEL_MAX = 40; // a bracketed prefix longer than this is prose, not a tag

// DATED LINEUP FACT — true for the model lineup as of 2026-08-05. Model names are not stable
// facts; they are a snapshot that goes stale the moment the lineup moves (the same reason
// KIT-D035/D042/D043 are dated decisions rather than standing rules). WHEN THE LINEUP CHANGES,
// EDIT THIS TABLE — it is the only place a display name is spelled, so a rename is one diff.
//
// Each entry matches BOTH the tier alias an orchestrator passes (`model: 'opus'`) and the full
// model id a transcript carries (`claude-opus-5`, incl. provider prefixes like `us.anthropic.…`
// and suffixes like `-20260101` / `[1m]`). The generation is part of every pattern on purpose:
// `claude-opus-4-1` must NOT render as "Opus 5" — an unknown value passes through verbatim,
// which is honest, where a bare /opus/ match would quietly lie.
const LINEUP = [
  [/^fable$|claude-fable-5\b/i, 'Fable 5'],
  [/^opus$|claude-opus-5\b/i, 'Opus 5'],
  [/^sonnet$|claude-sonnet-5\b/i, 'Sonnet 5'],
  [/^haiku$|claude-haiku-4-5\b/i, 'Haiku 4.5'],
];

const DISPLAY_NAMES = new Set(LINEUP.map(([, name]) => name.toLowerCase()));

// The display form of a raw model value: a known tier/id becomes its lineup name, anything else
// passes through VERBATIM (an unrecognized model is still worth showing — better a raw id on the
// line than a silent blank), and an absent value yields '' so callers can omit the tag entirely.
export function modelDisplay(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  for (const [pattern, name] of LINEUP) {
    if (pattern.test(value)) return name;
  }
  return value;
}

// Which model a dispatch will actually run on, in the order the harness decides it:
//   1. an explicit `model` on the Agent call — the orchestrator chose a tier;
//   2. the agent definition's `model:` frontmatter pin (kit agents pin opus, KIT-T151);
//   3. otherwise it INHERITS the session's model — the case dispatch-ladder exists to catch.
// Returns the raw value ('' when indeterminate); callers map it through modelDisplay.
export function resolveDispatchModel(root, input = {}, p = {}) {
  const explicit = typeof input.model === 'string' ? input.model.trim() : '';
  if (explicit) return explicit;
  const pinned = pinnedModel(root, String(input.subagent_type || input.agent_type || ''));
  if (pinned) return pinned;
  return latestAssistantModel(p.transcript_path);
}

// Prepend `[<display>] ` to an activity description. IDEMPOTENT: a description already led by a
// model tag is returned untouched, so a re-fired hook (or a payload that already went through
// updatedInput) never stacks `[Opus 5] [Opus 5] …`. A NON-model bracket prefix — `[CRX-T024] fix
// the thing` — is left in place and tagged in front of, because that bracket is the author's.
export function tagDescription(description, display) {
  const text = String(description ?? '');
  if (!display) return text;
  if (leadingTag(text)) return text;
  return `[${display}] ${text}`;
}

// The inverse, for surfaces that store the description as their own label: the roster's `task`
// should read `Build CRX-T024 admin foundation`, not repeat a tag it already carries in its
// `model` field. Strips ONLY a leading model tag; any other bracket prefix survives.
export function stripModelTag(description) {
  const text = String(description ?? '');
  const tag = leadingTag(text);
  return tag ? text.slice(tag.length).trimStart() : text;
}

// The leading `[…] ` run when — and only when — it names a model: either a lineup display name
// ("[Opus 5]") or a raw value modelDisplay would pass through verbatim ("[gpt-5]", from a
// previous tag of an unknown model). Returns the matched prefix, or '' when there is none.
function leadingTag(text) {
  const m = text.match(/^\[([^\]]+)\]\s*/);
  if (!m || m[1].length > TAG_LABEL_MAX) return '';
  const label = m[1].trim();
  if (DISPLAY_NAMES.has(label.toLowerCase())) return m[0];
  return modelDisplay(label) !== label || isModelish(label) ? m[0] : '';
}

// A raw model value that modelDisplay would pass through unchanged is only a TAG if it looks
// like a model id — otherwise `[CRX-T024]` and `[WIP]` would be eaten as stale tags.
function isModelish(label) {
  return /^(claude|gpt|gemini|llama|mistral|us\.anthropic|anthropic)[\w.\-[\]]*$/i.test(label);
}

// Resolve a `model:` pin from the agent definition's frontmatter. Probes the plugin's own
// agents/ (both install layouts), then project- and user-level .claude/agents/. A definition
// FOUND without a model line returns '' — an unpinned type must be routed explicitly.
export function pinnedModel(root, subagentType) {
  const name = String(subagentType || '').split(':').pop().trim();
  if (!name) return '';
  const hookDir = dirname(fileURLToPath(import.meta.url));
  const probes = [
    process.env.CLAUDE_PLUGIN_ROOT && join(process.env.CLAUDE_PLUGIN_ROOT, 'agents', `${name}.md`),
    join(hookDir, '..', 'agents', `${name}.md`),
    root && join(root, '.claude', 'agents', `${name}.md`),
    join(homedir(), '.claude', 'agents', `${name}.md`),
  ].filter(Boolean);
  for (const file of probes) {
    try {
      if (!existsSync(file)) continue;
      const head = readFileSync(file, 'utf8').slice(0, DEFINITION_HEAD_BYTES);
      const fm = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const m = fm && fm[1].match(/^model:\s*([^\s#]+)/m);
      return m ? m[1] : '';
    } catch {
      /* unreadable probe — try the next layout */
    }
  }
  return '';
}

// The session's model = the latest assistant turn in the transcript JSONL. Indeterminate
// ('' → treated as not-fable by the dispatch gate) whenever the path is absent or unparseable.
export function latestAssistantModel(transcriptPath) {
  try {
    if (!transcriptPath || !existsSync(transcriptPath)) return '';
    const size = statSync(transcriptPath).size;
    const start = Math.max(0, size - TRANSCRIPT_TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    const fd = openSync(transcriptPath, 'r');
    readSync(fd, buf, 0, buf.length, start);
    closeSync(fd);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const row = JSON.parse(line);
        const model = row && row.type === 'assistant' && row.message && row.message.model;
        if (model) return model;
      } catch {
        /* clipped first line of the tail — keep scanning */
      }
    }
  } catch {
    /* unreadable transcript — indeterminate */
  }
  return '';
}
