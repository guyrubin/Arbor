/**
 * OPS-1 (WAF backlog): structured logging + request observability.
 *
 * Emits one JSON object per line in the format Cloud Logging ingests natively
 * (`severity`, `message`, `httpRequest`, plus free-form labels). Errors include
 * the stack in `message` so GCP Error Reporting groups them automatically.
 * Locally the same lines remain grep-able JSON.
 */
import { randomUUID } from "crypto";
import type { RequestHandler } from "express";

type Fields = Record<string, unknown>;

type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

const emit = (severity: Severity, message: string, fields: Fields = {}) => {
  const line = JSON.stringify({
    severity,
    message,
    time: new Date().toISOString(),
    ...fields,
  });
  if (severity === "ERROR") console.error(line);
  else console.log(line);
};

export const logger = {
  debug: (message: string, fields?: Fields) => emit("DEBUG", message, fields),
  info: (message: string, fields?: Fields) => emit("INFO", message, fields),
  warn: (message: string, fields?: Fields) => emit("WARNING", message, fields),
  /** Pass the thrown error; the stack lands in `message` for Error Reporting. */
  error: (message: string, error?: unknown, fields?: Fields) => {
    const err = error instanceof Error ? error : error ? new Error(String(error)) : null;
    emit("ERROR", err ? `${message}\n${err.stack || err.message}` : message, {
      ...fields,
      ...(err ? { errorMessage: err.message } : {}),
    });
  },
};

/** The request id attached by `requestObservability` (also echoed to clients). */
export const requestIdOf = (req: { headers: Record<string, unknown> } & Record<string, any>): string =>
  (req.arborRequestId as string) || "unknown";

/**
 * Express middleware: tags every request with an id, echoes it as
 * `X-Request-Id`, and logs method/path/status/latency on completion.
 * AI endpoint bodies are never logged — only route names and metadata.
 */
export const requestObservability: RequestHandler = (req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const requestId = (typeof incoming === "string" && incoming.slice(0, 64)) || randomUUID();
  (req as any).arborRequestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  const startedAt = Date.now();

  res.on("finish", () => {
    const latencyMs = Date.now() - startedAt;
    const fields: Fields = {
      requestId,
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl?.split("?")[0],
        status: res.statusCode,
        latency: `${(latencyMs / 1000).toFixed(3)}s`,
      },
      latencyMs,
      userUid: (req as any).user?.uid || null,
    };
    if (res.statusCode >= 500) emit("ERROR", `${req.method} ${req.originalUrl} → ${res.statusCode}`, fields);
    else if (res.statusCode >= 400) emit("WARNING", `${req.method} ${req.originalUrl} → ${res.statusCode}`, fields);
    else emit("INFO", `${req.method} ${req.originalUrl} → ${res.statusCode}`, fields);
  });

  next();
};
