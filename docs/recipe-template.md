# Recipe proposal: [short name]

- Stable ID and new revision:
- Engineering question:
- Initial state and authoritative record:
- Controlled fault and exact injection point:
- Broken behavior and independently observable failure:
- One repair and why it changes the outcome:
- Invariant (same for both variants):
- Bounded termination, cancellation and failure behavior:
- Copyable test and adapter replacement points:
- Source references and source-review date:
- Production limitations / what this does not establish:
- Browser, CLI and contract-test evidence:

Add a minimal fixture and tests before extending the UI. Avoid external services, secrets, wall-clock dependence and unseeded randomness in a deterministic recipe. Use virtual time. Keep state local to one run.
