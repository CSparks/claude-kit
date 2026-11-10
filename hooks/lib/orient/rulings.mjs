// rulings.mjs — the maintainer rulings still resting in the inbox, listed ahead of every design decision (KIT-T938).
//   rulingsSection(ctx)   pushes the block when any un-promoted ruling exists; best-effort

import { unpromotedRulings } from '../inbox-rulings.mjs';
import { orientBlock } from '../ruling-messages.mjs';

export function rulingsSection({ out, root }) {
  try {
    out.push(...orientBlock(unpromotedRulings(root)));
  } catch {
    /* orientation proceeds without the rulings block */
  }
}
