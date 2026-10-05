import { describe, expect, test } from 'vitest';
import { createTicketFixture, dropFirstResponse, createTicketSafely, createVirtualClock, createReportFixture, waitForReport, createRateLimitFixture, readWithBackoff, RateLimitError, ToolError, recipeIds, runRecipe } from '../src/index.js';

describe('recipe contract', () => {
  for (const id of recipeIds) for (const variant of ['broken', 'repaired'] as const) {
    test(`${id} ${variant}: independent outcome, bounded and reproducible`, async () => {
      const first = await runRecipe(id, variant);
      expect(first.check.passed).toBe(variant === 'repaired');
      expect(first.events.length).toBeLessThanOrEqual(12);
      expect(first.events.map(event => event.step)).toEqual(first.events.map((_, i) => i + 1));
      expect(await runRecipe(id, variant)).toEqual(first);
      const parallel = await Promise.all([runRecipe(id, variant), runRecipe(id, variant)]);
      expect(parallel).toEqual([first, first]);
    });
  }
  test('trace snapshots do not change when later state changes', async () => {
    const result = await runRecipe('duplicate-action', 'broken');
    expect(result.events[0]?.state.tickets).toEqual([]);
    expect(result.state.tickets).toHaveLength(2);
  });
  test('reject unknown recipe and variant at runtime', async () => {
    // @ts-expect-error Deliberately invalid runtime caller.
    await expect(runRecipe('unknown', 'broken')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    // @ts-expect-error Deliberately invalid runtime caller.
    await expect(runRecipe('duplicate-action', 'unknown')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('idempotency and lost responses', () => {
  test('concurrent equivalent operations commit once in this fixture', async () => {
    const service = createTicketFixture();
    const input = { title: 'Order', key: 'same-operation' };
    const results = await Promise.all(Array.from({ length: 20 }, () => service.create(input)));
    expect(new Set(results.map(result => result.id)).size).toBe(1);
    expect(service.snapshot()).toHaveLength(1);
  });
  test('same key with changed payload conflicts; different intended action is separate', async () => {
    const service = createTicketFixture();
    await service.create({ title: 'One', key: 'a' });
    await expect(service.create({ title: 'Two', key: 'a' })).rejects.toMatchObject({ code: 'KEY_CONFLICT' });
    await service.create({ title: 'One', key: 'b' });
    expect(service.snapshot()).toHaveLength(2);
  });
  test('invalid input has no effect and does not consume the response-drop fault', async () => {
    const service = createTicketFixture();
    const tool = dropFirstResponse(service.create);
    await expect(tool({ title: '' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(tool({ title: 'valid', key: 'a' })).rejects.toMatchObject({ code: 'RESPONSE_LOST' });
    expect(await tool({ title: 'valid', key: 'a' })).toEqual({ id: 'ticket-1', title: 'valid' });
  });
  test('permanent errors are never blindly retried', async () => {
    let calls = 0;
    await expect(createTicketSafely(async () => { calls++; throw new ToolError('FORBIDDEN', 'denied'); }, { title: 'x', key: 'a' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(calls).toBe(1);
  });
  test('returned objects cannot mutate the authoritative fixture', async () => {
    const service = createTicketFixture();
    const ticket = await service.create({ title: 'original', key: 'k' });
    ticket.title = 'changed';
    service.snapshot()[0]!.title = 'also changed';
    expect((await service.create({ title: 'original', key: 'k' })).title).toBe('original');
  });
});

describe('completion verification', () => {
  test('accepted, running and complete are distinct states', async () => {
    const clock = createVirtualClock(); const service = createReportFixture(clock);
    expect((await service.submit()).status).toBe('accepted');
    await clock.sleep(100); expect(service.snapshot().status).toBe('running');
    await clock.sleep(200); expect(service.snapshot().status).toBe('completed');
  });
  for (const outcome of ['failed', 'cancelled'] as const) test(`stop on ${outcome}`, async () => {
    const clock = createVirtualClock(); const service = createReportFixture(clock, outcome); await service.submit();
    await expect(waitForReport(service.status, 'report-1', clock)).rejects.toMatchObject({ code: 'JOB_TERMINAL' });
    expect(clock.now()).toBe(300);
  });
  test('stuck job hits deadline without a false success', async () => {
    const clock = createVirtualClock(); const service = createReportFixture(clock, 'stuck'); await service.submit();
    await expect(waitForReport(service.status, 'report-1', clock, { timeoutMs: 350 })).rejects.toMatchObject({ code: 'DEADLINE' });
    expect(clock.now()).toBe(350); expect(service.snapshot().artifact).toBeNull();
  });
  test('completed flag alone is insufficient', async () => {
    await expect(waitForReport(async () => ({ id: 'x', status: 'completed', artifact: null }), 'x', createVirtualClock())).rejects.toMatchObject({ code: 'MISSING_ARTIFACT' });
  });
  test('wrong job, invalid poll interval and cancellation are rejected', async () => {
    const clock = createVirtualClock(); const service = createReportFixture(clock); await service.submit();
    await expect(waitForReport(service.status, 'other', clock)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(waitForReport(service.status, 'report-1', clock, { intervalMs: 0 })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(waitForReport(service.status, 'report-1', clock, { signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});

describe('retry policy', () => {
  test('exponential backoff is capped and injected jitter is observable', async () => {
    const clock = createVirtualClock(); const calls: number[] = [];
    const value = await readWithBackoff(async () => { calls.push(clock.now()); if (calls.length < 6) throw new RateLimitError(0); return 'ok'; }, clock, { maxAttempts: 6, timeoutMs: 10000, jitter: () => 25 });
    expect(value).toBe('ok'); expect(calls).toEqual([0, 125, 350, 775, 1600, 2625]);
  });
  test('attempt limit terminates persistent failure', async () => {
    const clock = createVirtualClock(); let calls = 0;
    await expect(readWithBackoff(async () => { calls++; throw new RateLimitError(0); }, clock, { maxAttempts: 3 })).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(calls).toBe(3);
  });
  test('never retries earlier than Retry-After to fit a deadline', async () => {
    const clock = createVirtualClock(); const service = createRateLimitFixture(clock, 3000);
    await expect(readWithBackoff(service.read, clock)).rejects.toMatchObject({ code: 'DEADLINE' });
    expect(service.snapshot().calls).toEqual([0]);
  });
  test('permanent failures, invalid budgets and cancellation stop immediately', async () => {
    let calls = 0; const read = async () => { calls++; throw new Error('permanent'); };
    await expect(readWithBackoff(read, createVirtualClock())).rejects.toThrow('permanent');
    expect(calls).toBe(1);
    await expect(readWithBackoff(read, createVirtualClock(), { maxAttempts: Infinity })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(readWithBackoff(read, createVirtualClock(), { signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(calls).toBe(1);
  });
});
