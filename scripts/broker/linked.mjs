// linked.mjs — one job across a superproject and its submodule (KIT-T482 item 4). A superproject
// patch may edit paths inside a submodule (`rapid-game/crates/…`), written as seen from the
// superproject root. Those paths plan against the submodule commit the superproject records,
// build and test together with the consumer change, and land as ONE unit: the submodule commit is
// pushed first (with its own pre-push gate), then a single superproject commit carries the
// consumer paths AND the new gitlink. Neither side ever sits on main without the other, unless
// the superproject push fails after the submodule landed; the result then names the pushed sha.
//
// `submodulesOf(cfg, repo)` → the submodule repos pinned in `repo`.
// `splitLinked(cfg, repo, paths)` → { own: [path], subs: Map<subRepo, [path relative to it]> }.
// `linkedReader(cfg, repo, cwd)` → read(path) for plan.mjs: a submodule path reads the recorded commit.
// `landLinked(cfg, repo, job, cwd, paths, opts)` → landPatch's result, plus `subSha` and `landedSubs`;
//   `onSubLanded({ own, gitlinks, preHead, subs })` runs once the submodule halves are pushed, before
//   the superproject commit, so the caller re-bases its journal (resume.mjs finishes a crash there).
//   (the submodule paths whose commit is pushed: the caller must not restore files under them).

import { join } from 'node:path';
import { git, revParse, showFile } from './git.mjs';
import { landCommits } from './land.mjs';

const posix = (p) => String(p).replace(/\\/g, '/');
const norm = (p) => posix(p).replace(/^\.\//, '').replace(/\/$/, '');

export const submodulesOf = (cfg, repo) => (repo.submodule ? [] : cfg.repos.filter((r) => r.submodule && norm(r.pinIn) === norm(repo.path)));

function subOf(cfg, repo, path) {
  const p = posix(path);
  for (const sub of submodulesOf(cfg, repo)) {
    const prefix = `${norm(sub.path)}/`;
    if (p.startsWith(prefix)) return { sub, rel: p.slice(prefix.length) };
  }
  return null;
}

export function splitLinked(cfg, repo, paths) {
  const own = [];
  const subs = new Map();
  for (const p of paths) {
    const hit = subOf(cfg, repo, p);
    if (!hit) { own.push(p); continue; }
    if (!subs.has(hit.sub)) subs.set(hit.sub, []);
    subs.get(hit.sub).push(hit.rel);
  }
  return { own, subs };
}

export function linkedReader(cfg, repo, cwd) {
  return (path) => {
    const hit = subOf(cfg, repo, path);
    if (!hit) return showFile(cwd, 'HEAD', path);
    const recorded = git(['rev-parse', `HEAD:${norm(hit.sub.path)}`], cwd).out;
    return recorded ? showFile(join(cfg.root, hit.sub.path), recorded, hit.rel) : null;
  };
}

// The submodule on its main branch at the commit it is checked out at, so a commit there can be
// pushed: refused when main has moved elsewhere locally.
function onMain(subCwd, sub) {
  const head = revParse(subCwd, 'HEAD');
  const main = revParse(subCwd, sub.main);
  if (main && main !== head && git(['merge-base', '--is-ancestor', main, head], subCwd).code !== 0) {
    return `${sub.path}: local ${sub.main} (${main.slice(0, 10)}) is not under the recorded ${head.slice(0, 10)}; a linked job lands on ${sub.main}`;
  }
  const r = git(['checkout', '-q', '-B', sub.main, head], subCwd);
  return r.code === 0 ? null : `${sub.path}: cannot put ${sub.main} at ${head.slice(0, 10)}: ${r.err.trim()}`;
}

export function landLinked(cfg, repo, job, cwd, paths, { verify, trailer, onPhase = () => {}, onCommitted, onSubLanded = () => {} } = {}) {
  const { own, subs } = splitLinked(cfg, repo, paths);
  const landed = [];
  for (const [sub, rels] of subs) {
    const subCwd = join(cfg.root, sub.path);
    const refused = onMain(subCwd, sub);
    if (refused) return { ok: false, committed: false, error: refused };
    onPhase(`${sub.name} commit`);
    const r = landCommits(cfg, sub, subCwd, [{ job: { ...job, noPin: true }, paths: rels, trailer }], { verify, onPhase });
    if (!r.ok) return { ...r, committed: false, error: `${sub.name} half did not land, nothing landed: ${r.error}` };
    landed.push({ sub, sha: r.sha });
  }
  const gitlinks = landed.map((l) => norm(l.sub.path));
  if (landed.length) onSubLanded({ own, gitlinks, preHead: revParse(cwd, 'HEAD'), subs: landed.map((l) => ({ name: l.sub.name, path: norm(l.sub.path), cwd: join(cfg.root, l.sub.path), sha: l.sha })) });
  const r = landCommits(cfg, repo, cwd, [{ job, paths: [...own, ...gitlinks], trailer }], { verify, onPhase, onCommitted });
  const subSha = landed.length ? landed[landed.length - 1].sha : null;
  if (!r.ok) {
    const pushed = landed.map((l) => `${l.sub.name} ${l.sha.slice(0, 10)}`).join(', ');
    return { ...r, subSha, landedSubs: gitlinks, error: `${pushed} landed and pushed; the ${repo.name} half (consumer change + pin) did not: ${r.error}. Resubmit the ${repo.name} half with --pin ${landed.map((l) => `${l.sub.name}=${l.sha}`).join(' --pin ')}` };
  }
  return { ...r, subSha, landedSubs: gitlinks };
}
