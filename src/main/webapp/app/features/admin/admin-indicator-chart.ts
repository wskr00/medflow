import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from "@angular/core";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { IndicatorPoint } from "./admin-indicators.models";
import { chartSeries, civilDay, civilLabel } from "./admin-indicators.utils";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButtonImports],
  selector: "app-admin-indicator-chart",
  styleUrls: ["./admin-indicator-content.scss", "./admin-indicator-chart.scss"],
  templateUrl: "./admin-indicator-chart.html",
})
export class AdminIndicatorChart {
  readonly chartId = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly inicio = input.required<string>();
  readonly fim = input.required<string>();
  readonly points = input.required<readonly IndicatorPoint[]>();
  readonly unit = input.required<string>();
  readonly emptyText = input.required<string>();
  readonly tone = input<"primary" | "info">("primary");
  protected readonly expanded = linkedSignal(() => this.points().length === 1);
  protected readonly failed = signal(false);
  protected readonly showTable = computed(
    () => this.expanded() || this.failed(),
  );
  protected readonly series = computed(() =>
    chartSeries(this.inicio(), this.fim(), this.points()),
  );
  protected readonly kind = computed(() =>
    civilDay(this.fim())! - civilDay(this.inicio())! < 31 ? "bar" : "line",
  );
  protected readonly ordered = computed(() =>
    [...this.points()].sort((a, b) => a.data.localeCompare(b.data)),
  );
  protected readonly dateLabel = civilLabel;
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>("canvas");
  private readonly document = inject(DOCUMENT);
  constructor() {
    afterRenderEffect((onCleanup) => {
      const canvas = this.canvas()?.nativeElement;
      const series = this.series(),
        kind = this.kind(),
        unit = this.unit(),
        tone = this.tone();
      if (!canvas) return;
      let alive = true;
      let chart: Chart<"bar" | "line", (number | null)[], string> | undefined;
      const view = this.document.defaultView;
      const motion = view?.matchMedia("(prefers-reduced-motion: reduce)");
      const onMotion = () => {
        if (chart) {
          chart.options.animation = motion?.matches ? false : { duration: 180 };
          chart.update("none");
        }
      };
      motion?.addEventListener("change", onMotion);
      onCleanup(() => {
        alive = false;
        motion?.removeEventListener("change", onMotion);
        chart?.destroy();
      });
      void Promise.resolve(this.document.fonts?.ready).then(() => {
        if (!alive) return;
        try {
          const rootStyle = view!.getComputedStyle(
            this.document.documentElement,
          );
          // Resolve OKLCH tokens to RGB for Chart.js color interpolation as well as canvas rendering.
          const color = (token: string) => {
            const sample = this.document.createElement("canvas");
            sample.width = sample.height = 1;
            const context = sample.getContext("2d")!;
            context.fillStyle = rootStyle.getPropertyValue(token).trim();
            context.fillRect(0, 0, 1, 1);
            const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
            return `rgb(${r}, ${g}, ${b})`;
          };
          const ink = color("--foreground"),
            muted = color("--muted-foreground"),
            border = color("--border"),
            main = color(`--${tone}`);
          chart = new Chart(canvas, {
            type: kind,
            data: {
              labels: series.labels,
              datasets: [
                {
                  label: unit,
                  data: series.values,
                  backgroundColor: main,
                  borderColor: main,
                  borderWidth: kind === "line" ? 2 : 0,
                  borderRadius: kind === "bar" ? 2 : 0,
                  maxBarThickness: 44,
                  pointRadius: series.labels.length > 90 ? 1.5 : 3,
                  pointHoverRadius: 4,
                  tension: 0,
                  spanGaps: false,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              locale: "pt-BR",
              animation: motion?.matches ? false : { duration: 180 },
              layout: { padding: { top: 22 } },
              interaction: { mode: "nearest", intersect: true },
              plugins: {
                tooltip: {
                  callbacks: {
                    title: (items) =>
                      items[0] ? civilLabel(items[0].label) : "",
                    label: (item) => `${item.parsed.y} ${unit}`,
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  border: { display: false },
                  ticks: {
                    color: muted,
                    maxRotation: 0,
                    maxTicksLimit: 7,
                    font: { family: "IBM Plex Sans Variable", size: 12 },
                    callback: function (value) {
                      return civilLabel(
                        this.getLabelForValue(Number(value)),
                        true,
                      );
                    },
                  },
                },
                y: {
                  beginAtZero: true,
                  border: { display: false },
                  grid: { color: border },
                  ticks: {
                    color: muted,
                    precision: 0,
                    maxTicksLimit: 5,
                    font: { family: "IBM Plex Sans Variable", size: 12 },
                  },
                },
              },
            },
            plugins: [
              {
                id: "medflow-values",
                afterDatasetsDraw: (graph) => {
                  if (kind !== "bar" || series.labels.length > 14) return;
                  const { ctx } = graph;
                  ctx.save();
                  ctx.fillStyle = ink;
                  ctx.font = '500 12px "IBM Plex Sans Variable"';
                  ctx.textAlign = "center";
                  graph.getDatasetMeta(0).data.forEach((element, index) => {
                    const value = series.values[index];
                    if (value === null) return;
                    const point = element as unknown as {
                      x: number;
                      y: number;
                    };
                    ctx.fillText(String(value), point.x, point.y - 8);
                  });
                  ctx.restore();
                },
              },
            ],
          });
          this.failed.set(false);
        } catch {
          this.failed.set(true);
        }
      });
    });
  }
}
