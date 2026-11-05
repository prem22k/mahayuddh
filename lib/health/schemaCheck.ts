/**
 * Classifies the result of a zero-row column check for /api/health.
 *
 * "mismatch" only for errors that mean the deployed code and the database
 * disagree: a missing column or table, or a missing grant. Anything else
 * (timeouts, 5xx, network) is "unknown", so a blip never reads as a schema
 * problem.
 */
export type SchemaState = "ok" | "mismatch" | "unknown";

const MISMATCH_CODES = new Set([
  "42703", // undefined_column: a migration the code depends on is missing
  "42P01", // undefined_table
  "42501", // insufficient_privilege: a column grant is missing
  "PGRST200", // PostgREST: relationship not in its schema cache
  "PGRST204", // PostgREST: column not in its schema cache
]);

export function classifySchemaError(error: { code?: string | null } | null | undefined): SchemaState {
  if (!error) return "ok";
  return error.code && MISMATCH_CODES.has(error.code) ? "mismatch" : "unknown";
}

/** Any mismatch wins, then any unknown; ok only when every check passed. */
export function combineSchemaStates(states: SchemaState[]): SchemaState {
  if (states.includes("mismatch")) return "mismatch";
  if (states.includes("unknown") || states.length === 0) return "unknown";
  return "ok";
}
