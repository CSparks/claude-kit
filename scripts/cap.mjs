#!/usr/bin/env node
// cap.mjs — sub-second capture into .ai/inbox/ from anywhere in a project. One file
// per capture (atomic — D-009); triage promotes each into tickets/decisions/etc.
//
//   cap bug login redirect loops after SSO
//   cap "form double-submits on slow network"     (untyped — classified at triage)
//   cap feature dark-mode toggle persists
//   cap --project hod feature graded roads        (explicit target — wins over cwd)
//   cap "hod: roads are graded, not raw terrain"  (leading name: prefix — same effect)
//   cap --done "already fixed the moon"           (resolved event — skips inbox/triage)
//   cap --done bug "fixed login crash"            (resolved event with type)
//
// --done writes a resolved record to .ai/resolved/ (OUTSIDE the inbox triage queue).
// This keeps the inbox=open-queue invariant: inbox/ holds only items that need attention;
// resolved/ is an immutable audit trail of already-handled items (KIT-D036, KIT-T013).
//
// TARGETING (KIT-T067 — cwd is NOT a reliable signal of the target project): a capture is
// routed to a project's store by, in order of precedence:
//   1. an explicit `--project <name>` flag,
//   2. a leading `<name>:` token in the text,
//   3. the nearest .ai/ above the cwd (the fallback — what running `cap` from inside a repo
//      historically meant).
// <name> matches a registered project case-insensitively, by its registry name OR its id key
// (e.g. `hod` / `hustle-or-die` / `HOD`). When no explicit target is given but the text
// OBVIOUSLY names another registered project (a `Project: X` marker, or the bare name/key as a
// standalone word), that project is PROPOSED on stderr so a misroute is caught before triage —
// but the cwd fallback still owns the write. The receipt ALWAYS names the resolved destination
// project, so a misroute reads in three words.
//
// First token (after targeting is stripped) is treated as a type ONLY if it matches a
// classification key in the resolved project's config.yml; otherwise the whole line is
// captured untyped.

import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import {
  readRegistry, writeItemFile, resolveStoreRoot, noStoreMessage, readIdentity, identityBlock,
} from '../hooks/lib.mjs';
import { wantsHelpFirst } from './cli-help.mjs';
import { runTopic } from './cap-topic.mjs';
import { classificationKeys, projectTable, matchProject, namedInText } from './cap-routing.mjs';

const DATE_END = 10; // slice [0,DATE_END) of an ISO string = YYYY-MM-DD
const TIME_START = 11; // HH:MM:SS begins here
const TIME_END = 16; // through the minutes
const SLUG_MAX = 48;
const RESOLVED_DIR = 'resolved'; // one-file-per-event audit log, outside the triage queue

// The store this capture falls back to: the nearest .ai above the cwd, else the unbounded
// catch-all. ONE resolution rule, shared with t/q/orient/flush (hooks/lib/unbounded.mjs) —
// cap carried its own walk-up copy until KIT-T189.
function findAiDir(start) {
  const root = resolveStoreRoot(start);
  return root ? join(root, '.ai') : null;
}

// --- targeting: pull an explicit --project flag out of argv ----------------------------------
function takeProjectFlag(argv) {
  const out = [];
  let project = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.match(/^--project=(.+)$/);
    if (eq) { project = eq[1]; continue; }
    if (a === '--project' || a === '-p') { project = argv[i + 1] ?? null; i++; continue; }
    out.push(a);
  }
  return { project, rest: out };
}

// Strip the --done flag before anything else, so it is invisible to the type/words split
// and the existing project-routing logic. Must come BEFORE takeProjectFlag so a call like
// `cap --done --project hod bug "..."` is handled correctly in either order.
function takeDoneFlag(argv) {
  const out = [];
  let done = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--done') { done = true; continue; }
    out.push(argv[i]);
  }
  return { done, rest: out };
}

const USAGE = `usage: cap [--project <name>] [--done] [type] <text>   (or "<name>: <text>")
  cap bug login redirect loops after SSO      type = a classification key in the target's config.yml
  cap "form double-submits on slow network"   untyped — classified at triage
  cap --project hod feature graded roads      explicit target, wins over cwd
  cap "hod: roads are graded"                 leading name: prefix — same effect
  cap --done bug "fixed login crash"          resolved event -> .ai/resolved/, skips the triage queue
  cap topic [<slug>]                          show / set this session's topic (stamped on later captures)
Routing precedence: --project, then a leading "<name>:", then the nearest .ai/ above the cwd,
then the unbounded catch-all store (a cwd with no .ai above it).
`;

const argv = process.argv.slice(2);
if (wantsHelpFirst(argv)) { process.stdout.write(USAGE); process.exit(0); }
if (argv.length === 0) {
  console.error(USAGE);
  process.exit(1);
}

if (argv[0] === 'topic' && argv.length <= 2) process.exit(runTopic(argv, findAiDir(process.cwd())));

const { done: isDone, rest: argvAfterDone } = takeDoneFlag(argv);
const { project: flagProject, rest } = takeProjectFlag(argvAfterDone);
if (rest.length === 0) {
  console.error('cap: nothing to capture.');
  process.exit(1);
}

// A leading `name:` token (e.g. `hod: roads are graded`, whether `hod:` is its own arg or fused
// into one quoted string) is the inline form of --project. Split it off as a CANDIDATE; it is only
// honored as targeting if it resolves to a registered project (below), so prose like
// "bug: login fails" stays content unless `bug` is actually a project.
function splitPrefix(rest) {
  const head = String(rest[0] || '');
  if (/^[A-Za-z0-9_-]+:$/.test(head)) {                 // `hod:` as its own arg
    return { candidate: head.slice(0, -1), text: rest.slice(1) };
  }
  const fused = head.match(/^([A-Za-z0-9_-]+):\s*(\S[\s\S]*)?$/); // `hod: text...` in one arg
  if (fused) {
    const after = fused[2] ? [fused[2], ...rest.slice(1)] : rest.slice(1);
    return { candidate: fused[1], text: after };
  }
  return { candidate: null, text: rest };
}
const { candidate: prefixCandidate, text: prefixStripped } = splitPrefix(rest);

const table = projectTable();

// Resolve the destination store. Explicit targeting (flag, then a `name:` prefix that names a real
// project) WINS over cwd. A `--project` naming nothing real is a HARD ERROR (the flag is an
// unambiguous targeting attempt — silently falling through to cwd would recreate the very misroute
// it prevents). A `name:` prefix that doesn't resolve is just content (no error).
let aiDir = null;
let projectName = null;
let proposed = null;
let words = rest.slice();

const prefixHit = prefixCandidate ? matchProject(table, prefixCandidate) : null;
const explicitHit = flagProject ? matchProject(table, flagProject) : prefixHit;

if (flagProject && !explicitHit) {
  const known = table.map((p) => p.key ? `${p.name} (${p.key})` : p.name).join(', ') || '(registry empty)';
  console.error(`cap: --project "${flagProject}" matches no registered project. Known: ${known}`);
  process.exit(1);
}

if (explicitHit) {
  aiDir = explicitHit.aiDir;
  projectName = explicitHit.name;
  // A prefix that resolved was targeting, not content — strip it. (A flag leaves the text whole.)
  if (prefixHit && !flagProject) words = prefixStripped;
  if (words.length === 0) {
    console.error('cap: nothing to capture after the project target.');
    process.exit(1);
  }
} else {
  // Fallback: the nearest .ai/ above the cwd (historical behavior). Still the ultimate fallback.
  aiDir = findAiDir(process.cwd());
  if (!aiDir) {
    // A session started outside every repo (a home directory, a scratch dir) normally lands in
    // the unbounded catch-all (KIT-T189). With none configured there is nowhere to go at all, so
    // name both escape routes: a capture deferred is a capture lost (KIT-T186).
    const known = table.map((p) => (p.key ? `${p.name} (${p.key.toLowerCase()})` : p.name)).join(', ');
    console.error(`cap: ${noStoreMessage()}.`);
    console.error(known
      ? `cap: or pass --project <name>. Registered: ${known}`
      : 'cap: the project registry is empty — run init-project.mjs in the target repo first.');
    process.exit(1);
  }
  const cwdEntry = table.find((p) => existsSync(p.aiDir) && resolve(p.aiDir) === resolve(aiDir));
  projectName = cwdEntry ? cwdEntry.name : (readRegistry().dataRoot && aiDir.includes('projects') ? basename(dirname(aiDir)) : basename(dirname(resolve(aiDir))));
  // Propose another project if the TEXT obviously names one — caught before triage (KIT-T067).
  proposed = namedInText(table, words.join(' '), projectName);
}

const keys = classificationKeys(join(aiDir, 'config.yml'));
let type = '';
if (keys.includes(words[0]) && words.length > 1) {
  type = words[0];
  words = words.slice(1);
}

// The ambiguity warning goes out BEFORE the write, and the receipt itself carries the marker
// (KIT-T186). Emitted after the receipt it read as an afterthought to a line that already said
// "captured": on 2026-08-06 a kit-named capture landed in the cwd project and the warning was
// noticed only later. Routing still obeys KIT-T067 — cwd owns the write, this only PROPOSES —
// so the one line an agent relays has to be the line that says the target is disputed.
const ambiguity = proposed
  ? `also names ${proposed.name}${proposed.key ? ` (${proposed.key})` : ''}`
  : '';
if (proposed) {
  const alias = (proposed.key || proposed.name).toLowerCase();
  console.error(`cap: this text ${ambiguity} but is being captured into ${projectName} (cwd). ` +
    `If that is the wrong store, re-run: cap --project ${alias} …`);
}

const iso = new Date().toISOString();
const date = iso.slice(0, DATE_END);
const time = iso.slice(TIME_START, TIME_END).replace(':', '');
const text = words.join(' ').trim();
const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, SLUG_MAX) || 'capture';

const name = `${date}-${time}-${slug}.md`;

// Per-ITEM identity (KIT-T189): the topic and session a capture belongs to, read from the
// DESTINATION store's pointer. Stamped as a trailing `key: value` block so the first line
// stays the title every existing reader (triage, `q inbox`) already parses.
const identity = identityBlock(readIdentity(aiDir));

if (isDone) {
  // Resolved event: write OUTSIDE the inbox triage queue so inbox stays = open work only.
  // One-file-per-event, same slug/date scheme as a normal cap, plus a `resolved:` timestamp.
  // resolved/ is in NON_STORE_DIRS so writeItemFile no-ops the hydrate — fine for audit trail.
  const resolvedDir = join(aiDir, RESOLVED_DIR);
  mkdirSync(resolvedDir, { recursive: true });
  const content = [
    type ? `(${type}) ` : '',
    text,
    '\n',
    `resolved: ${iso}`,
    '\n',
    identity,
  ].join('');
  await writeItemFile(join(resolvedDir, name), content);
  console.log(`resolved${type ? ` (${type})` : ''} -> ${projectName}/${RESOLVED_DIR}/${name}${ambiguity ? ` [${ambiguity}]` : ''}`);
} else {
  const inboxDir = join(aiDir, 'inbox');
  mkdirSync(inboxDir, { recursive: true });
  await writeItemFile(join(inboxDir, name), `${type ? `(${type}) ` : ''}${text}\n${identity}`);
  console.log(`captured${type ? ` (${type})` : ''} -> ${projectName}/inbox/${name}${ambiguity ? ` [${ambiguity}]` : ''}`);
}
