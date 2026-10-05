# The action happened twice

Revision 1. Source review: October 5, 2026. Deterministic fixture, not a model benchmark.

## Question

What happens when a ticket is committed, but the caller never receives the response? A timeout alone does not tell the caller whether work happened.

## Experiment

Start with an empty ticket store. Create a ticket. Drop the first successful response after commit. The broken caller repeats the request without an operation key: two tickets exist. The repaired caller supplies the same key on both attempts: the service returns the original ticket.

The assessment reads the ticket store. It does not trust the returned ticket ID alone. Both callers make two calls; only one preserves the intended effect count.

## Try it

```sh
node dist/cli.js duplicate-action --variant broken
node dist/cli.js duplicate-action --variant repaired
npx vitest run examples/duplicate-action.test.ts
```

The explicit broken command exits 1. The teaching test expects the reproduced bug and succeeds.

## Production limits

Idempotency is a service contract, not magic attached to a request header. This fixture checks conflicting payloads but keeps keys in memory. Durable production implementations need a transaction/unique constraint, scope boundaries, concurrent replay handling, retention policy and crash recovery. Different keys for the same business action may still duplicate that action. Unknown outcomes may require reconciliation instead of retry.

Reference: [Stripe's idempotent request contract](https://docs.stripe.com/api/idempotent_requests). Its exact retention and response behavior is provider-specific; the fixture is not a Stripe implementation.
