#!/usr/bin/env node
// agent-gate-guide.test.mjs — KIT-T1439: a writing subagent learns the tool to call instead BEFORE its first block and AT it.
// SubagentStart hands the guide to every subagent of an adopted repo; the one-file-search block leads with the exact Grep and
// Read calls; the source-shell-write block leads with the Edit call for the file and, for a stash, the baseline route; a stash
// of only the files the caller wrote passes beside a live writer, and its pop passes.
// Run: node hooks/agent-gate-guide.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adopted, cleanup, hook, identify, reporter, tmpDir } from './test-harness.mjs';
import { claimFile } from './lib/checkout-holder.mjs';

const { ok, done } = reporter('agent-gate-guide');
const script = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));

try {
  const repo = adopted(false);
  const guide = hook('subagent-gate-guide.mjs', { hook_event_name: 'SubagentStart', agent_type: 'general-purpose', cwd: repo }, repo);
  const parsed = JSON.parse(guide.out);
  const added = parsed.hookSpecificOutput.additionalContext;
  ok('SubagentStart: an adopted repo gets additionalContext under the SubagentStart event', guide.code === 0 && parsed.hookSpecificOutput.hookEventName === 'SubagentStart');
  ok('the guide names Read, the Grep tool on one file, q for a tree, Edit for a write and the baseline route', /Read \(file_path, offset, limit\)/.test(added) && /Grep tool \(pattern, path = that one file\)/.test(added) && /q code <text>/.test(added) && /Edit tool/.test(added) && /never a stash of the shared tree/.test(added));
  const bare = tmpDir('agg-unadopted-');
  execFileSync('git', ['init', '-q'], { cwd: bare, stdio: 'ignore' });
  const quiet = hook('subagent-gate-guide.mjs', { hook_event_name: 'SubagentStart', cwd: bare }, bare);
  ok('SubagentStart: an unadopted repo prints nothing', quiet.code === 0 && quiet.out.trim() === '');
  ok('SubagentStart: hooks.json registers the hook', /"SubagentStart"[\s\S]*?subagent-gate-guide\.mjs/.test(readFileSync(script('hooks.json'), 'utf8')));

  const grepBlock = hook('query-gate.mjs', { tool_name: 'Bash', tool_input: { command: 'cargo test 2>&1 | tail -3 && grep -n usePhysics crates/x/src/lib.rs' } }, repo).out;
  const grepAt = grepBlock.indexOf('Grep tool: pattern "usePhysics", path "crates/x/src/lib.rs"');
  ok('one-file-search block: leads with the exact Grep tool call, before the q line', grepAt > 0 && grepAt < grepBlock.indexOf('Exact equivalent:'));
  ok('one-file-search block: names the Read call with the file and the chained-command split', /Read tool: file_path "crates\/x\/src\/lib\.rs", offset and limit/.test(grepBlock) && /keep the other segments in Bash as written/.test(grepBlock));
  ok('one-file-search block: no longer says a search is "no grep" next to allowing the Grep tool', !/no search, no grep/.test(grepBlock));
  const awkBlock = hook('query-gate.mjs', { tool_name: 'Bash', tool_input: { command: "awk '/usePhysics/' src/a.cpp" } }, repo).out;
  ok('one-file-search block: an awk address carries its pattern into the Grep call', /Grep tool: pattern "usePhysics", path "src\/a\.cpp"/.test(awkBlock));

  const state = mkdtempSync(join(tmpdir(), 'agg-state-'));
  const holders = mkdtempSync(join(tmpdir(), 'agg-holders-'));
  const live = identify(adopted(false));
  const git = (...args) => execFileSync('git', args, { cwd: live, encoding: 'utf8' }).trim();
  const env = { ...process.env, CLAUDE_KIT_TURN_STATE: state, CLAUDE_KIT_HOLDERS_DIR: holders, CLAUDE_KIT_REGISTRY: join(state, 'registry.json'), CLAUDE_KIT_LIVE: '1' };
  const spawnHook = (name, payload) => spawnSync(process.execPath, [script(name)], { cwd: live, env, input: JSON.stringify(payload), encoding: 'utf8' });
  const toolWrite = (rel, text, session) => {
    const input = { session_id: session, tool_input: { file_path: join(live, rel), content: text } };
    spawnHook('pre-write.mjs', input);
    writeFileSync(join(live, rel), text);
    spawnHook('tool-write-record.mjs', { ...input, hook_event_name: 'PostToolUse', tool_response: {} });
  };
  const gate = (command, session = 'S1') => spawnHook('source-shell-gate.mjs', { session_id: session, tool_name: 'Bash', tool_input: { command } });
  const refusal = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);

  mkdirSync(join(live, 'src'), { recursive: true });
  writeFileSync(join(live, 'src', 'a.rs'), 'fn a() { 1 }\n');
  writeFileSync(join(live, 'src', 'b.rs'), 'fn b() { 1 }\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'seed');
  process.env.CLAUDE_KIT_HOLDERS_DIR = holders;
  process.env.CLAUDE_KIT_TURN_STATE = state;
  claimFile({ tree: git('rev-parse', '--show-toplevel'), session: 'S9', agent: 'roads', label: 'roads agent', rel: 'src/b.rs', head: 'h' });

  const sed = gate("sed -i 's/1/2/' src/a.rs");
  ok('source-shell-write block: a sed -i leads with the Edit call for that file', refusal(sed) && /Instead, call Edit tool: file_path "[^"\n]*\/src\/a\.rs", old_string -> new_string/.test(sed.stderr));
  const created = gate("cat > src/new.rs <<'EOF'\nfn n() {}\nEOF");
  ok('source-shell-write block: a heredoc that creates a file leads with the Write call for that file', refusal(created) && /Instead, call Write tool: file_path "[^"\n]*\/src\/new\.rs", content/.test(created.stderr));
  const stash = gate('git stash && cargo test && git stash pop');
  ok('source-shell-write block: a bare stash beside a live writer names the baseline route', refusal(stash) && /never a stash of the shared tree/.test(stash.stderr) && /git show HEAD:<path>/.test(stash.stderr) && /git stash push -m <note> -- <each file you wrote>/.test(stash.stderr));
  ok('source-shell-write block: a pull does not carry the baseline route', !/never a stash of the shared tree/.test(gate('git pull').stderr));

  toolWrite('src/a.rs', 'fn a() { 2 }\n', 'S1');
  ok('control: a stash of only a file the caller wrote passes beside a live writer', !refusal(gate('git stash push -m baseline -- src/a.rs')));
  ok('control: its pop passes', !refusal(gate('git stash pop')));
  toolWrite('src/b.rs', 'fn b() { 2 }\n', 'S9');
  ok('control: a stash of a file another writer changed is refused', refusal(gate('git stash push -m baseline -- src/b.rs')));
} finally {
  cleanup();
}
done();
