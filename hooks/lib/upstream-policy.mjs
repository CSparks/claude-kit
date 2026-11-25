// Parsing for the upstream-gate hook (KIT-T395): which commands submit work to a repo the
// account of record does not own, which repo that is, and whether the command carries the
// policy-read token. Pure over a command string plus a `ctx` of git lookups, so tests drive
// it without a repo.
//
//   ctx.remotes(dir)        -> [{ name, url }]            configured remotes in `dir`
//   ctx.defaultRemote(dir)  -> name | ''                  where a bare `git push` goes
//   ctx.ghResolved(dir)     -> 'owner/repo' | remote name | ''   `gh repo set-default` choice

import { segments } from './shell-segments.mjs';
import { msysToNative } from './msys-path.mjs';
import { tokenize } from './branch-ops.mjs';
import { gitCommand } from './git-subcommand.mjs';
import { MAX_NESTING, commandRuns } from './lead-command-walk.mjs';

export const OWN_OWNERS = (process.env.CLAUDE_KIT_OWN_OWNERS || 'CSparks').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const GH_SUBMIT = new Set(['pr create', 'issue create', 'pr comment', 'issue comment']);
const GH_REMOTE_RANK = ['upstream', 'github', 'origin'];
const PUSH_OPTS_WITH_VALUE = new Set(['-o', '--push-option', '--receive-pack', '--exec', '--repo', '--signed']);
const TOKEN = /\[upstream-policy-read:\s*([^\];]*[^\];\s])\s*;\s*ai-allowed:\s*(yes|no)\s*\]/i;

export const policyToken = (command) => {
  const m = String(command).match(TOKEN);
  return m ? { ref: m[1].trim(), aiAllowed: m[2].toLowerCase() === 'yes' } : null;
};

// `owner/repo` from a remote URL (https, ssh, scp spelling) or a github.com web URL, else ''.
export function slugOf(url) {
  const m = String(url).trim().replace(/\\/g, '/')
    .match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/\s]+@)?[^/:\s]+[/:](?!\d+\/)([^/\s]+)\/([^/\s#?]+)/i);
  return m ? `${m[1]}/${m[2].replace(/\.git$/i, '')}` : '';
}

export const isOwnSlug = (slug) => OWN_OWNERS.includes(String(slug).split('/')[0].toLowerCase());

const REPO_EQUALS = '--repo=';
const AMBIGUOUS_TARGET = 'several repos named:';
// gh flags of pr and issue create or comment that take their value as the next word: that word is text, never a repo flag.
const GH_VALUE_FLAGS = new Set(['--title', '-t', '--body', '-b', '--body-file', '-F', '--head', '-H', '--base', '-B', '--label', '-l',
  '--assignee', '-a', '--reviewer', '-r', '--milestone', '-m', '--project', '-p', '--template', '-T', '--recover']);

// Every repo a gh call's flags name, in order: the value of each -R or --repo, skipping the values of flags that take one.
const ghRepoFlags = (toks) => {
  const repos = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '-R' || t === '--repo') repos.push(toks[++i] || '');
    else if (t.startsWith(REPO_EQUALS)) repos.push(t.slice(REPO_EQUALS.length));
    else if (/^-R\S/.test(t)) repos.push(t.slice(2));
    else if (GH_VALUE_FLAGS.has(t)) i++;
  }
  return repos;
};

// The target repo of a gh call: its only candidate (flags, GH_REPO, a pull or issue URL). More than one distinct candidate is
// returned joined, which is no account's own slug, so the call counts as foreign.
const ghTargetSlug = (toks, env) => {
  const found = [...ghRepoFlags(toks), env.GH_REPO, urlSlug(toks)].filter(Boolean);
  const distinct = found.filter((c, i) => found.findIndex((o) => o.toLowerCase() === c.toLowerCase()) === i);
  return distinct.length > 1 ? `${AMBIGUOUS_TARGET} ${distinct.join(', ')}` : distinct[0] || '';
};

const urlSlug = (toks) => {
  for (const t of toks) { const m = t.match(/^https?:\/\/[^/\s]+\/([^/\s]+)\/([^/\s]+)\/(?:pull|issues)\//i); if (m) return `${m[1]}/${m[2]}`; }
  return '';
};

// The remote a `gh` command with no -R targets: gh-resolved, else upstream > github > origin.
function ghDefaultRemote(dir, ctx) {
  const remotes = ctx.remotes(dir);
  const resolved = ctx.ghResolved(dir);
  if (resolved && resolved.includes('/')) return { slug: resolved, remote: remotes.find((r) => slugOf(r.url).toLowerCase() === resolved.toLowerCase()) };
  const byName = (n) => remotes.find((r) => r.name === n);
  const pick = (resolved && byName(resolved)) || GH_REMOTE_RANK.map(byName).find(Boolean) || remotes[0];
  return pick ? { slug: slugOf(pick.url), remote: pick } : { slug: '', remote: null };
}

function pushTarget(toks, dir, ctx) {
  const rest = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.startsWith('-')) { if (PUSH_OPTS_WITH_VALUE.has(t) && !t.includes('=')) i++; continue; }
    rest.push(t);
  }
  const remotes = ctx.remotes(dir);
  const named = rest[0] && remotes.find((r) => r.name === rest[0]);
  if (named) return { slug: slugOf(named.url), remote: named };
  if (rest[0] && /^[a-z][a-z0-9+.-]*:\/\/|^[^/\\\s]+@[^:\s]+:/i.test(rest[0])) return { slug: slugOf(rest[0]), remote: null };
  const def = ctx.defaultRemote(dir);
  const remote = remotes.find((r) => r.name === def) || remotes.find((r) => r.name === 'origin');
  return remote ? { slug: slugOf(remote.url), remote } : { slug: '', remote: null };
}

// Every submission in `command` aimed at a repo the account does not own:
// [{ kind: 'gh pr create' | 'git push' | ..., slug, remote, dir }].
export function foreignSubmissions(command, cwd, ctx) {
  const out = [];
  collectSubmissions(String(command), cwd, ctx, out, 0, false);
  return out;
}

// The directory of every `git push` in `command`, whoever owns the remote: [{ dir }] (the pre-push wiring check, KIT-T1300).
export function pushedRepos(command, cwd, ctx) {
  const out = [];
  collectSubmissions(String(command), cwd, ctx, out, 0, true);
  return out.filter((f) => f.kind === 'git push').map(({ dir }) => ({ dir }));
}

// The directory a lexed `cd [/d] <dir>` segment moves to, '' when the words are not a cd.
const cdOperand = (words) => (words[0] === 'cd' ? (words[1] === '/d' ? words[2] : words[1]) || '' : '');

// One command text: each segment, then the command strings it runs (`bash -c`, `ssh`, `eval`, substitutions), each from
// the directory the segments before it reached.
function collectSubmissions(command, cwd, ctx, out, depth, every, shell = ctx.shell || '') {
  let dir = cwd;
  for (const { text } of segments(command, { shell })) {
    const seg = text.trim();
    if (!seg) continue;
    const toks = tokenize(seg, shell);
    const cd = cdOperand(toks);
    if (cd) { dir = ctx.resolveDir(dir, msysToNative(cd)); continue; }
    if (depth < MAX_NESTING) commandRuns(seg, shell).forEach((run) => collectSubmissions(run.text, dir, ctx, out, depth + 1, every, run.shell || ''));
    const env = {};
    while (toks.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[0])) { const [k, ...v] = toks.shift().split('='); env[k] = v.join('='); }
    const bin = (toks.shift() || '').replace(/^.*[\\/]/, '').replace(/\.exe$/i, '');
    let found = null;
    if (bin === 'gh' && GH_SUBMIT.has(`${toks[0]} ${toks[1]}`)) {
      const slug = ghTargetSlug(toks, env);
      const base = slug ? { slug, remote: ctx.remotes(dir).find((r) => slugOf(r.url).toLowerCase() === slug.toLowerCase()) || null } : ghDefaultRemote(dir, ctx);
      found = { kind: `gh ${toks[0]} ${toks[1]}`, ...base };
    } else if (bin === 'git') {
      const call = gitCommand(toks);
      const segDir = call.options.filter(({ flag }) => flag === '-C').reduce((d, { value }) => ctx.resolveDir(d, msysToNative(value)), dir);
      if (call.sub === 'push') found = { kind: 'git push', ...pushTarget(call.args, segDir, ctx) };
      if (found) found.dir = segDir;
    }
    if (found && (every || (found.slug && !isOwnSlug(found.slug)))) out.push({ ...found, dir: found.dir || dir });
  }
}

export const CLAUDE_TRAILER = /^(?:co-authored-by:\s*claude\b|claude-session:)|noreply@anthropic\.com|generated with \[?claude code|claude\.ai\/code\/session/im;

export const POLICY_URLS = { bevyengine: 'https://bevy.org/learn/contribute/policies/ai/' };
