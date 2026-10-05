/** Educational, in-memory fixtures. They are not durable production services. */
export class ToolError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'ToolError'; }
}

export class RateLimitError extends ToolError {
  constructor(public readonly retryAfterMs: number) { super('RATE_LIMITED', `Retry after ${retryAfterMs} ms`); }
}

export interface Clock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ToolError('CANCELLED', 'Operation cancelled');
}

export function boundedNumber(value: number, name: string, min: number, max: number, integer = false): void {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new ToolError('INVALID_INPUT', `${name} must be ${integer ? 'an integer ' : ''}between ${min} and ${max}`);
  }
}

export function createVirtualClock(): Clock {
  let elapsed = 0;
  return {
    now: () => elapsed,
    async sleep(ms, signal) {
      checkAbort(signal); boundedNumber(ms, 'delay', 0, 60000);
      elapsed += ms;
      checkAbort(signal);
    },
  };
}

export interface TicketInput { title: string; key?: string }
export interface Ticket { id: string; title: string }

export function createTicketFixture() {
  const tickets: Ticket[] = [];
  const keys = new Map<string, Ticket>();
  return {
    async create(input: TicketInput): Promise<Ticket> {
      if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200) {
        throw new ToolError('INVALID_INPUT', 'A ticket needs a title of 1 to 200 characters');
      }
      if (input.key !== undefined && (typeof input.key !== 'string' || !input.key.trim() || input.key.length > 100)) {
        throw new ToolError('INVALID_INPUT', 'An idempotency key must contain 1 to 100 characters');
      }
      const previous = input.key === undefined ? undefined : keys.get(input.key);
      if (previous) {
        if (previous.title !== input.title) throw new ToolError('KEY_CONFLICT', 'The same key cannot identify a different payload');
        return { ...previous };
      }
      // No await between lookup and commit. A real multi-worker server needs a transaction + unique constraint.
      const ticket = { id: `ticket-${tickets.length + 1}`, title: input.title };
      tickets.push(ticket);
      if (input.key !== undefined) keys.set(input.key, ticket);
      return { ...ticket };
    },
    snapshot: () => tickets.map(ticket => ({ ...ticket })),
  };
}

/** Commit the operation, then lose its first successful response. */
export function dropFirstResponse<A, R>(tool: (input: A) => Promise<R>): (input: A) => Promise<R> {
  let lost = false;
  return async input => {
    const response = await tool(input);
    if (!lost) { lost = true; throw new ToolError('RESPONSE_LOST', 'The operation committed, but its response was lost'); }
    return response;
  };
}

export type JobStatus = 'accepted' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface ReportJob { id: string; status: JobStatus; artifact: string | null }

export function createReportFixture(clock: Clock, outcome: 'completed' | 'failed' | 'cancelled' | 'stuck' = 'completed') {
  let startedAt: number | undefined;
  const snapshot = (): ReportJob => {
    if (startedAt === undefined) throw new ToolError('NOT_FOUND', 'Submit the job first');
    const age = clock.now() - startedAt;
    const status: JobStatus = age < 100 ? 'accepted' : age < 300 || outcome === 'stuck' ? 'running' : outcome;
    return { id: 'report-1', status, artifact: status === 'completed' ? 'Customer report: 3 resolved requests.' : null };
  };
  return {
    async submit(): Promise<ReportJob> {
      if (startedAt === undefined) startedAt = clock.now();
      return snapshot();
    },
    async status(id: string): Promise<ReportJob> {
      if (id !== 'report-1') throw new ToolError('NOT_FOUND', 'Unknown job ID');
      return snapshot();
    },
    snapshot,
  };
}

export function createRateLimitFixture(clock: Clock, availableAtMs = 300) {
  boundedNumber(availableAtMs, 'availability time', 0, 60000);
  const calls: number[] = [];
  return {
    async read(): Promise<string> {
      calls.push(clock.now());
      if (clock.now() < availableAtMs) throw new RateLimitError(availableAtMs - clock.now());
      return 'Inventory: 12 items available';
    },
    snapshot: () => ({ calls: [...calls], availableAtMs }),
  };
}
