// cargo-config-jobs.mjs — the `[build] jobs` a checkout's cargo would use (KIT-D135). Read only.
//
//   cargoConfigJobs(cwd) -> integer from the nearest `.cargo/config.toml` (or `config`) up from `cwd` that sets it, else null

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const JOBS_LINE = /^\s*jobs\s*=\s*(\d+)/;

function jobsIn(file) {
  let inBuild = false;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const section = /^\s*\[([^\]]+)\]/.exec(line);
    if (section) { inBuild = section[1].trim() === 'build'; continue; }
    const m = inBuild && JOBS_LINE.exec(line);
    if (m) return Number(m[1]);
  }
  return null;
}

export function cargoConfigJobs(cwd) {
  for (let dir = cwd; ; dir = dirname(dir)) {
    for (const name of ['config.toml', 'config']) {
      const file = join(dir, '.cargo', name);
      const jobs = existsSync(file) ? jobsIn(file) : null;
      if (jobs != null) return jobs;
    }
    if (dirname(dir) === dir) return null;
  }
}
