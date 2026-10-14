// train-run.mjs — run a train's commands once over the combined tree (KIT-T482 item 1).
// Commands run in order and stop at the first red one. A red test command with named failures
// and no build error is first checked against the pre-train tree (attribute.mjs): tests that
// fail there too are foreign and the run carries on; otherwise the entry keeps `caused` for
// train-blame.mjs.
//
// A red command with only compile errors in files no member touched goes through known-red.mjs
// (`knownRed(entry)`): errors main already has are left out and the rerun judges the train.
//
// `runTrainCommands(cfg, { id, repo, cwd, commands, nextLog, baseline, knownRed })`
//   commands  [{ cmd, owners, from }] from train-commands.mjs
//   nextLog   () → the next log number for this train
//   baseline  baseline.mjs's runner, or null (a re-verify after a rebase: no attribution)
// → { entries, failing: entry | null }

import { readFileSync } from 'node:fs';
import { attribute } from './attribute.mjs';
import { addDeferred } from './deferred.mjs';
import { diagnose } from './diagnose.mjs';
import { logPathFor } from './result.mjs';
import { runCommand } from './run.mjs';

export function runTrainCommands(cfg, { id, repo, cwd, commands, nextLog, baseline, knownRed = null }) {
  const entries = [];
  for (const c of commands) {
    const log = logPathFor(cfg, id, nextLog());
    const r = runCommand(c.cmd, { cwd, targetDir: cfg.targetDir, logPath: log, jobs: cfg.jobs });
    const entry = { ...r, log, owners: c.owners, ...(c.from ? { coalesced: c.from } : {}), ...diagnose(readFileSync(log, 'utf8')) };
    entries.push(entry);
    if (r.exit === 0) continue;
    if (Object.keys(entry.errors).length) {
      const red = knownRed ? knownRed(entry) : null;
      if (red) entry.knownRed = red;
      if (red && red.clean) continue;
      return { entries, failing: entry };
    }
    if (!baseline || !entry.failedTests.length) return { entries, failing: entry };
    const attributed = baseline((run) => attribute({ command: entry, runBaseline: (cmd) => run(cmd, `${nextLog()}-base`) }));
    if (!attributed) return { entries, failing: entry };
    if (attributed.caused.length) {
      entry.caused = attributed.caused;
      return { entries, failing: entry };
    }
    entry.foreign = attributed.foreign;
    addDeferred(cfg, attributed.foreign.map((f) => ({ ...f, cmd: entry.cmd, repo, job: id, dirty: attributed.dirty, head: attributed.head })));
  }
  return { entries, failing: null };
}

/** A re-run after a rebase is green when it passed or failed only on tests already known foreign. */
export function reverifyOk({ failing }, foreign) {
  if (!failing) return true;
  const known = new Set(foreign.map((f) => f.test));
  return failing.failedTests.length > 0 && !Object.keys(failing.errors).length && failing.failedTests.every((t) => known.has(t));
}
