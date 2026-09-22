// src/lib/__tests__/news-engine/errors.test.ts

import { describe, expect, it } from "vitest";
import {
  EngineConfigError,
  EngineError,
  EngineValidationError,
  isEngineError,
  toEngineError,
} from "@/lib/news-engine/errors";

describe("engine errors", () => {
  it("creates EngineError with code and details", () => {
    const error = new EngineError("ENGINE_PIPELINE_FAILURE", "Boom", {
      module: "pipeline",
    });

    expect(error.name).toBe("EngineError");
    expect(error.code).toBe("ENGINE_PIPELINE_FAILURE");
    expect(error.message).toBe("Boom");
    expect(error.details).toEqual({ module: "pipeline" });
  });

  it("creates EngineValidationError with correct code", () => {
    const error = new EngineValidationError("Bad input", { field: "title" });

    expect(error.name).toBe("EngineValidationError");
    expect(error.code).toBe("ENGINE_INVALID_INPUT");
    expect(error.details).toEqual({ field: "title" });
  });

  it("creates EngineConfigError with correct code", () => {
    const error = new EngineConfigError("Bad config", { key: "boost" });

    expect(error.name).toBe("EngineConfigError");
    expect(error.code).toBe("ENGINE_INVALID_CONFIG");
    expect(error.details).toEqual({ key: "boost" });
  });

  it("detects engine errors correctly", () => {
    expect(isEngineError(new EngineError("ENGINE_PIPELINE_FAILURE", "x"))).toBe(true);
    expect(isEngineError(new Error("plain error"))).toBe(false);
    expect(isEngineError("not-an-error")).toBe(false);
  });

  it("passes through EngineError unchanged", () => {
    const original = new EngineError("ENGINE_SCORING_FAILURE", "Scoring failed");
    const result = toEngineError(original);

    expect(result).toBe(original);
  });

  it("wraps native errors", () => {
    const native = new Error("native boom");
    const result = toEngineError(
      native,
      "ENGINE_CLUSTERING_FAILURE",
      "Fallback message",
      { stage: "cluster" },
    );

    expect(result).toBeInstanceOf(EngineError);
    expect(result.code).toBe("ENGINE_CLUSTERING_FAILURE");
    expect(result.message).toBe("native boom");
    expect(result.details).toEqual({ stage: "cluster" });
    expect(result.cause).toBe(native);
  });

  it("wraps unknown values safely", () => {
    const result = toEngineError("boom", "ENGINE_PIPELINE_FAILURE", "Pipeline fallback");

    expect(result).toBeInstanceOf(EngineError);
    expect(result.code).toBe("ENGINE_PIPELINE_FAILURE");
    expect(result.message).toBe("Pipeline fallback");
    expect(result.cause).toBe("boom");
  });
});