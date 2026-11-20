// msysToNative maps a Git Bash path to the native path a Node process reads (KIT-T1444).
// Run: node hooks/msys-path.test.mjs

import { toPath } from './lib/shell-segments.mjs';
import { msysToNative } from './lib/msys-path.mjs';
import { reporter } from './test-harness.mjs';

const { ok, done } = reporter('msys-path');
const win = { platform: 'win32', temp: 'C:\\Users\\x\\AppData\\Local\\Temp' };
const posix = { platform: 'linux', temp: '/tmp' };

ok('/tmp/x maps to the Windows temp dir', msysToNative('/tmp/a/b.txt', win) === 'C:/Users/x/AppData/Local/Temp/a/b.txt');
ok('bare /tmp maps to the temp dir', msysToNative('/tmp', win) === 'C:/Users/x/AppData/Local/Temp');
ok('/c/x maps to c:/x', msysToNative('/c/x/y', win) === 'c:/x/y' && msysToNative('/d/x', posix) === 'd:/x');
ok('control: /tmpfoo and /var/tmp are not /tmp', msysToNative('/tmpfoo/x', win) === '/tmpfoo/x' && msysToNative('/var/tmp/x', win) === '/var/tmp/x');
ok('control: /tmp stays on a POSIX host', msysToNative('/tmp/x', posix) === '/tmp/x');
ok('control: a Windows path and a relative path pass through', msysToNative('C:/a/b', win) === 'C:/a/b' && msysToNative('a/b', win) === 'a/b');
ok('toPath strips quotes and maps through the same rule', toPath('"/c/x"') === 'c:/x');

done();
