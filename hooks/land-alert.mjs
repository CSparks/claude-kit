#!/usr/bin/env node
// Stop — the LANDING ALERT ratchet (KIT-T021; KIT-D017's loop, pairs with KIT-T019).
//
// A rigid, structural part of the loop: whenever real work LANDS, the maintainer is ALWAYS
// alerted — never silent. "Lands" = a commit this turn (and, once pushed, that it's pushed/
// building, distinct from merely committed-local). The alert states WHAT landed, the TICKET it
// cites, and a LINK (the remote commit url). Like the commit-gate, this is enforced, not memory:
// every assistant turn ends at Stop, so we manufacture the choke point here — if work landed this
// turn and the reply doesn't already carry the landing receipt, block the stop ONCE with the
// alert. The burden flips from "remember to announce the landing" to "clear the gate".
//
// Loop-proof + once-per-landing: `stop_hook_active` (already nudged this stop) → allow; a marker
// keyed on the landed { head, pushed } state dedups so the SAME landing never re-alerts — but a
// STATE CHANGE (local commit → pushed/building) is a fresh landing worth its own alert. That is
// what distinguishes "pushed (building)" from "committed (not pushed)" across turns.
//
// Runs LAST on Stop (after sync-data pushes), so it observes the post-push state. FAIL-OPEN on
// every error: an alert hook must never wedge a session (the hook contract) → exit 0.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assistantTextOf } from './lib/assistant-text.mjs';
import { unannouncedIn } from './lib/announced-landings.mjs';
import { triageFooter } from './lib/block-triage.mjs';
import { LAND_SLOT, isPushed, landedThisTurn } from './lib/landed-commits.mjs';
import {
  gitRoot, adopted, payload, git, remoteCommitUrl, readTurnState, writeTurnState,
} from './lib.mjs';

// Cap how many landed commits we enumerate, so a turn that lands a long series stays one screen;
// the rest collapse to a "+N more" tail.
const MAX_LISTED = 8;

// The reply already told the maintainer the work landed → the alert is satisfied (the release
// valve, mirroring request-gate's RECEIPT). Any of: a landing verb (landed/pushed/deployed/live/
// shipped/committed), a short sha (7-40 hex), a commit-url, or an explicit [no-alert: reason].
const LANDED_RECEIPT = new RegExp(
  String.raw`\[no-?alert\b` +
    String.raw`|\b(?:landed|pushed|deployed|shipped|published|went live|is live|now live)\b` +
    String.raw`|\bcommit(?:ted|s)?\b[^\n]*\b[0-9a-f]{7,40}\b` +
    String.raw`|/commit/[0-9a-f]{7,40}\b` +
    String.raw`|\b[0-9a-f]{7,40}\b[^\n]*\b(?:landed|pushed|deployed|shipped|committed)\b`,
  'i',
);

// WHAT CAN BE UAT'd — the maintainer's standing rule (KIT-T099, sharpened by KIT-D045): a turn that
// lands work must end by telling the maintainer what THEY can try as a user (the app/preview to
// open, the CLI to run and read) — automated suites are Claude's own loop, cited only as
// already-run evidence, never assigned to the maintainer. Cleared by a UAT line, a test verb
// (test/verify/repro), a runner/command mention (cargo, npm, pytest, race_sim, … — as evidence),
// "N passed", an explicit "nothing to test", or "[no-test: <reason>]". Absent → the landing
// reply never said what to try. ([no-alert:] still suppresses the whole gate.)
const TEST_RECEIPT = new RegExp(
  String.raw`\[no-?(?:test|alert)\b` +
    String.raw`|\bUAT\b` +
    String.raw`|\bnothing to test\b` +
    String.raw`|\bcan be tested\b` +
    String.raw`|\b(?:tested?|verif(?:y|ied|ies))\b` +
    String.raw`|\brepro(?:duce|duced|s)?\b` +
    String.raw`|\b(?:cargo|npm|pnpm|yarn|pytest|jest|vitest|mocha|gradle|maven|go test|make|race_sim|geom_lint|preview)\b` +
    String.raw`|\b\d+\s+passed\b`,
  'i',
);

main().catch(() => process.exit(0)); // any failure → allow the stop (fail-open)

async function main() {
  const p = await payload();
  if (p.stop_hook_active) process.exit(0); // already nudged this stop — never loop
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  const tx = p.transcript_path;
  if (!tx || !existsSync(tx)) process.exit(0); // can't bound the turn — stay silent (fail-open)
  const { turnStartMs, lastAssistant } = parseTranscript(tx);
  if (!turnStartMs) process.exit(0);

  const landed = unannouncedIn(tx, landedThisTurn(root, turnStartMs));
  if (!landed.length) process.exit(0); // nothing landed, or every landing already named by sha — silent

  const head = git(['-C', root, 'rev-parse', 'HEAD']).trim();
  const pushed = isPushed(root);
  // Dedup: the SAME (head, pushed) landing alerts once. A later turn that pushes the same head
  // flips `pushed` false→true, which is a NEW state → a fresh "now pushed/building" alert.
  if (alreadyAlerted(root, head, pushed)) process.exit(0);

  // Satisfied only when the reply BOTH announces the landing AND says what can be tested
  // (KIT-T099 — the maintainer must always know what can be tested). Either missing → nag once.
  const reply = lastAssistant || '';
  const hasLanding = LANDED_RECEIPT.test(reply);
  const hasTest = TEST_RECEIPT.test(reply);
  const listing = { listed: landed.map((c) => c.sha), turnStartMs, at: Date.now() };
  if (hasLanding && hasTest) {
    recordAlerted(root, head, pushed, listing);
    process.exit(0);
  }

  recordAlerted(root, head, pushed, listing);
  process.stderr.write(renderAlert(root, landed, pushed, hasLanding, hasTest) + triageFooter());
  process.exit(2); // block-once (rigid) — the same ratchet as request-gate / flush
}

// --- the alert ------------------------------------------------------------------

function renderAlert(root, landed, pushed, hasLanding, hasTest) {
  const state = pushed
    ? 'PUSHED (building) — confirm it is LIVE once the deploy completes'
    : 'COMMITTED locally — NOT pushed yet (push at the task boundary, then confirm)';
  const lines = ['', `⚑ LANDING ALERT — work landed this turn. Tell the maintainer WHAT landed + WHAT CAN BE TESTED.`, `  State: ${state}.`, ''];
  for (const c of landed.slice(0, MAX_LISTED)) {
    const url = pushed ? remoteCommitUrl(root, c.sha) : null;
    const cite = c.ids.length ? `  [${c.ids.join(', ')}]` : '';
    lines.push(`  • ${c.shortSha} ${c.subject}${cite}`);
    if (url) lines.push(`      ${url}`);
  }
  if (landed.length > MAX_LISTED) lines.push(`  • …+${landed.length - MAX_LISTED} more`);
  lines.push('', '`t receipt` prints this landing as a receipt skeleton (sha, ticket, pushed state, the UAT line to fill).');
  lines.push('This alert is structural (KIT-T021/T099), not optional. To clear the gate:');
  if (!hasLanding) {
    lines.push('  - announce the landing — WHAT + the ticket + the link ("pushed"/"deployed"/the sha);');
  }
  if (!hasTest) {
    lines.push('  - state WHAT THE MAINTAINER CAN UAT — a user-facing command/experience to try (open X, run Y and read it), or "[no-test: <reason>]"; automated suites are Claude\'s to run — cite results, never assign them (KIT-D045);');
  }
  lines.push(
    '  - if a deploy follows, confirm when it is LIVE (not just pushed);',
    '  - or "[no-alert: <reason>]" to suppress the whole gate.',
    '',
  );
  return lines.join('\n');
}

// --- once-per-landing marker (own turn-state slot; KIT-T021) ---------------------
// Stored in the 'land' slot so housekeeping's full-overwrite of the default turn-state object
// can't clobber it (the two Stop hooks would otherwise race on one file).
const SLOT = LAND_SLOT;

function markerFor(head, pushed) {
  return `${head}:${pushed ? 'pushed' : 'local'}`;
}
function alreadyAlerted(root, head, pushed) {
  const st = readSlot(root);
  return !!st && st.alerted === markerFor(head, pushed);
}
// `listing` (the shas this alert listed, the turn start, when) is what `t receipt` reads back as its default boundary.
function recordAlerted(root, head, pushed, listing = {}) {
  writeSlot(root, { alerted: markerFor(head, pushed), ...listing });
}

// Both slot accessors fail-open (a miss → no marker → the alert simply fires, the safe direction
// for "did we tell the maintainer?").
function readSlot(root) {
  return readTurnState(root, SLOT);
}
function writeSlot(root, state) {
  writeTurnState(root, state, SLOT);
}

// --- transcript (turn bounding — the request-gate/flush definition) -------------

function parseTranscript(file) {
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
