import { boundedNumber, checkAbort, RateLimitError, ToolError, type Clock, type ReportJob, type Ticket, type TicketInput } from './fixtures.js';

/** For this known lost-response error only. Reuse one caller-owned key for the intended operation. */
export async function createTicketSafely(create: (input: TicketInput) => Promise<Ticket>, input: Required<TicketInput>): Promise<Ticket> {
  if (!input.key?.trim()) throw new ToolError('INVALID_INPUT', 'A stable operation key is required');
  try { return await create(input); }
  catch (error) {
    if (!(error instanceof ToolError) || error.code !== 'RESPONSE_LOST') throw error;
    return create(input);
  }
}

export async function waitForReport(
  status: (id: string) => Promise<ReportJob>, id: string, clock: Clock,
  options: { timeoutMs?: number; intervalMs?: number; signal?: AbortSignal; onStatus?: (job: ReportJob) => void } = {},
): Promise<ReportJob> {
  const timeout = options.timeoutMs ?? 1000;
  const interval = options.intervalMs ?? 100;
  boundedNumber(timeout, 'timeout', 1, 60000);
  boundedNumber(interval, 'poll interval', 1, 60000);
  const deadline = clock.now() + timeout;
  // This recipe bounds polling. A real adapter must also bound each network request.
  for (let poll = 0; poll < 1000; poll++) {
    checkAbort(options.signal);
    if (clock.now() > deadline) throw new ToolError('DEADLINE', 'Report did not finish before the deadline');
    const job = await status(id);
    checkAbort(options.signal);
    if (clock.now() > deadline) throw new ToolError('DEADLINE', 'Report response arrived after the deadline');
    if (job.id !== id) throw new ToolError('INVALID_RESPONSE', 'Status returned a different job');
    options.onStatus?.(job);
    if (job.status === 'completed') {
      if (!job.artifact) throw new ToolError('MISSING_ARTIFACT', 'Completion must include the report');
      return job;
    }
    if (job.status === 'failed' || job.status === 'cancelled') throw new ToolError('JOB_TERMINAL', `Report ${job.status}`);
    if (job.status !== 'accepted' && job.status !== 'running') throw new ToolError('INVALID_RESPONSE', 'Unknown report status');
    if (clock.now() >= deadline) throw new ToolError('DEADLINE', 'Report did not finish before the deadline');
    await clock.sleep(Math.min(interval, deadline - clock.now()), options.signal);
  }
  throw new ToolError('POLL_LIMIT', 'Report exceeded the polling budget');
}

/** Demonstrates a bounded retry policy for an idempotent read, not arbitrary writes. */
export async function readWithBackoff<T>(read: () => Promise<T>, clock: Clock,
  options: { maxAttempts?: number; timeoutMs?: number; jitter?: (attempt: number) => number; signal?: AbortSignal; onRetry?: (delay: number) => void } = {},
): Promise<T> {
  const attempts = options.maxAttempts ?? 4;
  const timeout = options.timeoutMs ?? 2000;
  boundedNumber(attempts, 'attempts', 1, 20, true);
  boundedNumber(timeout, 'timeout', 1, 60000);
  const deadline = clock.now() + timeout;
  for (let attempt = 0; attempt < attempts; attempt++) {
    checkAbort(options.signal);
    if (clock.now() >= deadline) throw new ToolError('DEADLINE', 'Retry deadline exhausted');
    try {
      const value = await read();
      checkAbort(options.signal);
      if (clock.now() > deadline) throw new ToolError('DEADLINE', 'Read completed after the deadline');
      return value;
    } catch (error) {
      checkAbort(options.signal);
      if (!(error instanceof RateLimitError) || attempt === attempts - 1) throw error;
      boundedNumber(error.retryAfterMs, 'Retry-After delay', 0, 60000);
      const jitter = options.jitter?.(attempt) ?? 0;
      boundedNumber(jitter, 'jitter', 0, 1000);
      const delay = Math.max(error.retryAfterMs, Math.min(100 * 2 ** attempt, 1000) + jitter);
      if (clock.now() + delay >= deadline) throw new ToolError('DEADLINE', 'Retry would exceed the deadline');
      options.onRetry?.(delay);
      await clock.sleep(delay, options.signal);
    }
  }
  throw new ToolError('ATTEMPT_LIMIT', 'Retry budget exhausted');
}
