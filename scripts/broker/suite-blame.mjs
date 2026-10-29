// suite-blame.mjs — which landing likely broke a red full-suite run (KIT-T472). Nothing is
// rebuilt or checked out: the failing tests are mapped to their cargo targets from the run's log,
// and each landing in the range since the last green run is mapped to the targets its changed
// paths select (affected.mjs). A landing whose targets include a failing one is a suspect, as is
// one with an unmapped path; a build failure makes every landing a suspect.
//
// `failingTargets(log)` → [{ test, spec }] (spec `--test x` | `--lib` | `--bin x` | null).
// `landingsIn(cwd, from, to)` → [{ sha, subject, paths }], oldest first; `from` null → [].
// `suspects(cwd, landings, failing)` → [{ sha, subject, why }].

import { selectAffected } from './affected.mjs';
import { diagnose } from './diagnose.mjs';
import { git } from './git.mjs';

const RUNNING = /^\s*Running (?:unittests )?(\S+)/;
const RESULT = /^test (\S+) \.\.\. (?:FAILED|failed)/;

function specOf(path) {
  const p = path.replace(/\\/g, '/');
  let m = p.match(/^tests\/([^/]+?)(?:\.rs|\/main\.rs)$/);
  if (m) return `--test ${m[1]}`;
  if (p === 'src/lib.rs') return '--lib';
  m = p.match(/^src\/bin\/([^/]+?)(?:\.rs|\/main\.rs)$/);
  return m ? `--bin ${m[1]}` : null;
}

export function failingTargets(log) {
  const out = [];
  let spec = null;
  for (const line of String(log).split(/\r?\n/)) {
    const run = line.match(RUNNING);
    if (run) { spec = specOf(run[1]); continue; }
    const failed = line.match(RESULT);
    if (failed) out.push({ test: failed[1], spec });
  }
  if (!out.length && Object.keys(diagnose(log).errors).length) out.push({ test: '(build)', spec: null });
  return out;
}

const lines = (out) => (out ? out.split('\n').map((l) => l.trim()).filter(Boolean) : []);

export function landingsIn(cwd, from, to) {
  if (!from) return [];
  return lines(git(['log', '--reverse', '--format=%H%x09%s', `${from}..${to}`], cwd).out).map((l) => {
    const [sha, ...subject] = l.split('\t');
    return { sha, subject: subject.join('\t'), paths: lines(git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha], cwd).out) };
  });
}

export function suspects(cwd, landings, failing) {
  const specs = new Set(failing.map((f) => f.spec).filter(Boolean));
  const blind = failing.some((f) => !f.spec);
  const out = [];
  for (const l of landings) {
    const sel = selectAffected(cwd, l.paths);
    const hit = [...sel.crates.values()].flatMap((s) => [...s]).map((s) => s.replace(/ -- .*$/, '')).filter((s) => specs.has(s));
    if (hit.length) out.push({ sha: l.sha, subject: l.subject, why: `its paths map to ${[...new Set(hit)].join(', ')}` });
    else if (sel.unmapped.length) out.push({ sha: l.sha, subject: l.subject, why: `unmapped paths ${sel.unmapped.join(', ')}` });
    else if (blind) out.push({ sha: l.sha, subject: l.subject, why: 'the failure has no mapped target' });
  }
  return out;
}
