import { describe, expect, it, vi } from "vitest";
import { calendarToday, civilDate } from "./patient-time";

describe("Patient calendar dates", () => {
  it("usa o dia da clínica quando o UTC já mudou de data", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-04T01:00:00Z"));
      expect(civilDate(calendarToday("America/Belem"))).toBe("2026-11-03");
      expect(civilDate(calendarToday("UTC"))).toBe("2026-11-04");
    } finally {
      vi.useRealTimers();
    }
  });
  it("envia a data civil escolhida sem deslocá-la por conversão UTC", () => {
    expect(civilDate(new Date(2026, 10, 4))).toBe("2026-11-04");
  });
});
