import { describe, expect, it } from "vitest";
import { summaryReason } from "./summary-reason";

describe("summaryReason", () => {
  it("explains every empty summary the API can return", () => {
    expect(summaryReason("no_previous", "ok")).toMatch(/earlier listing/i);
    expect(summaryReason("no_material_change", "ok")).toMatch(/nothing material/i);
    expect(summaryReason("pending", "ok")).toMatch(/being written/i);
    expect(summaryReason("llm_cap_reached", "ok")).toMatch(/daily/i);
    expect(summaryReason("llm_timeout", "ok")).toMatch(/timed out/i);
    expect(summaryReason("llm_failed", "ok")).toMatch(/failed/i);
    expect(summaryReason("llm_unusable", "ok")).toMatch(/unusable/i);
    expect(summaryReason("poll_failed", "not_found")).toMatch(/no listing/i);
    expect(summaryReason("poll_failed", "partial")).toMatch(/incomplete/i);
    expect(summaryReason("poll_failed", "timeout")).toMatch(/timed out/i);
    expect(summaryReason("ready", "ok")).toBeNull();
  });
});
