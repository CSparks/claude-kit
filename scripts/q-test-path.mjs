// q-test-path.mjs — is a repo-relative path a test file? Backs `q code|sym|file --test` (tests only)
// and `--not-test` (everything but): a `tests`/`test`/`__tests__`/`spec` directory, or a file named
// `test_x.py`, `x_test.rs`, `x.test.mjs`, `x.nodetest.mjs`, `x.spec.ts`.

const TEST_DIR = /(?:^|\/)(?:tests?|__tests__|specs?)\//i;
const TEST_FILE = /(?:^|\/)(?:test_[^/]*|[^/]*(?:[._-](?:node)?tests?|\.spec)\.[^/.]+)$/i;

export const isTestPath = (rel) => TEST_DIR.test(rel) || TEST_FILE.test(rel);
