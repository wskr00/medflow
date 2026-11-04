import { convertToParamMap } from "@angular/router";
import { describe, expect, it } from "vitest";
import {
  defaultDoctorPeriod,
  doctorPeriodErrors,
  doctorPeriodFromQuery,
  parseDoctorIndicators,
  registeredDuration,
} from "./doctor-indicators.utils";

const empty = {
  inicio: "2026-11-01",
  fim: "2026-11-04",
  timeZone: "America/Belem",
  consultasPorDataAgendada: {
    totalConsultas: 0,
    agendadas: 0,
    emEspera: 0,
    emAtendimento: 0,
    finalizadas: 0,
    canceladas: 0,
    porDia: [],
  },
  finalizacoesPorDataReal: {
    totalFinalizadas: 0,
    duracaoMediaSegundos: null,
    porDia: [],
  },
};
describe("Período e duração da própria atividade", () => {
  it("inclui o dia da clínica nos presets, mesmo em outro dia UTC", () => {
    expect(
      defaultDoctorPeriod("America/Belem", 7, new Date("2026-11-04T01:00:00Z")),
    ).toEqual({ inicio: "2026-10-28", fim: "2026-11-03" });
  });
  it("preserva URL parcial como inválida e limita o intervalo inclusivo a 366 dias", () => {
    expect(
      doctorPeriodErrors(
        doctorPeriodFromQuery(
          convertToParamMap({ inicio: "2026-11-01" }),
          "America/Belem",
        ),
      ),
    ).toHaveProperty("fim");
    expect(
      doctorPeriodErrors({ inicio: "2024-01-01", fim: "2024-12-31" }),
    ).toEqual({});
    expect(
      doctorPeriodErrors({ inicio: "2024-01-01", fim: "2025-01-01" }).fim,
    ).toContain("366");
    expect(
      doctorPeriodErrors({ inicio: "2026-02-29", fim: "2026-03-01" }),
    ).toHaveProperty("inicio");
  });
  it.each([
    [null, "Sem dados"],
    [0, "0 s"],
    [62.5, "1 min 3 s"],
    [1330, "22 min 10 s"],
    [4330, "1 h 12 min 10 s"],
    [3599.9, "1 h"],
  ])(
    "formata %s segundos como %s sem confundir zero e ausência",
    (value, expected) => {
      expect(registeredDuration(value)).toBe(expected);
    },
  );
  it("mantém a média global recebida, sem calcular média das médias diárias", () => {
    const report = {
      ...empty,
      finalizacoesPorDataReal: {
        totalFinalizadas: 4,
        duracaoMediaSegundos: 1500,
        porDia: [
          {
            data: "2026-11-01",
            totalFinalizadas: 1,
            duracaoMediaSegundos: 600,
          },
          {
            data: "2026-11-04",
            totalFinalizadas: 3,
            duracaoMediaSegundos: 1800,
          },
        ],
      },
    };
    expect(
      parseDoctorIndicators(report).finalizacoesPorDataReal
        .duracaoMediaSegundos,
    ).toBe(1500);
    expect(
      registeredDuration(
        parseDoctorIndicators(report).finalizacoesPorDataReal
          .duracaoMediaSegundos,
      ),
    ).toBe("25 min");
  });
  it("aceita médias nulas, mas não preenche campos ausentes ou contagens inválidas", () => {
    expect(parseDoctorIndicators(empty)).toEqual(empty);
    expect(() =>
      parseDoctorIndicators({
        ...empty,
        finalizacoesPorDataReal: { totalFinalizadas: 0, porDia: [] },
      }),
    ).toThrow();
    expect(() =>
      parseDoctorIndicators({
        ...empty,
        consultasPorDataAgendada: {
          ...empty.consultasPorDataAgendada,
          totalConsultas: null,
        },
      }),
    ).toThrow();
    expect(() =>
      parseDoctorIndicators({
        ...empty,
        finalizacoesPorDataReal: {
          ...empty.finalizacoesPorDataReal,
          duracaoMediaSegundos: -1,
        },
      }),
    ).toThrow();
  });
});
