// shell-attribution (KIT-T888, KIT-T1001, KIT-T1003, KIT-T1004): hand-write-detect blames a shell call for a changed
// source file only when the call itself can write one. A change that lands while a call that cannot write source
// runs (a gradle build, a q/t/cap verb, a loop of readers, a test run, a redirect into the scratchpad) belongs to
// another writer, whatever tool that writer used. A call that can write source keeps the file, in either shell.
// Run: node hooks/shell-attribution.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, reporter } from './test-harness.mjs';
import { handWriteHarness } from './hand-write-harness.mjs';

const { ok, done } = reporter('shell-attribution');

try {
  const { scratch, spawnHook, spawnHookAsync, fresh, rewrite, commit } = handWriteHarness();
  let id = 0;
  const run = (tool, command) => {
    const d = fresh();
    const callId = `a${++id}`;
    const base = { session_id: 'S1', tool_use_id: callId, tool_name: tool, tool_input: { command } };
    spawnHook('hand-write-detect.mjs', { ...base, hook_event_name: 'PreToolUse' }, d);
    rewrite(d, "fs.writeFileSync(p, 'export const a = 9;\\n')");
    return spawnHook('hand-write-detect.mjs', { ...base, hook_event_name: 'PostToolUse', tool_response: {} }, d);
  };
  const blamed = (r) => r.status === 2 && r.stderr.includes('src/a.mjs');
  const spared = (r) => r.status === 0 && !r.stderr.includes('HAND WRITE');

  const SPARED = [
    ['KIT-T1001: a for loop of q and t verbs', 'for t in KIT-T1 KIT-T2; do q show $t | head -40; echo ======; done'],
    ['KIT-T1001: a while loop reading with grep', 'while read l; do echo "$l" | grep -c x; done < list.txt'],
    ['KIT-T1001: an assignment from a substitution of readers, then ls and grep', 'TD="$(echo /tmp)/state"; ls "$TD" | grep -i repo'],
    ['KIT-T1003: gradlew.bat with a quoted test filter', './gradlew.bat :app:testDebugUnitTest --tests "com.x.OverlayContentBuilderTest"'],
    ['KIT-T1004: gradlew through a path', 'cd app && ../gradlew assembleDebug --no-daemon'],
    ['KIT-T1004: gradle on PATH', 'gradle build -x lint'],
    ['KIT-T888: node --test over repo tests', 'node --test hooks/agent-reconcile.test.mjs'],
    ['KIT-T888: a repo test script run by node', 'node hooks/hand-write-detect.test.mjs'],
    ['KIT-T888: a heredoc into a scratchpad file', `cat > "${join(scratch, 'draft.mjs').replace(/\\/g, '/')}" <<'EOF'\nexport const x = 1;\nEOF`],
    ['KIT-T941: a cap request with escaped double quotes and a semicolon in its text', 'cap request "fix the \\"Shuffle\\" screen; sed -i x src/a.mjs > y"'],
    ['KIT-T941: a t comment with escaped quotes inside single quotes', "t comment KIT-T1 'a \\\"b\\\" ; rm src/a.mjs'"],
  ];
  for (const [name, command] of SPARED) {
    ok(`${name}: a concurrent writer's change is not blamed on the call`, spared(run('Bash', command)));
  }

  const BLAMED = [
    ['Bash', 'a scratch script run', 'node scratch.js'],
    ['Bash', 'a for loop whose body is sed -i', 'for t in 1; do sed -i s/a/b/ src/a.mjs; done'],
    ['Bash', 'a heredoc into a repo source file', "cat > src/a.mjs <<'EOF'\nexport const a = 1;\nEOF"],
    ['Bash', 'a reader redirected into a repo source file', 'cat src/b.mjs > src/a.mjs'],
    ['Bash', 'a verb followed by sed -i', 'cap request "ok" ; sed -i s/a/b/ src/a.mjs'],
    ['Bash', 'an unresolved redirect target', 'echo x > "$OUT"'],
    ['Bash', 'node -p inside an assignment (inline code can write)', 'TD="$(node -p 1)"; ls "$TD"'],
    ['Bash', 'a scratch node script under the temp dir', `node ${join(scratch, 'gen.mjs').replace(/\\/g, '/')}`],
    ['Bash', 'node -e with a trailing --test is inline code, not a test run', 'node -e "console.log(1)" --test'],
    ['Bash', 'node -p with a trailing --test', 'node -p 1 --test'],
    ['Bash', 'a script whose own argument is --test', 'node scratch.js --test'],
    ['Bash', 'a test script from the scratchpad, not the repo', `node ${join(scratch, 'x.test.mjs').replace(/\\/g, '/')}`],
    ['Bash', 'node --test over a scratchpad file', `node --test ${join(scratch, 'gen.test.mjs').replace(/\\/g, '/')}`],
    ['Bash', 'a repo test run that preloads a module with --require', 'node --require ./preload.js --test hooks/a.test.mjs'],
    ['Bash', 'a repo test script that preloads a module with --import', 'node --import ./hook.mjs hooks/a.test.mjs'],
    ['Bash', 'a repo test run redirected into a source file', 'node --test hooks/a.test.mjs > src/a.mjs'],
    ['Bash', 'an ambiguous line holding a redirect', "echo $'x' > src/a.mjs"],
    ['PowerShell', 'a backslash before > is no escape in PowerShell: the redirect writes', 'echo x \\> src/a.mjs'],
    ['PowerShell', 'a cap whose quotes only PowerShell reads as escapes, then sed -i', 'cap request "x\\" ; sed -i s/a/b/ src/a.mjs ; echo \\""'],
  ];
  for (const [tool, name, command] of BLAMED) {
    ok(`CONTROL (${tool}): ${name} still owns the changed file`, blamed(run(tool, command)));
  }

  // KIT-T1010: two lanes of one orchestrator session (agent ids differ) share a checkout; lane X runs a program the
  // hook cannot rule out while lane Y's Edit lands. Y's pre-write ran before X's call began and Y's confirmation lags.
  const CHECKER = 'rapid-game/rust/target/debug/meshkit-check.exe script.txt';
  const CONFIRM_LAG_MS = 400;
  const lagged = async ({ command, confirm, rewriteByShell = false }) => {
    const d = fresh();
    const file = join(d, 'src', 'a.mjs');
    const edit = { session_id: 'ORCH', agent_id: 'laneY', tool_input: { file_path: file, old_string: 'a = 1', new_string: 'a = 9' } };
    const base = { session_id: 'ORCH', agent_id: 'laneX', tool_use_id: `lag${++id}`, tool_name: 'Bash', tool_input: { command } };
    spawnHook('pre-write.mjs', edit, d);
    spawnHook('hand-write-detect.mjs', { ...base, hook_event_name: 'PreToolUse' }, d);
    writeFileSync(file, rewriteByShell ? 'export const a = 5;\n' : 'export const a = 9;\n');
    const post = spawnHookAsync('hand-write-detect.mjs', { ...base, hook_event_name: 'PostToolUse', tool_response: {} }, d);
    if (confirm) {
      await new Promise((resolve) => setTimeout(resolve, CONFIRM_LAG_MS));
      spawnHook('tool-write-record.mjs', { ...edit, hook_event_name: 'PostToolUse', tool_response: {} }, d);
    }
    return { result: await post, refused: commit(d, 'ORCH', ['src/a.mjs']).out.includes('KIT-T706') };
  };
  const confirmed = await lagged({ command: CHECKER, confirm: true });
  ok('KIT-T1010: lane Y\'s Edit whose confirmation lags is not blamed on lane X\'s checker call', spared(confirmed.result));
  ok('KIT-T1010: the commit holding that file is not refused', !confirmed.refused);
  const unconfirmed = await lagged({ command: CHECKER, confirm: false });
  ok('KIT-T1010 control: an Edit nothing ever confirms still leaves the file to the call', blamed(unconfirmed.result));
  ok('KIT-T1010 control: and the commit holding it is refused', unconfirmed.refused);
  const rewritten = await lagged({ command: 'node scratch.js', confirm: true, rewriteByShell: true });
  ok('KIT-T1010 control: a call that rewrote the file to other content is blamed even with the confirmation landing', blamed(rewritten.result) && rewritten.refused);
} finally {
  cleanup();
}

done();
