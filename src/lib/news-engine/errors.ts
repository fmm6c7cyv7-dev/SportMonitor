// src/lib/news-engine/errors.ts

export type EngineErrorCode =
  | "ENGINE_INVALID_INPUT"
  | "ENGINE_INVALID_ARTICLE"
  | "ENGINE_INVALID_CONFIG"
  | "ENGINE_PIPELINE_FAILURE"
  | "ENGINE_SCORING_FAILURE"
  | "ENGINE_CLUSTERING_FAILURE";

type EngineErrorDetails = Record<string, unknown> | undefined;

function normalizeMessage(message: string, fallback: string): string {
  const trimmed = typeof message === "string" ? message.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
}

export class EngineError extends Error {
  public readonly code: EngineErrorCode;
  public readonly details?: EngineErrorDetails;
  public readonly cause?: unknown;

  constructor(
    code: EngineErrorCode,
    message: string,
    details?: EngineErrorDetails,
    cause?: unknown,
  ) {
    super(normalizeMessage(message, "Unknown engine error"));
    this.name = "EngineError";
    this.code = code;
    this.details = details;
    this.cause = cause;

    Object.setPrototypeOf(this, EngineError.prototype);
  }
}

export class EngineValidationError extends EngineError {
  constructor(
    message: string,
    details?: EngineErrorDetails,
    cause?: unknown,
  ) {
    super(
      "ENGINE_INVALID_INPUT",
      normalizeMessage(message, "Invalid engine input"),
      details,
      cause,
    );
    this.name = "EngineValidationError";

    Object.setPrototypeOf(this, EngineValidationError.prototype);
  }
}

export class EngineConfigError extends EngineError {
  constructor(
    message: string,
    details?: EngineErrorDetails,
    cause?: unknown,
  ) {
    super(
      "ENGINE_INVALID_CONFIG",
      normalizeMessage(message, "Invalid engine config"),
      details,
      cause,
    );
    this.name = "EngineConfigError";

    Object.setPrototypeOf(this, EngineConfigError.prototype);
  }
}

export function isEngineError(value: unknown): value is EngineError {
  return value instanceof EngineError;
}

export function toEngineError(
  error: unknown,
  fallbackCode: EngineErrorCode = "ENGINE_PIPELINE_FAILURE",
  fallbackMessage = "Pipeline failure",
  details?: EngineErrorDetails,
): EngineError {
  if (isEngineError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new EngineError(
      fallbackCode,
      normalizeMessage(error.message, fallbackMessage),
      details,
      error,
    );
  }

  return new EngineError(fallbackCode, fallbackMessage, details, error);
}