/** Civil dates are sent without UTC conversion; timestamps are displayed in the clinic zone. */
export function civilDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function calendarToday(timeZone?: string): Date {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)!.value);
  return new Date(part("year"), part("month") - 1, part("day"));
}
export function slotKey(slot: {
  regraAgendaId: string;
  inicio: string;
}): string {
  return `${slot.regraAgendaId}|${slot.inicio}`;
}
