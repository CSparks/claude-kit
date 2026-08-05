#!/bin/sh
# Is Git LFS enabled for THIS repo? (KIT — per-repo gate)
#
# LFS is a kit-level capability but a PER-REPO decision: it bills against the
# repo owner's account quota and a wrong call is expensive to unwind (deleting
# objects does not refund the month). So the shared hooks below never assume
# it — they ask here first.
#
# The gate is the repo's own `.gitattributes` declaring an lfs filter. That is
# the one place LFS is genuinely configured, so it cannot drift from reality
# the way a duplicate flag in a config file would.
#
# Sourced, not executed. Sets LFS_ON=1 when this repo is opted in AND the
# git-lfs binary exists. Fails open: any doubt leaves LFS_ON unset and the
# calling hook simply does its own work.

LFS_ON=

_repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || _repo_root=

if [ -n "$_repo_root" ] && [ -f "$_repo_root/.gitattributes" ]; then
  if grep -q 'filter=lfs' "$_repo_root/.gitattributes" 2>/dev/null; then
    if command -v git-lfs >/dev/null 2>&1; then
      LFS_ON=1
    else
      printf >&2 '%s\n' \
        "warning: this repo tracks files with Git LFS but 'git-lfs' is not on your PATH." \
        "         Large files will check out as pointer text. Install git-lfs, then run:" \
        "           git lfs pull"
    fi
  fi
fi

unset _repo_root
