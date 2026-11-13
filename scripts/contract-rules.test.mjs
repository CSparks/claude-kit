// contract-rules.test.mjs — the process-failure preventions the base contract and the dispatching commands
// must carry (KIT-D156): flush the anchor at every commit/landing/decision, the dispatch checklist, and store reads
// through q show. Run: node scripts/contract-rules.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KIT_ROOT } from './dispatch-ladder.mjs';
import { adopted, cleanup, hook, reporter } from '../hooks/test-harness.mjs';

const { ok, done } = reporter('contract-rules');
const read = (rel) => readFileSync(join(KIT_ROOT, rel), 'utf8');

try {
  const base = read('user-config/CLAUDE.global.md');
  ok('the base contract says to flush the anchor at every commit, landing receipt and decision, before replying',
    /Flush the anchor \(`t session "<state \+ next steps>"`\) at every commit, landing receipt and decision, the same turn, before replying/.test(base));
  ok('the base contract carries the dispatch checklist with every tag form',
    ['Dispatch checklist', '`q gates agent`', '[<Family N.M>] <label>', '[job: <id>]', '[read-only: <why>]', '[tree: <its root>]', '[maintainer-words:', '[reuses:']
      .every((s) => base.includes(s)));
  ok('the base contract reads store items with q show or Read, never a text tool', /Read a work-store item with `q show <id>` or the Read tool on ONE file; never sed\/cat\/grep\/head on `\.ai\/`/.test(base));
  for (const f of ['commands/work.md', 'commands/drain.md']) {
    const text = read(f);
    ok(`${f} puts the dispatch checklist in the orchestrator's hands`, /Dispatch checklist, every Agent call/.test(text) && text.includes('[job: <id>]') && text.includes('[read-only: <why>]'));
  }
  ok('the base contract says a cap note is never the home of a ruling and names the promotion, the Stop block and the clear (KIT-T938)',
    ['A `cap` note is never the home of a ruling', 'RULING CAPTURED', 't decide --file <draft.md> --from <inbox id>', 'Stop hook blocks once', 't triage <id> --skip', 'orient lists']
      .every((s) => base.includes(s)));
  ok('the base contract puts [rulings-checked: ...] in the dispatch checklist for design and plan briefs', /design or plan brief[\s\S]{0,200}\[rulings-checked: <q inbox or q fts run, or inbox ids read>\|none apply: <why>\]/.test(base));
  for (const f of ['commands/work.md', 'commands/drain.md']) ok(`${f} carries the rulings-checked tag`, read(f).includes('[rulings-checked: <q inbox or q fts run, or inbox ids read>|none apply: <why>]'));
  for (const f of ['commands/work.md', 'commands/drain.md']) ok(`${f} carries the escalate tag for a job dearer than the ticket type's default (KIT-T940)`, /\[escalate: <reason>\]/.test(read(f)));
  ok('the base contract carries the escalate tag in the dispatch checklist (KIT-T940)', /Dispatch checklist[\s\S]{0,1600}\[escalate: <reason>\]/.test(base));
  for (const f of ['agents/analyst.md', 'agents/analyst-max.md']) ok(`${f} names the escalate tag for the dispatcher (KIT-T940)`, /\[escalate: <reason>\]/.test(read(f)));
  ok('the owning commands carry the promotion protocol', read('commands/cap.md').includes('RULING CAPTURED') && read('commands/decide.md').includes('--from <inbox id>') && read('commands/triage.md').includes('t decide --file <draft.md> --from <cap id>'));
  const MESSAGE_FILE_NAME = 'commit-<ticket id>-<six random characters>.txt';
  ok('the base contract tells agents to write a unique commit message file in the shared scratchpad (KIT-T1135)', base.includes(MESSAGE_FILE_NAME) && /agents of one session share one\s+scratchpad/.test(base));
  for (const f of ['agents/README.md', 'agents/implementer.md', 'agents/perf-tuner.md', 'agents/rg-ui-engineer.md']) {
    ok(`${f} names the unique commit message file (KIT-T1135)`, read(f).includes(MESSAGE_FILE_NAME));
  }
  ok('the base contract names the prose-ask gate and his rule that a need from him is a questionnaire (KIT-D168)',
    /Anything you need from him is a questionnaire \(KIT-D168/.test(base) && base.includes('`prose-ask`') && base.includes('or it\'s a process failure'));
  ok('the base contract bans prose "waiting on you" wording without a questionnaire and cites GG-D088 (KIT-T1151)',
    /KIT-T1151; GG-D088\)/.test(base) && base.includes('"waiting on you", "your call"') && base.includes('without a questionnaire the same turn'));
  ok('the base contract makes a dispatch the third step of a process failure and names its gate (KIT-D168)',
    /\(3\) DISPATCH an agent the same\s+turn[\s\S]{0,400}`process-failure-dispatch`/.test(base));
  const gates = read('hooks/lib/gate-tokens.mjs');
  ok('the tree and read-only token meanings say a scratchpad path is read-only work, not a [tree:]', /a non-git path such as the scratchpad is ignored: use \[read-only:\]/.test(gates));

  const repo = adopted(true);
  writeFileSync(join(repo, '.ai', 'SESSION.md'), '# S\nstate\n');
  const orient = hook('orient.mjs', { hook_event_name: 'SessionStart' }, repo);
  ok('orient tells the session to flush SESSION.md at every commit, landing and decision', /flush: t session at every commit, landing, decision/.test(orient.out));
} finally { cleanup(); }
done();
