// orient (SessionStart orientation): standing-decision scope filtering (KIT-T046), SESSION
// staleness and the zombie-`doing` banner (KIT-T062 / KIT-T028), and the gist+pointer token
// budget (KIT-T071). Run: node hooks/orient.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  adopted, ageFile, cleanup, git, hook, project, reporter, repo,
} from './test-harness.mjs';

const { ok, done } = reporter('orient');

const STALE_SESSION_DAYS = 6; // backdates SESSION before its repo's last commit
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const STALE_DOING_HOURS = 4; // past the hook's 2 h threshold
const FRESH_MINUTES = 10;
const TOKEN_BUDGET = 1200;
const CHARS_PER_TOKEN = 3; // conservative char-per-token bound for the budget assertion
const SESSION_LINES = 80; // well beyond the gist cap
const ROADMAP_ITEMS = 56;
const DECISION_COUNT = 15;
const ID_PAD = 2;

try {
  // --- standing-decision scope filter (KIT-T046) ---------------------------------
  {
    const o = adopted(false);
    mkdirSync(join(o, '.ai', 'decisions'), { recursive: true });
    writeFileSync(join(o, '.ai', 'decisions', 'D-001.md'), '---\nid: D-001\ntitle: out-of-scope worldgen rule\nstanding: true\nscope: worldgen\n---\n');
    writeFileSync(join(o, '.ai', 'decisions', 'D-002.md'), '---\nid: D-002\ntitle: parser files rule\nstanding: true\npaths: src/parser/*\n---\n');
    writeFileSync(join(o, '.ai', 'decisions', 'D-003.md'), '---\nid: D-003\ntitle: global invariant\nstanding: true\n---\n');
    mkdirSync(join(o, 'src', 'parser'), { recursive: true });
    writeFileSync(join(o, 'src', 'parser', 'lex.ts'), 'export const t = 1;\n');
    // stage so porcelain reports the FILE path (untracked dirs collapse to `?? src/`,
    // which no paths-glob can match)
    git(['add', '-A'], o);
    const r = hook('orient.mjs', {}, o);
    ok('orient: in-scope (paths glob) standing decision surfaces', r.out.includes('D-002'));
    ok('orient: scope-less standing decision always surfaces', r.out.includes('D-003'));
    ok('orient: out-of-scope standing decision collapses to a scope pointer',
      r.out.includes('+1 more standing decision(s) out of scope (scopes: worldgen)'));
    const standingSection = r.out.split('--- STANDING')[1].split('\n---')[0];
    ok('orient: standing section itself omits the out-of-scope decision', !standingSection.includes('D-001'));
  }

  const clean = adopted(false);
  ok('orient: adopted repo emits orientation', /ORIENTATION/.test(hook('orient.mjs', { hook_event_name: 'SessionStart' }, clean).out));
  {
    // KIT-T254: the retrieval ritual leads the orientation — placement IS the fix, so a
    // regression that demotes it below the content sections must fail loudly here.
    const o = hook('orient.mjs', { hook_event_name: 'SessionStart' }, clean).out;
    const ritual = o.indexOf('RETRIEVAL FIRST');
    ok('orient: RETRIEVAL FIRST block present', ritual >= 0 && o.includes('q recent') && o.includes('CHOICES.toml'));
    ok('orient: RETRIEVAL FIRST precedes all content sections', ritual >= 0 && ritual < o.indexOf('--- Recent commits'));
  }
  ok('orient: non-adopted repo is silent', hook('orient.mjs', {}, repo()).out.trim() === '');

  // --- SESSION staleness: one line, only when stale (KIT-T062) --------------------
  {
    const so = project('required');
    writeFileSync(join(so, 'f.txt'), 'x\n');
    git(['add', '-A'], so);
    git(['commit', '-q', '-m', 'KIT-T062 seed'], so);
    const sess = join(so, '.ai', 'SESSION.md');
    writeFileSync(sess, '# SESSION\nfresh\n'); // written AFTER the commit → current
    let r = hook('orient.mjs', {}, so);
    ok('orient: a SESSION newer than the last commit is NOT flagged stale (KIT-T062)', !r.out.includes('SESSION.md is STALE'));
    ageFile(sess, STALE_SESSION_DAYS);
    r = hook('orient.mjs', {}, so);
    ok('orient: a SESSION older than the last commit is flagged stale, one line (KIT-T062)',
      r.out.includes('SESSION.md is STALE') && /STALE \(\d+d/.test(r.out));
  }

  // --- zombie `doing` banner (KIT-T028) ------------------------------------------
  {
    const doingFm = (id, updatedIso) => `---\nid: ${id}\ntitle: a doing ticket\nstatus: doing\nupdated: ${updatedIso}\n---\n`;
    const staleTs = new Date(Date.now() - STALE_DOING_HOURS * MS_PER_HOUR).toISOString();
    const freshTs = new Date(Date.now() - FRESH_MINUTES * MS_PER_MINUTE).toISOString();

    const staleProj = project('required');
    writeFileSync(join(staleProj, '.ai', 'tickets', 'KIT-T702-y.md'), doingFm('KIT-T702', staleTs));
    const r = hook('orient.mjs', {}, staleProj);
    ok('orient: stale `doing` emits !! ZOMBIE DOING banner (KIT-T028)',
      r.code === 0 && r.out.includes('!! ZOMBIE DOING') && r.out.includes('KIT-T702'));

    const freshProj = project('required');
    writeFileSync(join(freshProj, '.ai', 'tickets', 'KIT-T704-w.md'), doingFm('KIT-T704', freshTs));
    const rf = hook('orient.mjs', {}, freshProj);
    ok('orient: fresh `doing` ticket does NOT emit zombie banner (KIT-T028)',
      rf.code === 0 && !rf.out.includes('ZOMBIE DOING'));
  }

  // --- token budget: gist + pointer, never a full dump (KIT-T071) -----------------
  {
    const BUDGET_CHARS = TOKEN_BUDGET * CHARS_PER_TOKEN;
    const tb = project('none');

    writeFileSync(join(tb, '.ai', 'SESSION.md'),
      Array.from({ length: SESSION_LINES }, (_, i) => `## Step ${i + 1}: do something with the thing`).join('\n'));

    writeFileSync(join(tb, '.ai', 'ROADMAP.md'),
      ['# Roadmap', '', '## Milestone 1', ...Array.from({ length: ROADMAP_ITEMS }, (_, i) => `- item ${i + 1}: work to do here`)].join('\n'));

    mkdirSync(join(tb, '.ai', 'decisions'), { recursive: true });
    for (let i = 1; i <= DECISION_COUNT; i++) {
      const id = `D-0${String(i).padStart(ID_PAD, '0')}`;
      writeFileSync(join(tb, '.ai', 'decisions', `${id}.md`),
        `---\nid: ${id}\ntitle: decision number ${i} about some architectural thing\n---\n`);
    }

    writeFileSync(join(tb, '.ai', 'lineage.yml'),
      'relations:\n  - name: rapid-game\n    role: engine\n    note: shared Rust core\n' +
      '  - name: gta7\n    role: ancestor\n    note: public MIT fork\n' +
      '  - name: mmo-rts\n    role: sibling\n    note: another consumer\n' +
      '  - name: rapid-rust\n    role: dead\n    note: retired\n' +
      '  - name: wordslide-codex\n    role: parent\n    note: org root\n');

    const r = hook('orient.mjs', {}, tb);

    ok('orient KIT-T071: output is within the token budget (≤1200 tokens)', r.out.length <= BUDGET_CHARS);
    ok('orient KIT-T071: ORIENTATION header is present', /ORIENTATION/.test(r.out));
    ok('orient KIT-T071: SESSION resume gist is present (first lines)', r.out.includes('## Step 1:'));
    ok('orient KIT-T071: SESSION full pointer is present', r.out.includes('read .ai/SESSION.md'));
    ok('orient KIT-T071: ROADMAP gist is present (milestone header)', r.out.includes('## Milestone 1'));
    ok('orient KIT-T071: ROADMAP full pointer is present', r.out.includes('head .ai/ROADMAP.md'));
    ok('orient KIT-T071: decisions gist lists recent ids', r.out.includes('D-015') || r.out.includes('D-010'));
    ok('orient KIT-T071: decisions overflow pointer is present', r.out.includes('q decisions'));
    ok('orient KIT-T071: lineage collapsed to pointer (no full dump)', r.out.includes('lineage.yml'));
    ok('orient KIT-T071: lineage does not dump all relation details inline', !r.out.includes('[engine] rapid-game'));
    ok('orient KIT-T071: SESSION does not dump all 80 lines', !r.out.includes('## Step 80:'));
    ok('orient KIT-T071: ROADMAP does not dump all 60 items', !r.out.includes('item 56:'));
  }
} finally {
  cleanup();
}

done();
