#!/usr/bin/env node
// Stop — auto-commit + push the centralized workflow-data repo (claude-kit-data) when
// it has changes, so a turn's .ai/ edits persist without manual ceremony (D-008). The
// project repo's CODE commits still carry the ticket citation; the data repo syncs
// itself. No-ops unless the current repo's .ai resolves into a separate git repo.

import { gitRoot, git, gitTry, centralDataRoot } from './lib.mjs';
import { dataProjectPathspec } from './data-repo.mjs';

const proj = gitRoot();
if (!proj) process.exit(0);

// Centralized only: .ai resolves into a DIFFERENT repo than the project (KIT-T059: one
// resolver, shared with orient).
const dataRoot = centralDataRoot(proj);
if (!dataRoot) process.exit(0);

// KIT-T230: the data repo is SHARED — every project's store lives under projects/<name>/, and
// other sessions edit theirs concurrently. Every step below is limited to THIS project's
// subtree, so a sync never stages, commits, or publishes another session's in-flight edits.
// An unrecognized layout yields '' and falls back to the whole repo, announced.
const scope = dataProjectPathspec(proj);
const pathspec = scope ? ['--', scope] : [];
if (!scope) {
  process.stderr.write(
    `[sync-data] .ai does not resolve to ${dataRoot}/projects/<name> — syncing the WHOLE data repo (may include other projects)\n`,
  );
}

if (!git(['-C', dataRoot, 'status', '--porcelain', ...pathspec]).trim()) process.exit(0);

// Don't auto-commit a duplicate/mismatched id into the data repo. This is the
// guard for centralized projects (the path that let two HOD-T045 files persist):
// the dup lands here, not through commit-gate. checkIds scans this project's .ai
// (resolved through the junction). Block the stop so it's fixed now; fail open on
// a scan error so a parse glitch never wedges the session.
try {
  // dynamic so a broken scripts/ tree degrades to fail-open instead of an import-time crash (KIT-T055)
  const { checkIds } = await import('../scripts/id-utils.mjs');
  const { duplicates, mismatches, regressionGaps } = checkIds(proj);
  if (duplicates.length || mismatches.length || regressionGaps.length) {
    const lines = ['', '[sync-data] BLOCKED: .ai id integrity check failed — NOT committing.', ''];
    for (const d of duplicates) lines.push(`  DUPLICATE ${d.id}: ${d.files.join('  ·  ')}`);
    for (const m of mismatches) lines.push(`  MISMATCH ${m.file}: id '${m.fmId}' != filename '${m.fileId}'`);
    for (const g of regressionGaps) lines.push(`  REGRESSION INCOMPLETE ${g.id} (${g.file}): ${g.reason}`);
    // KIT-T170: one hint per FAILURE MODE. The old message offered the regression-link fix for
    // every finding, so an id/filename mismatch was told to run `t link` — advice that cannot fix it.
    lines.push('');
    if (duplicates.length) lines.push('  DUPLICATE -> re-key one of the files: node <kit>/scripts/next-id.mjs <store>');
    if (mismatches.length) lines.push("  MISMATCH  -> make the id and the filename agree: rename the file to <id>-<slug>.md, or set frontmatter `id:` to the filename's id. Canon is <KEY>-D###-slug.md (KIT-D011).");
    if (regressionGaps.length) lines.push('  REGRESSION INCOMPLETE -> t link <id> regressed_from|causing_commit <ref>');
    lines.push('', 'Fix the flagged item(s) then retry.', '');
    process.stderr.write(lines.join('\n'));
    process.exit(2);
  }
} catch {
  /* integrity scan is best-effort — never wedge a stop on a scan error */
}

// KIT-T053: every step is VERIFIED — a receipt is only emitted for what actually
// happened, and a failure surfaces the real git error instead of a false success.
git(['-C', dataRoot, 'add', ...(scope ? ['--', scope] : ['-A'])]);
const subject = scope ? `sync: workflow data (${scope})` : 'sync: workflow data';
const commit = gitTry(['-C', dataRoot, 'commit', '-m', subject, ...pathspec]);
if (!commit.ok) {
  process.stderr.write(`[sync-data] commit FAILED — data repo NOT synced:\n${commit.out.trim()}\n`);
  process.exit(0);
}

if (!git(['-C', dataRoot, 'remote']).trim()) {
  process.stderr.write('[sync-data] committed claude-kit-data (no remote configured — not pushed)\n');
  process.exit(0);
}

// Rejected push (the other machine moved first): fetch+rebase once, retry. A rebase
// that conflicts is aborted so the repo is never left mid-rebase; the local commit
// stays and the failure is reported for manual reconciliation.
let push = gitTry(['-C', dataRoot, 'push']);
if (!push.ok) {
  const rebase = gitTry(['-C', dataRoot, 'pull', '--rebase']);
  if (rebase.ok) {
    push = gitTry(['-C', dataRoot, 'push']);
  } else {
    gitTry(['-C', dataRoot, 'rebase', '--abort']);
    push = { ok: false, out: `${push.out.trim()}\nrebase also failed:\n${rebase.out.trim()}` };
  }
}
if (push.ok) {
  process.stderr.write('[sync-data] committed + pushed claude-kit-data\n');
} else {
  process.stderr.write(
    `[sync-data] committed locally but PUSH FAILED — claude-kit-data is NOT synced (other machines cannot see this turn). Reconcile manually:\n${push.out.trim()}\n`,
  );
}
