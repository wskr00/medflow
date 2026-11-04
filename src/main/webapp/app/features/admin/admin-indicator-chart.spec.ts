import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminIndicatorChart } from "./admin-indicator-chart";
import { Chart } from "chart.js";

vi.mock("chart.js", () => {
  class FakeChart {
    declare static configs: { type: string; options: { animation: unknown } }[];
    declare static destroyed: number;
    declare static fail: boolean;
    static register() {}
    readonly options: { animation: unknown };
    destroy() {
      FakeChart.destroyed++;
    }
    update() {}
    constructor(
      _canvas: unknown,
      config: { type: string; options: { animation: unknown } },
    ) {
      if (FakeChart.fail) throw new Error("canvas unavailable");
      this.options = config.options;
      FakeChart.configs.push(config);
    }
  }
  FakeChart.configs = [];
  FakeChart.destroyed = 0;
  FakeChart.fail = false;
  return {
    Chart: FakeChart,
    BarController: {},
    BarElement: {},
    CategoryScale: {},
    LinearScale: {},
    LineController: {},
    LineElement: {},
    PointElement: {},
    Tooltip: {},
  };
});
const chartMock = Chart as unknown as {
  configs: { type: string; options: { animation: unknown } }[];
  destroyed: number;
  fail: boolean;
};
function create() {
  const fixture = TestBed.createComponent(AdminIndicatorChart);
  for (const [key, value] of Object.entries({
    chartId: "test-chart",
    title: "Consultas por dia",
    description: "Por data agendada",
    inicio: "2026-11-01",
    fim: "2026-11-04",
    unit: "consultas",
    emptyText: "Sem registros",
    points: [
      { data: "2026-11-01", quantidade: 2 },
      { data: "2026-11-04", quantidade: 4 },
    ],
  }))
    fixture.componentRef.setInput(key, value);
  return fixture;
}
describe("Integração do gráfico com o ciclo de vida Angular", () => {
  beforeEach(() => {
    chartMock.configs.length = 0;
    chartMock.destroyed = 0;
    chartMock.fail = false;
    TestBed.configureTestingModule({ imports: [AdminIndicatorChart] });
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          fillRect() {},
          getImageData: () => ({ data: [0, 95, 97, 255] }),
        }) as unknown as CanvasRenderingContext2D,
    );
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("desliga animações com movimento reduzido e destrói instâncias ao atualizar/sair", async () => {
    const fixture = create();
    await fixture.whenStable();
    await vi.waitFor(() => expect(chartMock.configs).toHaveLength(1));
    expect(chartMock.configs[0].options.animation).toBe(false);
    fixture.componentRef.setInput("fim", "2027-01-01");
    await fixture.whenStable();
    await vi.waitFor(() => expect(chartMock.configs).toHaveLength(2));
    expect(chartMock.configs[1].type).toBe("line");
    expect(chartMock.destroyed).toBe(1);
    fixture.destroy();
    expect(chartMock.destroyed).toBe(2);
  });
  it("mantém a tabela utilizável se a renderização do canvas falhar", async () => {
    chartMock.fail = true;
    const fixture = create();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        "O gráfico não pôde ser desenhado",
      );
    });
    const table = fixture.nativeElement.querySelector(
      "#test-chart-table",
    ) as HTMLElement;
    expect(table.hidden).toBe(false);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(table.textContent).toContain("4");
  });
});
