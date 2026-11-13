// no-remote.mjs — a repo entry with `remote: none` (KIT-T1122): a checkout whose root repo has no git remote.
//
//   NO_REMOTE                   the config value that names it
//   hasRemote(remote)           false for `none` (and an empty name): a landing is a local commit, nothing is fetched or pushed
//   noRemoteRefusal(repo)       why a repo entry cannot be remote-less, or null: a submodule lane pushes its commit so a
//                               superproject pin can name it, and the pre-push gate runs against a remote
//
// An absent `remote` key still means `origin`: a config that omits it keeps pushing.

export const NO_REMOTE = 'none';

export const hasRemote = (remote) => Boolean(remote) && remote !== NO_REMOTE;

export function noRemoteRefusal({ name, remote, submodule, prePush }) {
  if (hasRemote(remote)) return null;
  if (submodule) return `broker.repos ${name}: remote: ${NO_REMOTE} cannot be a submodule lane; a pin names a commit that is on the submodule's remote`;
  if (prePush) return `broker.repos ${name}: pre_push: true needs a remote; the gate runs before a push and a remote-less repo pushes nothing`;
  return null;
}
