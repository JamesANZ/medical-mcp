/**
 * Audit Logging Infrastructure
 *
 * Logs all calculator usage for liability/QA purposes.
 * IMPORTANT: No patient-identifiable information is stored.
 */

export interface AuditLogEntry {
  timestamp: string;
  calculatorType: string;
  inputs: Record<string, unknown>; // Sanitized - no patient identifiers
  output?: unknown; // Calculated result
  sessionId?: string; // Optional session identifier
  error?: string; // Error message if calculation failed
}

// In-memory storage for audit logs
// In production, this should be replaced with a proper database
const auditLogs: AuditLogEntry[] = [];

// Maximum number of logs to keep in memory (prevent memory issues)
const MAX_LOGS = 1000;

/**
 * Log a calculator usage event
 * @param calculatorType - Type of calculator used
 * @param inputs - Sanitized input parameters (no patient identifiers)
 * @param output - Calculated result (optional)
 * @param error - Error message if calculation failed (optional)
 */
export function logCalculatorUsage(
  calculatorType: string,
  inputs: Record<string, unknown>,
  output?: unknown,
  error?: string,
): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    calculatorType,
    inputs: sanitizeInputs(inputs),
    output,
    error,
  };

  auditLogs.push(entry);

  // Keep only the most recent logs
  if (auditLogs.length > MAX_LOGS) {
    auditLogs.shift();
  }

  // In production, also write to persistent storage
  // For now, we just log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("[AUDIT]", JSON.stringify(entry, null, 2));
  }
}

/**
 * Sanitize inputs to remove any potential patient-identifiable information
 * This is a basic implementation - enhance as needed
 */
function sanitizeInputs(
  inputs: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  // List of fields that might contain patient identifiers
  const sensitiveFields = [
    "patientName",
    "patientId",
    "mrn",
    "ssn",
    "dateOfBirth",
    "address",
    "phone",
    "email",
  ];

  for (const [key, value] of Object.entries(inputs)) {
    // Skip sensitive fields
    if (
      sensitiveFields.some((field) =>
        key.toLowerCase().includes(field.toLowerCase()),
      )
    ) {
      continue;
    }

    // Only include numeric or string values (no objects that might contain identifiers)
    if (
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Get audit logs (for QA/debugging purposes)
 * In production, this should require proper authentication
 */
export function getAuditLogs(limit: number = 100): AuditLogEntry[] {
  return auditLogs.slice(-limit);
}

/**
 * Clear audit logs (for testing/development)
 */
export function clearAuditLogs(): void {
  auditLogs.length = 0;
}
