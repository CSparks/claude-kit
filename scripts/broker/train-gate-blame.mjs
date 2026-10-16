// train-gate-blame.mjs — pin a refused pre-push gate on a train member (KIT-T535). The gate runs
// once over every landing commit; when its log names the file one member patched (path or file
// name), that member is the culprit. `gateBlame(log, members)` → the blamed members, or [] when
// the log names none, or every member (no information).
//   members = [{ job, files: [path] }].

const BACKSLASH = String.fromCharCode(92);
const posix = (p) => String(p).split(BACKSLASH).join('/');
const escape = (s) => s.replace(/[.*+?^${}()|[\]]/g, '\$&');

const named = (log, file) => {
  const path = posix(file);
  const base = path.slice(path.lastIndexOf('/') + 1);
  return new RegExp(`(^|[^\w.-])(${escape(path)}|${escape(base)})($|[^\w.-])`, 'm').test(log);
};

export function gateBlame(log, members) {
  const hit = members.filter((m) => m.files.some((f) => named(String(log), f)));
  return hit.length === members.length ? [] : hit;
}
