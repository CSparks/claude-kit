// commit-foreign judges the repo the commit runs in, not the repo the hook process started in (KIT-T1347): a subagent whose
// shell sits inside a submodule runs `git add -- <files> && git commit` with no `cd` or `-C`, the hook process still
// stands in the superproject, and the payload's `cwd` is the only word of where the command acts.
// Run: node hooks/commit-foreign-subdir-cwd.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, repo, tmpDir } from './test-harness.mjs';

const report = reporter('commit-foreign-subdir-cwd');
const { done } = report;
const ok = (name, cond, detail = '') => { report.ok(name, cond); if (!cond && detail) console.log(`        ${detail}`); };

try {
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('commit-subdir-state-') };
  const origin = identify(repo());
  mkdirSync(join(origin, '.ai'));
  writeFileSync(join(origin, '.ai', 'config.yml'), 'uat:\n  default: none\n');
  writeFileSync(join(origin, 'field.rs'), 'pub fn field() -> u32 { 1 }\n');
  git(['add', '--', '.'], origin);
  git(['commit', '-q', '-m', 'seed'], origin);

  const parent = identify(adopted(false));
  git(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', origin, 'sub'], parent);
  git(['commit', '-q', '-m', 'pin'], parent);
  const sub = join(parent, 'sub');
  identify(sub);

  const SESSION = 'S1';
  const body = (n) => `pub fn f_${n}() -> u32 { ${n} }\n`;
  const written = (base, rel, text) => {
    const payload = { session_id: SESSION, tool_input: { file_path: join(base, rel), content: text } };
    hook('pre-write.mjs', payload, base, env);
    writeFileSync(join(base, rel), text);
    hook('tool-write-record.mjs', payload, base, env);
  };
  const MSG = 'implements KIT-T1347';
  const command = `git add -- field.rs && git commit -m "${MSG}"`;
  // The hook process stands in the superproject; the payload's cwd names where the shell is.
  const gate = (payloadCwd) => hook('commit-gate.mjs', { session_id: SESSION, cwd: payloadCwd, tool_input: { command } }, parent, env);

  written(parent, 'mine.rs', body(1));
  writeFileSync(join(parent, 'broker.rs'), body(2));
  git(['add', '--', 'mine.rs', 'broker.rs'], parent);
  written(sub, 'field.rs', body(3));

  const inside = gate(sub);
  ok('a commit run in a submodule is judged by the submodule, not by the dirty superproject index', inside.code === 0, inside.out.trim());

  const outside = gate(parent);
  ok('control: the same command run in the superproject still names its foreign staged path', outside.code === 2 && outside.out.includes('broker.rs'), outside.out.trim());

  writeFileSync(join(sub, 'stray.rs'), body(4));
  git(['add', '--', 'stray.rs'], sub);
  const stray = gate(sub);
  ok('negative control: a staged path of the submodule the session never wrote is still refused by name', stray.code === 2 && stray.out.includes('stray.rs') && !stray.out.includes('broker.rs'), stray.out.trim());

  const missing = hook('commit-gate.mjs', { session_id: SESSION, cwd: join(parent, 'no-such-dir'), tool_input: { command } }, parent, env);
  ok('a payload cwd that is not a directory falls back to the hook cwd', missing.code === 2 && missing.out.includes('broker.rs'), missing.out.trim());
} finally {
  cleanup();
  done();
}
