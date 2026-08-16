#!/usr/bin/env node
// commit-gate tests for the STAGING-SCOPE gates (KIT-T106, KIT-T230) and the id-integrity
// hints (KIT-T170). Throwaway git fixtures, real hook invocations. exit 0 = all pass.
//
// (The gate's older branches — pathspec/staged judging, evidence floor, citation — are covered
// by scripts/test-hooks.mjs.)

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = dirname(fileURLToPath(import.meta.url));
const fixtures = [];
let pass = 0;
let fail = 0;

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? `  (${detail})` : '')); }
}
function hook(name, command, cwd, env = {}) {
  const r = spawnSync(process.execPath, [join(HOOKS, name)], {
    input: JSON.stringify({ tool_input: { command } }),
    cwd, encoding: 'utf8', env: { ...process.env, ...env },
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}
function preWrite(file, cwd, env) {
  spawnSync(process.execPath, [join(HOOKS, 'pre-write.mjs')], {
    input: JSON.stringify({ tool_input: { file_path: file, content: '# x\n' } }),
    cwd, encoding: 'utf8', env: { ...process.env, ...env },
  });
}
const g = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'ignore' });

function repo() {
  const d = mkdtempSync(join(tmpdir(), 'kit-cg-'));
  fixtures.push(d);
  g(['init', '-q'], d);
  g(['config', 'user.email', 't@t'], d);
  g(['config', 'user.name', 't'], d);
  return d;
}
function adopted() {
  const d = repo();
  mkdirSync(join(d, '.ai'));
  return d;
}

try {
  const cwd = repo(); // the session's cwd — every command targets its repo with `git -C`

  // --- KIT-T170: id-integrity hints name the fix for the ACTUAL failure mode ----------
  {
    const dup = adopted();
    mkdirSync(join(dup, '.ai', 'tickets'), { recursive: true });
    writeFileSync(join(dup, '.ai', 'tickets', 'T-001-a.md'), '---\nid: T-001\ntitle: a\nstatus: todo\n---\n');
    writeFileSync(join(dup, '.ai', 'tickets', 'T-001-b.md'), '---\nid: T-001\ntitle: b\nstatus: todo\n---\n');
    g(['add', '-A'], dup);
    const r = hook('commit-gate.mjs', `git -C ${dup} commit -m x`, cwd);
    ok('duplicate ids block', r.code === 2 && r.out.includes('DUPLICATE'), r.out.trim());
    ok('DUPLICATE hint is the re-key fix, not the regression-link boilerplate (KIT-T170)',
      r.out.includes('next-id.mjs') && !r.out.includes('t link'), r.out.trim());
  }
  {
    const mm = adopted();
    mkdirSync(join(mm, '.ai', 'decisions'), { recursive: true });
    writeFileSync(join(mm, '.ai', 'decisions', 'DEC-006-x.md'), '---\nid: GB-D006\ntitle: x\n---\n');
    g(['add', '-A'], mm);
    const r = hook('commit-gate.mjs', `git -C ${mm} commit -m x`, cwd);
    ok('id/filename mismatch blocks', r.code === 2 && r.out.includes('MISMATCH'), r.out.trim());
    ok('MISMATCH hint says rename-or-fix-id and cites the <KEY>-D### canon (KIT-T170)',
      r.out.includes('rename the file') && r.out.includes('<KEY>-D###-slug.md') && !r.out.includes('t link'), r.out.trim());
  }

  // --- KIT-T106: a bare `git commit` names the staged paths this turn did not write ----
  {
    const ts = mkdtempSync(join(tmpdir(), 'kit-turnstate-'));
    fixtures.push(ts);
    const env = { CLAUDE_KIT_TURN_STATE: ts };
    const d = adopted();
    writeFileSync(join(d, 'mine.md'), '# mine\n');
    writeFileSync(join(d, 'theirs.md'), '# theirs\n');
    preWrite(join(d, 'mine.md'), d, env); // the turn's ONE authored write — records the ledger

    g(['add', 'mine.md'], d);
    let r = hook('commit-gate.mjs', `git -C ${d} commit -m x`, cwd, env);
    ok('bare commit of only this turn\'s writes is silent (negative control)',
      r.code === 0 && !r.out.includes('did NOT write'), r.out.trim());

    g(['add', 'theirs.md'], d);
    r = hook('commit-gate.mjs', `git -C ${d} commit -m x`, cwd, env);
    ok('bare commit WARNS and names the foreign staged path (KIT-T106)',
      r.code === 0 && r.out.includes('did NOT write') && r.out.includes('theirs.md'), r.out.trim());
    ok('the warning does not accuse the turn\'s own file',
      !/^\s+mine\.md$/m.test(r.out), r.out.trim());

    r = hook('commit-gate.mjs', `git -C ${d} commit -m x -- mine.md`, cwd, env);
    ok('a pathspec commit is never warned about (KIT-T106)',
      r.code === 0 && !r.out.includes('did NOT write'), r.out.trim());
  }

  // --- KIT-T230: the shared data repo is staged/committed one project subtree at a time --
  {
    const dr = repo();
    for (const n of ['alpha', 'beta']) {
      mkdirSync(join(dr, 'projects', n, 'tickets'), { recursive: true });
      writeFileSync(join(dr, 'projects', n, 'tickets', `${n}-T001-a.md`), `---\nid: ${n}-T001\ntitle: ${n}\nstatus: todo\n---\n`);
    }
    let r = hook('commit-gate.mjs', `git -C ${dr} add -A`, cwd);
    ok('tree-wide `git add -A` in the data repo WARNS (KIT-T230)',
      r.code === 0 && r.out.includes('tree-wide `git add`') && r.out.includes('projects/<name>'), r.out.trim());

    r = hook('commit-gate.mjs', `git -C ${adopted()} add -A`, cwd);
    ok('`git add -A` in a normal repo is silent (negative control)',
      r.code === 0 && !r.out.includes('tree-wide'), r.out.trim());

    g(['add', '-A'], dr);
    r = hook('commit-gate.mjs', `git -C ${dr} commit -m x`, cwd);
    ok('a commit spanning two project subtrees BLOCKS (KIT-T230)',
      r.code === 2 && r.out.includes('projects/alpha') && r.out.includes('projects/beta'), r.out.trim());

    r = hook('commit-gate.mjs', `git -C ${dr} commit -m x -- projects/alpha`, cwd);
    ok('a pathspec-limited single-subtree commit is allowed (negative control)',
      r.code === 0 && !r.out.includes('project subtrees'), r.out.trim());
  }
} finally {
  for (const f of fixtures) { try { rmSync(f, { recursive: true, force: true }); } catch { /* best-effort */ } }
}

console.log(fail === 0 ? `\ncommit-gate: all pass (${pass})` : `\ncommit-gate: ${fail} FAILED, ${pass} passed`);
process.exit(fail === 0 ? 0 : 1);
