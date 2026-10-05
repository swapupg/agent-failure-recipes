# Adapt a recipe without losing the test

1. Run the unmodified recipe and inspect the broken outcome.
2. Identify the invariant: a count of committed actions, an existing artifact, or allowable call times.
3. Replace the fixture adapter with your service in a **disposable integration environment**. Keep the fault injection and independent assertion. Never point destructive test tools at customer resources.
4. Read the result from the service's authoritative store or API. An agent's text, an accepted response or a success toast is not the state assertion.
5. Show the test failing against the broken implementation and passing with the repair. Keep this test in your normal suite.

## Boundaries you must supply

- **Idempotency:** use one stable key for one intended operation, scoped to tenant and endpoint. Persist the key and effect atomically. Reject changed payloads. Define retention and replay behavior. Our single-process Map does not establish database or multi-worker correctness.
- **Network errors:** `RESPONSE_LOST` is a known injected fault here. A real network timeout has an unknown outcome; translate errors carefully. Retry writes only with server support or reconcile first. The loopback test's error translation is test-specific.
- **Completion:** persist the job ID. Require a trusted terminal status and fetch/validate the artifact. Set a deadline on every network call; the polling helper cannot interrupt a custom adapter that never settles. Cover failure, cancellation, missing objects and authorization.
- **Retries:** the example is a read. Parse Retry-After from seconds or an HTTP date into milliseconds before using the helper. Retry only defined transient errors; propagate permanent ones. Introduce independently randomized production jitter and an overall deadline. Cap retries across layers, not just inside one helper.
- **Time:** inject a Clock. `createVirtualClock()` advances logical time immediately and never sleeps in real time. It is for deterministic tests, not production scheduling. A real clock must provide cancellable sleep and monotonic elapsed time.
- **Permissions:** these public educational fixtures have no users or tenancy. Your tool service must enforce permissions independently of model instructions.

## API map

| Export | Contract |
|---|---|
| `runRecipe(id, variant)` | Fresh revision-1 fixture run; ordered trace and independent assessment. |
| `createTicketFixture()` | In-memory create/snapshot with key conflict detection. |
| `dropFirstResponse(tool)` | Drops the first successful response after the wrapped operation resolves. Failed operations do not consume the fault. |
| `createTicketSafely(tool, input)` | At most two attempts, same required key, retries only RESPONSE_LOST. |
| `createReportFixture(clock, outcome)` | Accepted at 0 ms, running at 100 ms, terminal at 300 ms; optional stuck/failed/cancelled outcomes. |
| `waitForReport(status, id, clock, options)` | Bounded polling, terminal-failure handling, job identity and artifact checks. Adapters must bound individual requests. |
| `createRateLimitFixture(clock, availableAtMs)` | Records call times; returns RateLimitError until availability. |
| `readWithBackoff(read, clock, options)` | Attempt/deadline budget, Retry-After floor, capped exponential delay and injectable jitter. |

Copyable examples import from `../src/index.js` within a clone. When installing the built package, change that import to `agent-failure-recipes`. The browser only executes bundled recipes. It does not run arbitrary uploaded code.
