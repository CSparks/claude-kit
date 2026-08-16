// q-governing.mjs — file-scoped governance (KIT-T049): the OTHER direction from `trail`
// (which walks an item's ANCESTRY up). Given file path(s), which OPEN tickets / in-force
// decisions GOVERN them — plus `drift`, the decided-vs-actual structural check.
//
// Scan-only by nature: the governing fields (`files:` / `scope:` / `paths:`) and the item
// body are NOT in the SQLite schema, so the markdown scan IS the source whether or not an
// engine exists — the cache is never a hard dependency (KIT-T031).
//
// The motivating failure: HOD-T048 (files: src/sim, src/main.ts) sat `todo` while those exact
// files were worked and nothing surfaced it.

import { compareIds } from './id-utils.mjs';
import { OPEN, isSuperseded, storeRank, clip, SUMMARY_CLIP } from './q-model.mjs';

// POSIX-normalize a path for matching so a Windows-style edit path lines up with the
// forward-slash globs the stores write, and a leading ./ never blocks a match.
const normPath = (p) => String(p || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

// A glob (orient's globToRe shape: `*` -> `.*`, everything else literal, case-insensitive,
// anchored). `src/world/*` matches `src/world/City.ts`; `rust/*` matches `rust/anything`.
const globToRe = (g) => new RegExp(
  '^' + normPath(g).split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');

// Does a governing PATTERN (a ticket `files:` entry or a decision `paths:` glob) cover a
// queried FILE path? Three ways, widest-first: (a) glob match when the pattern has a `*`;
// (b) exact path equality; (c) directory containment either way — a `files: src/sim` entry
// governs an edit to `src/sim/Foo.ts` (pattern is an ancestor dir of the file), AND a query
// for the directory `src/world` surfaces a decision whose glob/path is UNDER it. Both
// normalized to POSIX so OS path separators never split a real match.
function pathCovered(pattern, file) {
  const pat = normPath(pattern);
  const f = normPath(file);
  if (!pat || !f) return false;
  if (pat.includes('*')) {
    if (globToRe(pat).test(f) || globToRe(pat).test(f.split('/')[0] + '/x')) return true;
    // Symmetry with the containment rule below: a query for the DIRECTORY `src/legacy2d`
    // must surface a decision governing `src/legacy2d/*` — the glob's literal prefix is
    // inside the queried dir. Without this a ticket whose `files:` names a folder misses
    // the decision that parks that folder (KIT-T232).
    const literal = normPath(pat.slice(0, pat.indexOf('*'))).replace(/\/$/, '');
    return Boolean(literal) && (literal === f || literal.startsWith(f + '/'));
  }
  if (pat === f) return true;
  return f.startsWith(pat + '/') || pat.startsWith(f + '/');
}

// The governing patterns an item exposes: a ticket's `files:` entries, a decision's `paths:`
// globs. (`scope` is a free token, matched against the query string separately by the caller —
// it is not a path.) Returns [] for an item that governs nothing.
const governPatterns = (i) => [...(i.files || []), ...(i.paths || [])];

// "In force" for governance/drift — store-aware, because a DECISION has no flow status: it
// governs from the moment it's recorded until it's SUPERSEDED (the anti-relitigation backbone),
// so requiring todo/doing/review would wrongly drop every decision. A TICKET, by contrast, only
// governs while it's still OPEN (a `done` ticket's reorg is already executed — not pending).
// Both exclude archived + superseded.
const isInForce = (i) =>
  !i.archived && !isSuperseded(i) &&
  (i.store === 'decisions' ? i.status !== 'rejected' : OPEN.includes(i.status));

// One row of `governing` output — DECISIONS-first, token-frugal gist + `✎` drill-in clue,
// PLUS which of the item's patterns matched (the agent sees WHY it surfaced, in 1 line).
function governingRow(i, hits) {
  const bodyLen = i.body ? i.body.length : 0;
  const titleClipped = String(i.title || '').length > SUMMARY_CLIP;
  return {
    id: i.id,
    store: i.store,
    status: i.status,
    matched: [...new Set(hits)].join(','),
    summary: clip(i.summary || i.title || '', SUMMARY_CLIP),
    more: bodyLen > 0 || titleClipped ? '✎' : '',
  };
}

// `governing <path...>`: the OPEN tickets/decisions governing the given file path(s).
export function governing(items, paths) {
  const queried = paths.map(normPath).filter(Boolean);
  const out = [];
  for (const i of items) {
    if (!isInForce(i)) continue;
    const hits = [];
    for (const pat of governPatterns(i)) {
      for (const q of queried) if (pathCovered(pat, q)) { hits.push(pat); break; }
    }
    // A decision's `scope` token (govScope — NOT the id-prefix scope) governs when it appears
    // literally in a queried path: keeps the free-token contract without baking a taxonomy in.
    if (i.govScope && queried.some((q) => q.toLowerCase().includes(i.govScope.toLowerCase()))) hits.push('scope:' + i.govScope);
    if (hits.length) out.push(governingRow(i, hits));
  }
  return out.sort((a, b) => storeRank(a.store) - storeRank(b.store) || compareIds(a.id, b.id));
}

// `drift`: decided-vs-actual STRUCTURAL drift. For each OPEN item, flag a governing target
// the tree doesn't actually have — a reorg that was DECIDED but never EXECUTED. Two honest
// signals, no NLP:
//   (1) DECLARED targets absent — its `files:` entries that name a CONCRETE path absent from
//       disk. (Decision `paths:` GLOBS are deliberately NOT drift targets: a glob like
//       `rust/*` is a forward-looking governance SCOPE, not a "this folder must exist" claim,
//       so an absent `rust/` is normal, not drift.)
//   (2) UNREALIZED SEPARATION — an item whose body declares a "retire X as the truth / keep it
//       frozen as the example" reorg while NO frozen/legacy destination dir exists anywhere in
//       the tree. This is the HOD-T048 case — the exact failure that motivated KIT-T049.
//       Reported target: the missing dir(s).
// `exists(path)` is injected so the cache, CLI, and test paths share one tree-probe.
// Candidate destination dirs a "retire X as truth / keep it frozen as the example" reorg
// implies. Probed against the tree (and src/-prefixed) so a project that DID make the
// separation clears the flag the moment any of them exists. Tiny + literal on purpose.
const SEPARATION_DIRS = ['legacy', 'frozen', 'src/legacy', 'src/frozen'];
// A DELIBERATE retire-a-product-subsystem-to-a-frozen-area declaration — NOT any incidental
// "freeze input" / "legacy enum" mention. The signal is a retire/freeze/legacy verb sitting
// CLOSE TO a source-of-truth/product noun (the thing being demoted): "retire TS-as-truth",
// "TS sim … retired as the product's truth", "kept frozen as the gta7 example", "the TS SIM is
// legacy". Proximity (~40 chars) is what separates this reorg intent from a stray keyword.
const SEPARATION_RE =
  /\b(retir\w+|frozen|freeze|legacy|deprecat\w+)\b[^.\n]{0,40}?\b(as[ -](?:the[ ]+)?(?:truth|product|oracle|example)|truth|product[ ]+(?:sim|path|truth)|example|oracle)\b/i;
function declaresSeparation(body) {
  return SEPARATION_RE.test(String(body || ''));
}

export function drift(items, exists) {
  const out = [];
  const haveSeparationArea = SEPARATION_DIRS.some((d) => exists(d));
  for (const i of items) {
    if (!isInForce(i)) continue;
    const targets = new Set();
    for (const f of (i.files || [])) { const t = normPath(f); if (t && !t.includes('*')) targets.add(t); }
    const absent = [...targets].filter((t) => !exists(t));
    let reason = absent.length ? 'declared-target-absent' : '';
    if (!haveSeparationArea && declaresSeparation(i.body)) {
      for (const d of SEPARATION_DIRS) absent.push(d);
      reason = reason ? reason + '+unrealized-separation' : 'unrealized-separation';
    }
    if (absent.length) {
      out.push({
        id: i.id, store: i.store, status: i.status, reason,
        absent: [...new Set(absent)].sort().join(','),
        summary: clip(i.summary || i.title || '', SUMMARY_CLIP),
        more: i.body && i.body.length ? '✎' : '',
      });
    }
  }
  return out.sort((a, b) => storeRank(a.store) - storeRank(b.store) || compareIds(a.id, b.id));
}
