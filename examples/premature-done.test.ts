import { expect, test } from 'vitest';
import { createVirtualClock, createReportFixture, waitForReport } from '../src/index.js';

test('acceptance alone does not mean the report exists', async () => {
  const service = createReportFixture(createVirtualClock());
  const reply = await service.submit();
  expect(reply.status).toBe('accepted');
  expect(service.snapshot().artifact).toBeNull();
});

test('verify completion and the artifact before saying done', async () => {
  const clock = createVirtualClock();
  const service = createReportFixture(clock);
  const job = await service.submit();
  await waitForReport(service.status, job.id, clock);
  expect(service.snapshot().status).toBe('completed');
  expect(service.snapshot().artifact).toContain('Customer report');
  // Adapt: status should read your authoritative job; also verify the stored artifact.
});
