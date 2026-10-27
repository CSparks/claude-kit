// t/status.mjs — the ticket status transition (t status): known-state check, the human_only /
// uat-required gate, the landed-commit `todo` refusal and its --remaining note, and the History
// stamping. Pure markdown mutation; the CLI main in t.mjs wraps it with the index/cache refresh.

import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { field } from '../frontmatter.mjs';
import { appendUnderSection, stamp } from '../md-body.mjs';
import { readConfig } from '../t-config.mjs';
import { remainingNote } from '../landed.mjs';
import { SHA_RE, findTicket, setField } from './ticket-file.mjs';
import { lapseVerdict, lapseNote, LAPSE_LABEL, HUMAN_MARK } from './lapse-rule.mjs';
import { addLabel, removeLabel } from './labels.mjs';

// --- t status ------------------------------------------------------------------------------

function resolveUat(parts, cfg) {
  return field(parts.fm, 'uat') || cfg.uatDefault;
}

// `--lapsed` is the one door past the human_only / uat gate (KIT-D107): review → done only, and
// only once the ticket has idled past the lapse window with no maintainer feedback.
function assertLapsable(id, state, from, text, opts) {
  if (state !== 'done' || from !== 'review') throw new Error(`${id}: --lapsed only moves a ticket review → done (this is ${from} → ${state})`);
  const verdict = lapseVerdict(text, { now: opts.now });
  if (!verdict.eligible) throw new Error(`${id}: not lapsable — ${verdict.reason}`);
}

// Transition a ticket's status. Enforces config.statuses (target must be a known state),
// guards human_only / uat-required closes behind --human, stamps a (status) History line, and
// — for `done` — runs the done tail (archive + fixed_commit hygiene). Pure markdown mutation:
// the CLI main wraps this with the index/cache refresh so tests can drive it in isolation.
export function setStatus(root, id, state, opts = {}) {
  const cfg = readConfig(root);
  const t = findTicket(root, id);
  if (!t.parts) throw new Error(`${id}: no frontmatter block to update`);
  const known = new Set([...cfg.flow, ...cfg.offBoard, ...cfg.humanOnly]);
  if (!known.has(state)) {
    throw new Error(`${id}: '${state}' is not a known status (flow: ${cfg.flow.join(', ')}; off-board: ${cfg.offBoard.join(', ')})`);
  }
  const from = field(t.parts.fm, 'status') || '—';
  const remaining = remainingNote(id, state, t.text, opts.remaining);

  if (opts.lapsed) assertLapsable(id, state, from, t.text, opts);
  const uatRequiredClose = state === 'done' && resolveUat(t.parts, cfg) === 'required';
  const humanGated = !opts.lapsed && (cfg.humanOnly.includes(state) || uatRequiredClose);
  if (humanGated && !opts.human) {
    const why = uatRequiredClose ? `uat=required for ${id}` : `'${state}' is human_only`;
    throw new Error(`${id}: ${why} — re-run with --human (this transition is the maintainer's call)`);
  }

  let fm = setField(t.parts.fm, 'status', state);
  fm = setField(fm, 'updated', new Date().toISOString().replace(/\.\d+Z$/, 'Z'));

  const reopening = from === 'done' && state !== 'done';
  if (opts.lapsed) fm = addLabel(fm, LAPSE_LABEL);
  if (reopening) fm = removeLabel(fm, LAPSE_LABEL);

  const type = field(t.parts.fm, 'type');
  const tailNotes = [];
  // A sha the caller PASSED is written on any transition and any type (KIT-T190). It used to be
  // read only inside the done+bug/regression branch, so `t status <id> review --fixed-commit <sha>`
  // — the closing shape of every uat=required project — dropped the flag without a word, and the
  // ticket's provenance link to its fixing commit was simply lost (seen on GB-T039).
  if (opts.fixedCommit) {
    if (!SHA_RE.test(opts.fixedCommit)) throw new Error(`--fixed-commit '${opts.fixedCommit}' is not a sha`);
    fm = setField(fm, 'fixed_commit', opts.fixedCommit);
  } else if (state === 'done' && (type === 'bug' || type === 'regression') && !field(t.parts.fm, 'fixed_commit')) {
    tailNotes.push(`set fixed_commit on this ${type} (pass --fixed-commit <sha>) — regression tracking needs the fixing commit`);
  }

  const suffix = opts.lapsed ? ` — ${lapseNote}` : opts.human ? ` ${HUMAN_MARK}` : '';
  let body = appendUnderSection(t.parts.rest, 'History', `- [${stamp()}] (status) ${from} → ${state}${suffix}`);
  if (opts.note) body = appendUnderSection(body, 'History', `- [${stamp()}] (comment) ${opts.note}`);
  if (remaining) body = appendUnderSection(body, 'History', `- [${stamp()}] (comment) ${remaining}`);

  const out = t.parts.open + fm + t.parts.close + body;
  writeFileSync(t.path, out);

  // done tail: archive the file so the active board stays small (config.history.archive_done_to).
  let movedTo = null;
  if (state === 'done' && !t.archived && t.store === 'tickets') {
    const archDir = join(root, '.ai', cfg.archiveDir);
    mkdirSync(archDir, { recursive: true });
    const dest = join(archDir, t.file);
    renameSync(t.path, dest);
    movedTo = dest;
  }
  let restored = null;
  if (reopening && t.archived && t.store === 'tickets') {
    restored = join(root, '.ai', 'tickets', t.file);
    renameSync(t.path, restored);
  }
  return { id, from, to: state, path: movedTo || restored || t.path, archived: !!movedTo, warnings: tailNotes };
}
