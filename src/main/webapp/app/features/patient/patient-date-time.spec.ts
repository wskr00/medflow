import { describe, expect, it } from "vitest";

import { addCivilDays, clinicDateFromInstant } from "./patient-date-time";

describe("datas da jornada do paciente", () => {
  it("navega datas civis sem depender do fuso do navegador", () => {
    expect(addCivilDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addCivilDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("obtém a data local da clínica a partir do instante retornado", () => {
    expect(clinicDateFromInstant("2026-09-17T00:30:00-03:00", "America/Belem"))
      .toBe("2026-09-17");
  });
});
