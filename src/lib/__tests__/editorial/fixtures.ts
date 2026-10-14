import type { EditorialAssessment } from "@/lib/editorial/assessment";
/** Explicit, reviewed model outputs. These fixtures do not perform classification. */
export function assessment(title: string, category: EditorialAssessment["category"], overrides: Partial<EditorialAssessment> = {}): EditorialAssessment {
  return {version: 1, title, category, status: "confirmed", badge: null, breaking: false, evidence: title, assessed_at: "2026-10-14T06:00:00Z", model: "test", ...overrides};
}
