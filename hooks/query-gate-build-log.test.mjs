// KIT-T1355: a grep of a named log or build-output file is blocked with the Read tool and an inline filter named FIRST,
// before the q form; a source file's block stays as it was. Run: node hooks/query-gate-build-log.test.mjs

import { adopted, cleanup, hook, reporter } from './test-harness.mjs';

const { ok, done } = reporter('query-gate-build-log');

try {
  const dir = adopted(false);
  const verdict = (command) => hook('query-gate.mjs', { tool_name: 'Bash', tool_input: { command } }, dir);
  const readFirst = (out) => out.indexOf('FIRST: read it with the Read tool') >= 0 && out.indexOf('FIRST: read it with the Read tool') < out.indexOf('Exact equivalent');

  const log = verdict('grep -n "error" target/spansbuild3-err.txt');
  ok('a grep of a build-output text file is still refused', log.code === 2 && /one-file-search/.test(log.out), log.out.trim());
  ok('its block names the Read tool and the inline filter before the q form', readFirst(log.out), log.out.trim());
  ok('its block still prints the exact q equivalent', /Exact equivalent:  .*code error --dir/.test(log.out), log.out.trim());

  const dotLog = verdict('grep error build.log');
  ok('a *.log file gets the same lead', dotLog.code === 2 && readFirst(dotLog.out), dotLog.out.trim());

  const source = verdict('grep -n "fn main" src/main.rs');
  ok('negative control: a source file is still refused without the log lead', source.code === 2 && !/FIRST: read it/.test(source.out), source.out.trim());
} finally {
  cleanup();
  done();
}
