#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — block a `git commit` of code that isn't tied to the
// plan-of-record / a ticket. exit 2 = block, 0 = allow. No-ops on unadopted repos.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { payload, git, gitRoot, adopted, pathExcluded, excludeFooter, ID_CITE_SRC } from './lib.mjs';
import { isDataRepo, dataProjectsSpanned } from './data-repo.mjs';
import { turnWrites, turnStartMs } from './turn-writes.mjs';

const CODE = new Set(
  'ts tsx js jsx mjs cjs rs py go java rb php cs swift kt c cc cpp cxx h hpp css scss sass less vue svelte sql'.split(' '),
);
// Foreign staged paths listed before the warning collapses to a "+N more" tail.
const MAX_FOREIGN = 10;

const p = await payload();
const command = (p.tool_input && p.tool_input.command) || '';
const isCommit = /\bgit\s+(?:-C\s+\S+\s+|--?\S+\s+)*commit\b/.test(command);
// `git add -A` / `git add .` with no pathspec limit. -A is TREE-WIDE regardless of cwd, so in
// the shared data repo it stages every project's subtree, not the one being worked (KIT-T230).
const isBareAdd = /\bgit\s+(?:-C\s+(?:"[^"]+"|'[^']+'|\S+)\s+)?add\s+(?:-[A-Za-z-]+\s+)*(?:-A\b|--all\b|\.\s*(?:$|[;|&]))/.test(command);
if (!isCommit && !isBareAdd) process.exit(0);

// The commit runs in the repo the command targets, not the session cwd: resolve a
// leading `cd <path>` or `git -C <path>`. Translate an MSYS path (/d/dev/x) to a
// Windows path (d:/dev/x) so `git -C` accepts it. Falls back to cwd.
function targetDir(cmd) {
  let m = cmd.match(/(?:^|&&|;)\s*cd\s+(\S[^&;|]*)/);
  let path = m ? m[1].trim() : '';
  if (!path) {
    m = cmd.match(/git\s+-C\s+("[^"]+"|'[^']+'|\S+)/);
    path = m ? m[1].trim() : '';
  }
  if (!path) return process.cwd();
  path = path.replace(/^["']|["']$/g, '');
  return path.replace(/^\/([A-Za-z])\//, '$1:/');
}

const root = gitRoot(targetDir(command));
const dataRepo = isDataRepo(root);

// KIT-T230: warn on a tree-wide add in the shared data repo, BEFORE the adopted() gate — the
// data repo's own root holds `projects/`, not `.ai`, so it is never "adopted".
if (isBareAdd && dataRepo) {
  process.stderr.write(
    [
      '',
      '⚠ tree-wide `git add` in the shared workflow-data repo (claude-kit-data).',
      '',
      '  -A / . stage the WHOLE repo regardless of cwd, so this sweeps every other',
      "  project's subtree — including a live session's half-written edits — into your commit.",
      '',
      '  Add by explicit pathspec instead:',
      '    git -C <data-repo> add -- projects/<name>',
      '',
    ].join('\n'),
  );
}
if (!isCommit) process.exit(0);
if (!adopted(root) && !dataRepo) process.exit(0);
// Centralized data (D-008): the plan-of-record lives in claude-kit-data, not this repo,
// so it can't be touched in this commit — the gate is cite-only here.
const centralized = existsSync(join(root, '.claude-project'));

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const uniq = (a) => [...new Set(a)];

// KIT-T052: judge the COMMIT'S file set, not the whole dirty tree.
//   explicit pathspec -> git's own matching (`status --porcelain -- <paths>`)
//   -a/--all          -> tracked modified + staged
//   bare commit       -> staged set only
// Shell parsing is heuristic: anything unrecognized falls back to the whole
// dirty tree — the strict direction, so the gate may narrow but never leak.
function commitSpec(cmd) {
  const m = cmd.match(/\bgit\s+(?:-C\s+(?:"[^"]+"|'[^']+'|\S+)\s+|--?\S+\s+)*commit\b/);
  if (!m) return { mode: 'tree' };
  let seg = '';
  let q = '';
  for (const ch of cmd.slice(m.index + m[0].length)) {
    if (q) { seg += ch; if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'") { q = ch; seg += ch; continue; }
    if (ch === ';' || ch === '|' || ch === '&') break;
    seg += ch;
  }
  // options whose value arrives as the NEXT token (long form without '=')
  const VALUE_OPTS = new Set(['-m', '-F', '-t', '-c', '-C', '--message', '--file', '--template', '--author', '--date', '--cleanup', '--fixup', '--squash', '--reuse-message', '--reedit-message', '--trailer', '--pathspec-from-file']);
  const toks = [...seg.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((t) => t[1] ?? t[2] ?? t[3]);
  const paths = [];
  let all = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '--') { paths.push(...toks.slice(i + 1)); break; }
    if (t === '-a' || t === '--all') { all = true; continue; }
    if (t.startsWith('--')) { if (VALUE_OPTS.has(t)) i++; continue; }
    if (t.startsWith('-')) {
      // short cluster (-am): 'a' flags all; a trailing value-taking letter consumes the next token
      if (t.includes('a')) all = true;
      if (/[mFtcC]$/.test(t)) i++;
      continue;
    }
    paths.push(t);
  }
  if (paths.length) return { mode: 'paths', paths };
  return { mode: all ? 'all' : 'staged' };
}

// porcelain v1: two status columns + space, renames as `R  old -> new`
const porcelainFiles = (raw) =>
  raw.split('\n').filter(Boolean).map((l) => {
    let p = l.slice('XY '.length);
    if (p.includes(' -> ')) p = p.split(' -> ').pop();
    return p.replace(/^"|"$/g, '');
  });

const spec = commitSpec(command);
let changed;
if (spec.mode === 'paths') {
  changed = uniq(porcelainFiles(git(['-C', root, 'status', '--porcelain', '--', ...spec.paths])));
} else if (spec.mode === 'staged') {
  changed = uniq(lines(git(['-C', root, 'diff', '--cached', '--name-only'])));
} else if (spec.mode === 'all') {
  changed = uniq([
    ...lines(git(['-C', root, 'diff', '--name-only', 'HEAD'])),
    ...lines(git(['-C', root, 'diff', '--cached', '--name-only'])),
  ]);
} else {
  changed = uniq([
    ...lines(git(['-C', root, 'diff', '--name-only', 'HEAD'])),
    ...lines(git(['-C', root, 'diff', '--cached', '--name-only'])),
    ...lines(git(['-C', root, 'ls-files', '--others', '--exclude-standard'])),
  ]);
}
if (!changed.length) process.exit(0);

// KIT-T230: in the shared data repo, a commit spanning more than one `projects/<name>/` subtree
// publishes another live session's in-flight edits under this project's label. Hard block — the
// fix is always a pathspec, and the damage (pushed, mislabeled, mid-edit) is not undoable in place.
if (dataRepo) {
  const spanned = dataProjectsSpanned(changed);
  if (spanned.length > 1) {
    process.stderr.write(
      [
        '',
        `BLOCKED: this commit spans ${spanned.length} project subtrees of the shared workflow-data repo.`,
        '',
        ...spanned.map((n) => `  projects/${n}`),
        '',
        "Another session's in-flight edits would be published under this commit's label.",
        'Commit ONE project subtree at a time:',
        '  git -C <data-repo> add    -- projects/<name>',
        '  git -C <data-repo> commit -m "<msg>" -- projects/<name>',
        '',
      ].join('\n'),
    );
    process.exit(2);
  }
}
if (!adopted(root)) process.exit(0);

// KIT-T106: a bare `git commit` commits the WHOLE index, including anything staged outside this
// turn's work — that is how a perf commit swept in the maintainer's separately-staged deletions.
// WARN (not block): staged-by-maintainer can be intended; naming the foreign paths is the point.
if (spec.mode === 'staged') {
  const authored = turnWrites(root, turnStartMs(root));
  const foreign = changed.filter((f) => !authored.has(f));
  if (foreign.length && authored.size) {
    const shown = foreign.slice(0, MAX_FOREIGN);
    process.stderr.write(
      [
        '',
        `⚠ bare \`git commit\` — ${foreign.length} staged path(s) this turn did NOT write:`,
        '',
        ...shown.map((f) => `  ${f}`),
        ...(foreign.length > shown.length ? [`  +${foreign.length - shown.length} more`] : []),
        '',
        'They will ride along under this commit message. If that is not intended, commit a pathspec:',
        '  git commit -m "<msg>" -- <the files this turn changed>',
        '',
      ].join('\n'),
    );
  }
}

// ID integrity: if this commit touches the markdown stores, refuse it when the
// stores hold a duplicate id or a frontmatter/filename mismatch. This runs BEFORE
// the plan-of-record early-allow below so touching a ticket can't bypass it. The
// centralized layout (.ai is a junction into the data repo) is guarded separately
// by sync-data; here `root`'s own .ai is scanned. Fail open on any scan error.
if (changed.some((f) => /(^|\/)(?:\.ai\/)?(?:tickets|decisions|notes|questions)\/[^/]+\.md$/.test(f))) {
  try {
    // dynamic so a broken scripts/ tree degrades to fail-open instead of an import-time crash (KIT-T055)
    const { checkIds } = await import('../scripts/id-utils.mjs');
    const { duplicates, mismatches } = checkIds(root);
    if (duplicates.length || mismatches.length) {
      const lines = ['', 'BLOCKED: .ai id integrity check failed.', ''];
      for (const d of duplicates) lines.push(`  DUPLICATE ${d.id}: ${d.files.join('  ·  ')}`);
      for (const m of mismatches) lines.push(`  MISMATCH ${m.file}: id '${m.fmId}' != filename '${m.fileId}'`);
      // KIT-T170: one hint per FAILURE MODE — a mismatch is a rename, not a re-key.
      lines.push('');
      if (duplicates.length) lines.push('  DUPLICATE -> re-key one of the files: node <kit>/scripts/next-id.mjs <store>');
      if (mismatches.length) lines.push("  MISMATCH  -> make the id and the filename agree: rename the file to <id>-<slug>.md, or set frontmatter `id:` to the filename's id. Canon is <KEY>-D###-slug.md (KIT-D011).");
      lines.push('', 'Fix the flagged file(s) then commit.', '');
      process.stderr.write(lines.join('\n'));
      process.exit(2);
    }
  } catch {
    /* integrity scan is best-effort — never wedge a commit on a scan error */
  }
}

// EVIDENCE FLOOR (KIT-T061): a ticket reaching its CLOSING transition must cite test evidence
// (a test path / suite-run reference / commit sha) OR carry an explicit [no-test: reason]. The
// closing transition follows config.uat (KIT-D034): doing→done where uat resolves `none`,
// doing→review where `required`. Runs BEFORE the plan-of-record early-allow below, so the act
// of touching the ticket can't bypass its own floor. A "transition" = the staged status equals
// the closing state while HEAD's did not (so re-touching an already-closed ticket never blocks).
// Fail-open on any read/parse error per the HOOK CONTRACT.
const ticketChanges = changed.filter(
  (f) => /(^|\/)\.ai\/tickets\/(?:archive\/)?[^/]+\.md$/.test(f) && !/(^|\/)(?:_TEMPLATE|INDEX)\.md$/.test(f),
);
if (ticketChanges.length) {
  try {
    const { evidenceFloor, readConfig } = await import('../scripts/t.mjs');
    const uatDefault = readConfig(root).uatDefault;
    const statusOf = (text) => {
      const fm = (text.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
      const m = fm.match(/^status:[ \t]*(.*)$/m);
      return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
    };
    const offenders = [];
    for (const f of ticketChanges) {
      const abs = join(root, f);
      if (!existsSync(abs)) continue; // a delete (e.g. the rename SOURCE of an archive move)
      const text = readFileSync(abs, 'utf8');
      const floor = evidenceFloor(text, uatDefault);
      if (!floor.needsEvidence) continue; // not at the closing state, or evidence/escape present
      const head = git(['-C', root, 'show', `HEAD:${f}`]);
      if (head && statusOf(head) === floor.closing) continue; // already closed in HEAD — not new
      const id = (text.match(/^id:[ \t]*(.*)$/m) || [, f])[1].trim();
      offenders.push({ id, closing: floor.closing });
    }
    if (offenders.length) {
      const lines = ['', 'BLOCKED: a ticket reached its closing transition without test evidence (KIT-T061).', ''];
      for (const o of offenders) lines.push(`  ${o.id} → ${o.closing}, but its Notes/History cite no test artifact.`);
      lines.push(
        '',
        'UAT needs a floor: a closing transition must be test-backed, not self-asserted.',
        'Add ONE to the ticket (then re-commit):',
        '  - a test path (e.g. scripts/foo.test.mjs) or suite-run reference (npm test, "N passed"),',
        '  - the test/fixing commit sha, or',
        '  - an explicit escape:  [no-test: <reason>]',
        '',
      );
      process.stderr.write(lines.join('\n'));
      process.exit(2);
    }
  } catch {
    /* evidence scan is best-effort — never wedge a commit on a read/parse error */
  }
}

// Plan-of-record part of the change? A root/legacy ROADMAP|DECISIONS.md, or any of the
// atomic .ai/ stores (tickets/decisions/questions/notes/inbox — D-009).
if (changed.some((f) => /(^|\/)(ROADMAP|DECISIONS)\.md$/i.test(f) || /\.ai\/(tickets|decisions|questions|notes|inbox)\//.test(f))) {
  process.exit(0);
}
// Commit cites a logged item, or explicitly overrides? Scheme <KEY>-<TYPE><NUM> (HOD-T045,
// KIT-D010) via the shared atom (KIT-T059) · or [no-log:].
if (new RegExp(String.raw`\b${ID_CITE_SRC}\b|\[no-log`).test(command)) process.exit(0);

// Does the change actually touch code? (docs/config-only commits are fine)
// KIT-T051: a code file path excluded from `commit-log` doesn't count toward the
// citation requirement — so a generated/vendored tree can be committed uncited.
const touchesCode = changed.some(
  (f) => CODE.has((f.split('.').pop() || '').toLowerCase()) && !pathExcluded(root, 'commit-log', f),
);
if (!touchesCode) process.exit(0);

const blockedLine = centralized
  ? 'BLOCKED: code commit with no ticket citation (workflow data is centralized — KIT-D008).'
  : 'BLOCKED: this commit changes code but does not touch the plan-of-record.';
const options = centralized
  ? [
      "  - cite the ticket in the message (e.g. 'implements HOD-T045' / 'KIT-T007'), or",
      "  - if genuinely not trackable work, include '[no-log: <reason>]'.",
    ]
  : [
      '  - update the plan-of-record (ROADMAP / a .ai/ticket) in this commit, or',
      '  - record a decision in DECISIONS, or',
      "  - cite the item in the message (e.g. 'implements HOD-T041' / 'KIT-T007'), or",
      "  - if genuinely not trackable work, include '[no-log: <reason>]'.",
    ];
process.stderr.write(
  ['', blockedLine, '', 'Before committing, do ONE of:', ...options, '', 'Unlogged work is lost across sessions. This gate is the enforcement, not memory.', ''].join('\n') +
    excludeFooter('commit-log'),
);
process.exit(2);
