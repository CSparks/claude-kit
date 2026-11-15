// The one route for vendoring an unmodified third-party tree into a repo (check-id source-shell-write, KIT-T1218): the
// tree's folder is listed in .claude-kit-ignore.yaml, so the shell gate lets `cp -r` land it and pre-write lets one Edit
// patch an over-long file of it. Shared by the gate's block text and `q gates source`.
//
//   VENDOR_ROUTE -> the lines naming the route, no indent

export const VENDOR_ROUTE = [
  'Vendoring a third-party tree verbatim (a crate copied from the cargo registry into patches/), when the maintainer asked for it:',
  'list its folder once in the .claude-kit-ignore.yaml at the root of the repo that holds it (a submodule has its own):',
  '    "*":',
  '      - rust/patches/**',
  'Every check then skips that folder: cp -r copies it and an Edit patches its over-long files. Commit the entry with the tree.',
  'Ordinary source stays gated.',
];
