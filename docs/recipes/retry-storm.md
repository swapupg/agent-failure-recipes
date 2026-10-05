# The retry makes it worse

Revision 1. Source review: October 5, 2026. Deterministic fixture, not a load benchmark.

## Question

Does retrying give a busy service time to recover, or consume the whole budget before it can respond?

## Experiment

The inventory service allows a read at virtual 300 ms. The broken caller makes four attempts at time zero: all fail. The repair respects the service's Retry-After delay, so its second call succeeds at 300 ms. Both variants have a four-attempt ceiling.

The policy also includes capped exponential delay and injected jitter. Retry-After dominates the delay in this particular recipe. Separate tests exercise exponential growth, the cap, jitter, persistent failure, permanent errors, cancellation and deadline exhaustion.

## Try it

```sh
node dist/cli.js retry-storm --variant broken
node dist/cli.js retry-storm --variant repaired
npx vitest run examples/retry-storm.test.ts
```

## Production limits

This one-caller example shows premature retries, not a fleet-scale storm or a throughput improvement. Jitter is fixed in the demo so links reproduce the same trace. Production callers need independently randomized jitter, bounded network calls and an overall budget. Retry safe operations only; writes require an idempotency or reconciliation contract. Do not layer independent retry loops without accounting for their multiplied attempts.

Reference: [AWS Builders' Library: timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/).
