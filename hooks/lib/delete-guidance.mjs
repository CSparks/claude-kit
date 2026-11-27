// What source-shell-gate tells a caller whose shell delete of a source file was refused (owns-untracked-file.mjs): the
// rule, then the one way out that fits why this file was refused.
//
//   DELETE_RULE                                 the rule in one sentence (also printed by `q gates source`)
//   deleteGuidance(refusal, { path, cwd, operand, verb, what, mainThread, holders })   the lines for a refusal in DELETE_REFUSALS; '' for an unknown refusal
//     operand: the unresolved delete operand; verb: the git call that was refused; what: the part of it that names no file
//     mainThread: the caller is the main thread; holders: the live writers named for a live-writer refusal (live-writers.mjs)

import { resolve } from 'node:path';
import { DELETE_REFUSALS as R } from './owns-untracked-file.mjs';
import { BASELINE_ROUTE } from './agent-gate-guide.mjs';

export const DELETE_RULE = 'a shell delete (rm, del, Remove-Item) of source, or a git call that deletes or hides files (git clean, git rm -f, git stash -u), passes only for a file this caller wrote with Write or Edit and has not changed since, one named file per operand, whose name the command spells out or assigns to a variable as one literal; a tracked file is removed with `git rm -- <path>`; a git stash naming files passes only for this caller\'s own files, for the main thread too; a git call that may take files it does not name (no path, a directory, a glob) passes only while no other writer is live in the checkout; a file another session or agent wrote, or no tool wrote, is left to the main thread: a subagent raises it there, and the main thread removes an untracked one with the plain `rm <path>` (PowerShell: `Remove-Item <path>`) once no live writer holds it, no git discard verb';

// A pull, rebase, stash or autostash moves every writer's tracked changes out of the shared work tree (KIT-T1266).
const INTEGRATION_VERB = /^git (?:pull|rebase|stash|merge|config$)/;
// A git config call that is not plainly a read: agents have no need to change shared git configuration (KIT-T1266).
const configWayOut = () => 'This git config call is not exactly a read (an optional scope flag --global, --local, --system or --worktree, an optional --show-origin and --show-scope, then exactly one of --get <key>, --get-all <key>, --get-regexp <pattern>, --list, -l, get <key>, list; anything else, an abbreviated option or a bare key included, is refused), and another writer is live in this checkout: git configuration is shared by every writer, and keys such as pull.rebase, merge.autoStash, rebase.autoStash, branch.<name>.rebase and include.path change what every later pull, rebase or merge does to their uncommitted work. An agent has no need to change it here: raise it to the coordinator, who runs the same call once no other writer is live in this checkout (a pre-push wiring such as core.hooksPath at a quiet moment, before a push agent is dispatched).';
const baselineRoute = (verb) => (/^git stash/.test(verb) ? `\n  ${BASELINE_ROUTE.join('\n  ')}` : '');
const integrationWayOut = (verb) => (verb === 'git config' ? configWayOut() : `${verb} here would stash, rebase or move the tracked changes of every writer of this checkout${/--autostash/.test(verb) ? ' (an autostash is refused whether or not another writer is live)' : ', and another writer is live in it'}. Commit your own work by explicit path (\`git commit -F <message file> -- <your paths>\`), then \`git fetch\` and \`git push origin HEAD:main\`. If the push is rejected because the remote moved, \`git pull --rebase\` is allowed only when no other writer has uncommitted changes in this checkout; otherwise raise it to the coordinator, who arranges a quiet moment. Do not pull, rebase or stash here meanwhile.${baselineRoute(verb)}`);
const MAIN_THREAD_DELETE = (path) => `the plain \`rm ${path}\` (PowerShell: \`Remove-Item ${path}\`)`;

// A subagent hands the delete to the main thread; the main thread reaches this through a git discard verb on a tracked file
// with changes, or when the registry of live writers could not be read.
// An agent killed by an API error sends no stop event, so its claims outlive it (KIT-T1287); only the main thread may release them.
export const RELEASE_HINT = 'If that writer is dead (killed by an API error: no stop event), release its claims with `claims --release <agent id> --reason "<why>"` (refused for an agent that wrote in the last 5 minutes).';
// The one form a main thread may use to put back tracked files a dead or ended writer left changed (KIT-T1286).
const RESTORE_FORM = '`git restore -- <path> <path> ...`, naming each tracked file (no directory, no glob, no `.`)';
// The stray an old revision's files leave after `git checkout <rev> -- <dir>`: the verb that restores and returns (KIT-T1340).
export const RESTORE_TREE_FORM = '`restore-tree <rev> <dir> ...` puts directories as <rev> had them and removes the files <rev> lacks; `restore-tree --back <dir> ...` returns them to HEAD';
const STRAY_HINT = `If this file is a leftover of looking at an older revision (git checkout <rev> -- <dir>), no delete is needed: ${RESTORE_TREE_FORM}, removing the strays no commit would lose.`;
const raiseToMainThread = ({ mainThread, path, verb }) => {
  if (verb === 'git restore') {
    return mainThread
      ? `The main thread may put these files back with ${RESTORE_FORM} once no live writer holds any of them; the registry of live writers could not be read if it still refuses: retry once it can. A file a live writer holds stays refused.`
      : `Raise it to the main thread: once no live writer holds the files, it puts them back with ${RESTORE_FORM}. A subagent has no sanctioned way.`;
  }
  return `${mainThread
    ? `A tracked file holding changes no tool of this caller wrote: commit or restore them first, then delete it. Otherwise the registry of live writers could not be read: retry ${MAIN_THREAD_DELETE(path)}.`
    : `Raise it to the main thread: once no live writer holds it, the main thread removes an untracked file with ${MAIN_THREAD_DELETE(path)}. A subagent has no sanctioned way.`} ${STRAY_HINT}`;
};

// A named-path stash of a file this caller did not write is refused to every caller, the main thread included, whether or not
// its writer has ended (delete-judge.mjs; RDG-D191 holds any lift); the pathless stash passes only while no other writer is live.
const STASH_VERB = /^git stash/;
const STASH_REFUSALS = new Set([R.unrecorded, R.otherWriter]);
const STASH_WHY = { [R.unrecorded]: 'No Edit or Write of this caller left these bytes (never written by a tool, or changed since)', [R.otherWriter]: 'Another session or agent wrote this file' };
const stashWayOut = (refusal, verb) => `${STASH_WHY[refusal]}. A stash naming files passes only for files this caller wrote with Write or Edit and has not changed since; no caller, the main thread included, may stash another writer's file by name, even one whose writer has ended. The pathless \`git stash push -m <note>\` (every tracked change of this checkout) passes only while no other writer is live in it: the main thread runs it then, and a subagent raises it to the main thread. Meanwhile commit your own work by explicit path, or read the old code with \`git show HEAD:<path>\`.${baselineRoute(verb)}`;

const WAYS_OUT = {
  [R.noWriter]: () => 'This call carries no session id, so no Write can be attributed to it.',
  [R.glob]: () => 'A glob is not expanded: name each file.',
  [R.missing]: ({ path, cwd }) => `No such file at ${resolve(cwd, path).replace(/\\/g, '/')}: the command is in ${cwd.replace(/\\/g, '/')} at this point (a \`cd\` earlier in the command moves where a relative path points).`,
  [R.tracked]: ({ path }) => `Tracked source: remove it with \`git rm -- ${path}\`, so the commit shows the deletion, and commit it at once by explicit path (\`git commit -F <message file> -- ${path}\`): until then the deletion sits staged in the index every writer of this checkout shares. ${STRAY_HINT}`,
  [R.unrecorded]: (ctx) => (ctx.verb === 'git restore' && ctx.mainThread
    ? 'No Edit or Write of any writer recorded these bytes (never written by a tool, or changed since): they may be the maintainer\'s own uncommitted edit, which a restore would destroy. Ask the maintainer before restoring them.'
    : `No Edit or Write of this caller left these bytes (never written by a tool, or changed since): it stays with its writer. ${raiseToMainThread(ctx)}`),
  [R.otherWriter]: (ctx) => `Another session or agent wrote this file: it stays with its writer. ${raiseToMainThread(ctx)}`,
  [R.liveWriter]: ({ path, holders, verb, mainThread }) => `${holders.length ? holders.join(' and ') : 'A writer'} is live in this checkout and may still be writing this file. Once that writer has stopped or committed it, the main thread ${verb === 'git restore' ? `puts it back with ${RESTORE_FORM}` : `removes it with ${MAIN_THREAD_DELETE(path)}`}.${mainThread ? ` ${RELEASE_HINT}` : ''}`,
  [R.unresolved]: ({ operand }) => `This delete names ${operand}, which this command does not assign as one literal NAME=value segment before it, so the file it holds is unknown. Spell the path out, or assign the variable in the same command (NAME=path; rm "$NAME").`,
  [R.sweep]: ({ verb, what }) => (INTEGRATION_VERB.test(verb || '') ? integrationWayOut(verb) : `${verb || 'This git call'} here may take files it does not name${what ? ` (${what})` : ''}, and another writer is live in this checkout: its untracked or changed files could go. Name each file you wrote yourself (\`git clean -f -- <path>\`, \`rm <path>\`), or raise it to the main thread. A call outside the git allow-list is written plainly: a built-in git command with only the options and config keys \`q gates source\` lists, and no environment change in front of it or exported in the command. No shell verb is sanctioned for another writer's files.`),
};

export function deleteGuidance(refusal, ctx) {
  const stash = STASH_VERB.test(ctx.verb || '') && STASH_REFUSALS.has(refusal);
  const wayOut = stash ? () => stashWayOut(refusal, ctx.verb) : WAYS_OUT[refusal];
  return wayOut ? `  Delete rule: ${DELETE_RULE}.\n  ${wayOut(ctx)}\n` : '';
}
