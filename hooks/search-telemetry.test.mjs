// Tests for search telemetry (KIT-T285): the classifier, the PostToolUse hook's log rows, gate
// blocks logged by query-gate, the report, and the weekly review section. Isolated log dir.
// Run: node hooks/search-telemetry.test.mjs

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';
import { classifyCalls, shapeOf } from './lib/search-shape.mjs';
import { readSearchLog } from './lib/search-log.mjs';
import { usageSummary, formatSummary, transcriptRows, logReport } from '../scripts/search-report.mjs';
import { reviewReport } from '../scripts/doc-review.mjs';

const { ok, done } = reporter('search-telemetry');
const one = (tool, input) => classifyCalls(tool, input)[0];

try {
  // --- classifier -------------------------------------------------------------------
  ok('q verb is read from the command', (() => { const c = one('Bash', { command: 'node "D:/kit/scripts/q.mjs" fts sleep wake' }); return c.kind === 'q' && c.verb === 'fts'; })());
  ok('code-graph query verb is read', one('Bash', { command: 'node scripts/code-graph.mjs --query defines Foo' }).verb === 'defines');
  const g = one('Bash', { command: "rg -t rust 'fn spawn_camp' crates/" });
  ok('rg with a rust type is language-tagged and shaped as a definition', g.kind === 'rg' && g.lang === 'rust' && g.shape === 'definition');
  ok('--include=*.wgsl tags wgsl', one('Bash', { command: 'grep -rn foo --include=*.wgsl .' }).lang === 'wgsl');
  ok('a bare identifier is the identifier shape', shapeOf('SpawnCamp') === 'identifier');
  ok('a regex is the regex shape', shapeOf('foo.*bar|baz') === 'regex');
  ok('a piped output filter is not a search', classifyCalls('Bash', { command: 'cargo test | grep error' }).length === 0);
  ok('a grep with a file argument piped from nothing is a search', classifyCalls('Bash', { command: 'grep needle src/lib.rs' }).length === 1);
  ok('.ai paths are the store target', one('Bash', { command: 'grep -r x .ai/decisions' }).target === 'store');
  ok('the Grep tool is classified with its type', one('Grep', { pattern: 'Camp', type: 'rust' }).lang === 'rust');
  ok('Glob is classified', one('Glob', { pattern: '**/*.rs' }).kind === 'Glob');
  ok('a non-search command yields nothing', classifyCalls('Bash', { command: 'cargo build' }).length === 0);
  ok('newline-separated commands are each classified', classifyCalls('Bash', { command: 'rg foo src\nnode q.mjs open' }).length === 2);

  // --- hook + log ---------------------------------------------------------------------
  const logDir = mkdtempSync(join(tmpdir(), 'search-log-'));
  const env = { CLAUDE_KIT_SEARCH_LOG_DIR: logDir };
  const d = adopted(false);
  const post = (tool, input) => hook('search-telemetry.mjs', { tool_name: tool, tool_input: input, session_id: 's1' }, d, env);
  ok('the hook exits 0 and prints nothing', (() => { const r = post('Bash', { command: 'rg -t rust Camp crates' }); return r.code === 0 && r.out === ''; })());
  post('Bash', { command: 'node q.mjs fts camps' });
  post('Grep', { pattern: 'foo', path: 'src' });
  post('Bash', { command: 'cargo build' });
  process.env.CLAUDE_KIT_SEARCH_LOG_DIR = logDir;
  const rows = readSearchLog(d, 1);
  ok('one row per search call, none for non-search', rows.length === 3 && rows.every((r) => r.session === 's1' && r.ts));
  ok('the hook fails open on garbage input', hook('search-telemetry.mjs', 'not json', d, env).code === 0);

  // --- query-gate logs its blocks ------------------------------------------------------
  hook('query-gate.mjs', { tool_input: { command: 'grep -rn physics .ai/decisions/' } }, d, env);
  ok('a gate block is logged as a blocked event with its rule', readSearchLog(d, 1).some((r) => r.event === 'blocked' && r.rule === 'store-grep'));

  // --- report -----------------------------------------------------------------------------
  const s = usageSummary(readSearchLog(d, 1));
  ok('summary counts q, fts, grep and blocks', s.q === 1 && s.qFts === 1 && s.grep === 1 && s.grepTool === 1 && s.gateBlocks === 1);
  const text = formatSummary(s, 'search log', 14);
  ok('report shows the mix, the baseline and the unanswered shapes', /indexed: q 1 \(fts 1\)/.test(text) && /baseline/.test(text) && /identifier:rust|regex:any/.test(text));
  ok('logReport reads the log for the project', /SEARCH USAGE \(14d, search log\)/.test(logReport(d)));
  ok('the weekly review includes the search usage section', /SEARCH USAGE/.test(reviewReport(d)));

  // --- transcript scan (the baseline method) ----------------------------------------------------
  const tdir = mkdtempSync(join(tmpdir(), 'tx-'));
  mkdirSync(join(tdir, 'sub'), { recursive: true });
  const tool = (name, input) => JSON.stringify({ timestamp: new Date().toISOString(), message: { content: [{ type: 'tool_use', name, input }] } });
  const blocked = JSON.stringify({ message: { content: [{ type: 'tool_result', content: 'BLOCKED: searching the .ai work store with a text tool.' }] } });
  writeFileSync(join(tdir, 'a.jsonl'), [tool('Bash', { command: 'rg Camp crates' }), blocked].join('\n') + '\n');
  writeFileSync(join(tdir, 'sub', 'b.jsonl'), tool('Bash', { command: 'node q.mjs open' }) + '\n');
  const tr = usageSummary(transcriptRows(tdir, 14));
  ok('transcript scan counts subagent files and gate blocks', tr.grep === 1 && tr.q === 1 && tr.gateBlocks === 1);
} finally {
  cleanup();
}
done();
