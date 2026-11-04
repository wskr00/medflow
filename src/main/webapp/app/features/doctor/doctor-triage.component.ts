import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmInputImports } from "@spartan-ng/helm/input";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";
import { IdentityService } from "../../auth/identity.service";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { StatusBadgeComponent } from "../../shared/ui/status-badge.component";
import { DoctorApi, doctorIssue } from "./doctor.api";
import {
  DoctorAppointment,
  DoctorIssue,
  DoctorWorkspace,
  Page,
} from "./doctor.models";

@Component({
  selector: "app-doctor-triage",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DoctorApi],
  imports: [
    RouterLink,
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
    HlmSpinnerImports,
    StatePanelComponent,
    StatusBadgeComponent,
  ],
  templateUrl: "./doctor-triage.component.html",
  styleUrl: "./doctor-triage.component.scss",
})
export class DoctorTriageComponent {
  private readonly api = inject(DoctorApi);
  private readonly router = inject(Router);
  private readonly identity = inject(IdentityService);
  protected readonly date = signal(this.today());
  protected readonly busyId = signal<string | null>(null);
  protected readonly notice = signal<DoctorIssue | null>(null);
  protected readonly agendaPage = signal(0);
  protected readonly queuePage = signal(0);
  protected readonly agenda = httpResource<Page<DoctorAppointment>>(() =>
    this.api.agenda({ data: this.date(), page: this.agendaPage(), size: 20 }),
  );
  protected readonly queue = httpResource<Page<DoctorAppointment>>(() =>
    this.api.queue({ page: this.queuePage(), size: 20 }),
  );
  protected readonly agendaData = computed(() =>
    this.agenda.hasValue() ? this.agenda.value() : undefined,
  );
  protected readonly queueData = computed(() =>
    this.queue.hasValue() ? this.queue.value() : undefined,
  );
  protected readonly agendaItems = computed(
    () => this.agendaData()?.items ?? [],
  );
  protected readonly queueItems = computed(() => this.queueData()?.items ?? []);
  protected start(item: DoctorAppointment) {
    if (!item.allowedActions.canStart || this.busyId()) return;
    this.busyId.set(item.id);
    this.notice.set(null);
    this.api
      .start(item.id, item.version)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (workspace: DoctorWorkspace) =>
          void this.router.navigate([
            "/workspace/doctor/atendimentos",
            workspace.atendimento.id,
          ]),
        error: (error) => {
          this.notice.set(doctorIssue(error, "triage"));
          this.agenda.reload();
          this.queue.reload();
        },
      });
  }
  protected reload() {
    this.notice.set(null);
    this.agenda.reload();
    this.queue.reload();
  }
  protected issue(error: unknown) {
    return doctorIssue(error, "triage");
  }
  protected time(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
  protected hasNext(page: Page<unknown> | undefined) {
    return !!page && (page.page + 1) * page.size < page.totalElements;
  }
  protected changeDate(value: string) {
    if (value) {
      this.date.set(value);
      this.agendaPage.set(0);
    }
  }
  protected dateTime(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
  private today() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: this.identity.identity.value()?.timeZone ?? "America/Belem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
}
