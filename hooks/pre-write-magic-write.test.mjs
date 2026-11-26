// pre-write `magic-numbers` (KIT-T1602): a bare literal is judged the same whether it arrives by Write (a new or a
// replaced file) or by Edit. Run: node hooks/pre-write-magic-write.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, repo as plainRepo, reporter } from './test-harness.mjs';

const { ok, done } = reporter('pre-write-magic-write');
const BLOCK = 2;
const ICON = '      <Circle size={10} aria-hidden />';
const PLACEHOLDER = '      <Circle size={ICON_SIZE} aria-hidden />';
const body = (line) => `import { Circle } from "lucide-react";\n\nexport function SessionStatus() {\n  return (\n    <span>\n${line}\n    </span>\n  );\n}\n`;

try {
  for (const [kind, repo] of [['an adopted repo', adopted(false)], ['a git repo with no .ai store', plainRepo()]]) {
    mkdirSync(join(repo, 'src', 'patterns'), { recursive: true });
    const file = join(repo, 'src', 'patterns', 'SessionStatus.tsx');
    const run = (tool_name, tool_input) => hook('pre-write.mjs', { tool_name, tool_input: { file_path: file, ...tool_input } }, repo);
    const magic = (r) => r.code === BLOCK && r.out.includes('Magic numbers');

    ok(`${kind}: a Write of a new .tsx with a bare icon size blocks`, magic(run('Write', { content: body(ICON) })));
    writeFileSync(file, body(PLACEHOLDER));
    ok(`${kind}: an Edit putting the same literal in blocks`, magic(run('Edit', { old_string: PLACEHOLDER, new_string: ICON })));
    ok(`${kind}: a Write replacing the existing file with the literal blocks`, magic(run('Write', { content: body(ICON) })));
    ok(`${kind} control: the named constant passes on Write`, run('Write', { content: `const ICON_SIZE = 10;\n${body(PLACEHOLDER)}` }).code === 0);
  }

  const repo = plainRepo();
  mkdirSync(join(repo, 'src'), { recursive: true });
  const write = (content) => hook('pre-write.mjs', { tool_name: 'Write', tool_input: { file_path: join(repo, 'src', 'S.tsx'), content } }, repo);
  const ROW = 'export const STATES = {\n  blocked: { accent: "var(--a)", icon: <CircleAlert size={14} aria-hidden="true" />, label: "Needs you" },\n};\n';
  const rowWrite = write(ROW);
  ok('KIT-T1602: a key-value row carrying <Icon size={14} /> blocks (the fleet-desktop SessionStatus.tsx Write)', rowWrite.code === BLOCK && rowWrite.out.includes('size={14}'));
  ok('KIT-T1602: a magic literal after a trivial one on the same line blocks', write('export function f(g) {\n  return g(0, 14);\n}\n').code === BLOCK);
  ok('KIT-T1602 control: named values on a row still pass ({ retries: 3, delays: [100, 200] })', write('export function f(g) {\n  return g({ retries: 3, delays: [100, 200] });\n}\n').code === 0);
  ok('KIT-T1602 control: declarations still name their values (const, let, destructuring)', write('const ICON = 14;\nlet sizes = [12, 14];\nconst [a, b] = [12, 14];\n').code === 0);
  ok('KIT-T1602 control: an assignment of a bare value still passes', write('export function f(opts) {\n  opts.timeout = 5000;\n}\n').code === 0);
} finally {
  cleanup();
}
done();
