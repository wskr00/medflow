import { DOCUMENT } from "@angular/common";
import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Injector,
  afterNextRender,
  inject,
  signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmDialog, HlmDialogImports } from "@spartan-ng/helm/dialog";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";
import { IdentityService } from "../../auth/identity.service";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { StatusBadgeComponent } from "../../shared/ui/status-badge.component";
import { PatientApi, patientIssue } from "./patient.api";
import { Appointment, Page, PatientIssue } from "./patient.models";

@Component({
  selector: "app-patient-appointments",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PatientApi],
  imports: [
    RouterLink,
    HlmAlertImports,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    StatePanelComponent,
    StatusBadgeComponent,
  ],
  templateUrl: "./patient-appointments.component.html",
  styleUrls: [
    "./patient-journey.scss",
    "./patient-appointments.component.scss",
  ],
})
export class PatientAppointmentsComponent {
  private readonly api = inject(PatientApi);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly identity = inject(IdentityService);
  protected readonly page = signal(0);
  readonly resource = httpResource<Page<Appointment>>(() =>
    this.api.appointments("UPCOMING", undefined, this.page()),
  );
  protected readonly items = computed(() =>
    this.resource.hasValue() ? this.resource.value().items : [],
  );
  protected readonly hasNext = computed(
    () =>
      this.resource.hasValue() &&
      (this.page() + 1) * this.resource.value().size <
        this.resource.value().totalElements,
  );
  protected readonly target = signal<Appointment | null>(null);
  protected readonly saving = signal(false);
  protected readonly problem = signal<PatientIssue | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected issue(error: unknown) {
    return patientIssue(error);
  }
  protected date(
    value: string,
    kind: "day" | "month" | "weekday" | "time" | "full",
  ) {
    const options: Record<string, Intl.DateTimeFormatOptions> = {
      day: { day: "2-digit" },
      month: { month: "short", year: "numeric" },
      weekday: { weekday: "long" },
      time: { timeStyle: "short" },
      full: { dateStyle: "full", timeStyle: "short" },
    };
    return new Intl.DateTimeFormat("pt-BR", {
      ...options[kind],
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
  protected openCancel(appointment: Appointment, dialog: HlmDialog) {
    if (this.saving() || !appointment.allowedActions.canCancel) return;
    this.target.set(appointment);
    this.problem.set(null);
    dialog.open();
  }
  protected cancel(dialog: HlmDialog) {
    const appointment = this.target();
    if (!appointment?.allowedActions.canCancel || this.saving()) return;
    this.saving.set(true);
    this.problem.set(null);
    this.notice.set(null);
    this.api
      .cancel(appointment.id, appointment.version)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          dialog.close();
          this.notice.set(
            `Consulta de ${appointment.especialidade.nome} cancelada.`,
          );
          this.page.set(0);
          this.resource.reload();
          afterNextRender(
            () =>
              this.document
                .getElementById("patient-cancel-notice")
                ?.focus({ preventScroll: true }),
            { injector: this.injector },
          );
        },
        error: (error) => {
          const issue = patientIssue(error, "write");
          this.problem.set(issue);
          if (issue.conflict) {
            this.resource.reload();
          }
        },
      });
  }
}
