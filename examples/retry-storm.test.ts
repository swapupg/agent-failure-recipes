import { expect, test } from 'vitest';
import { createVirtualClock, createRateLimitFixture, readWithBackoff } from '../src/index.js';

test('immediate retries exhaust the budget before recovery', async () => {
  const service = createRateLimitFixture(createVirtualClock(), 300);
  for (let attempt = 0; attempt < 4; attempt++) {
    await expect(service.read()).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  }
  expect(service.snapshot().calls).toEqual([0, 0, 0, 0]);
});

test('respect Retry-After and bound attempts', async () => {
  const clock = createVirtualClock();
  const service = createRateLimitFixture(clock, 300);
  const result = await readWithBackoff(service.read, clock, { maxAttempts: 4 });
  expect(result).toContain('12 items');
  expect(service.snapshot().calls).toEqual([0, 300]);
  // Adapt: normalize your SDK's 429 response; use a real cancellable clock in integration tests.
});
