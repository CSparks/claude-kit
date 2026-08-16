// Tests for hooks/housekeeping.mjs — the SessionStart/Stop nags: the CLAUDE_CODE_SUBAGENT_MODEL
// override (KIT-T220), the unpushed pile-up (KIT-T054), the weekly-review thresholds (KIT-T058),
// the closure nags (KIT-T062) and the stale-`doing` detector (KIT-T028). Each nag is asserted at
// its threshold: fresh = silent, stale = nag. Run: node hooks/housekeeping.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  adopted, ageFile, cleanup, git, homeEnv, hook, project, quietHome, remoteOrigin,
  reviewTicket, tmpDir,
} from './test-harness.mjs';

const HOOK = fileURLToPath(new URL('./housekeeping.mjs', import.meta.url));
let failures = 0;
let count = 0;

function ok(name, cond) {
  count++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const repo = mkdtempSync(join(tmpdir(), 'hk-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai', 'tickets'), { recursive: true });

function run(env) {
  const base = { ...process.env };
  delete base.CLAUDE_CODE_SUBAGENT_MODEL;
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: repo,
    input: JSON.stringify({ hook_event_name: 'SessionStart' }),
    encoding: 'utf8',
    env: { ...base, ...env },
  });
  return { code: r.status, out: r.stdout || '' };
}

const set = run({ CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' });
ok('env set: nag fires', /SUBAGENT MODEL OVERRIDE/.test(set.out));
ok('env set: names the value', /CLAUDE_CODE_SUBAGENT_MODEL=haiku/.test(set.out));
ok('env set: names the consequence', /dispatch ladder/.test(set.out));
ok('env set: never blocks', set.code === 0);

const unset = run({});
ok('env unset: silent (negative control)', !/SUBAGENT MODEL OVERRIDE/.test(unset.out));
ok('env unset: exits 0', unset.code === 0);

const STALE_INBOX_DAYS = 4; // past the hook's 2 d inbox threshold
const README_AGE_DAYS = 9; // arbitrary old age for the never-counted README
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const STALE_DOING_HOURS = 4; // past the 2 h DOING_STALE_MS threshold
const FRESH_MINUTES = 10;

try {
  const clean = adopted(false);

  // --- unpushed pile-up at Stop (KIT-T054) ---------------------------------------
  {
    const origin = remoteOrigin();
    const a = origin.clone('a');
    mkdirSync(join(a, '.ai'));
    for (const n of ['seed', 'c2', 'c3']) {
      writeFileSync(join(a, 'h.txt'), `${n}\n`);
      git(['add', '-A'], a);
      git(['commit', '-q', '-m', n], a);
    }
    const nag = hook('housekeeping.mjs', { hook_event_name: 'Stop' }, a);
    ok('housekeeping Stop nags on unpushed pile-up', nag.code === 0 && nag.out.includes('unpushed commit(s)'));
    const fresh = hook('housekeeping.mjs', { hook_event_name: 'Stop' }, clean);
    ok('housekeeping Stop stays quiet about pushes on a clean repo', fresh.code === 0 && !fresh.out.includes('unpushed commit(s)'));
  }

  // --- weekly-review thresholds against a throwaway HOME (KIT-T058) ---------------
  {
    const r = hook('housekeeping.mjs', {}, clean, homeEnv(quietHome()));
    ok('housekeeping: fresh review timestamps stay silent', r.code === 0 && !r.out.includes('REVIEW DUE'));

    const staleHome = tmpDir('kit-home-');
    const s = hook('housekeeping.mjs', {}, clean, homeEnv(staleHome));
    ok('housekeeping: missing timestamps nag BOTH reviews', s.code === 0 && s.out.includes('MEMORY REVIEW DUE') && s.out.includes('MAINTENANCE REVIEW DUE'));
    const stop = hook('housekeeping.mjs', { hook_event_name: 'Stop' }, clean, homeEnv(staleHome));
    ok('housekeeping: Stop repeats pending reviews', stop.code === 0 && stop.out.includes('pending before end-of-session'));
  }

  // --- closure nags: inbox age, review queue, stale doing (KIT-T062 / KIT-T028) ----
  // A quiet HOME keeps the weekly-review nags out of the way; the turn-state dir is
  // isolated per scenario so Stop's growth comparison starts from a known snapshot.
  {
    const home = homeEnv(quietHome());
    const env = { ...home, CLAUDE_KIT_TURN_STATE: tmpDir('kit-turn-') };

    const freshIb = project('required');
    writeFileSync(join(freshIb, '.ai', 'inbox', 'a.md'), '(idea) new\n');
    let r = hook('housekeeping.mjs', {}, freshIb, env);
    ok('housekeeping: fresh inbox stays silent (KIT-T062)', r.code === 0 && !r.out.includes('INBOX UN-TRIAGED'));

    const staleInbox = project('required');
    const ib = join(staleInbox, '.ai', 'inbox', 'old.md');
    writeFileSync(ib, '(idea) stale\n');
    ageFile(ib, STALE_INBOX_DAYS);
    const readme = join(staleInbox, '.ai', 'inbox', 'README.md');
    writeFileSync(readme, '# inbox\n');
    ageFile(readme, README_AGE_DAYS);
    r = hook('housekeeping.mjs', {}, staleInbox, env);
    ok('housekeeping: stale inbox item nags with count + oldest age (KIT-T062)',
      r.code === 0 && /INBOX UN-TRIAGED: 1 item\(s\).*oldest 4d/.test(r.out));
    ok('housekeeping: inbox README is not counted as a capture (KIT-T062)',
      !/INBOX UN-TRIAGED: 2 item/.test(r.out));

    // review queue under uat=required waits on the human; under uat=none it is the agent's
    // to close, so the nag is silent by design (KIT-D034)
    r = hook('housekeeping.mjs', {}, project('required'), env);
    ok('housekeeping: empty review queue stays silent (KIT-T062)', r.code === 0 && !r.out.includes('REVIEW QUEUE'));

    const withReview = project('required');
    reviewTicket(withReview, 'KIT-T201');
    reviewTicket(withReview, 'KIT-T202');
    r = hook('housekeeping.mjs', {}, withReview, env);
    ok('housekeeping: review queue nags, phrased as waiting on the human (KIT-T062)',
      r.code === 0 && r.out.includes('REVIEW QUEUE') && /waiting on YOUR `\/done`/.test(r.out));
    ok('housekeeping: small review queue lists the ids (KIT-T062)',
      r.out.includes('KIT-T201') && r.out.includes('KIT-T202'));

    const uatNone = project('none');
    reviewTicket(uatNone, 'KIT-T301');
    reviewTicket(uatNone, 'KIT-T302');
    r = hook('housekeeping.mjs', {}, uatNone, env);
    ok('housekeeping: review nag is SILENT under uat=none (KIT-T062 / KIT-D034)',
      r.code === 0 && !r.out.includes('REVIEW QUEUE'));

    // Stop: one line, and only when the queue GREW during the turn
    {
      const grow = project('required');
      const genv = { ...home, CLAUDE_KIT_TURN_STATE: tmpDir('kit-turn-') };
      reviewTicket(grow, 'KIT-T401'); // queue = 1 at SessionStart
      hook('housekeeping.mjs', {}, grow, genv); // SessionStart snapshots the count
      let s = hook('housekeeping.mjs', { hook_event_name: 'Stop' }, grow, genv);
      ok('housekeeping Stop: no growth → silent about the review queue (KIT-T062)', s.code === 0 && !s.out.includes('Review queue GREW'));
      reviewTicket(grow, 'KIT-T402');
      s = hook('housekeeping.mjs', { hook_event_name: 'Stop' }, grow, genv);
      ok('housekeeping Stop: review queue GREW this turn nags once (KIT-T062)',
        s.code === 0 && /Review queue GREW this turn \(1 → 2\)/.test(s.out));

      const growNone = project('none');
      const nenv = { ...home, CLAUDE_KIT_TURN_STATE: tmpDir('kit-turn-') };
      hook('housekeeping.mjs', {}, growNone, nenv);
      reviewTicket(growNone, 'KIT-T501');
      s = hook('housekeeping.mjs', { hook_event_name: 'Stop' }, growNone, nenv);
      ok('housekeeping Stop: uat=none stays silent about review growth (KIT-T062)', s.code === 0 && !s.out.includes('Review queue GREW'));
    }

    // stale `doing` detector: the scanner reads the `updated:` frontmatter (KIT-T028)
    {
      const doingFm = (id, status, updatedIso) =>
        `---\nid: ${id}\ntitle: a ${status} ticket\nstatus: ${status}\nupdated: ${updatedIso}\n---\n`;
      const freshTs = new Date(Date.now() - FRESH_MINUTES * MS_PER_MINUTE).toISOString();
      const staleTs = new Date(Date.now() - STALE_DOING_HOURS * MS_PER_HOUR).toISOString();
      const doingProj = project('required');

      writeFileSync(join(doingProj, '.ai', 'tickets', 'KIT-T701-x.md'), doingFm('KIT-T701', 'doing', freshTs));
      let d = hook('housekeeping.mjs', {}, doingProj, env);
      ok('housekeeping: fresh `doing` ticket stays silent (KIT-T028)', d.code === 0 && !d.out.includes('ZOMBIE DOING'));

      writeFileSync(join(doingProj, '.ai', 'tickets', 'KIT-T702-y.md'), doingFm('KIT-T702', 'doing', staleTs));
      d = hook('housekeeping.mjs', {}, doingProj, env);
      ok('housekeeping: stale `doing` nags with ZOMBIE DOING + id (KIT-T028)',
        d.code === 0 && d.out.includes('ZOMBIE DOING') && d.out.includes('KIT-T702'));

      writeFileSync(join(doingProj, '.ai', 'tickets', 'KIT-T703-z.md'), doingFm('KIT-T703', 'todo', staleTs));
      d = hook('housekeeping.mjs', {}, doingProj, env);
      ok('housekeeping: non-doing ticket not counted as zombie (KIT-T028)', !d.out.includes('KIT-T703'));

      const stopR = hook('housekeeping.mjs', { hook_event_name: 'Stop' }, doingProj, env);
      ok('housekeeping Stop: stale `doing` nags at Stop too (KIT-T028)',
        stopR.code === 0 && stopR.out.includes('ZOMBIE DOING') && stopR.out.includes('KIT-T702'));
    }
  }
} finally {
  cleanup();
}

console.log(`\n${count - failures}/${count} passed`);
process.exit(failures ? 1 : 0);
