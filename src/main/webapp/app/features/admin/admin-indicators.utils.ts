import { ParamMap } from "@angular/router";
import { IndicatorFilters } from "./admin-indicators.models";
import { civilDay, clinicDay, shiftDay } from "../../shared/date/civil-date";
export {
  civilDay,
  clinicDay,
  civilLabel,
  isTimeZone,
} from "../../shared/date/civil-date";
export const filterKeys = [
  "inicio",
  "fim",
  "unidadeId",
  "especialidadeId",
] as const;
export type FilterErrors = Partial<Record<keyof IndicatorFilters, string>>;
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
