// Tiny structured-logger shim. Replaces ad-hoc console.log calls in edge
// functions so log lines are queryable as structured JSON.
//
// Existing code can opt-in incrementally — this does NOT replace console.log
// globally; functions that want structured logs import logEvent / logError.

export interface LogContext {
  fn: string;
  userId?: string | null;
  orgId?: string | null;
  runId?: string | null;
  op?: string;
  durationMs?: number;
  outcome?: 'ok' | 'error' | 'partial' | 'skipped';
  costPence?: number;
  [key: string]: unknown;
}

export function logEvent(ctx: LogContext, message?: string): void {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'info',
    msg: message ?? ctx.op ?? ctx.fn,
    ...ctx,
  }));
}

export function logError(ctx: LogContext, error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'error',
    msg,
    stack,
    ...ctx,
  }));
}

export async function withTimer<T>(
  ctx: Omit<LogContext, 'durationMs' | 'outcome'>,
  work: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await work();
    logEvent({ ...ctx, durationMs: Math.round(performance.now() - start), outcome: 'ok' });
    return result;
  } catch (e) {
    logError({ ...ctx, durationMs: Math.round(performance.now() - start), outcome: 'error' }, e);
    throw e;
  }
}
