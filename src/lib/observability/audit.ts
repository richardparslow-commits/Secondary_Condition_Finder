import "server-only";

import { createLogger } from "./logger";

const auditLogger = createLogger("audit");

export type AuditAction =
  | "workflow-diagnosed-selected"
  | "workflow-service-connected-selected"
  | "workflow-ratings-selected"
  | "workflow-documents-context"
  | "workflow-completed"
  | "workflow-restarted"
  | "presumptive-service-history-saved"
  | "presumptive-service-history-cleared"
  | "regulatory-preflight-triggered"
  | "regulatory-preflight-unauthorized"
  | "accredited-rep-search"
  | "admin-cache-clear-triggered"
  | "admin-cache-clear-unauthorized";

export interface AuditFields {
  action: AuditAction;
  status: "success" | "failure" | "unauthorized";
  route?: string;
  // Safe counters only — never condition contents, evidence, or PII.
  count?: number;
  source?: string;
  environment?: string | null;
}

export function auditLog(
  action: AuditAction,
  fields: Omit<AuditFields, "action"> & Record<string, unknown>,
): void {
  // Redact loudly if caller accidentally passes sensitive keys.
  const safe: Record<string, unknown> = { action };
  for (const [key, value] of Object.entries(fields)) {
    if (["payload", "rawText", "evidence", "cookie", "secret", "apiKey", "diagnosed", "serviceConnected", "medications", "treatments", "history"].includes(key)) {
      continue;
    }
    safe[key] = value;
  }

  const level = safe.status === "failure" || safe.status === "unauthorized" ? "warn" : "info";
  auditLogger[level](`audit:${action}`, safe);
}
