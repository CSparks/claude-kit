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

import { git } from './lib/exec.mjs';
import { readLadder } from '../scripts/dispatch-ladder.mjs';

const TRANSCRIPT_TAIL_BYTES = 256 * 1024; // enough JSONL tail to find the latest assistant turn
const DEFINITION_HEAD_BYTES = 4 * 1024; // frontmatter lives at the top of an agent .md
const TAG_LABEL_MAX = 40; // a bracketed prefix longer than this is prose, not a tag

// The display name is DERIVED from the model id (`claude-opus-5-5` -> `Opus 5.5`): no lineup
// table lives in code. Provider prefixes (`us.anthropic.`), date suffixes (`-20260101`) and
// `[1m]` are ignored. The only map is the kit config's `dispatch.aliases` (alias -> full id),
// so a retargeted alias is one config line (KIT-D079, KIT-T337).
const FAMILY_ID = /claude-([a-z]+)-(\d+)(?:-(\d{1,2})(?!\d))?/i;
const VENDOR_ID = /^(?:claude|gpt|gemini|llama|mistral|us\.anthropic|anthropic)[\w.\-[\]:]*$/i;

function idDisplay(id) {
  const m = String(id).match(FAMILY_ID);
  if (!m) return '';
  const [, family, major, minor] = m;
  return `${family[0].toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? `.${minor}` : ''}`;
}

function kitAliases() {
  try {
    return readLadder().aliases;
  } catch {
    return {};
  }
}

// Families the kit knows: alias names plus the families of every ladder model id.
function knownFamilies() {
  const families = new Set(Object.keys(kitAliases()));
  try {
    for (const t of Object.values(readLadder().tiers)) {
      for (const id of [t.model, t.fallback]) {
        const m = String(id || '').match(FAMILY_ID);
        if (m) families.add(m[1].toLowerCase());
      }
    }
  } catch {
    /* no ladder — only vendor-shaped ids count as tags */
  }
  return [...families];
}

// The display form of a raw model value: an id or alias becomes `Family N[.M]`, anything else
// passes through VERBATIM (an unrecognized model is still worth showing), and an absent value
// yields '' so callers can omit the tag entirely.
export function modelDisplay(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const fromId = idDisplay(value);
  if (fromId) return fromId;
  const aliased = kitAliases()[value.replace(/\[[^\]]*\]$/, '').toLowerCase()];
  return aliased ? idDisplay(aliased) || aliased : value;
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

// The ONE label form: `[<display>] <description>`. Any leading model tag the caller wrote
// (`[opus]`, `[claude-opus-5-5]`, `[sonnet55]`, a stale `[Opus 5]`) is replaced by the resolved
// model's tag, so the line states what the dispatch runs on, and a re-fired hook is IDEMPOTENT.
// A NON-model bracket prefix — `[CRX-T024] fix the thing` — is the author's and stays after it.
export function tagDescription(description, display) {
  const text = String(description ?? '');
  if (!display) return text;
  return `[${display}] ${stripModelTag(text)}`;
}

// The inverse, for surfaces that store the description as their own label: the roster's `task`
// should read `Build CRX-T024 admin foundation`, not repeat a tag it already carries in its
// `model` field. Strips ONLY a leading model tag; any other bracket prefix survives.
export function stripModelTag(description) {
  const text = String(description ?? '');
  const tag = leadingTag(text);
  return tag ? text.slice(tag.length).trimStart() : text;
}

// The leading `[…] ` run when — and only when — it names a model: a vendor-shaped id
// (`claude-opus-5-5`, `gpt-5`) or a kit model family with an optional version (`opus`,
// `Opus 5.5`, `sonnet55`). `[CRX-T024]` and `[WIP]` are the author's and never match.
// Returns the matched prefix, or '' when there is none.
function leadingTag(text) {
  const m = text.match(/^\[([^\]]+)\]\s*/);
  if (!m || m[1].length > TAG_LABEL_MAX) return '';
  const label = m[1].trim();
  if (VENDOR_ID.test(label)) return m[0];
  const families = knownFamilies();
  if (!families.length) return '';
  const family = new RegExp(`^(?:${families.join('|')})(?:[\\s.\\-]?\\d+(?:[.\\-]\\d+)?)?$`, 'i');
  return family.test(label) ? m[0] : '';
}

// The repos above `root`, nearest first: a hook whose cwd sits inside a submodule must still
// see the superproject's `.claude/agents/`, where a workspace pins its agents (KIT-T267).
function superprojects(root) {
  const chain = [];
  let cwd = root;
  while (cwd) {
    const up = git(['rev-parse', '--show-superproject-working-tree'], cwd).trim();
    if (!up || chain.includes(up)) break;
    chain.push(up);
    cwd = up;
  }
  return chain;
}

// Resolve a `model:` pin from the agent definition's frontmatter. Probes the plugin's own
// agents/ (both install layouts), then the project's and every superproject's
// .claude/agents/, then the user's. A definition FOUND without a model line returns '' —
// an unpinned type must be routed explicitly.
export function pinnedModel(root, subagentType) {
  const m = definitionFrontmatter(root, subagentType).match(/^model:\s*([^\s#]+)/m);
  return m && m[1] !== 'inherit' ? m[1] : '';
}

// The `tools:` list from the agent definition's frontmatter: an array of tool names, or null
// when no definition was found, it lists no tools, or it grants everything ('*'). A caller
// asking whether a type can WRITE treats null as "unknown — assume it can".
export function definitionTools(root, subagentType) {
  const m = definitionFrontmatter(root, subagentType).match(/^tools:\s*(.+)$/m);
  if (!m) return null;
  const tools = m[1].split(',').map((t) => t.trim()).filter(Boolean);
  return !tools.length || tools.includes('*') ? null : tools;
}

// The frontmatter block of the first definition found for `subagentType`, '' when none.
function definitionFrontmatter(root, subagentType) {
  const name = String(subagentType || '').split(':').pop().trim();
  if (!name) return '';
  const hookDir = dirname(fileURLToPath(import.meta.url));
  const projectRoots = root ? [root, ...superprojects(root)] : [];
  const probes = [
    process.env.CLAUDE_PLUGIN_ROOT && join(process.env.CLAUDE_PLUGIN_ROOT, 'agents', `${name}.md`),
    join(hookDir, '..', 'agents', `${name}.md`),
    ...projectRoots.map((r) => join(r, '.claude', 'agents', `${name}.md`)),
    join(homedir(), '.claude', 'agents', `${name}.md`),
  ].filter(Boolean);
  for (const file of probes) {
    try {
      if (!existsSync(file)) continue;
      const head = readFileSync(file, 'utf8').slice(0, DEFINITION_HEAD_BYTES);
      const fm = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      return fm ? fm[1] : '';
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
        if (model && !model.startsWith('<')) return model;
      } catch {
        /* clipped first line of the tail — keep scanning */
      }
    }
  } catch {
    /* unreadable transcript — indeterminate */
  }
  return '';
}
