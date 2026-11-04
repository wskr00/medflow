const dayMs = 86_400_000;
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
export function civilLabel(value: string, short = false): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "numeric",
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
  }).format(new Date(`${value}T12:00:00Z`));
}
