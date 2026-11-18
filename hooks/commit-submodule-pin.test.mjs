// A commit takes no submodule pin another live writer moved (KIT-T1257, from KIT-T1256): the agent that commits inside a
// submodule claims the gitlink in the superproject, so a second agent of the same session committing the superproject is
// refused for the pin, by name, while the first agent's own commit of it passes.
// Run: node hooks/commit-submodule-pin.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('commit-submodule-pin');

try {
  const holders = tmpDir('commit-pin-holders-');
  process.env.CLAUDE_KIT_HOLDERS_DIR = holders;
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('commit-pin-state-'), CLAUDE_KIT_HOLDERS_DIR: holders };
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

  const MSG = 'implements KIT-T1257';
  const gate = (agent, command, cwd) => hook('commit-gate.mjs', { session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_input: { command } }, cwd, env);
  const field = join(sub, 'field.rs');
  const content = 'pub fn field() -> u32 { 2 }\n';
  const payload = { session_id: 'S1', agent_id: 'agentRoads', tool_input: { file_path: field, content } };
  hook('pre-write.mjs', payload, sub, env);
  writeFileSync(field, content);
  hook('tool-write-record.mjs', payload, sub, env);
  git(['add', '--', 'field.rs'], sub);
  const inside = gate('agentRoads', `git -C ${sub} commit -m "${MSG}"`, sub);
  ok('the agent\'s own commit inside the submodule passes', inside.code === 0, inside.out.trim());
  git(['commit', '-q', '-m', MSG], sub);
  git(['add', '--', 'sub'], parent);

  const other = gate('agentTerrain', `git -C ${parent} commit -m "${MSG}"`, parent);
  ok('another agent\'s commit of the superproject is refused for the pin', other.code === 2 && /uncommitted work of another live writer/.test(other.out), other.out.trim());
  ok('the refusal names the pin and the agent that moved it', /sub: agent agentRoads/.test(other.out), other.out.trim());
  const own = gate('agentRoads', `git -C ${parent} commit -m "${MSG}"`, parent);
  ok('control: the agent that moved the pin commits it', own.code === 0, own.out.trim());
  const escaped = gate('agentTerrain', `git -C ${parent} commit -m "${MSG} [commit-foreign: pinning the roads agent's work]"`, parent);
  ok('control: [commit-foreign: reason] lifts the refusal', escaped.code === 0, escaped.out.trim());

  git(['commit', '-q', '-m', 'pin moved'], parent);
  const after = gate('agentTerrain', `git -C ${parent} commit --allow-empty -m "${MSG}"`, parent);
  ok('control: once the pin is committed no one holds it', after.code === 0, after.out.trim());

  // KIT-T1362: a gitlink is judged by the pointer it records. Another writer's uncommitted files inside the submodule are
  // not in a superproject commit, so a standing pin claim with the pointer unchanged takes nothing.
  const { claimFile } = await import('./lib/checkout-holder.mjs');
  const top = git(['rev-parse', '--show-toplevel'], parent).trim();
  const head = () => git(['rev-parse', 'HEAD'], parent).trim();
  writeFileSync(field, 'pub fn field() -> u32 { 3 }\n');
  claimFile({ tree: top, session: 'S1', agent: 'agentRoads', label: 'roads', rel: 'sub', head: head() });
  const dirtyOnly = gate('agentTerrain', `git -C ${parent} commit -m "${MSG}" -- sub`, parent);
  ok('a pin claim with the pointer unchanged and only dirty files inside the submodule refuses nothing', dirtyOnly.code === 0, dirtyOnly.out.trim());

  writeFileSync(join(sub, 'terrain.rs'), 'pub fn terrain() -> u32 { 1 }\n');
  git(['add', '--', 'terrain.rs'], sub);
  git(['commit', '-q', '-m', MSG], sub);
  git(['add', '--', 'sub'], parent);
  const moved = gate('agentTerrain', `git -C ${parent} add -- sub && git -C ${parent} commit -m "${MSG}" -- sub`, parent);
  ok('control: once the pointer moves, the standing pin claim of another writer still refuses the bump (KIT-T1257)', moved.code === 2 && /sub: agent agentRoads/.test(moved.out), moved.out.trim());
  git(['commit', '-q', '-m', 'pin moved again'], parent);

  writeFileSync(join(sub, 'terrain.rs'), 'pub fn terrain() -> u32 { 2 }\n');
  git(['add', '--', 'terrain.rs'], sub);
  git(['commit', '-q', '-m', MSG], sub);
  writeFileSync(join(sub, 'field.rs'), 'pub fn field() -> u32 { 4 }\n');
  const bump = gate('agentTerrain', `git -C ${parent} add -- sub && git -C ${parent} commit -m "${MSG}" -- sub`, parent);
  ok('a pointer bump with another writer\'s dirty files inside the submodule and no pin claim passes', bump.code === 0, bump.out.trim());

  writeFileSync(join(parent, 'road.rs'), 'pub fn road() -> u32 { 1 }\n');
  git(['add', '--', 'road.rs'], parent);
  git(['commit', '-q', '-m', 'road'], parent);
  writeFileSync(join(parent, 'road.rs'), 'pub fn road() -> u32 { 2 }\n');
  claimFile({ tree: top, session: 'S1', agent: 'agentRoads', label: 'roads', rel: 'road.rs', head: head() });
  const realForeign = gate('agentTerrain', `git -C ${parent} add -- road.rs && git -C ${parent} commit -m "${MSG}" -- road.rs`, parent);
  ok('control: a real foreign path in the superproject still blocks, naming it, with the [commit-foreign: reason] hint', realForeign.code === 2 && /^\s+road\.rs/m.test(realForeign.out) && /\[commit-foreign: <reason>\]/.test(realForeign.out) && /id: commit-foreign/.test(realForeign.out), realForeign.out.trim());
} finally {
  cleanup();
  done();
}
