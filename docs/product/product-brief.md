# Agent Failure Recipes

Authorizing owner: Swapnil Upganlawar. Approved endpoint: implementation, public open-source repository, and verified static deployment, requested October 5, 2026. Brand: Model Fieldnotes; independent of any employer or company. No social publication is authorized.

## Outcome and audience

An engineer building a tool-using agent can reproduce a dependency failure, inspect the committed state, run a repair against the same initial conditions, and adapt the invariant into their existing test suite. Educators are secondary users. Free MIT source, no accounts or model credentials.

Flagship distinction: small executable recipes rather than adopting another evaluation platform. Browser, CLI, and tests execute the same TypeScript functions. This is a deterministic fixture lab, not a model benchmark or production reliability certification.

## Launch boundary

Three recipes: duplicate action after a lost response; claiming completion after acceptance; immediate retries against a rate-limited service. Each includes broken and repaired implementations, independent state checks, a copyable Vitest example, original references and limitations. Node 24, TypeScript, zero runtime dependencies. Static browser lab on GitHub Pages at the repository path. No npm registry publication is required; clone and local package installation are supported.

Deferred: framework adapters, live models, uploaded traces, accounts, hosted agent execution, durable service implementations, additional languages, telemetry, payments, and scheduled publishing. No deferred controls in the UI.

## Journey and state

Open a recipe -> run broken -> inspect trace and state -> apply repair -> compare -> copy/download test -> run locally -> replace the tool boundary with a disposable test adapter. URL stores recipe, revision and view. Refresh/back/forward reconstruct that deterministic run. Unknown routes recover explicitly. Repeat actions start fresh fixtures; no shared mutable run state. Each run is bounded. Browser state is educational and deliberately disposable; the fixture service's state is authoritative within a run.

## Trust and operations

Public readers may run only bundled code; no arbitrary execution or network tools. Contributors submit reviewed code through pull requests. No private records, auth, database, notifications or paid services. The static site and package are release artifacts from one passing commit. CI checks source, tests, packaged install, browser journeys, accessibility scan, dependency audit and artifact size. Smoke verifies exact production revision and full browser journey. Git retains source; Actions retains release artifacts and hashes. Rollback revalidates and deploys a previous verified ref. Initial release can be unpublished if necessary without affecting Model Fieldnotes.

## Alternatives, reviewed 2026-10-05

- https://github.com/karthikrshet/agent-reliability: broader fault injection, state checks and CI platform. Our scope is copyable small recipes, not capability parity.
- https://github.com/Shopify/toxiproxy: transport fault testing; our examples teach application-level invariants alongside transport failures.
- https://github.com/swapupg/agent-explainer: interactive conceptual simulations; these recipes expose runnable code and adaptation points.

## Assumptions and success

TypeScript and one test framework minimize initial maintenance; validate with contributors before adding languages. No paid infrastructure. Initial usability target: five builders can run a recipe, explain the repair, and adapt a test; actual pilot results remain unverified until observed. Stars are an aspiration, not a release gate. Static hosting capacity is provider-managed; no throughput/uptime guarantee is made.
