// A commit takes no path another live writer holds uncommitted work in (KIT-T1256): two agents of ONE session share a session id
// and one git index, so an earlier `git add` of the other agent's files must stop this agent's commit, name them, and name the
// commit by explicit path that leaves their staged work staged. Run: node hooks/commit-agent-claims.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('commit-agent-claims');

try {
  const holders = tmpDir('commit-claims-holders-');
  process.env.CLAUDE_KIT_HOLDERS_DIR = holders;
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('commit-claims-state-'), CLAUDE_KIT_HOLDERS_DIR: holders };
  const { claimFile, releaseAgent } = await import('./lib/checkout-holder.mjs');
  const target = identify(adopted(false));
  const tree = git(['rev-parse', '--show-toplevel'], target).trim();
  const head = () => git(['rev-parse', 'HEAD'], target).trim();
  const abs = (rel) => join(target, rel);
  const body = (n) => `pub fn f_${n}() -> u32 { ${n} }\n`;
  const written = (rel, n, session) => {
    mkdirSync(dirname(abs(rel)), { recursive: true });
    writeFileSync(abs(rel), body(n));
    hook('pre-write.mjs', { session_id: session, tool_input: { file_path: abs(rel), content: body(n) } }, target, env);
  };
  const verdict = (agent, command) => hook('commit-gate.mjs', { session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_input: { command } }, target, env);
  const MSG = 'implements KIT-T1256';

  written('src/anchor.rs', 0, 'S1');
  git(['add', '--', 'src/anchor.rs'], target);
  git(['commit', '-q', '-m', 'anchor'], target);

  written('src/roads.rs', 1, 'S1');
  written('src/mine.rs', 2, 'S1');
  git(['add', '--', 'src/roads.rs', 'src/mine.rs'], target);
  claimFile({ tree, session: 'S1', agent: 'agentRoads', label: 'roads agent', rel: 'src/roads.rs', head: head() });
  claimFile({ tree, session: 'S1', agent: 'agentTerrain', label: 'terrain agent', rel: 'src/mine.rs', head: head() });

  const bare = verdict('agentTerrain', `git -C ${target} commit -m "${MSG}"`);
  ok('a bare commit with another live agent\'s staged file is refused', bare.code === 2, bare.out.trim());
  ok('the refusal names the file and the agent holding it', bare.out.includes('src/roads.rs') && bare.out.includes('agentRoads') && bare.out.includes('roads agent'), bare.out.trim());
  ok('the refusal offers the commit by explicit path over the agent\'s own file only', /git commit -m "<message>" -- src\/mine\.rs\n/.test(bare.out), bare.out.trim());
  ok('the refusal never offers unstaging the other agent\'s work as the fix', !/^\s*git restore --staged/m.test(bare.out) && /Do not `git restore --staged`/.test(bare.out), bare.out.trim());

  const afterAdd = verdict('agentTerrain', `git -C ${target} add -- src/mine.rs && git -C ${target} commit -m "${MSG}"`);
  ok('an add of the agent\'s own paths before a bare commit does not hide the other agent\'s staged file', afterAdd.code === 2 && afterAdd.out.includes('src/roads.rs'), afterAdd.out.trim());

  const byPath = verdict('agentTerrain', `git -C ${target} commit -m "${MSG}" -- src/mine.rs`);
  ok('control: a commit by explicit path over the agent\'s own file passes', byPath.code === 0, byPath.out.trim());
  const withFile = verdict('agentTerrain', `git -C ${target} commit -F msg.txt -- src/mine.rs`);
  ok('control: the same with a message file is not refused for the other agent\'s file', !withFile.out.includes('uncommitted work of another live writer'), withFile.out.trim());
  const roadsBare = verdict('agentRoads', `git -C ${target} commit -m "${MSG}"`);
  ok('the claim is symmetric: the other agent\'s bare commit is refused for the first agent\'s file', roadsBare.code === 2 && roadsBare.out.includes('src/mine.rs') && roadsBare.out.includes('agentTerrain'), roadsBare.out.trim());

  const escaped = verdict('agentTerrain', `git -C ${target} commit -m "${MSG} [commit-foreign: finishing the roads agent's staged work]"`);
  ok('control: [commit-foreign: reason] lifts the refusal', escaped.code === 0, escaped.out.trim());

  const mainThread = verdict('', `git -C ${target} commit -m "${MSG}"`);
  ok('the main thread of the session is held to it too', mainThread.code === 2 && mainThread.out.includes('src/roads.rs') && mainThread.out.includes('src/mine.rs'), mainThread.out.trim());

  releaseAgent('agentRoads');
  releaseAgent('agentTerrain');
  const released = verdict('agentTerrain', `git -C ${target} commit -m "${MSG}"`);
  ok('control: once the other agent has stopped (its claims released) the bare commit passes', released.code === 0, released.out.trim());

  claimFile({ tree, session: 'S1', agent: 'agentRoads', label: 'roads agent', rel: 'src/roads.rs', head: head() });
  claimFile({ tree, session: 'S1', agent: 'agentTerrain', label: 'terrain agent', rel: 'src/roads.rs', head: head() });
  const both = verdict('agentTerrain', `git -C ${target} commit -m "${MSG}"`);
  ok('control: a path the committing agent holds a claim on too is not foreign', both.code === 0, both.out.trim());

  releaseAgent('agentRoads');
  releaseAgent('agentTerrain');
  git(['add', '--', 'src/roads.rs', 'src/mine.rs'], target);
  git(['commit', '-q', '-m', 'settle'], target);
  const { beatHolder } = await import('./lib/checkout-holder.mjs');
  written('src/rolled.rs', 7, 'S1');
  beatHolder({ tree, session: 'S1', agent: 'agentRolled', label: 'rolled agent' });
  claimFile({ tree, session: 'S1', agent: 'agentRolled', label: 'rolled agent', rel: 'src/rolled.rs', head: head() });
  const rolledCommit = (session, agent) => hook('commit-gate.mjs', { session_id: session, agent_id: agent, tool_input: { command: `git -C ${target} commit -m "${MSG}" -- src/rolled.rs` } }, target, env);
  const rolled = rolledCommit('S2', 'agentRolled');
  ok('a subagent whose session id changed commits its own file; its old session is not another live session', rolled.code === 0, rolled.out.trim());
  const rolledOther = rolledCommit('S2', 'agentOther');
  ok('negative control: another agent of the new session is refused that file', rolledOther.code === 2 && rolledOther.out.includes('src/rolled.rs'), rolledOther.out.trim());
} finally {
  cleanup();
  done();
}
