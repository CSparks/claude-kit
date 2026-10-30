// t/link.mjs — typed links between store items: `t link` writes one, `t unlink` removes it.
// Each relation names its forward field on the item the caller names; the supersede pair also
// writes its inverse on the target and retires/restores the older ticket, so the two files never
// disagree. Pure markdown mutation; the CLI main in t.mjs wraps it with the index/cache refresh.
//
//   link(root, id, rel, target)    -> { id, rel, target[, newer, older, bothSides] }
//   unlink(root, id, rel, target)  -> same shape; throws when the link is not there

import { writeFileSync } from 'node:fs';
import { field, listField } from '../frontmatter.mjs';
import { appendUnderSection, stamp } from '../md-body.mjs';
import { SHA_RE, findTicket, setField } from './ticket-file.mjs';

const ID_RE = /^[A-Za-z][A-Za-z0-9]*-[A-Za-z]?\d+$/; // KIT-T075, KIT-D032 (keys may carry digits: S2-T001)
const RETIRED = 'superseded';
const RESTORE_DEFAULT = 'todo';

// What each relation points at: another ITEM (id-shaped) or a COMMIT (sha-shaped). Nothing else is
// written. `list` relations hold many targets; the rest hold one.
const LINK_RELS = {
  supersedes: { kind: 'id' },
  superseded_by: { kind: 'id' },
  regressed_from: { kind: 'id' },
  parent: { kind: 'id' },
  link: { kind: 'id', list: 'links' },
  causing_commit: { kind: 'sha' },
  fixed_commit: { kind: 'sha' },
};

export const LINK_REL_NAMES = Object.keys(LINK_RELS);

function validate(verb, rel, target) {
  const spec = LINK_RELS[rel];
  if (!spec) throw new Error(`t ${verb}: unknown rel '${rel}' (one of: ${LINK_REL_NAMES.join(', ')})`);
  if (spec.kind === 'id' && !ID_RE.test(target)) throw new Error(`t ${verb}: '${target}' is not an id-shaped target for ${rel}`);
  if (spec.kind === 'sha' && !SHA_RE.test(target)) throw new Error(`t ${verb}: '${target}' is not a sha for ${rel}`);
  return spec;
}

const listWrite = (fm, key, values) => setField(fm, key, `[${values.join(', ')}]`);

function addToList(fm, key, value) {
  const cur = listField(fm, key);
  return cur.includes(value) ? fm : listWrite(fm, key, [...cur, value]);
}

function removeFromList(fm, key, value) {
  return listWrite(fm, key, listField(fm, key).filter((v) => v !== value));
}

const save = (t, fm, rest = t.parts.rest) => writeFileSync(t.path, t.parts.open + fm + t.parts.close + rest);

// Normalize a supersede link to (newer supersedes older) whichever side was named.
function supersedePair(root, id, rel, target) {
  const named = rel === 'supersedes';
  const newer = named ? id : target;
  const older = named ? target : id;
  return { newer, older, nt: findTicket(root, newer), ot: findTicket(root, older) };
}

export function link(root, id, rel, target) {
  const spec = validate('link', rel, target);
  const t = findTicket(root, id);
  if (!t.parts) throw new Error(`${id}: no frontmatter block`);

  if (spec.list) {
    save(t, addToList(t.parts.fm, spec.list, target));
    return { id, rel, target };
  }

  if (rel === 'supersedes' || rel === 'superseded_by') {
    const { newer, older, nt, ot } = supersedePair(root, id, rel, target);
    save(nt, setField(nt.parts.fm, 'supersedes', older));
    const prior = field(ot.parts.fm, 'status') || RESTORE_DEFAULT;
    const ofm = setField(setField(ot.parts.fm, 'superseded_by', newer), 'status', RETIRED);
    save(ot, ofm, appendUnderSection(ot.parts.rest, 'History', `- [${stamp()}] (status) ${prior} → ${RETIRED} (by ${newer})`));
    return { id, rel, target, newer, older, bothSides: true };
  }

  save(t, setField(t.parts.fm, rel, target));
  return { id, rel, target };
}

// The status the older ticket held before the last `→ superseded` History line; todo when unrecorded.
function priorStatus(rest) {
  const froms = [...rest.matchAll(new RegExp(`\\(status\\) (\\S+) → ${RETIRED}\\b`, 'g'))].map((m) => m[1]);
  return froms.filter((s) => s !== RETIRED && s !== '—').pop() || RESTORE_DEFAULT;
}

function unlinkSupersede(root, id, rel, target) {
  const { newer, older, nt, ot } = supersedePair(root, id, rel, target);
  const forward = field(nt.parts.fm, 'supersedes') === older;
  const inverse = field(ot.parts.fm, 'superseded_by') === newer;
  if (!forward && !inverse) throw new Error(`t unlink: ${newer} does not supersede ${older} — no such link to remove`);
  if (forward) save(nt, setField(nt.parts.fm, 'supersedes', ''));
  if (inverse) {
    let ofm = setField(ot.parts.fm, 'superseded_by', '');
    let note = `- [${stamp()}] (unlink) superseded_by ${newer}`;
    if (field(ofm, 'status') === RETIRED) {
      const restored = priorStatus(ot.parts.rest);
      ofm = setField(ofm, 'status', restored);
      note = `- [${stamp()}] (unlink) superseded_by ${newer}; status ${RETIRED} → ${restored}`;
    }
    save(ot, ofm, appendUnderSection(ot.parts.rest, 'History', note));
  }
  return { id, rel, target, newer, older, bothSides: true };
}

export function unlink(root, id, rel, target) {
  const spec = validate('unlink', rel, target);
  if (rel === 'supersedes' || rel === 'superseded_by') return unlinkSupersede(root, id, rel, target);
  const t = findTicket(root, id);
  if (!t.parts) throw new Error(`${id}: no frontmatter block`);
  const held = spec.list ? listField(t.parts.fm, spec.list).includes(target) : field(t.parts.fm, rel) === target;
  if (!held) throw new Error(`t unlink: ${id} is not linked ${rel} ${target} — no such link to remove`);
  const fm = spec.list ? removeFromList(t.parts.fm, spec.list, target) : setField(t.parts.fm, rel, '');
  save(t, fm, appendUnderSection(t.parts.rest, 'History', `- [${stamp()}] (unlink) ${rel} ${target}`));
  return { id, rel, target };
}
