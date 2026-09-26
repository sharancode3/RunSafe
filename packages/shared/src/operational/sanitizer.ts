const SENSITIVE_PATTERNS: RegExp[] = [
  /postgres(ql)?:\/\/[^:]+:[^@]+@/gi,
  /bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi,
  /(sk-[a-zA-Z0-9_\-\.]{20,})/gi,
  /(AKIA[0-9A-Z]{16})/gi,
  /("?(password|secret|token|api_?key|authorization|auth|jwt)"?\s*[:=]\s*"?[^",\s]+"?)/gi,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/gi,
];

export function redactSensitiveString(input: string): string {
  if (!input || typeof input !== "string") return input;
  let sanitized = input;

  // Redact connection strings
  sanitized = sanitized.replace(/postgres(ql)?:\/\/([^:]+):([^@]+)@/gi, "postgres://$2:[REDACTED]@");

  // Redact Bearer tokens
  sanitized = sanitized.replace(/bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, "Bearer [REDACTED]");

  // Redact OpenAI style keys
  sanitized = sanitized.replace(/sk-[a-zA-Z0-9_\-\.]{20,}/gi, "sk-[REDACTED]");

  // Redact AWS access keys
  sanitized = sanitized.replace(/AKIA[0-9A-Z]{16}/gi, "AKIA[REDACTED]");

  // Redact JSON/header password and token pairs
  sanitized = sanitized.replace(
    /(["']?(?:password|secret|token|api_?key|authorization|auth|jwt)["']?\s*[:=]\s*["'])([^"'\s,]+)(["'])/gi,
    "$1[REDACTED]$3"
  );

  // Redact PEM private keys
  sanitized = sanitized.replace(
    /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/gi,
    "[REDACTED PRIVATE KEY]"
  );

  return sanitized;
}

export function sanitizeOutput<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    return redactSensitiveString(data) as unknown as T;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeOutput(item)) as unknown as T;
  }

  if (typeof data === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("apikey") ||
        lowerKey.includes("api_key") ||
        lowerKey.includes("authorization")
      ) {
        copy[key] = "[REDACTED]";
      } else {
        copy[key] = sanitizeOutput(value);
      }
    }
    return copy as T;
  }

  return data;
}
