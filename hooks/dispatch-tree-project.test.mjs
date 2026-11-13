// tree-project-dispatch (KIT-T1114): a [tree: X] that is another registered project's checkout needs a brief that cites a
// ticket of that project, or the maintainer's quoted words. Own checkout, a checkout inside it, an unregistered path and a
// read-only dispatch are never judged.
// Run: node hooks/dispatch-tree-project.test.mjs

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, finish, gitTop, makeRepo, run } from './dispatch-guard-harness.mjs';

const kitLike = makeRepo();
writeFileSync(join(kitLike, '.ai', 'config.yml'), 'ids:\n  key: "KIT"\n  prefix: "KIT-T"\n');
const kitRoot = gitTop(kitLike);
const session = makeRepo();
const sessionRoot = gitTop(session);
const registry = join(mkdtempSync(join(tmpdir(), 'tp-reg-')), 'projects.json');
writeFileSync(registry, JSON.stringify({ projects: { 'claude-kit': kitRoot, 'road-generator': sessionRoot } }));
process.env.CLAUDE_KIT_REGISTRY = registry;

const writer = (prompt) => ({ subagent_type: 'general-purpose', model: 'sonnet', prompt });
const inKit = (extra) => `build the thing [tree: ${kitRoot}] ${extra}`;

const refused = run(session, writer(inKit('(RDG-T031)')));
expect('a tree tag at another registered project with no ticket of it is refused', refused.code, 2);
expect('the refusal names the project, its key and the exact maintainer tag form', /claude-kit/.test(refused.err) && /KIT-/.test(refused.err) && /\[maintainer-asked-tree: <his words>\]/.test(refused.err) && /tree-project-dispatch/.test(refused.err) ? 1 : 0, 1);
expect('a brief citing no ticket at all is refused', run(session, writer(inKit(''))).code, 2);
expect('citing a ticket of that project passes (the road-generator to claude-kit case)', run(session, writer(inKit('KIT-T1114'))).code, 0);
expect('the maintainer\'s quoted words pass', run(session, writer(inKit('(RDG-T031) [maintainer-asked-tree: "use the kit checkout"]'))).code, 0);
expect('an empty maintainer tag does not pass', run(session, writer(inKit('(RDG-T031) [maintainer-asked-tree: ]'))).code, 2);
expect('a read-only dispatch is never judged', run(session, writer(inKit('(RDG-T031) [read-only: audit]'))).code, 0);
expect('the session\'s own checkout is never judged', run(session, writer(`work [tree: ${sessionRoot}] (RDG-T031)`)).code, 0);

const sub = join(sessionRoot, 'rapid-game');
mkdirSync(join(sub, '.git'), { recursive: true });
expect('a checkout inside the session\'s own (a submodule) is never judged', run(session, writer(`work [tree: ${sub}] (RDG-T031)`)).code, 0);

const unregistered = gitTop(makeRepo());
expect('a git root no project registered is never judged', run(session, writer(`work [tree: ${unregistered}] (RDG-T031)`)).code, 0);
expect('a tree tag that is no git root changes nothing', run(session, writer(`work [tree: ${join(tmpdir(), 'nope-nowhere')}] (RDG-T031)`)).code, 0);

finish();
