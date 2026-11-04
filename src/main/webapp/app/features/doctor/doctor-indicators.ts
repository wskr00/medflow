import { DOCUMENT } from "@angular/common";
import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormField, FormRoot, form, validate } from "@angular/forms/signals";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmInputImports } from "@spartan-ng/helm/input";
import { HlmNativeSelectImports } from "@spartan-ng/helm/native-select";
import Keycloak from "keycloak-js";
import { IdentityService } from "../../auth/identity.service";
import { civilLabel, isTimeZone } from "../../shared/date/civil-date";
import { DailyCountChart } from "../../shared/ui/daily-count-chart";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import {
  DoctorIndicatorsApi,
  doctorIndicatorsIssue,
} from "./doctor-indicators.api";
import { DoctorPeriod } from "./doctor-indicators.models";
import {
  defaultDoctorPeriod,
  doctorPeriodErrors,
  doctorPeriodFromQuery,
  parseDoctorIndicators,
  registeredDuration,
  sameDoctorPeriod,
} from "./doctor-indicators.utils";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DoctorIndicatorsApi],
  imports: [
    RouterLink,
    FormField,
    FormRoot,
    HlmButtonImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    DailyCountChart,
    StatePanelComponent,
  ],
  selector: "app-doctor-indicators",
  styleUrl: "./doctor-indicators.scss",
  templateUrl: "./doctor-indicators.html",
})
export class DoctorIndicators {
  protected readonly identity = inject(IdentityService).identity;
  private readonly api = inject(DoctorIndicatorsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly keycloak = inject(Keycloak);
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly zone = computed(() =>
    this.identity.hasValue() && isTimeZone(this.identity.value().timeZone)
      ? this.identity.value().timeZone
      : undefined,
  );
  private readonly routePeriod = computed(() =>
    this.zone() ? doctorPeriodFromQuery(this.query(), this.zone()!) : undefined,
  );
  protected readonly applied = computed(() => {
    const period = this.routePeriod();
    return period && !Object.keys(doctorPeriodErrors(period)).length
      ? period
      : undefined;
  });
  protected readonly invalidUrl = computed(
    () => !!this.routePeriod() && !this.applied(),
  );
  protected readonly model = linkedSignal<DoctorPeriod>(
    () => this.routePeriod() ?? { inicio: "", fim: "" },
  );
  protected readonly preset = linkedSignal(() => {
    const period = this.routePeriod(),
      zone = this.zone();
    if (period && zone)
      for (const days of [1, 7, 30])
        if (sameDoctorPeriod(defaultDoctorPeriod(zone, days), period))
          return String(days);
    return "custom";
  });
  protected readonly periodForm = form(
    this.model,
    (path) => {
      for (const key of ["inicio", "fim"] as const)
        validate(path[key], ({ valueOf }) => {
          const errors = doctorPeriodErrors({
            inicio: valueOf(path.inicio),
            fim: valueOf(path.fim),
          });
          return errors[key]
            ? { kind: "period", message: errors[key] }
            : undefined;
        });
    },
    {
      submission: {
        action: async () => {
          await this.applyPeriod();
        },
      },
    },
  );
  protected readonly pendingPeriod = computed(
    () => !this.applied() || !sameDoctorPeriod(this.model(), this.applied()!),
  );
  protected readonly result = httpResource(
    () => (this.applied() ? this.api.url(this.applied()!) : undefined),
    {
      parse: (raw: unknown) => ({
        report: parseDoctorIndicators(raw),
        receivedAt: Date.now(),
      }),
    },
  );
  protected readonly data = computed(() => {
    if (!this.applied() || this.result.isLoading() || !this.result.hasValue())
      return undefined;
    const report = this.result.value().report;
    return sameDoctorPeriod(report, this.applied()!) ? report : undefined;
  });
  protected readonly scheduledDays = computed(() =>
    [...(this.data()?.consultasPorDataAgendada.porDia ?? [])].sort((a, b) =>
      a.data.localeCompare(b.data),
    ),
  );
  protected readonly points = computed(() =>
    this.scheduledDays().map((day) => ({
      data: day.data,
      quantidade: day.totalConsultas,
    })),
  );
  protected readonly allCompletedDays = computed(() =>
    [...(this.data()?.finalizacoesPorDataReal.porDia ?? [])].sort((a, b) =>
      a.data.localeCompare(b.data),
    ),
  );
  protected readonly allDays = linkedSignal(() => {
    this.data();
    return false;
  });
  protected readonly completedDays = computed(() =>
    this.allDays()
      ? this.allCompletedDays()
      : this.allCompletedDays().slice(0, 14),
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
  protected fieldError(key: keyof DoctorPeriod) {
    return this.periodForm[key]().touched() || this.invalidUrl()
      ? doctorPeriodErrors(this.model())[key]
      : undefined;
  }
  protected invalidSubmit() {
    const errors = doctorPeriodErrors(this.model());
    const key = (["inicio", "fim"] as const).find((key) => errors[key]);
    if (key) this.document.getElementById(`activity-${key}`)?.focus();
  }
  protected choosePreset(value: string | null | undefined) {
    if (!value) return;
    this.preset.set(value);
    if (value !== "custom" && this.zone())
      this.model.set(defaultDoctorPeriod(this.zone()!, Number(value)));
  }
  protected resetPeriod() {
    if (this.zone()) {
      this.model.set(defaultDoctorPeriod(this.zone()!));
      this.preset.set("7");
    }
  }
  private async applyPeriod() {
    const period = this.model();
    if (!this.zone() || Object.keys(doctorPeriodErrors(period)).length) return;
    if (this.applied() && sameDoctorPeriod(period, this.applied()!)) {
      this.result.reload();
      return;
    }
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { inicio: period.inicio, fim: period.fim },
    });
  }
  protected reloadContext() {
    if (!this.identity.isLoading()) this.identity.reload();
    this.result.reload();
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
  protected loginAgain() {
    void this.keycloak.login({ prompt: "login" });
  }
  protected readonly issue = doctorIndicatorsIssue;
  protected readonly label = civilLabel;
  protected readonly duration = registeredDuration;
}
