#!/usr/bin/env node
// commit-gate tests: cwd resolution + work-item citation, PowerShell wiring, pathspec/staged
// judging (KIT-T052), the staging-scope gates (KIT-T106, KIT-T230), id-integrity and its hints
// (KIT-T170), and the evidence floor on a closing transition (KIT-T061). Throwaway git
// fixtures, real hook invocations. exit 0 = all pass.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as harness from './test-harness.mjs';

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
  const cg = (command, target = cwd) => hook('commit-gate.mjs', command, target);

  // --- cwd resolution + work-item citation ------------------------------------------
  {
    const tgt = harness.adopted(true); // adopted repo with staged, uncommitted code
    ok('cd-target uncommitted code, no cite -> block', cg(`cd ${tgt} && git commit -m x`).code === 2);
    ok('git -C target, no cite -> block', cg(`git -C ${tgt} commit -m x`).code === 2);
    ok('cite (HOD-T045) bypasses', cg(`cd ${tgt} && git commit -m HOD-T045`).code === 0);
    ok('clean cwd passes', cg('git commit -m x').code === 0);
    ok('non-commit no-ops', cg(`cd ${tgt} && git status`).code === 0);
  }

  // --- KIT-T052: PowerShell wiring + pathspec/staged judging ------------------------
  {
    const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
    const matcher = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes('commit-gate'))).matcher;
    ok('wired for PowerShell as well as Bash', /\bBash\b/.test(matcher) && /\bPowerShell\b/.test(matcher));

    const mixed = harness.adopted(true); // staged foo.ts + an untracked doc
    writeFileSync(join(mixed, 'README.md'), '# readme\n');
    ok('pathspec docs-only commit passes despite dirty code (KIT-T052)',
      cg(`git -C ${mixed} commit -m x README.md`).code === 0);
    ok('pathspec code commit, no cite -> block (KIT-T052)',
      cg(`git -C ${mixed} commit -m x foo.ts`).code === 2);

    const stagedDocs = harness.adopted(false); // docs staged, code merely untracked
    writeFileSync(join(stagedDocs, 'foo.ts'), 'function f() { return doStuff(42); }\n');
    writeFileSync(join(stagedDocs, 'README.md'), '# readme\n');
    execFileSync('git', ['add', 'README.md'], { cwd: stagedDocs, stdio: 'ignore' });
    ok('bare commit judges the staged set, not the dirty tree (KIT-T052)',
      cg(`git -C ${stagedDocs} commit -m x`).code === 0);
  }

  // --- id integrity: duplicate ids in the store block the commit ---------------------
  {
    const dup = harness.adopted(false);
    mkdirSync(join(dup, '.ai', 'tickets'), { recursive: true });
    writeFileSync(join(dup, '.ai', 'tickets', 'T-001-a.md'), '---\nid: T-001\ntitle: a\nstatus: todo\n---\n');
    writeFileSync(join(dup, '.ai', 'tickets', 'T-001-b.md'), '---\nid: T-001\ntitle: b\nstatus: todo\n---\n');
    execFileSync('git', ['add', '-A'], { cwd: dup, stdio: 'ignore' });
    const r = cg(`git -C ${dup} commit -m x`);
    ok('duplicate store ids block the commit (id-integrity)', r.code === 2 && r.out.includes('DUPLICATE'));
  }

  // --- KIT-T061: a CLOSING transition needs a test artifact or the explicit escape ----
  {
    const seed = (status, notes) => `---\nid: KIT-T001\ntitle: seed\ntype: feature\nstatus: ${status}\n---\n\n## Notes\n${notes}\n`;
    const mkEf = () => {
      const ef = harness.identify(harness.adopted(false));
      writeFileSync(join(ef, '.ai', 'config.yml'), 'uat:\n  default: none\nids:\n  key: "KIT"\n  prefix: "KIT-T"\n  pad: 3\n');
      mkdirSync(join(ef, '.ai', 'tickets'), { recursive: true });
      return ef;
    };
    const seedCommit = (d, text) => {
      const p = join(d, '.ai', 'tickets', 'KIT-T001-x.md');
      writeFileSync(p, text);
      execFileSync('git', ['add', '-A'], { cwd: d, stdio: 'ignore' });
      execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: d, stdio: 'ignore' });
      return p;
    };
    const stageEdit = (d, p, text) => { writeFileSync(p, text); execFileSync('git', ['add', '-A'], { cwd: d, stdio: 'ignore' }); };

    const a = mkEf(); stageEdit(a, seedCommit(a, seed('doing', 'working.')), seed('done', 'finished it.'));
    const ra = cg(`git -C ${a} commit -m x`);
    ok('closing transition with no test evidence blocks (KIT-T061)', ra.code === 2 && /KIT-T061/.test(ra.out) && ra.out.includes('KIT-T001'));

    const b = mkEf(); stageEdit(b, seedCommit(b, seed('doing', 'working.')), seed('done', 'ran npm test — 5 passed.'));
    ok('closing transition WITH a suite-run reference passes (KIT-T061)', cg(`git -C ${b} commit -m x`).code === 0);

    const c = mkEf(); stageEdit(c, seedCommit(c, seed('doing', 'working.')), seed('done', 'docs only [no-test: pure doc edit].'));
    ok('[no-test: reason] escape passes the floor (KIT-T061)', cg(`git -C ${c} commit -m x`).code === 0);

    const e = mkEf(); stageEdit(e, seedCommit(e, seed('todo', 'initial.')), seed('todo', 'expanded the description.'));
    ok('a non-closing ticket edit is unaffected by the floor (KIT-T061)', cg(`git -C ${e} commit -m x`).code === 0);
  }

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
  // --- KIT-T162: the id citation accepts a digit-bearing scope key (S2-T001) ----------
  {
    const d = adopted();
    writeFileSync(join(d, 'code.js'), 'export const x = 1;\n');
    g(['add', 'code.js'], d);
    const cite = (msg) => hook('commit-gate.mjs', `git -C ${d} commit -m "${msg}" -- code.js`, cwd);

    let r = cite('implements S2-T001');
    ok('a digit-bearing scope key cites (S2-T001)', r.code === 0, r.out.trim());

    r = cite('implements KIT-T112');
    ok('an all-letter key still cites (KIT-T112, negative control)', r.code === 0, r.out.trim());

    r = cite('implements s2-t001');
    ok('a lowercase id does NOT cite', r.code === 2 && r.out.includes('BLOCKED'), r.out.trim());

    r = cite('implements S-T001');
    ok('a single-character key does NOT cite', r.code === 2 && r.out.includes('BLOCKED'), r.out.trim());
  }
  // --- KIT-T407: a commit carrying source this session never wrote ----------------------
  {
    const state = mkdtempSync(join(tmpdir(), 'kit-cg-state-'));
    fixtures.push(state);
    const env = { CLAUDE_KIT_TURN_STATE: state };
    const d = adopted();
    const gate = (command, s) => { if (process.env.DBG) console.log(JSON.stringify(readdirSync(state).map((f) => [f, readFileSync(join(state, f), 'utf8')])));
      const r = spawnSync(process.execPath, [join(HOOKS, 'commit-gate.mjs')], {
        input: JSON.stringify({ session_id: s, tool_input: { command } }), cwd, encoding: 'utf8', env: { ...process.env, ...env },
      });
      return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
    };
    const write = (file, s) => {
      writeFileSync(join(d, file), 'export const x = 1;\n');
      spawnSync(process.execPath, [join(HOOKS, 'pre-write.mjs')], {
        input: JSON.stringify({ session_id: s, tool_input: { file_path: join(d, file), content: 'export const x = 1;\n' } }),
        cwd: d, encoding: 'utf8', env: { ...process.env, ...env },
      });
    };
    write('mine.js', 'A');
    writeFileSync(join(d, 'theirs.js'), 'export const y = 2;\n'); // another session's file
    g(['add', 'mine.js', 'theirs.js'], d);
    const msg = (extra = '') => `git -C ${d} commit -m "implements KIT-T407 ${extra}"`;

    let r = gate(msg(), 'A');
    ok('a staged path this session did not write blocks (exit 2) and is named',
      r.code === 2 && r.out.includes('theirs.js') && !r.out.includes('  mine.js'), r.out.trim());

    r = gate(msg('[commit-foreign: finishing the earlier session]'), 'A');
    ok('[commit-foreign: reason] passes', r.code === 0, r.out.trim());

    r = gate(msg(), 'B');
    ok('a session with no writes ledger is not judged (fail open)', r.code === 0, r.out.trim());

    g(['reset', '-q', 'theirs.js'], d);
    r = gate(msg(), 'A');
    ok('only own paths staged -> allowed (negative control)', r.code === 0, r.out.trim());

    r = gate(msg(), undefined);
    ok('no session id -> allowed (fail open)', r.code === 0, r.out.trim());
  }
  // --- KIT-T418: a submodule pin following this session's work inside the submodule ------
  {
    const state = mkdtempSync(join(tmpdir(), 'kit-cg-state-'));
    fixtures.push(state);
    const env = { CLAUDE_KIT_TURN_STATE: state };
    const sess = (name, s, command, cwdOf) => spawnSync(process.execPath, [join(HOOKS, name)], {
      input: JSON.stringify({ session_id: s, tool_input: name === 'pre-write.mjs' ? { file_path: command, content: 'x\n' } : { command } }),
      cwd: cwdOf, encoding: 'utf8', env: { ...process.env, ...env },
    });
    const gate = (command, s) => { const r = sess('commit-gate.mjs', s, command, cwd); return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }; };
    const upstream = repo();
    writeFileSync(join(upstream, 'a.txt'), 'a\n');
    g(['add', 'a.txt'], upstream);
    g(['commit', '-q', '-m', 'init'], upstream);
    const mkSuper = () => {
      const d = adopted();
      writeFileSync(join(d, 'mine.js'), 'export const x = 1;\n');
      g(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', upstream, 'sub'], d);
      g(['config', 'user.email', 't@t'], join(d, 'sub'));
      g(['config', 'user.name', 't'], join(d, 'sub'));
      g(['add', 'mine.js', '.gitmodules', 'sub'], d);
      g(['commit', '-q', '-m', 'base'], d);
      return d;
    };
    const advance = (d, session, how) => {
      writeFileSync(join(d, 'sub', 'a.txt'), 'b\n');
      if (how === 'write') sess('pre-write.mjs', session, join(d, 'sub', 'a.txt'), join(d, 'sub'));
      if (how === 'commit') {
        g(['-C', join(d, 'sub'), 'add', 'a.txt'], d);
        sess('commit-gate.mjs', session, `git -C ${join(d, 'sub')} commit -m "implements KIT-T418"`, cwd);
        g(['-C', join(d, 'sub'), 'commit', '-q', '-m', 'in sub'], d);
      }
      writeFileSync(join(d, 'mine.js'), 'export const x = 2;\n');
      sess('pre-write.mjs', session, join(d, 'mine.js'), d);
      g(['add', 'mine.js', 'sub'], d);
      return `git -C ${d} commit -m "implements KIT-T418"`;
    };

    let d = mkSuper();
    let cmd = advance(d, 'A', 'commit');
    let r = gate(cmd, 'A');
    ok('pin after this session committed in the submodule passes (KIT-T418)', r.code === 0, r.out.trim());

    d = mkSuper();
    cmd = advance(d, 'A', 'write');
    r = gate(cmd, 'A');
    ok('pin after this session edited inside the submodule passes (KIT-T418)', r.code === 0, r.out.trim());

    d = mkSuper();
    cmd = advance(d, 'B', 'commit'); // B did the submodule work; A only wrote mine.js
    sess('pre-write.mjs', 'A', join(d, 'mine.js'), d);
    r = gate(cmd, 'A');
    ok('pin moved with no activity by this session in the submodule -> blocked and named',
      r.code === 2 && r.out.includes('sub'), r.out.trim());
  }
} finally {
  for (const f of fixtures) { try { rmSync(f, { recursive: true, force: true }); } catch { /* best-effort */ } }
  harness.cleanup();
}

console.log(fail === 0 ? `\ncommit-gate: all pass (${pass})` : `\ncommit-gate: ${fail} FAILED, ${pass} passed`);
process.exit(fail === 0 ? 0 : 1);
