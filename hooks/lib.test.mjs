// Unit tests for hooks/lib.mjs: upstream ahead/behind (KIT-T054), the central-dataRoot
// project enumeration (KIT-T055), the stale-`doing` scanner (KIT-T028), and the registry
// round-trip. Run: node hooks/lib.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { aheadBehind, projectAiDirs } from './lib.mjs';
import {
  TMP_REG, cleanup, git, project, remoteOrigin, reporter, repo, tmpDir,
} from './test-harness.mjs';

const { ok, done } = reporter('lib');

const MS_PER_HOUR = 3600 * 1000;
const DOING_THRESHOLD_MS = 2 * MS_PER_HOUR;
const STALE_DOING_HOURS = 4;
const FRESH_MINUTES = 10;
const MS_PER_MINUTE = 60 * 1000;

try {
  {
    const origin = remoteOrigin();
    const a = origin.clone('a');
    writeFileSync(join(a, 'f.txt'), 'seed\n');
    git(['add', '-A'], a); git(['commit', '-q', '-m', 'seed'], a); git(['push', '-q', '-u', 'origin', 'HEAD'], a);
    const b = origin.clone('b');

    writeFileSync(join(b, 'g.txt'), 'B\n');
    git(['add', '-A'], b); git(['commit', '-q', '-m', 'B1'], b); git(['push', '-q'], b);
    let ab = aheadBehind(a, { fetch: true });
    ok('aheadBehind: behind-only after the other machine pushes', !!ab && ab.ahead === 0 && ab.behind === 1 && !ab.diverged);

    writeFileSync(join(a, 'f.txt'), 'A\n');
    git(['add', '-A'], a); git(['commit', '-q', '-m', 'A1'], a);
    ab = aheadBehind(a);
    ok('aheadBehind: diverged when both machines moved', !!ab && ab.ahead === 1 && ab.behind === 1 && ab.diverged);

    git(['pull', '-q', '--rebase'], a);
    ab = aheadBehind(a);
    ok('aheadBehind: ahead-only after rebase', !!ab && ab.ahead === 1 && ab.behind === 0 && !ab.diverged);

    git(['remote', 'set-url', 'origin', join(origin.base, 'nonexistent.git')], a);
    ab = aheadBehind(a, { fetch: true });
    ok('aheadBehind: offline fetch fails open (stale counts, no throw)', !!ab && ab.ahead === 1 && ab.behind === 0);

    ok('aheadBehind: no upstream -> null', aheadBehind(repo()) === null);
  }

  {
    const central = tmpDir('kit-central-');
    mkdirSync(join(central, 'projects', 'centralonly'), { recursive: true });
    writeFileSync(join(central, 'projects', 'centralonly', 'config.yml'), 'ids:\n  key: "CEN"\n');
    writeFileSync(TMP_REG, JSON.stringify({ dataRoot: central, projects: {} }));
    const prevReg = process.env.CLAUDE_KIT_REGISTRY;
    process.env.CLAUDE_KIT_REGISTRY = TMP_REG;
    const dirs = projectAiDirs();
    if (prevReg === undefined) delete process.env.CLAUDE_KIT_REGISTRY; else process.env.CLAUDE_KIT_REGISTRY = prevReg;
    writeFileSync(TMP_REG, '{}');
    ok('projectAiDirs enumerates central-dataRoot-only projects (KIT-T055 readdirSync fix)',
      dirs.some((d) => d.name === 'centralonly'));
  }

  {
    // The scanner reads the `updated:` frontmatter (mtime is only its fallback).
    const doingFm = (id, updatedIso) =>
      `---\nid: ${id}\ntitle: a doing ticket\nstatus: doing\nupdated: ${updatedIso}\n---\n`;
    const staleTs = new Date(Date.now() - STALE_DOING_HOURS * MS_PER_HOUR).toISOString();
    const freshTs = new Date(Date.now() - FRESH_MINUTES * MS_PER_MINUTE).toISOString();

    const staleProj = project('required');
    writeFileSync(join(staleProj, '.ai', 'tickets', 'KIT-T702-y.md'), doingFm('KIT-T702', staleTs));
    const freshProj = project('required');
    writeFileSync(join(freshProj, '.ai', 'tickets', 'KIT-T704-w.md'), doingFm('KIT-T704', freshTs));

    const { scanStaleDoingTickets } = await import('./lib.mjs');
    const scan1 = scanStaleDoingTickets(staleProj, DOING_THRESHOLD_MS);
    ok('lib.scanStaleDoingTickets: returns count+ids for stale doing (KIT-T028)',
      scan1.count === 1 && scan1.ids.includes('KIT-T702') && scan1.oldestMs > 0);
    const scan2 = scanStaleDoingTickets(freshProj, DOING_THRESHOLD_MS);
    ok('lib.scanStaleDoingTickets: returns count=0 for fresh doing (KIT-T028)',
      scan2.count === 0 && scan2.ids.length === 0);
  }

  {
    process.env.CLAUDE_KIT_REGISTRY = join(tmpDir('kit-rt-'), 'r.json');
    const lib = await import('./lib.mjs');
    lib.recordProject('alpha', '/repo/alpha', '/data');
    const rr = lib.readRegistry();
    ok('registry: recordProject round-trips name + dataRoot', rr.projects.alpha === '/repo/alpha' && rr.dataRoot === '/data');
  }
} finally {
  cleanup();
}

done();
