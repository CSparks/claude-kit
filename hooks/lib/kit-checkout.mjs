// kit-checkout.mjs — is a directory the claude-kit checkout (its package.json is named claude-kit). Several live sessions
// there is normal (KIT-D155), so the commit-foreign gate judges it per file, not per tree. The checkout-holder guard judges
// every checkout per file (KIT-T1114).
//
//   isKitCheckout(tree) -> true when tree/package.json names claude-kit

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const KIT_PACKAGE = 'claude-kit';

export function isKitCheckout(tree) {
  try {
    return JSON.parse(readFileSync(join(tree, 'package.json'), 'utf8')).name === KIT_PACKAGE;
  } catch {
    return false;
  }
}
