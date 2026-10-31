// notices.mjs — the top of orientation: the retrieval ritual, then every machine-level warning and dispatch-now list
// (broker health, drift, devices, kit bugs, idle queues, repeat asks, concerns, directives), each best-effort (KIT-T071).
//
//   header(ctx)            starts the output with the title, the repo and the retrieval ritual
//   notices(ctx)           pushes the warnings and dispatch-now lists
//   identity(ctx, views)   pushes foundational decisions, framework contracts, promotions and the doc tree; returns the foundational list

import { pathExcluded, payload, projectName } from '../../lib.mjs';
import { frameworkSection } from '../frameworks.mjs';
import { promotionLines } from '../../../scripts/decision-promotion.mjs';
import { adoptedDocTree, trunkMap } from '../../../scripts/doc-tree.mjs';
import { clip } from './common.mjs';

const REPEAT_ASKS_SHOWN = 8;
const DIRECTIVES_SHOWN = 5;
const PAYLOAD_WAIT_MS = 500;

export function header({ out, root }) {
  out.push('=== PROJECT ORIENTATION (on-disk record — trust over any summary or your memory) ===');
  out.push(`Repo: ${root}`);
  out.push('');
  // The retrieval ritual sits at the TOP: a tool list trailing 300 lines of content does not change behaviour.
  out.push('--- RETRIEVAL FIRST (before proposing/designing/claiming ANYTHING) ---');
  out.push('  q fts <nouns>        already settled/filed? SEARCH before you design — relitigation is a process failure');
  out.push('  q recent [Nd] [scope] what happened lately: decisions, fixed, moves, created (default 7d)');
  out.push('  q open | trail <id> | governing <path> | doc-trail <id> | show <id>   (full surface: q --help)');
  out.push('--- SEARCH WITH q, NOT grep/rg (code, docs, configs, tickets — this repo + its framework submodule; ranked, exact) ---');
  out.push('  q code <text> [--lang rust] [--path crates/x] [--regex -i -w] [-C 2] [--kind code|doc|config|ticket] [-l] [--limit 0]');
  out.push('  q sym <name> [--type fn,struct,impl,use,mod]   definitions, impls, uses, mod tree');
  out.push('  q file <glob>                                   find files by path');
  out.push('  q cannot do it? file it: cap feature "q: <what is missing>" --project claude-kit (never grep silently)');
  out.push('  Adoption ledger: <framework>/docs/CHOICES.toml — cite the row before naming any crate alternative.');
  out.push('  An empty/failed query is "NOT CHECKED", never "does not exist".');
  out.push('');
}

export async function notices({ out, root }) {
  try {
    const { healthWarnings } = await import('../../../scripts/broker/health-read.mjs');
    for (const w of healthWarnings(root)) out.push(`!! ${w}`);
  } catch {
    /* broker health is best-effort */
  }
  // A project-level dispatch: block is ignored (KIT-D079); the capability table's evidence dates expire (KIT-D080).
  try {
    const { dispatchDrift } = await import('../../../scripts/dispatch-ladder.mjs');
    const drift = dispatchDrift(root);
    if (drift) out.push(`!! ${drift}`);
    const { capabilityStatus, modelsLine } = await import('../../../scripts/model-lineup.mjs');
    out.push(modelsLine(capabilityStatus()));
    if (!pathExcluded(root, 'coordination-model', root)) {
      const { mainThreadNotice } = await import('../../../scripts/coordination-model.mjs');
      const hookInput = await Promise.race([payload(), new Promise((r) => setTimeout(() => r({}), PAYLOAD_WAIT_MS))]);
      const notice = mainThreadNotice(hookInput.model);
      if (notice) out.push(notice);
    }
    const { dispatchLine } = await import('../../../scripts/dispatch-report.mjs');
    const { KIT_ROOT } = await import('../../../scripts/dispatch-ladder.mjs');
    const proposal = dispatchLine([root, KIT_ROOT]);
    if (proposal) out.push(proposal);
  } catch {
    /* drift check is best-effort */
  }
  try {
    const { deviceBlock } = await import('../../../scripts/devices.mjs');
    out.push(...deviceBlock(projectName(root)));
  } catch {
    /* device block is best-effort */
  }
  try {
    const { kitBugBlock } = await import('../../../scripts/kit-bug.mjs');
    out.push(...kitBugBlock());
  } catch {
    /* kit-bug listing is best-effort */
  }
  try {
    const { noDaemonBlock } = await import('../../../scripts/broker/summary.mjs');
    out.push(...noDaemonBlock(root));
  } catch {
    /* broker dispatch check is best-effort */
  }
  try {
    const { askedAgainOpen } = await import('../../../scripts/asked-again.mjs');
    const repeats = askedAgainOpen(root);
    if (repeats.length) {
      out.push('--- DISPATCH NOW: tickets asked for again (a repeat ask outranks the queue) ---');
      for (const r of repeats.slice(0, REPEAT_ASKS_SHOWN)) out.push(`  ${r.id} — asked ${r.asked}x — ${clip(r.title, 100)}`);
      out.push('');
    }
  } catch {
    /* asked-again listing is best-effort */
  }
  try {
    const { concernBlock } = await import('../../../scripts/concern-check.mjs');
    const block = await concernBlock(root);
    if (block.length) out.push(...block, '');
  } catch {
    /* concern check is best-effort */
  }
  try {
    const { unenforcedDirectives } = await import('../directive.mjs');
    const open = unenforcedDirectives(root);
    if (open.length) {
      out.push('--- DIRECTIVES WITHOUT A TEST (a directive stays true only while a test enforces it) ---');
      for (const d of open.slice(0, DIRECTIVES_SHOWN)) out.push(`  ${d.id} — ${clip(d.title, 80)} — ${d.problem}`);
      out.push('');
    }
  } catch {
    /* directive listing is best-effort */
  }
}

export function identity({ out, root }, views) {
  const foundational = views.foundationalDecisions();
  if (foundational.length) {
    out.push('--- PROJECT IDENTITY (foundational — ALWAYS true; this is what the project IS; cite, never contradict) ---');
    for (const m of foundational) out.push(`  ${m.id ? m.id + ' — ' : ''}${clip(m.title, 140)}`);
    out.push('');
  }
  try {
    const section = frameworkSection(root);
    if (section) out.push(section);
  } catch {
    /* framework layer unavailable — orientation proceeds without it */
  }
  out.push(...promotionLines(root));
  try {
    if (adoptedDocTree(root)) {
      out.push('--- DOC TREE (navigate trunk → branch before searching; full index docs/TREE.md) ---');
      for (const line of trunkMap(root)) out.push('  ' + line);
      out.push('');
    }
  } catch {
    /* doc tree is best-effort — orientation proceeds without it */
  }
  return foundational;
}
