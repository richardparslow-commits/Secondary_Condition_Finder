export type ClientErrorComponent =
  | "root-error-boundary"
  | "api-error-boundary"
  | "secondary-error-boundary"
  | "presumptive-error-boundary";

/**
 * Create a content-free client error event. The original exception is accepted
 * only so callers cannot accidentally be tempted to serialize it; its message,
 * stack, cause, and digest are deliberately never inspected or returned.
 */
export function createClientErrorEvent(
  component: ClientErrorComponent,
  error: unknown,
) {
  // Reference without inspecting; keep the error argument explicitly discarded.
  void error;
  return {
    timestamp: new Date().toISOString(),
    level: "error" as const,
    component,
    message: "Application error; diagnostic details withheld.",
  };
}
