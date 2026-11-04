import { ParamMap } from "@angular/router";
import { IndicatorFilters, IndicatorPoint } from "./admin-indicators.models";

const dayMs = 86_400_000;
export const filterKeys = [
  "inicio",
  "fim",
  "unidadeId",
  "especialidadeId",
] as const;
export type FilterErrors = Partial<Record<keyof IndicatorFilters, string>>;
/** A civil date is parsed in UTC only for calendar arithmetic, never to infer the clinic's day. */
export function civilDay(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const instant = Date.parse(`${value}T12:00:00Z`);
  if (
    !Number.isFinite(instant) ||
    new Date(instant).toISOString().slice(0, 10) !== value
  )
    return undefined;
  return Math.floor(instant / dayMs);
}
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value }).format();
    return !!value;
  } catch {
    return false;
  }
}
export function clinicDay(zone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function shiftDay(value: string, offset: number): string {
  return new Date((civilDay(value)! + offset) * dayMs)
    .toISOString()
    .slice(0, 10);
}
export function presetFilters(
  zone: string,
  days = 7,
  now = new Date(),
): IndicatorFilters {
  const fim = clinicDay(zone, now);
  return {
    inicio: shiftDay(fim, 1 - days),
    fim,
    unidadeId: "",
    especialidadeId: "",
  };
}
export function filterErrors(value: IndicatorFilters): FilterErrors {
  const errors: FilterErrors = {};
  const start = civilDay(value.inicio),
    end = civilDay(value.fim);
  if (start === undefined) errors.inicio = "Informe uma data inicial válida.";
  if (end === undefined) errors.fim = "Informe uma data final válida.";
  if (start !== undefined && end !== undefined) {
    if (end < start)
      errors.fim = "A data final deve ser igual ou posterior à inicial.";
    else if (end - start >= 366)
      errors.fim =
        "Selecione um intervalo de até 366 dias, incluindo início e fim.";
  }
  for (const key of ["unidadeId", "especialidadeId"] as const) {
    if (
      value[key] &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value[key],
      )
    )
      errors[key] = "Selecione um cadastro válido ou limpe este filtro.";
  }
  return errors;
}
export function filtersFromQuery(
  query: ParamMap,
  zone: string,
): IndicatorFilters {
  const defaults = presetFilters(zone);
  const hasPeriod = query.has("inicio") || query.has("fim");
  return {
    inicio: hasPeriod ? (query.get("inicio") ?? "") : defaults.inicio,
    fim: hasPeriod ? (query.get("fim") ?? "") : defaults.fim,
    unidadeId: query.get("unidadeId") ?? "",
    especialidadeId: query.get("especialidadeId") ?? "",
  };
}
export function sameFilters(a: IndicatorFilters, b: IndicatorFilters): boolean {
  return filterKeys.every((key) => a[key] === b[key]);
}
export function civilLabel(value: string, short = false): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "numeric",
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
  }).format(new Date(`${value}T12:00:00Z`));
}
/** Missing positions remain null, rather than fabricated zero observations or compressed time. */
export function chartSeries(
  inicio: string,
  fim: string,
  points: readonly IndicatorPoint[],
) {
  const start = civilDay(inicio),
    end = civilDay(fim);
  if (
    start === undefined ||
    end === undefined ||
    end < start ||
    end - start >= 366
  )
    return { labels: [], values: [] };
  const byDay = new Map(points.map((point) => [point.data, point.quantidade]));
  const labels = Array.from({ length: end - start + 1 }, (_, index) =>
    shiftDay(inicio, index),
  );
  return { labels, values: labels.map((date) => byDay.get(date) ?? null) };
}
