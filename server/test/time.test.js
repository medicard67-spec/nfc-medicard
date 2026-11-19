import { describe, it, expect } from "vitest";
import { ageFromDob, malaysiaNow } from "../src/lib/time.js";

describe("ageFromDob", () => {
  const at = new Date("2026-11-19T04:00:00Z"); // 19 Nov 2026, noon in Malaysia

  it("counts whole years, one less before this year's birthday", () => {
    expect(ageFromDob("2003-08-15", at)).toBe(23);
    expect(ageFromDob("2003-12-25", at)).toBe(22);
    expect(ageFromDob("2003-11-19", at)).toBe(23); // birthday today
  });

  it("uses the Malaysian date: just after midnight in Malaysia is already the birthday", () => {
    const earlyMorning = new Date("2026-11-18T16:30:00Z"); // 19 Nov, 00:30 in Malaysia
    expect(malaysiaNow(earlyMorning).date).toBe("2026-11-19");
    expect(ageFromDob("2003-11-19", earlyMorning)).toBe(23);
  });

  it("returns null without a usable date, so the stored age is used instead", () => {
    expect(ageFromDob(null, at)).toBeNull();
    expect(ageFromDob("", at)).toBeNull();
    expect(ageFromDob("not a date", at)).toBeNull();
  });
});
