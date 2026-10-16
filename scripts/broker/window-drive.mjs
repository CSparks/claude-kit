// window-drive.mjs — submits queued jobs one gap apart from a second process, for train-window.test.mjs. NOT a test.
//   node window-drive.mjs <root> <jobsFile> <gapMs>

import { readFileSync } from 'node:fs';
import { readBrokerConfig } from './config.mjs';
import { writeJob } from './result.mjs';

const [root, jobsFile, gap] = process.argv.slice(2);
const cfg = readBrokerConfig(root);
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
for (const [i, job] of jobs.entries()) {
  if (i) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(gap));
  writeJob(cfg, job);
}
