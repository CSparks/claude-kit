// Which dependency-source tree a grep/rg command targets (KIT-T392): the cargo registry
// (…/registry/src/<index>/<crate-version>/…) or a repo's vendor dir (…/vendor/<crate>/…).
// `q code|sym --registry <spec>` answers those searches, so the query gate names it.
//
//   registryTarget(command) -> { spec } | null     spec is null when the crate is not named
//   registryLine(spec, pattern, qPath) -> the exact `q code … --registry …` command
//
// A path that ends in a file (…/src/lib.rs) is a targeted look, not a search of the crate: null.

const REGISTRY = /(?:^|\/)registry\/src(?:\/[^/]+(?:\/([^/]+))?(\/.*)?)?$/;
const VENDOR = /(?:^|\/)vendor(?:\/([^/]+))?(\/.*)?$/;
const FILE_TAIL = /\.[A-Za-z0-9]{1,6}$/;
const PLACEHOLDER = '<crate-version>';

const pathTokens = (command) => (command.match(/"[^"]*"|'[^']*'|\S+/g) || [])
  .map((t) => t.replace(/^["']|["']$/g, '').replace(/\\/g, '/'))
  .filter((t) => !t.startsWith('-') && t.includes('/') && !t.includes('node_modules/'));

export function registryTarget(command) {
  for (const t of pathTokens(command)) {
    const m = REGISTRY.exec(t) || VENDOR.exec(t);
    if (!m) continue;
    const [, crate, tail] = m;
    if (tail && FILE_TAIL.test(tail)) continue;
    return { spec: crate && !/[*?]/.test(crate) ? crate : null };
  }
  return null;
}

const quote = (s) => (/^[\w.-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

export function registryLine(spec, pattern, qPath) {
  return `node "${qPath}" code ${pattern ? quote(pattern) : '<text>'} --registry ${spec || PLACEHOLDER}`;
}
