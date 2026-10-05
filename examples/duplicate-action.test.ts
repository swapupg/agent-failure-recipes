import { expect, test } from 'vitest';
import { createTicketFixture, dropFirstResponse, createTicketSafely } from '../src/index.js';

test('a lost response exposes the broken retry', async () => {
  const service = createTicketFixture();
  const tool = dropFirstResponse(service.create);
  await expect(tool({ title: 'Order 42' })).rejects.toMatchObject({ code: 'RESPONSE_LOST' });
  await tool({ title: 'Order 42' });
  // We expect the bug here so the teaching suite stays green.
  expect(service.snapshot()).toHaveLength(2);
});

test('the same operation key produces one committed ticket', async () => {
  const service = createTicketFixture();
  const tool = dropFirstResponse(service.create);
  await createTicketSafely(tool, { title: 'Order 42', key: 'order-42-support' });
  expect(service.snapshot()).toHaveLength(1);
  // Adapt: replace service.create AND snapshot with your disposable service's adapter.
});
