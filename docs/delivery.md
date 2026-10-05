# Initial delivery evidence

Authorized endpoint: public open-source repository and verified GitHub Pages deployment, requested October 5, 2026. Scope: Agent Failure Recipes under swapupg, independent static hosting. No social publication or existing-site changes.

## Local verification

| Capability | Status | Evidence | Remaining risk |
|---|---|---|---|
| Three recipes and independent assertions | Tested | 31 passing Vitest unit, example and loopback HTTP tests | Fixtures are in memory, not durable production services |
| Browser journeys | Verified locally | 32 passing Playwright runs across Chromium, Firefox, WebKit and mobile Chromium viewport | Physical devices and manual screen readers unverified |
| Keyboard regression | Tested | 20 additional passing keyboard runs | macOS WebKit uses Option+Tab native link navigation |
| Package and CLI | Tested | Packed install in empty project, exports, exit codes 0/1/2 | npm registry publishing outside scope |
| Dependencies | Tested | npm audit: zero vulnerabilities on October 5, 2026 | Future advisories need rechecking |
| Visual/accessibility | Verified locally | Desktop, mobile and dark screenshots inspected; axe light/dark scans pass | No blanket accessibility certification |
| JavaScript size | Tested | 8,187 gzip bytes, under 100 KB budget | CI records exact artifact size |
| Public deployment | Gated by CI | Workflow verifies source, scans secrets, tests, deploys immutable artifact, checks HTTPS hashes and runs public Chromium journeys | Consult the release and workflow result for final status |

## Regression contracts

- Keyboard skip-link: Tab could arrive on Run before the asynchronous hashchange handler refocused the workbench. Invariant: keyboard focus stays on the user's next action. Fix: intercept skip navigation, focus/scroll once without changing recipe hash. Existing complete keyboard journey caught the bug; it passes five times per browser project after the fix.
- No-JavaScript test harness: Playwright's text query excluded noscript content even though the screenshot showed it. Use a scoped CSS locator and preserve the visible fallback/content assertions.
- macOS WebKit harness: default Tab skips links; Option+Tab includes them. Use the actual native navigation sequence; keep every focus and outcome assertion.
- Initial compiler/lint configuration: explicit Node types and uninitialized typed outcome variables removed setup errors; full type/lint checks pass.

## Release controls

Three substantive repair attempts per root cause; five repair pushes; one unchanged rerun only with transient evidence. At initial publication: one product focus fix, one correction per harness root cause, zero repair pushes and zero unchanged reruns. No paid services.

Final source revision, artifact digests, runtime evidence and rollback information are retained in the workflow artifacts and GitHub release. The local task also keeps its mutation intents/receipts outside this repository. Pilots, adoption and third-party service integrations remain unverified.
