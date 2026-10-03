// paired.mjs — find the other half of a two-repo change (KIT-T305). A submodule job lands and
// pins the superproject with `chore: pin <path> <sha> — <title> (implements <ticket>)`; the
// superproject half is submitted next. The superproject's "tree without the patch" already
// holds that pin, so a failure the submodule half caused fails in the baseline too and would be
// deferred as foreign. Attribution therefore treats a failure as `suspect` when such a pin for
// the job's ticket landed since the job's base.

import { git } from './git.mjs';

const PIN = /^chore: pin (\S+) ([0-9a-f]{7,40}) — .*\(implements ([^)\s]+)\)/;

/** Pins for `ticket` in `base..HEAD`, earliest first: [{ commit, path, sha }]. [] without a base or ticket. */
export function pairedPins(cwd, base, ticket) {
  if (!base || !ticket) return [];
  const log = git(['log', '--reverse', '--format=%H%x09%s', `${base}..HEAD`], cwd);
  if (log.code !== 0 || !log.out) return [];
  const pins = [];
  for (const line of log.out.split('\n')) {
    const [commit, ...subject] = line.split('\t');
    const m = PIN.exec(subject.join('\t'));
    if (m && m[3] === ticket) pins.push({ commit, path: m[1], sha: m[2] });
  }
  return pins;
}

/** A suspect entry per failed test, naming the earliest paired pin. */
export function suspects(failed, pins) {
  return failed.map((f) => ({ ...f, reason: `suspect: paired pin ${pins[0].commit.slice(0, 7)} (${pins[0].path} ${pins[0].sha.slice(0, 7)})` }));
}
