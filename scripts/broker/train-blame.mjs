// train-blame.mjs — pin a train's red command on the member that caused it (KIT-T482 item 1).
// A train runs several disjoint patches as one build; when a command fails, each failure is
// traced to the ONE member it belongs to, or reported ambiguous:
//   compile error  → the member whose patch touched the file rustc points at
//   failed test    → the only member that asked for the command, else the only member whose
//                    commands select the test's target (nextest binary id), else the only member
//                    that touched the test's own file (tests/<t>.rs) or its module (src/a/b.rs for
//                    a::b::tests::name)
//   anything else  → the only member that asked for the command
// The caller drops blamed members and rebuilds the rest; only an all-ambiguous red bisects.
//
// `blame(entry, members)`: entry = { cmd, exit, errors, failed, caused?, owners: [id] } (caused:
// the failed tests attribution kept; absent = all of `failed`); members = [{ id, touched: [path],
// commands: [cmd] }] → { blamed: Map<id, [reason]>, ambiguous: [reason] }.

const posix = (p) => String(p).replace(/\\/g, '/');
const SELECTOR_WITH_VALUE = new Set(['--test', '--bin', '--example', '--bench']);
const SELECTOR_FLAG = new Set(['--lib', '--bins', '--tests', '--examples', '--benches']);

// The member whose touched paths include the file (rustc may print it relative to a workspace
// above the job's checkout, or absolute).
function ownerOfFile(file, members) {
  const f = posix(file);
  const hit = members.filter((m) => m.touched.some((p) => f === p || f.endsWith(`/${p}`)));
  return hit.length === 1 ? hit[0] : null;
}

const TEST_SUBS = new Set(['test', 't', 'nextest']);

// { pkg, selectors } of a cargo test-shaped command, or null.
function cargoSelection(cmd) {
  const toks = String(cmd).trim().split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1 || !TEST_SUBS.has(toks[ci + 1])) return null;
  let pkg = null;
  const selectors = [];
  for (let i = ci + 2; i < toks.length && toks[i] !== '--'; i++) {
    const t = toks[i];
    if (t === '-p' || t === '--package') pkg = toks[++i];
    else if (SELECTOR_WITH_VALUE.has(t)) selectors.push(`${t} ${toks[++i]}`);
    else if (SELECTOR_FLAG.has(t)) selectors.push(t);
  }
  return { pkg, selectors };
}

// nextest binary id → { crate, spec }: `crate` → --lib, `crate::name` → --test name, `crate::bin/b` → --bin b.
function targetOf(binary) {
  const [crate, rest] = String(binary).split('::');
  if (!rest) return { crate, spec: '--lib' };
  if (rest.startsWith('bin/')) return { crate, spec: `--bin ${rest.slice(4)}` };
  return { crate, spec: `--test ${rest}` };
}

const selects = (cmd, { crate, spec }) => {
  const s = cargoSelection(cmd);
  if (!s || (s.pkg && s.pkg !== crate)) return false;
  if (!s.selectors.length) return true;
  return s.selectors.includes(spec) || (spec.startsWith('--test ') && s.selectors.includes('--tests')) || (spec.startsWith('--bin ') && s.selectors.includes('--bins'));
};

const touchedFile = (m, re) => m.touched.some((p) => re.test(p));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Module files a unit test's path names, longest prefix first: a::b::tests::t → src/a/b.rs, src/a/b/mod.rs, src/a.rs …
function moduleFiles(test) {
  const segs = String(test).split('::').slice(0, -1).filter((s) => s !== 'tests');
  const out = [];
  for (let n = segs.length; n > 0; n--) {
    const mod = segs.slice(0, n).join('/');
    out.push(new RegExp(`(^|/)src/${esc(mod)}(\\.rs|/mod\\.rs)$`));
  }
  return out;
}

// [owner, how] for one failed test, or [null, why].
function ownerOfTest(t, entry, members) {
  const asked = members.filter((m) => (entry.owners || []).includes(m.id));
  if (asked.length === 1) return [asked[0], 'only member running the command'];
  let pool = asked.length ? asked : members;
  if (t.binary) {
    const target = targetOf(t.binary);
    const sel = pool.filter((m) => m.commands.some((c) => selects(c, target)));
    if (sel.length === 1) return [sel[0], `only member selecting ${target.spec}`];
    if (sel.length) pool = sel;
    const name = target.spec.startsWith('--test ') ? target.spec.slice(7) : null;
    if (name) {
      const own = pool.filter((m) => touchedFile(m, new RegExp(`(^|/)tests/${esc(name)}(\\.rs|/)`)));
      if (own.length === 1) return [own[0], `touched tests/${name}`];
      return [null, `${t.test} (${target.spec}) is selected by ${pool.map((m) => m.id).join(', ')}`];
    }
  }
  for (const re of moduleFiles(t.test)) {
    const own = pool.filter((m) => touchedFile(m, re));
    if (own.length === 1) return [own[0], 'touched its module'];
    if (own.length > 1) break;
  }
  return [null, `${t.test} could belong to ${pool.map((m) => m.id).join(', ')}`];
}

export function blame(entry, members) {
  const blamed = new Map();
  const ambiguous = [];
  const add = (m, why) => { if (!blamed.has(m.id)) blamed.set(m.id, []); blamed.get(m.id).push(why); };
  const files = Object.keys(entry.errors || {});
  if (files.length) {
    for (const file of files) {
      const owner = file === '(unlocated)' ? null : ownerOfFile(file, members);
      if (owner) add(owner, `compile error in ${posix(file)}`);
      else ambiguous.push(`compile error in ${posix(file)}, a file no single member touched`);
    }
    return { blamed, ambiguous };
  }
  const caused = entry.caused ? (entry.failed || []).filter((f) => entry.caused.includes(f.test)) : entry.failed || [];
  if (caused.length) {
    for (const t of caused) {
      const [owner, how] = ownerOfTest(t, entry, members);
      if (owner) add(owner, `test ${t.binary ? `${t.binary} ` : ''}${t.test} failed (${how})`);
      else ambiguous.push(`test ${how}`);
    }
    return { blamed, ambiguous };
  }
  const asked = members.filter((m) => (entry.owners || []).includes(m.id));
  if (asked.length === 1) add(asked[0], `\`${entry.cmd}\` exited ${entry.exit}`);
  else ambiguous.push(`\`${entry.cmd}\` exited ${entry.exit} with no located error`);
  return { blamed, ambiguous };
}
