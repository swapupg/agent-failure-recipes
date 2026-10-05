# Contributing

Start small: improve an explanation, add an original source, fix accessibility, or add a focused test. For a new recipe, open a scenario proposal first so its failure, invariant and maintenance scope are clear.

1. Use Node 24 and `npm ci`.
2. Copy the [recipe template](docs/recipe-template.md).
3. Add a small fixture or reuse the existing ones, a broken implementation, a bounded repair and an independent state assertion.
4. Add a copyable Vitest example and documentation with sources, revision and limits. Browser code must not make real tool/model calls.
5. Run `npm run check`, `npm audit --audit-level=high`, and the browser suite after `npx playwright install --with-deps chromium firefox webkit`.
6. Open a pull request explaining the invariant and evidence. Do not include personal/customer data, employer code, secrets or unsupported benchmark claims.

Published recipe revisions are immutable learning contracts. Preserve old links when changing behavior; a new revision needs a new route and tests. A refactor may retain a revision only if traces and behavior stay compatible. Source formatting/corrections that do not affect meaning may be fixed in place.

Do not disable assertions to make a test pass. The broken example should reproduce a bug; the repaired example must satisfy the same invariant. Test fresh runs, independent concurrent fixtures, terminal failures and invalid inputs. Keep integration dependencies optional and clearly separate from deterministic examples.
