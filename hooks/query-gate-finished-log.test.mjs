// KIT-T1349: the Monitor that resumes work on a finished broker run follows target/broker/finished.log through a grep
// (KIT-D115); the retrieval gate lets that stream pass and keeps blocking every other piped grep of one named file.
// Run: node hooks/query-gate-finished-log.test.mjs

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';

const { ok, done } = reporter('query-gate-finished-log');

try {
  const dir = adopted(false);
  mkdirSync(join(dir, 'target', 'broker'), { recursive: true });
  const verdict = (command) => hook('query-gate.mjs', { tool_name: 'Bash', tool_input: { command } }, dir);

  const stream = verdict('tail -n 0 -F target/broker/finished.log | grep --line-buffered -E "j-1|j-2"');
  ok('the documented Monitor stream of finished.log passes', stream.code === 0, stream.out.trim());
  const lower = verdict('tail -f target/broker/finished.log | grep --line-buffered j-1');
  ok('tail -f of finished.log passes', lower.code === 0, lower.out.trim());
  const follow = verdict('tail --follow=name target/broker/finished.log | grep --line-buffered j-1');
  ok('tail --follow of finished.log passes', follow.code === 0, follow.out.trim());

  const other = verdict('tail -n 0 -F target/broker/build.log | grep --line-buffered -E "error|warning"');
  ok('negative control: the same stream of another log is still refused', other.code === 2 && /one-file-search/.test(other.out), other.out.trim());
  const read = verdict('tail -n 200 target/broker/finished.log | grep j-1');
  ok('negative control: a plain read of finished.log piped to grep is still refused', read.code === 2 && /one-file-search/.test(read.out), read.out.trim());
  const direct = verdict('grep j-1 target/broker/finished.log');
  ok('negative control: grep of finished.log itself is still refused', direct.code === 2 && /one-file-search/.test(direct.out), direct.out.trim());
  ok('the block names the sanctioned stream', /tail -n 0 -F target\/broker\/finished\.log/.test(direct.out), direct.out.trim());
} finally {
  cleanup();
  done();
}
