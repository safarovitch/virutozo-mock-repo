// HOOK-3 · AGENTS.md H4 — logic for guard-tests.mjs (pure functions, unit-tested).

/**
 * Remove string literals ('…', "…", `…`) and comments (// …, /* … *\/) from JS/TS source,
 * so patterns that only appear in test data, titles or comments don't count (D1-15).
 * Template literals are removed whole, including `${…}`; regex literals aren't recognised.
 */
export function stripStringsAndComments(src) {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? src.length : end - 1;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      i = j;
      out += c + c;
      continue;
    }
    out += c;
  }
  return out;
}

const EXPECT_RE = /\bexpect(\.soft)?\s*\(/g;
const SKIP_RE = /\b(it|test|describe)\s*\.\s*(skip|only|todo|fixme)\b|\bx(it|describe)\s*\(/g;
const SNAPSHOT_RE = /\.\s*to(Match|MatchInline)Snapshot\s*\(/g;

const count = (s, re) => (s.match(re) ?? []).length;

/** Returns the list of ways `after` weakens `before` (empty = fine). */
export function findProblems(before, after) {
  const problems = [];
  const lostExpects = count(before, EXPECT_RE) - count(after, EXPECT_RE);
  if (lostExpects > 0) problems.push(`removes ${lostExpects} expect() assertion(s)`);

  const codeBefore = stripStringsAndComments(before);
  const codeAfter = stripStringsAndComments(after);
  if (count(codeAfter, SKIP_RE) > count(codeBefore, SKIP_RE)) problems.push('adds .skip/.only/.todo/.fixme');
  if (count(codeAfter, SNAPSHOT_RE) > count(codeBefore, SNAPSHOT_RE)) problems.push('adds a snapshot assertion'); // D1-18
  return problems;
}
