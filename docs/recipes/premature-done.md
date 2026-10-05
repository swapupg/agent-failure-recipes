# “Accepted” is not “done”

Revision 1. Source review: October 5, 2026. Deterministic fixture, not a model benchmark.

## Question

Can the agent prove the report exists before it announces completion?

## Experiment

Submit a report job. It is accepted immediately, running at virtual 100 ms and completed at 300 ms. The broken caller announces success at time zero: no artifact exists. The repaired caller checks status until the completed job includes its report.

The invariant is checked against job state and the artifact at the moment of the claim. The tests also exercise failed, cancelled, stuck and falsely completed jobs.

## Try it

```sh
node dist/cli.js premature-done --variant broken
node dist/cli.js premature-done --variant repaired
npx vitest run examples/premature-done.test.ts
```

## Production limits

Actual jobs need persisted IDs, authenticated reads, bounded network calls, failure handling and cancellation policy. A polling deadline is not a timeout for an adapter that never resolves. An artifact's existence does not prove correctness of its content. A response that says completed but returns no report is rejected.

Reference: [Microsoft's asynchronous request-reply pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/async-request-reply). Accepted, pending and completed are separate states; adapt to the service's actual status contract.
