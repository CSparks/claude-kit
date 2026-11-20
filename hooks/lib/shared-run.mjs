// shared-run.mjs — the longest run of consecutive words two texts share (KIT-T1451). A restatement repeats a phrase; loose
// topic overlap scatters single words, so the questionnaire gates ask for a run before they call a text a restatement.
//
//   longestSharedRun(a, b) -> number of words in the longest common run (case-insensitive, letters and digits)

const wordList = (text) => String(text ?? '').toLowerCase().match(/[a-z0-9]+/g) || [];

export function longestSharedRun(a, b) {
  const x = wordList(a);
  const y = wordList(b);
  let best = 0;
  let prev = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const row = new Array(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) {
        row[j] = prev[j - 1] + 1;
        if (row[j] > best) best = row[j];
      }
    }
    prev = row;
  }
  return best;
}
