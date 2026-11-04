import { DOCUMENT } from "@angular/common";
import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from "@angular/core";
import { rxResource, toSignal } from "@angular/core/rxjs-interop";
import { FormField, FormRoot, form, validate } from "@angular/forms/signals";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmInputImports } from "@spartan-ng/helm/input";
import { HlmNativeSelectImports } from "@spartan-ng/helm/native-select";
import Keycloak from "keycloak-js";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { AdminApi } from "./admin.api";
import { Clinic, Specialty, Unit } from "./admin.models";
import { AdminIndicatorsApi, indicatorIssue } from "./admin-indicators.api";
import {
  AdminIndicatorsResponse,
  IndicatorFilters,
} from "./admin-indicators.models";
import {
  civilLabel,
  filterErrors,
  filterKeys,
  filtersFromQuery,
  isTimeZone,
  presetFilters,
  sameFilters,
} from "./admin-indicators.utils";
import { DailyCountChart } from "../../shared/ui/daily-count-chart";
import { AdminIndicatorDistribution } from "./admin-indicator-distribution";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminApi, AdminIndicatorsApi],
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    HlmButtonImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    StatePanelComponent,
    DailyCountChart,
    AdminIndicatorDistribution,
  ],
  selector: "app-admin-indicators",
  styleUrl: "./admin-indicators.scss",
  templateUrl: "./admin-indicators.html",
})
export class AdminIndicators {
  private readonly api = inject(AdminIndicatorsApi);
  private readonly configuration = inject(AdminApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly keycloak = inject(Keycloak);
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly clinic = httpResource<Clinic>(() =>
    this.configuration.clinic(),
  );
  protected readonly zone = computed(() =>
    this.clinic.hasValue() && isTimeZone(this.clinic.value().timeZone)
      ? this.clinic.value().timeZone
      : undefined,
  );
  private readonly routeFilters = computed(() =>
    this.zone() ? filtersFromQuery(this.query(), this.zone()!) : undefined,
  );
  protected readonly applied = computed(() => {
    const filters = this.routeFilters();
    return filters && !Object.keys(filterErrors(filters)).length
      ? filters
      : undefined;
  });
  protected readonly invalidUrl = computed(
    () => !!this.routeFilters() && !this.applied(),
  );
  protected readonly model = linkedSignal<IndicatorFilters>(
    () =>
      this.routeFilters() ?? {
        inicio: "",
        fim: "",
        unidadeId: "",
        especialidadeId: "",
      },
  );
  protected readonly period = linkedSignal(() => {
    const value = this.routeFilters(),
      zone = this.zone();
    if (value && zone)
      for (const days of [1, 7, 30]) {
        const defaults = presetFilters(zone, days);
        if (defaults.inicio === value.inicio && defaults.fim === value.fim)
          return String(days);
      }
    return "custom";
  });
  protected readonly filtersForm = form(
    this.model,
    (path) => {
      for (const key of filterKeys)
        validate(path[key], ({ valueOf }) => {
          const errors = filterErrors({
            inicio: valueOf(path.inicio),
            fim: valueOf(path.fim),
            unidadeId: valueOf(path.unidadeId),
            especialidadeId: valueOf(path.especialidadeId),
          });
          return errors[key]
            ? { kind: "filter", message: errors[key] }
            : undefined;
        });
    },
    {
      submission: {
        action: async () => {
          await this.applyFilters();
        },
      },
    },
  );
  protected readonly pendingFilters = computed(
    () => !this.applied() || !sameFilters(this.model(), this.applied()!),
  );
  protected readonly units = rxResource({
    stream: () => this.api.catalog<Unit>("unidades"),
  });
  protected readonly specialties = rxResource({
    stream: () => this.api.catalog<Specialty>("especialidades"),
  });
  protected readonly unitOptions = computed(() =>
    this.units.hasValue() ? this.units.value() : [],
  );
  protected readonly specialtyOptions = computed(() =>
    this.specialties.hasValue() ? this.specialties.value() : [],
  );
  protected readonly selectedUnit = httpResource<Unit>(() =>
    this.applied()?.unidadeId
      ? this.configuration.unit(this.applied()!.unidadeId)
      : undefined,
  );
  protected readonly selectedSpecialty = httpResource<Specialty>(() =>
    this.applied()?.especialidadeId
      ? this.configuration.specialty(this.applied()!.especialidadeId)
      : undefined,
  );
  protected readonly missingUnit = computed(
    () =>
      !!this.model().unidadeId &&
      !this.unitOptions().some((item) => item.id === this.model().unidadeId),
  );
  protected readonly missingSpecialty = computed(
    () =>
      !!this.model().especialidadeId &&
      !this.specialtyOptions().some(
        (item) => item.id === this.model().especialidadeId,
      ),
  );
  protected readonly result = httpResource(
    () => (this.applied() ? this.api.url(this.applied()!) : undefined),
    {
      parse: (raw: unknown) => {
        const data = raw as AdminIndicatorsResponse;
        if (
          !data ||
          !isTimeZone(data.timeZone) ||
          !data.consultasPorDataAgendada ||
          !data.finalizacoesPorDataReal
        )
          throw new Error("Resposta de indicadores inválida");
        const counts = data.consultasPorDataAgendada;
        const values = [
          counts.totalConsultas,
          counts.agendadas,
          counts.emEspera,
          counts.emAtendimento,
          counts.finalizadas,
          counts.canceladas,
          data.finalizacoesPorDataReal.totalFinalizadas,
        ];
        if (values.some((value) => !Number.isSafeInteger(value) || value < 0))
          throw new Error("Contagens indisponíveis");
        return { data, receivedAt: Date.now() };
      },
    },
  );
  protected readonly data = computed(() => {
    if (!this.applied() || this.result.isLoading() || !this.result.hasValue())
      return undefined;
    const data = this.result.value().data;
    return data.inicio === this.applied()!.inicio &&
      data.fim === this.applied()!.fim
      ? data
      : undefined;
  });
  protected readonly scheduledPoints = computed(
    () =>
      this.data()?.consultasPorDataAgendada.porDia.map((day) => ({
        data: day.data,
        quantidade: day.totalConsultas,
      })) ?? [],
  );
  protected readonly finalizationPoints = computed(
    () =>
      this.data()?.finalizacoesPorDataReal.porDia.map((day) => ({
        data: day.data,
        quantidade: day.totalFinalizadas,
      })) ?? [],
  );
  protected readonly byUnit = computed(
    () =>
      this.data()?.consultasPorDataAgendada.porUnidade.map((item) => ({
        id: item.id,
        nome: item.nome,
        quantidade: item.totalConsultas,
        estados: item,
      })) ?? [],
  );
  protected readonly bySpecialty = computed(
    () =>
      this.data()?.consultasPorDataAgendada.porEspecialidade.map((item) => ({
        id: item.id,
        nome: item.nome,
        quantidade: item.totalConsultas,
        estados: item,
      })) ?? [],
  );
  protected readonly completedUnits = computed(
    () =>
      this.data()?.finalizacoesPorDataReal.porUnidade.map((item) => ({
        id: item.id,
        nome: item.nome,
        quantidade: item.totalFinalizadas,
      })) ?? [],
  );
  protected readonly completedSpecialties = computed(
    () =>
      this.data()?.finalizacoesPorDataReal.porEspecialidade.map((item) => ({
        id: item.id,
        nome: item.nome,
        quantidade: item.totalFinalizadas,
      })) ?? [],
  );
  protected readonly states = computed(() => {
    const data = this.data()?.consultasPorDataAgendada;
    return data
      ? [
          { label: "Agendadas", value: data.agendadas, kind: "scheduled" },
          { label: "Em espera", value: data.emEspera, kind: "waiting" },
          { label: "Em atendimento", value: data.emAtendimento, kind: "care" },
          { label: "Finalizadas", value: data.finalizadas, kind: "done" },
          { label: "Canceladas", value: data.canceladas, kind: "cancelled" },
        ]
      : [];
  });
  protected fieldError(key: keyof IndicatorFilters) {
    return this.filtersForm[key]().touched() || this.invalidUrl()
      ? filterErrors(this.model())[key]
      : undefined;
  }
  protected choosePeriod(value: string | null | undefined) {
    if (!value) return;
    this.period.set(value);
    if (value !== "custom" && this.zone()) {
      const { inicio, fim } = presetFilters(this.zone()!, Number(value));
      this.model.update((current) => ({ ...current, inicio, fim }));
    }
  }
  protected clearFilters() {
    if (this.zone()) {
      this.model.set(presetFilters(this.zone()!));
      this.period.set("7");
    }
  }
  private async applyFilters() {
    const value = this.model();
    if (!this.zone() || Object.keys(filterErrors(value)).length) return;
    if (this.applied() && sameFilters(value, this.applied()!)) {
      this.result.reload();
      return;
    }
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        inicio: value.inicio,
        fim: value.fim,
        unidadeId: value.unidadeId || null,
        especialidadeId: value.especialidadeId || null,
      },
    });
  }
  protected onInvalidSubmit() {
    const errors = filterErrors(this.model());
    const key = filterKeys.find((key) => errors[key]);
    if (key) this.document.getElementById(`indicators-${key}`)?.focus();
  }
  protected dimensionName(kind: "unit" | "specialty") {
    const id =
      kind === "unit"
        ? this.applied()?.unidadeId
        : this.applied()?.especialidadeId;
    if (!id)
      return kind === "unit" ? "Todas as unidades" : "Todas as especialidades";
    const options =
      kind === "unit" ? this.unitOptions() : this.specialtyOptions();
    const resource =
      kind === "unit" ? this.selectedUnit : this.selectedSpecialty;
    const item =
      options.find((item) => item.id === id) ??
      (resource.hasValue() ? resource.value() : undefined);
    return item
      ? `${item.nome}${item.ativo ? "" : " (inativa)"}`
      : kind === "unit"
        ? "Unidade selecionada (cadastro indisponível)"
        : "Especialidade selecionada (cadastro indisponível)";
  }
  protected receivedTime() {
    return this.data() && this.result.hasValue()
      ? new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: this.data()!.timeZone,
        }).format(this.result.value().receivedAt)
      : "";
  }
  protected reloadCatalogs() {
    this.units.reload();
    this.specialties.reload();
    this.selectedUnit.reload();
    this.selectedSpecialty.reload();
  }
  protected loginAgain() {
    void this.keycloak.login({ prompt: "login" });
  }
  protected readonly label = civilLabel;
  protected readonly issue = indicatorIssue;
}
