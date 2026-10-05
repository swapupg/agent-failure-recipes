import { createServer } from 'node:http';
import { once } from 'node:events';
import { expect, test } from 'vitest';
import { createTicketFixture, createTicketSafely, ToolError, type Ticket, type TicketInput } from '../src/index.js';

// Loopback integration: a real socket closes AFTER the fixture commits the ticket.
test.each([false, true])('HTTP response loss, repaired=%s', async repaired => {
  const service = createTicketFixture(); let drop = true;
  const server = createServer(async (req, res) => {
    const body: Buffer[] = []; for await (const part of req) body.push(Buffer.from(part));
    const input = JSON.parse(Buffer.concat(body).toString()) as TicketInput;
    const ticket = await service.create(input);
    if (drop) { drop = false; res.destroy(); return; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(ticket));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No server address');
  const create = async (input: TicketInput): Promise<Ticket> => {
    let response: Response;
    try { response = await fetch(`http://127.0.0.1:${address.port}`, { method: 'POST', body: JSON.stringify(input), signal: AbortSignal.timeout(2000) }); }
    catch { throw new ToolError('RESPONSE_LOST', 'Test transport closed after commit'); }
    return await response.json() as Ticket;
  };
  try {
    if (repaired) await createTicketSafely(create, { title: 'test', key: 'one-operation' });
    else { await expect(create({ title: 'test' })).rejects.toMatchObject({ code: 'RESPONSE_LOST' }); await create({ title: 'test' }); }
    expect(service.snapshot()).toHaveLength(repaired ? 1 : 2);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
