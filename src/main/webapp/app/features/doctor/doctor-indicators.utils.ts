import { ParamMap } from "@angular/router";
import {
  civilDay,
  clinicDay,
  isTimeZone,
  shiftDay,
} from "../../shared/date/civil-date";
import {
  DoctorIndicatorStates,
  DoctorIndicatorsReport,
  DoctorPeriod,
} from "./doctor-indicators.models";

export function defaultDoctorPeriod(
  zone: string,
  days = 7,
  now = new Date(),
): DoctorPeriod {
  const fim = clinicDay(zone, now);
  return { inicio: shiftDay(fim, 1 - days), fim };
}
export function doctorPeriodFromQuery(
  params: ParamMap,
  zone: string,
): DoctorPeriod {
  return params.has("inicio") || params.has("fim")
    ? { inicio: params.get("inicio") ?? "", fim: params.get("fim") ?? "" }
    : defaultDoctorPeriod(zone);
}
export function doctorPeriodErrors(
  value: DoctorPeriod,
): Partial<Record<keyof DoctorPeriod, string>> {
  const start = civilDay(value.inicio),
    end = civilDay(value.fim);
  const errors: Partial<Record<keyof DoctorPeriod, string>> = {};
  if (start === undefined) errors.inicio = "Informe uma data inicial válida.";
  if (end === undefined) errors.fim = "Informe uma data final válida.";
  if (start !== undefined && end !== undefined) {
    if (end < start)
      errors.fim = "A data final deve ser igual ou posterior à inicial.";
    else if (end - start >= 366)
      errors.fim = "Selecione até 366 dias, incluindo início e fim.";
  }
  return errors;
}
export function sameDoctorPeriod(a: DoctorPeriod, b: DoctorPeriod) {
  return a.inicio === b.inicio && a.fim === b.fim;
}
export function registeredDuration(seconds: number | null): string {
  if (seconds === null) return "Sem dados";
  const total = Math.round(seconds),
    hours = Math.floor(total / 3600),
    minutes = Math.floor((total % 3600) / 60),
    rest = total % 60;
  return [
    hours ? `${hours} h` : "",
    minutes ? `${minutes} min` : "",
    rest || (!hours && !minutes) ? `${rest} s` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
/** The API owns aggregation; validation never fills an absent count with zero. */
export function parseDoctorIndicators(raw: unknown): DoctorIndicatorsReport {
  const value = raw as DoctorIndicatorsReport;
  const invalid = () => {
    throw new Error("Resposta de atividade indisponível ou inválida");
  };
  const count = (number: unknown) =>
    typeof number === "number" && Number.isSafeInteger(number) && number >= 0;
  const duration = (number: unknown) =>
    number === null ||
    (typeof number === "number" && Number.isFinite(number) && number >= 0);
  const states = (entry: DoctorIndicatorStates) =>
    entry &&
    [
      "totalConsultas",
      "agendadas",
      "emEspera",
      "emAtendimento",
      "finalizadas",
      "canceladas",
    ].every((key) => count(entry[key as keyof DoctorIndicatorStates]));
  if (
    !value ||
    typeof value.timeZone !== "string" ||
    !isTimeZone(value.timeZone) ||
    typeof value.inicio !== "string" ||
    typeof value.fim !== "string" ||
    Object.keys(doctorPeriodErrors(value)).length
  )
    return invalid();
  const scheduled = value.consultasPorDataAgendada,
    finalized = value.finalizacoesPorDataReal;
  if (
    !states(scheduled) ||
    !Array.isArray(scheduled.porDia) ||
    !finalized ||
    !count(finalized.totalFinalizadas) ||
    !duration(finalized.duracaoMediaSegundos) ||
    !Array.isArray(finalized.porDia)
  )
    return invalid();
  const inPeriod = (date: string) =>
    typeof date === "string" &&
    civilDay(date) !== undefined &&
    date >= value.inicio &&
    date <= value.fim;
  if (
    scheduled.porDia.some(
      (day) => !day || !inPeriod(day.data) || !states(day),
    ) ||
    finalized.porDia.some(
      (day) =>
        !day ||
        !inPeriod(day.data) ||
        !count(day.totalFinalizadas) ||
        !duration(day.duracaoMediaSegundos),
    )
  )
    return invalid();
  return value;
}
