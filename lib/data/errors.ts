/** Typed data-layer errors. Replaces silent `return []` so UI can show retry. */
export class DataError extends Error {
  readonly source: string;
  readonly retryable: boolean;
  constructor(source: string, message: string, opts?: { retryable?: boolean; cause?: unknown }) {
    super(message);
    this.name = "DataError";
    this.source = source;
    this.retryable = opts?.retryable ?? true;
    if (opts?.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export function dataErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof DataError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
