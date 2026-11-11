import { describe, expect, it } from "vitest";
import { batchDates, batchEnd } from "@/lib/utils/batch";

describe("batch scheduler dates", () => {
  it("whole week = 7 days from the start", () => {
    expect(batchEnd("2027-03-01", "week")).toBe("2027-03-07");
    expect(batchDates("2027-03-01", "week", [1, 2, 3, 4, 5])).toEqual(["2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04", "2027-03-05"]); // Mon–Fri
  });
  it("whole month runs to the last day of the start month (incl. leap Feb)", () => {
    expect(batchEnd("2028-02-10", "month")).toBe("2028-02-29");
    expect(batchEnd("2027-02-10", "month")).toBe("2027-02-28");
    expect(batchEnd("2027-12-20", "month")).toBe("2027-12-31");
  });
  it("picks only the chosen weekdays (0 = Sunday)", () => {
    const d = batchDates("2027-03-01", "month", [1, 3, 5]); // Mon/Wed/Fri in March 2027
    expect(d).toHaveLength(14); expect(d[0]).toBe("2027-03-01"); expect(d.at(-1)).toBe("2027-03-31");
    for (const k of d) expect([1, 3, 5]).toContain(new Date(`${k}T12:00:00Z`).getUTCDay());
  });
  it("custom end date is inclusive; bad input yields nothing", () => {
    expect(batchDates("2027-03-01", "until", [1], "2027-03-15")).toEqual(["2027-03-01", "2027-03-08", "2027-03-15"]);
    expect(batchDates("nope", "week", [1])).toEqual([]);
    expect(batchDates("2027-03-01", "week", [])).toEqual([]);
  });
  it("never produces more than a year of days", () => {
    expect(batchDates("2027-01-01", "until", [0, 1, 2, 3, 4, 5, 6], "2030-01-01").length).toBeLessThanOrEqual(366);
  });
});
