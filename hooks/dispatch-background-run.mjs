// background-run — a dispatch check for dispatch-guard (KIT-T1161). The broker-wait gate refuses `cargo run` and
// `cargo test` in the background and a subagent cannot idle on a background job (KIT-D115), so a brief that tells an
// agent to background one, or to "start it in the background" without naming the built exe, sends it into that refusal.
// The sanctioned long-run form: build in the foreground, start the BUILT exe in the background, end the turn
// (docs/wait-rule.md). A brief that names the built exe (a `target/debug/<name>.exe` path, "the built exe") passes.
//
//   backgroundRunBlock({ prompt, footer }) -> block message | null (check `background-run`)

export const BACKGROUND_RUN_CHECK = 'background-run';

const BACKGROUND = String.raw`(?:in the background|in background|run_in_background|backgrounded?|background it)`;
const CARGO_RUN = String.raw`cargo(?:\.exe)?\s+(?:run|test)\b`;
const NEAR = String.raw`[^.\n]{0,100}`;
const CARGO_IN_BACKGROUND = new RegExp(`${CARGO_RUN}${NEAR}${BACKGROUND}|${BACKGROUND}${NEAR}${CARGO_RUN}`, 'i');
const START_IN_BACKGROUND = /\b(?:start|launch|run|kick off|spawn)\s+(?:it|the\s+(?:run|probe|game|app|server|binary|exe|program|capture))\b[^.\n]{0,40}\b(?:in the background|in background|run_in_background)\b/i;
const BUILT_EXE = /\b(?:built|compiled)\s+(?:exe|binary|executable|program)\b|\btarget[\\/](?:debug|release)[\\/][\w.-]+/i;
// A clause that forbids the form ("never run cargo run in the background") is the rule itself, not an instruction.
const FORBIDDEN_CLAUSE = new RegExp(String.raw`\b(?:never|don'?t|do not|must not|not)\b${NEAR}`, 'ig');

export function backgroundRunBlock({ prompt, footer }) {
  if (BUILT_EXE.test(String(prompt || ''))) return null;
  const text = String(prompt || '').replace(FORBIDDEN_CLAUSE, ' ');
  if (!CARGO_IN_BACKGROUND.test(text) && !START_IN_BACKGROUND.test(text)) return null;
  return [
    'BLOCKED: this brief tells the agent to run a program in the background without the built exe.',
    '  The broker-wait gate refuses `cargo run` and `cargo test` in the background, and a subagent cannot idle on a background job (KIT-D115).',
    '',
    'The one sanctioned long-run form (docs/wait-rule.md): build in the foreground (one call), start the BUILT exe',
    'in the background (target/debug/<name>.exe), then end the turn; the orchestrator reads the result after the finish notice.',
    'Fix: name the built exe in the brief, for example "build with cargo build, then start target/debug/<name>.exe in the background and end your turn".',
    '',
    footer,
  ].join('\n');
}
