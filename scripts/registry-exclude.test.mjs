// registry-set exclude (KIT-D180, KIT-T447): the verb adds a tree to the registry's `excluded` list once; q run inside an
// excluded git repo with no .ai store refuses instead of searching it (the KIT-T1603 resolver never reaches it).
// Run: node scripts/registry-exclude.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV, TMP_REG, cleanup, git, repo, reporter } from '../hooks/test-harness.mjs';

const { ok, done } = reporter('registry-exclude');
const SET = join(import.meta.dirname, 'registry-set.mjs');
const Q = join(import.meta.dirname, 'q.mjs');
const TOKEN = 'zqxExcludedToken';
const excludedList = () => JSON.parse(readFileSync(TMP_REG, 'utf8')).excluded || [];
const set = (...args) => spawnSync(process.execPath, [SET, ...args], { encoding: 'utf8', env: ENV });

try {
  writeFileSync(TMP_REG, JSON.stringify({ projects: {}, excluded: ['D:/dev/the-commodore'] }, null, 2));
  const fleet = repo();
  mkdirSync(join(fleet, 'src'), { recursive: true });
  writeFileSync(join(fleet, 'src', 'a.ts'), `export const ${TOKEN} = true;\n`);
  git(['add', 'src/a.ts'], fleet);

  const added = set('exclude', fleet);
  ok('exclude adds the tree beside the existing root', added.status === 0 && excludedList().length === 2 && excludedList()[0] === 'D:/dev/the-commodore');
  set('exclude', fleet);
  set('exclude', join(fleet, 'src'));
  ok('a second exclude of the tree, or of a folder under it, adds nothing', excludedList().length === 2);
  ok('exclude with no path fails and names the usage', set('exclude').status === 1);

  const q = spawnSync(process.execPath, [Q, 'code', TOKEN], { cwd: fleet, encoding: 'utf8', env: ENV });
  ok('q code inside the excluded repo refuses and says the kit is off there', q.status === 2 && /claude-kit is off under/.test(q.stderr) && !q.stdout.includes('src/a.ts'));
  const sub = spawnSync(process.execPath, [Q, 'code', TOKEN, '--no-db'], { cwd: join(fleet, 'src'), encoding: 'utf8', env: ENV });
  ok('q code from a folder inside it refuses too', sub.status === 2 && !sub.stdout.includes('src/a.ts'));
} finally {
  cleanup();
}
done();
