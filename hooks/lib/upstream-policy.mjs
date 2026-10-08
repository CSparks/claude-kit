// Parsing for the upstream-gate hook (KIT-T395): which commands submit work to a repo the
// account of record does not own, which repo that is, and whether the command carries the
// policy-read token. Pure over a command string plus a `ctx` of git lookups, so tests drive
// it without a repo.
//
//   ctx.remotes(dir)        -> [{ name, url }]            configured remotes in `dir`
//   ctx.defaultRemote(dir)  -> name | ''                  where a bare `git push` goes
//   ctx.ghResolved(dir)     -> 'owner/repo' | remote name | ''   `gh repo set-default` choice

import { segments, cdTarget, toPath } from './shell-segments.mjs';
import { tokenize } from './branch-ops.mjs';

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

const ghRepoFlag = (toks) => {
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '-R' || t === '--repo') return toks[i + 1] || '';
    if (t.startsWith('--repo=')) return t.slice(7);
    if (/^-R\S/.test(t)) return t.slice(2);
  }
  return '';
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
  let dir = cwd;
  for (const { text } of segments(String(command))) {
    const seg = text.trim();
    if (!seg) continue;
    const cd = cdTarget(seg);
    if (cd) { dir = ctx.resolveDir(dir, cd); continue; }
    const toks = tokenize(seg);
    const env = {};
    while (toks.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[0])) { const [k, ...v] = toks.shift().split('='); env[k] = v.join('='); }
    const bin = (toks.shift() || '').replace(/^.*[\\/]/, '').replace(/\.exe$/i, '');
    let found = null;
    if (bin === 'gh' && GH_SUBMIT.has(`${toks[0]} ${toks[1]}`)) {
      const slug = ghRepoFlag(toks) || env.GH_REPO || urlSlug(toks);
      const base = slug ? { slug, remote: ctx.remotes(dir).find((r) => slugOf(r.url).toLowerCase() === slug.toLowerCase()) || null } : ghDefaultRemote(dir, ctx);
      found = { kind: `gh ${toks[0]} ${toks[1]}`, ...base };
    } else if (bin === 'git') {
      let segDir = dir;
      while (toks.length && (toks[0] === '-C' || toks[0] === '-c')) { const f = toks.shift(); const v = toks.shift() || ''; if (f === '-C') segDir = ctx.resolveDir(segDir, toPath(v)); }
      if (toks[0] === 'push') found = { kind: 'git push', ...pushTarget(toks.slice(1), segDir, ctx) };
      if (found) found.dir = segDir;
    }
    if (found && found.slug && !isOwnSlug(found.slug)) out.push({ ...found, dir: found.dir || dir });
  }
  return out;
}

export const CLAUDE_TRAILER = /^(?:co-authored-by:\s*claude\b|claude-session:)|noreply@anthropic\.com|generated with \[?claude code|claude\.ai\/code\/session/im;

export const POLICY_URLS = { bevyengine: 'https://bevy.org/learn/contribute/policies/ai/' };
