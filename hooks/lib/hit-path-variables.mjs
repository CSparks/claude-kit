// hit-path-variables.mjs — the path a shell write names, with the variables the command assigns expanded (KIT-T1345).
// `D=target/perf/aa; cat > $D/find_apex.py <<'EOF'` writes below target/, not to a file named `$D/find_apex.py`: the
// source-shell gate judges the resolved path. Only an assignment the command proves (shell-variables.mjs assignedValues)
// expands; anything else stays as written and is judged fail-closed.
//
//   hitPathResolver(command, shell) -> (found) -> path     `found` is a shellSourceWrites hit

import { segments } from './shell-segments.mjs';
import { assignedValues, expandVariables } from './shell-variables.mjs';

const VARIABLE = /\$\{?[A-Za-z_]/;

export function hitPathResolver(command, shell) {
  let parts = null;
  let values = null;
  return (found) => {
    const path = String(found.path || '');
    if (!VARIABLE.test(path)) return path;
    parts ??= segments(command, { shell });
    values ??= assignedValues(parts, shell);
    return expandVariables(`"${path}"`, values.get([...parts][found.segment]), shell).slice(1, -1);
  };
}
