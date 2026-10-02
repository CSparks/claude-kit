// glob.mjs — the tiny glob dialect the broker's config uses: `**/` (any directories, even
// none), `**` (anything), `*` (within one path segment), `?`. Paths are `/`-separated.

const ESCAPE = /[.+^${}()|[\]\\]/g;

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(ESCAPE, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export const matchesAny = (globs, path) => globs.some((g) => globToRegExp(g).test(path));
