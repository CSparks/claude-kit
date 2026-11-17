// path-restore — a dispatch check for dispatch-guard (KIT-T1340). `git checkout <rev> -- <dir>` copies an older revision's files
// but never removes the paths that revision lacks, so every run of an old state leaves untracked stray source that the delete
// gate forbids a subagent to remove. A brief that prescribes it (or `git restore --source=<rev>`) for looking at an older
// revision is refused; the kit verb `restore-tree <rev> <dir> ...` and `restore-tree --back <dir> ...` is the form.
// A brief that names restore-tree, or a clause that forbids the raw form ("never git checkout <sha> -- dir"), passes.
//
//   pathRestoreBlock({ prompt, footer }) -> block message | null (check `path-restore`)

export const PATH_RESTORE_CHECK = 'path-restore';

const NEAR = String.raw`[^.\n]{0,100}`;
// A revision named by a short or full hash, or by a placeholder such as <sha>, <rev>, <old-sha>, <commit>.
const REVISION = String.raw`(?:[0-9a-f]{7,40}|<[^>\n]*(?:sha|rev|commit|hash|tag)[^>\n]*>)`;
const CHECKOUT_FROM_REVISION = new RegExp(String.raw`\bgit\s+checkout\s+${REVISION}\s+--\s`, 'i');
const RESTORE_FROM_REVISION = new RegExp(String.raw`\bgit\s+restore\b[^\n]{0,60}--source[= ]\s*(?:${REVISION}|\S+)`, 'i');
const VERB = /\brestore-tree\b/i;
const FORBIDDEN_CLAUSE = new RegExp(String.raw`\b(?:never|don'?t|do not|must not|not|instead of|rather than)\b${NEAR}`, 'ig');

export function pathRestoreBlock({ prompt, footer }) {
  const brief = String(prompt || '');
  if (VERB.test(brief)) return null;
  const text = brief.replace(FORBIDDEN_CLAUSE, ' ');
  if (!CHECKOUT_FROM_REVISION.test(text) && !RESTORE_FROM_REVISION.test(text)) return null;
  return [
    'BLOCKED: this brief tells the agent to put paths back to an older revision with raw git (git checkout <rev> -- <dir>, git restore --source).',
    '  That copies the old files and never removes the ones the revision lacks: each run leaves untracked stray source, and the delete gate',
    '  forbids a subagent to remove it (KIT-T1340).',
    '',
    'The sanctioned form is the kit verb restore-tree, on PATH like q:',
    '  restore-tree <rev> <dir> [<dir> ...]     the directories as <rev> had them, the files <rev> lacks removed',
    '  restore-tree --back <dir> [<dir> ...]    the directories at HEAD again, the strays removed',
    'It refuses, changing nothing, when an uncommitted change would be lost. Fix: name restore-tree in the brief instead of the raw git call.',
    '',
    footer,
  ].join('\n');
}
