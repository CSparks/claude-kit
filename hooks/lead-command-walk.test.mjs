// lead-command-walk.mjs word cleaning: a quoted operand keeps its `>`/`<`, a variable keeps its `$` (KIT-T1174).
// Run: node hooks/lead-command-walk.test.mjs

import { cleaned, commandRuns, withoutRedirects } from './lib/lead-command-walk.mjs';
import { reporter } from './test-harness.mjs';

const { ok, done } = reporter('lead-command-walk');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok('a redirect operand is cut: heredoc, file, fd duplication', withoutRedirects("patch -p1 <<'EOF' > out 2>&1").trim() === 'patch -p1');
ok('a quoted file name after > is cut with its redirect', withoutRedirects('echo x > "out file"').trim() === 'echo x');
ok('a > inside a double-quoted operand stays', withoutRedirects('git commit -m "a -> b > c"') === 'git commit -m "a -> b > c"');
ok('a < inside a single-quoted operand stays', withoutRedirects("grep '<tag>' f.txt") === "grep '<tag>' f.txt");
ok('a redirect after a quoted operand is cut and the operand stays', withoutRedirects('echo "a > b" > out.txt').trim() === 'echo "a > b"');

ok('a variable keeps its $: $S, ${S} and a quoted "$S"', same(cleaned(['$S/x', '${S}/y', '"$S/z"']), ['$S/x', '${S}/y', '"$S/z"']));
ok('a grouping word loses its cover: $(, (, a backtick and the closers', same(cleaned(['$(git', '(git', '`git', 'x)', 'y`']), ['git', 'git', 'git', 'x', 'y']));
ok('a lone grouping brace is dropped', same(cleaned(['{', 'git', '}']), ['git']));
ok('a ${...} word keeps its closing brace, a plain word loses a trailing one', same(cleaned(['${S}', 'x}']), ['${S}', 'x']));

ok('commandRuns reads the string a shell runs and each substitution', same(commandRuns('bash -c "git commit" $(echo hi)', 'bash').map((r) => r.text), ['git commit', 'echo hi']));
ok('control: a command that runs nothing yields no runs', commandRuns('git status', 'bash').length === 0);

done();
