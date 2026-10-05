import { createVirtualClock, createTicketFixture, dropFirstResponse, createReportFixture, createRateLimitFixture, RateLimitError, ToolError, type Clock, type TicketInput } from './fixtures.js';
import { createTicketSafely, waitForReport, readWithBackoff } from './repairs.js';

export const recipeIds = ['duplicate-action', 'premature-done', 'retry-storm'] as const;
export type RecipeId = typeof recipeIds[number];
export type Variant = 'broken' | 'repaired';
export interface TraceEvent { step: number; atMs: number; actor: 'Agent' | 'Tool' | 'Check'; detail: string; state: Record<string, unknown> }
export interface RecipeResult {
  schemaVersion: 1; recipe: RecipeId; revision: 1; variant: Variant;
  events: TraceEvent[]; state: Record<string, unknown>;
  check: { passed: boolean; invariant: string; evidence: string };
}
export interface RecipeInfo {
  id: RecipeId; number: string; title: string; tagline: string; question: string; failure: string; repair: string;
  invariant: string; limitation: string; adaptation: string; sources: { title: string; url: string }[];
}
export const recipes: RecipeInfo[] = [
  {
    id: 'duplicate-action', number: '01', title: 'The action happened twice', tagline: 'Lost response · duplicate ticket',
    question: 'What if the tool succeeds, but your agent never hears back?',
    failure: 'A support ticket is committed. The response is lost. The agent retries without an operation key and creates a second ticket.',
    repair: 'Reuse one idempotency key for the same intended action. The fixture service returns the ticket it already committed.',
    invariant: 'Exactly one ticket exists for this intended action.',
    limitation: 'Idempotency needs server support. This in-memory fixture does not survive process restarts. Production services need atomic persistence, scoped keys, payload conflict checks and a documented retention window. A retry key does not make an unsupported API safe.',
    adaptation: 'Replace fixture.create with your ticket adapter against a disposable service. Keep the response-drop wrapper. Read the service database or an authoritative list endpoint to count committed tickets.',
    sources: [{ title: 'Stripe: idempotent requests', url: 'https://docs.stripe.com/api/idempotent_requests' }],
  },
  {
    id: 'premature-done', number: '02', title: '“Accepted” is not “done”', tagline: 'Async job · missing report',
    question: 'What if the agent announces a report before the report exists?',
    failure: 'The report tool accepts the request. The agent treats that acknowledgement as completion while the authoritative job is still pending.',
    repair: 'Poll the job status within a deadline, handle terminal failures, and require the report artifact before announcing completion.',
    invariant: 'A completion claim is backed by a completed job and a report artifact.',
    limitation: 'The fixture uses a virtual clock. Real adapters need request-level timeouts, authenticated status and artifact reads, cancellation policy and durable job IDs. A completed status alone does not establish that report contents are correct.',
    adaptation: 'Replace status with your job-status adapter, preserve the job ID, and verify the output exists in the actual artifact store. Test failed, cancelled and permanently pending jobs too.',
    sources: [{ title: 'Microsoft: asynchronous request-reply pattern', url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/async-request-reply' }],
  },
  {
    id: 'retry-storm', number: '03', title: 'The retry makes it worse', tagline: 'Rate limit · exhausted attempts',
    question: 'What if every immediate retry arrives while the service is still unavailable?',
    failure: 'The inventory service requests a 300 ms pause. Four immediate attempts all fail at virtual time zero, exhausting the retry budget.',
    repair: 'Respect Retry-After, add capped exponential backoff, and enforce attempt and elapsed-time budgets. The fixture waits before its next read.',
    invariant: 'The read succeeds within four attempts without retrying before the service allows it.',
    limitation: 'This is one caller against a deterministic fixture, not a load benchmark. The demo injects fixed jitter for reproducibility. Production fleets need independently randomized jitter, a shared retry budget, request timeouts and possibly load shedding. Retry only safe operations.',
    adaptation: 'Map your client’s rate-limit response into RateLimitError, preserve Retry-After, and supply a real clock with cancellable sleep. Keep permanent errors non-retryable and test multiple callers separately.',
    sources: [{ title: 'AWS Builders’ Library: timeouts, retries and backoff with jitter', url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/' }],
  },
];

export function isRecipeId(value: string): value is RecipeId { return recipeIds.some(id => id === value); }

export async function runRecipe(id: RecipeId, variant: Variant): Promise<RecipeResult> {
  if (!isRecipeId(id) || !['broken', 'repaired'].includes(variant)) throw new ToolError('INVALID_INPUT', 'Unknown recipe or variant');
  const info = recipes.find(recipe => recipe.id === id)!;
  const clock: Clock = createVirtualClock();
  const events: TraceEvent[] = [];
  const record = (actor: TraceEvent['actor'], detail: string, state: Record<string, unknown>) => {
    events.push({ step: events.length + 1, atMs: clock.now(), actor, detail, state: structuredClone(state) });
  };
  let state: Record<string, unknown>;
  let passed: boolean;
  let evidence: string;
  if (id === 'duplicate-action') {
    const service = createTicketFixture();
    let calls = 0;
    const transport = dropFirstResponse(async (input: TicketInput) => {
      calls++;
      record('Agent', `Create ticket${input.key ? ` with key ${input.key}` : ' without a key'}`, { tickets: service.snapshot(), calls });
      const ticket = await service.create(input);
      record('Tool', calls === 1 ? 'Ticket committed; response will be lost' : 'Return ticket to caller', { tickets: service.snapshot(), calls });
      return ticket;
    });
    const observed = async (input: TicketInput) => {
      try { return await transport(input); }
      catch (error) {
        if (error instanceof ToolError && error.code === 'RESPONSE_LOST') record('Tool', 'Response lost after commit', { tickets: service.snapshot(), calls });
        throw error;
      }
    };
    if (variant === 'repaired') await createTicketSafely(observed, { title: 'Help with order 42', key: 'order-42-support-1' });
    else {
      try { await observed({ title: 'Help with order 42' }); }
      catch (error) { if (!(error instanceof ToolError) || error.code !== 'RESPONSE_LOST') throw error; await observed({ title: 'Help with order 42' }); }
    }
    state = { tickets: service.snapshot(), calls };
    passed = service.snapshot().length === 1;
    evidence = `${service.snapshot().length} committed ticket${passed ? '' : 's'} after ${calls} calls.`;
  } else if (id === 'premature-done') {
    const service = createReportFixture(clock);
    const accepted = await service.submit();
    record('Tool', 'Request accepted; report not yet created', { ...accepted, claimedDone: false });
    if (variant === 'repaired') await waitForReport(service.status, accepted.id, clock, {
      onStatus: job => record('Agent', `Verify authoritative status: ${job.status}`, { ...job, claimedDone: false }),
    });
    state = { ...service.snapshot(), claimedDone: true };
    record('Agent', 'Announce completion', state);
    passed = service.snapshot().status === 'completed' && Boolean(service.snapshot().artifact);
    evidence = passed ? 'Completed job and report artifact exist at the completion claim.' : 'Agent claimed completion; job is accepted and no report exists.';
  } else {
    const service = createRateLimitFixture(clock);
    let value: string | null = null;
    const read = async () => {
      record('Agent', 'Read inventory', { ...service.snapshot(), value });
      try { const response = await service.read(); record('Tool', 'Inventory returned', { ...service.snapshot(), value: response }); return response; }
      catch (error) { record('Tool', 'Rate limited: wait 300 ms from initial request', { ...service.snapshot(), value }); throw error; }
    };
    if (variant === 'repaired') value = await readWithBackoff(read, clock, { jitter: () => 25, onRetry: delay => record('Agent', `Wait ${delay} ms before retry`, { ...service.snapshot(), value }) });
    else for (let attempt = 0; attempt < 4; attempt++) {
      try { value = await read(); break; } catch (error) { if (!(error instanceof RateLimitError)) throw error; }
    }
    const snapshot = service.snapshot();
    state = { ...snapshot, value, elapsedMs: clock.now() };
    passed = value !== null && snapshot.calls.length <= 4 && snapshot.calls.slice(1).every(time => time >= snapshot.availableAtMs);
    evidence = `${snapshot.calls.length} calls at [${snapshot.calls.join(', ')}] ms; ${value ? 'inventory returned' : 'no result'}.`;
  }
  record('Check', `${passed ? 'PASS' : 'FAIL'}: ${evidence}`, state);
  return { schemaVersion: 1, recipe: id, revision: 1, variant, events, state, check: { passed, invariant: info.invariant, evidence } };
}
