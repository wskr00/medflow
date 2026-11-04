import { civilDay, shiftDay } from "../date/civil-date";
export interface DailyCountPoint {
  readonly data: string;
  readonly quantidade: number;
}
/** Missing positions remain null, rather than fabricated zero observations or compressed time. */
export function chartSeries(
  inicio: string,
  fim: string,
  points: readonly DailyCountPoint[],
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
