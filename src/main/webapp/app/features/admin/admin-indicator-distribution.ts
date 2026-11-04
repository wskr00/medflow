import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from "@angular/core";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { IndicatorDimension } from "./admin-indicators.models";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButtonImports],
  selector: "app-admin-indicator-distribution",
  styleUrls: [
    "./admin-indicator-content.scss",
    "./admin-indicator-distribution.scss",
  ],
  templateUrl: "./admin-indicator-distribution.html",
})
export class AdminIndicatorDistribution {
  readonly distributionId = input.required<string>();
  readonly title = input.required<string>();
  readonly noun = input.required<string>();
  readonly rows = input.required<readonly IndicatorDimension[]>();
  readonly unit = input("consultas");
  protected readonly all = linkedSignal(() => {
    this.rows();
    return false;
  });
  protected readonly detail = linkedSignal(() => {
    this.rows();
    return false;
  });
  protected readonly ordered = computed(() =>
    [...this.rows()].sort(
      (a, b) =>
        b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"),
    ),
  );
  protected readonly shown = computed(() =>
    this.all() ? this.ordered() : this.ordered().slice(0, 6),
  );
  protected readonly maximum = computed(() =>
    Math.max(0, ...this.rows().map((row) => row.quantidade)),
  );
  protected readonly hasStates = computed(() =>
    this.rows().some((row) => row.estados),
  );
  protected width(row: IndicatorDimension) {
    return this.maximum() > 0 ? (row.quantidade / this.maximum()) * 100 : 0;
  }
}
