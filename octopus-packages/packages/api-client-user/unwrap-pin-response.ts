/**
 * Unwrap Pin framework response format
 *
 * Pin framework returns responses in format: { data: T, trace_id?: string }
 * This function extracts the data field.
 */
export function unwrapPinResponse<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  return response as T;
}
