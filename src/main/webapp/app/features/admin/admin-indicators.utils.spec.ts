import { convertToParamMap } from "@angular/router";
import { describe, expect, it } from "vitest";
import {
  chartSeries,
  civilDay,
  clinicDay,
  filterErrors,
  filtersFromQuery,
  presetFilters,
  sameFilters,
} from "./admin-indicators.utils";

const base = {
  inicio: "2026-01-01",
  fim: "2026-12-31",
  unidadeId: "",
  especialidadeId: "",
};
describe("Datas e filtros dos indicadores", () => {
  it("usa o dia da clínica na virada UTC, incluindo hoje nos sete dias", () => {
    const now = new Date("2026-11-04T01:00:00Z");
    expect(clinicDay("America/Belem", now)).toBe("2026-11-03");
    expect(presetFilters("America/Belem", 7, now)).toMatchObject({
      inicio: "2026-10-28",
      fim: "2026-11-03",
    });
  });
  it("valida calendário real, ordem e máximo inclusivo de 366 dias", () => {
    expect(civilDay("2026-02-29")).toBeUndefined();
    expect(civilDay("2024-02-29")).toBeDefined();
    expect(
      filterErrors({ ...base, inicio: "2024-01-01", fim: "2024-12-31" }),
    ).toEqual({});
    expect(filterErrors({ ...base, fim: "2027-01-01" })).toEqual({});
    expect(filterErrors({ ...base, fim: "2027-01-02" }).fim).toContain("366");
    expect(filterErrors({ ...base, fim: "2025-12-31" }).fim).toContain(
      "posterior",
    );
  });
  it("não troca silenciosamente datas parciais ou IDs inválidos vindos da URL", () => {
    const value = filtersFromQuery(
      convertToParamMap({ inicio: "2026-01-01", unidadeId: "foreign" }),
      "America/Belem",
    );
    expect(value.fim).toBe("");
    expect(filterErrors(value)).toHaveProperty("fim");
    expect(filterErrors(value)).toHaveProperty("unidadeId");
  });
  it("compara período e ambas as dimensões sem perder os filtros combinados", () => {
    expect(sameFilters(base, { ...base })).toBe(true);
    expect(sameFilters(base, { ...base, unidadeId: "another" })).toBe(false);
    expect(sameFilters(base, { ...base, especialidadeId: "another" })).toBe(
      false,
    );
  });
  it("preserva lacunas e um zero real sem somar ou interpolar contagens", () => {
    expect(
      chartSeries("2026-11-01", "2026-11-04", [
        { data: "2026-11-04", quantidade: 8 },
        { data: "2026-11-01", quantidade: 0 },
      ]),
    ).toEqual({
      labels: ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"],
      values: [0, null, null, 8],
    });
  });
});
