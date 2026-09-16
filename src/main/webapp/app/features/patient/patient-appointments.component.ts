import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from "@angular/core";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmDialog, HlmDialogImports } from "@spartan-ng/helm/dialog";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmInputImports } from "@spartan-ng/helm/input";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";

import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { StatusBadgeComponent } from "../../shared/ui/status-badge.component";
import { PatientAppointmentsApi, patientApiIssue } from "./patient-appointments.api";
import { clinicDateFromInstant, formatPatientDateTime } from "./patient-date-time";
import { AvailabilitySlot, PatientApiIssue, PatientAppointment, PatientFeedback } from "./patient.models";

@Component({
  selector: "app-patient-appointments",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSpinnerImports,
    StatePanelComponent,
    StatusBadgeComponent,
  ],
  template: `
    <section hlmCard aria-labelledby="appointments-title">
      <div hlmCardHeader>
        <h2 hlmCardTitle id="appointments-title">Próprios agendamentos</h2>
        <p hlmCardDescription>O servidor retorna somente consultas vinculadas à sua identidade.</p>
      </div>
      <div hlmCardContent class="flex flex-col gap-4 pb-6">
        <div class="flex justify-end"><button hlmBtn variant="outline" type="button" (click)="api.appointments.reload()">Atualizar</button></div>
        @if (api.appointments.isLoading()) {
          <app-state-panel state="loading" title="Carregando agendamentos" description="Aguarde um momento." />
        } @else if (api.appointments.error()) {
          <app-state-panel state="error" [title]="issue(api.appointments.error()).title" [description]="issue(api.appointments.error()).description" />
        } @else if ((api.appointments.value()?.items ?? []).length === 0) {
          <app-state-panel state="empty" title="Você ainda não possui agendamentos" description="Use a consulta de horários acima para iniciar um agendamento." />
        } @else {
          <div class="grid gap-4 lg:grid-cols-2">
            @for (appointment of api.appointments.value()?.items ?? []; track appointment.id) {
              <article class="border-border flex flex-col gap-4 rounded-lg border p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="flex flex-col gap-1">
                    <h3 class="font-semibold">{{ appointment.especialidade.nome }}</h3>
                    <p class="text-muted-foreground text-sm">{{ appointment.medico.nome }} · {{ format(appointment.inicio) }}</p>
                  </div>
                  <app-status-badge [status]="appointment.status" />
                </div>
                <dl class="text-muted-foreground grid gap-1 text-sm">
                  <div><dt class="inline font-medium text-foreground">Unidade: </dt><dd class="inline">{{ appointment.unidade.nome }}</dd></div>
                  <div><dt class="inline font-medium text-foreground">Consultório: </dt><dd class="inline">{{ appointment.consultorio.nome }}</dd></div>
                </dl>
                @if (appointment.status === "AGENDADA") {
                  <div class="flex flex-wrap gap-3">
                    <hlm-dialog #rescheduleDialog="hlmDialog">
                      <button hlmDialogTrigger hlmBtn variant="outline" type="button" (click)="openReschedule(appointment)">Reagendar</button>
                      <hlm-dialog-content *hlmDialogPortal class="sm:max-w-2xl">
                        <hlm-dialog-header><h3 hlmDialogTitle>Reagendar atendimento</h3><p hlmDialogDescription>Escolha uma nova data e um horário oferecido pelo servidor para este agendamento.</p></hlm-dialog-header>
                        @if (rescheduleTarget(); as target) {
                          <div class="flex flex-col gap-4">
                            @if (rescheduleIssue(); as issue) {
                              <section hlmAlert [variant]="issue.isConflict ? 'default' : 'destructive'" aria-live="polite"><h4 hlmAlertTitle>{{ issue.title }}</h4><p hlmAlertDescription>{{ issue.description }}</p></section>
                            }
                            <div hlmField><label hlmFieldLabel for="reschedule-date">Nova data</label><input hlmInput id="reschedule-date" type="date" [value]="rescheduleDate()" (input)="setRescheduleDate($event)" /></div>
                            @if (rescheduleAvailability.isLoading()) {
                              <app-state-panel state="loading" title="Consultando horários" description="Aguarde a disponibilidade vinculada a este atendimento." />
                            } @else if (rescheduleAvailability.error()) {
                              <app-state-panel state="error" [title]="issue(rescheduleAvailability.error()).title" [description]="issue(rescheduleAvailability.error()).description" />
                              <button hlmBtn variant="outline" type="button" (click)="rescheduleAvailability.reload()">Tentar novamente</button>
                            } @else if ((rescheduleAvailability.value()?.items ?? []).length === 0) {
                              <app-state-panel state="empty" title="Não há horário nessa data" description="Escolha outra data para consultar a disponibilidade." />
                            } @else {
                              <div class="grid gap-2 sm:grid-cols-2">
                                @for (slot of rescheduleAvailability.value()?.items ?? []; track slot.regraAgendaId + slot.inicio) {
                                  <button hlmBtn variant="outline" type="button" class="h-auto min-h-11 justify-start whitespace-normal py-3 text-start" [attr.aria-pressed]="rescheduleSlot()?.inicio === slot.inicio" (click)="rescheduleSlot.set(slot)">{{ format(slot.inicio) }} · {{ slot.consultorio.nome }}</button>
                                }
                              </div>
                            }
                            @if (rescheduleSlot(); as slot) {
                              <section hlmAlert><h4 hlmAlertTitle>Confirmar novo horário</h4><p hlmAlertDescription>{{ target.especialidade.nome }} com {{ target.medico.nome }}, {{ format(slot.inicio) }}.</p></section>
                            }
                          </div>
                        }
                        <hlm-dialog-footer>
                          <button hlmBtn variant="outline" type="button" hlmDialogClose>Voltar</button>
                          <button hlmBtn type="button" [disabled]="!rescheduleSlot() || rescheduling()" (click)="confirmReschedule(rescheduleDialog)">@if (rescheduling()) { <hlm-spinner /> } {{ rescheduling() ? "Confirmando..." : "Confirmar reagendamento" }}</button>
                        </hlm-dialog-footer>
                      </hlm-dialog-content>
                    </hlm-dialog>
                    <hlm-dialog #cancellationDialog="hlmDialog">
                      <button hlmDialogTrigger hlmBtn variant="destructive" type="button" (click)="openCancellation(appointment)">Cancelar</button>
                      <hlm-dialog-content *hlmDialogPortal>
                        <hlm-dialog-header><h3 hlmDialogTitle>Cancelar agendamento?</h3><p hlmDialogDescription>Esta ação será confirmada pelo servidor e não pode ser desfeita por esta tela.</p></hlm-dialog-header>
                        @if (cancellationIssue(); as issue) {
                          <section hlmAlert [variant]="issue.isConflict ? 'default' : 'destructive'" aria-live="polite"><h4 hlmAlertTitle>{{ issue.title }}</h4><p hlmAlertDescription>{{ issue.description }}</p></section>
                        }
                        <hlm-dialog-footer>
                          <button hlmBtn variant="outline" type="button" hlmDialogClose>Manter agendamento</button>
                          <button hlmBtn variant="destructive" type="button" [disabled]="cancelling()" (click)="confirmCancellation(cancellationDialog)">@if (cancelling()) { <hlm-spinner /> } {{ cancelling() ? "Cancelando..." : "Confirmar cancelamento" }}</button>
                        </hlm-dialog-footer>
                      </hlm-dialog-content>
                    </hlm-dialog>
                  </div>
                }
              </article>
            }
          </div>
          <nav aria-label="Paginação dos agendamentos" class="flex flex-wrap items-center gap-3">
            <button hlmBtn variant="outline" type="button" [disabled]="api.appointmentsPage() === 0" (click)="previousPage()">Página anterior</button>
            <p class="text-muted-foreground text-sm" aria-live="polite">Página {{ api.appointmentsPage() + 1 }} de {{ totalPages() }} · {{ api.appointments.value()?.totalElements }} agendamentos</p>
            <button hlmBtn variant="outline" type="button" [disabled]="api.appointmentsPage() + 1 >= totalPages()" (click)="nextPage()">Próxima página</button>
          </nav>
        }
      </div>
    </section>
  `,
})
export class PatientAppointmentsComponent {
  protected readonly api = inject(PatientAppointmentsApi);
  readonly timeZone = input.required<string>();
  readonly feedback = output<PatientFeedback>();
  protected readonly rescheduling = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly rescheduleTarget = signal<PatientAppointment | null>(null);
  protected readonly cancellationTarget = signal<PatientAppointment | null>(null);
  protected readonly rescheduleDate = signal("");
  protected readonly rescheduleSlot = signal<AvailabilitySlot | null>(null);
  protected readonly rescheduleIssue = signal<PatientApiIssue | null>(null);
  protected readonly cancellationIssue = signal<PatientApiIssue | null>(null);
  protected readonly rescheduleAvailability = this.api.rescheduleAvailability(
    computed(() => this.rescheduleTarget()?.id ?? null),
    this.rescheduleDate,
  );

  protected openReschedule(appointment: PatientAppointment): void {
    this.rescheduleTarget.set(appointment);
    this.rescheduleDate.set(clinicDateFromInstant(appointment.inicio, this.timeZone()));
    this.rescheduleSlot.set(null);
    this.rescheduleIssue.set(null);
  }

  protected setRescheduleDate(event: Event): void {
    this.rescheduleDate.set((event.target as HTMLInputElement).value);
    this.rescheduleSlot.set(null);
    this.rescheduleIssue.set(null);
  }

  protected confirmReschedule(dialog: HlmDialog): void {
    const appointment = this.rescheduleTarget();
    const slot = this.rescheduleSlot();
    if (!appointment || !slot) return;
    this.rescheduling.set(true);
    this.api.reschedule(appointment.id, { regraAgendaId: slot.regraAgendaId, inicio: slot.inicio }, appointment.version)
      .pipe(finalize(() => this.rescheduling.set(false)))
      .subscribe({
        next: () => {
          this.feedback.emit({ kind: "success", title: "Agendamento reagendado", description: "O novo horário foi confirmado pelo servidor." });
          dialog.close();
          this.clearReschedule();
          this.api.appointments.reload();
        },
        error: (error: unknown) => this.handleRescheduleError(dialog, error),
      });
  }

  protected openCancellation(appointment: PatientAppointment): void {
    this.cancellationTarget.set(appointment);
    this.cancellationIssue.set(null);
  }

  protected confirmCancellation(dialog: HlmDialog): void {
    const appointment = this.cancellationTarget();
    if (!appointment) return;
    this.cancelling.set(true);
    this.cancellationIssue.set(null);
    this.api.cancel(appointment.id, appointment.version)
      .pipe(finalize(() => this.cancelling.set(false)))
      .subscribe({
        next: () => {
          this.feedback.emit({ kind: "success", title: "Agendamento cancelado", description: "O cancelamento foi confirmado pelo servidor." });
          dialog.close();
          this.cancellationTarget.set(null);
          this.api.appointments.reload();
        },
        error: (error: unknown) => this.handleCancellationError(dialog, error),
      });
  }

  protected format(value: string): string {
    return formatPatientDateTime(value, this.timeZone());
  }

  protected issue(error: unknown) {
    return patientApiIssue(error);
  }

  protected totalPages(): number {
    const response = this.api.appointments.value();
    return response ? Math.max(1, Math.ceil(response.totalElements / response.size)) : 1;
  }

  protected previousPage(): void {
    this.api.setAppointmentsPage(this.api.appointmentsPage() - 1);
  }

  protected nextPage(): void {
    this.api.setAppointmentsPage(this.api.appointmentsPage() + 1);
  }

  private handleRescheduleError(dialog: HlmDialog, error: unknown): void {
    const issue = patientApiIssue(error);
    this.feedback.emit({ kind: issue.isConflict ? "conflict" : "error", title: issue.title, description: issue.description });
    if (this.invalidatesTarget(issue.code)) {
      dialog.close();
      this.clearReschedule();
      this.api.appointments.reload();
      return;
    }
    this.rescheduleIssue.set(issue);
    if (issue.code === "HORARIO_INDISPONIVEL") {
      this.rescheduleSlot.set(null);
      this.rescheduleAvailability.reload();
    }
    if (issue.isConflict) this.api.appointments.reload();
  }

  private handleCancellationError(dialog: HlmDialog, error: unknown): void {
    const issue = patientApiIssue(error);
    this.feedback.emit({ kind: issue.isConflict ? "conflict" : "error", title: issue.title, description: issue.description });
    if (this.invalidatesTarget(issue.code)) {
      dialog.close();
      this.cancellationTarget.set(null);
      this.cancellationIssue.set(null);
      this.api.appointments.reload();
      return;
    }
    this.cancellationIssue.set(issue);
    if (issue.isConflict) this.api.appointments.reload();
  }

  private invalidatesTarget(code: string): boolean {
    return ["VERSAO_DESATUALIZADA", "TRANSICAO_INVALIDA", "RECURSO_NAO_ENCONTRADO"].includes(code);
  }

  private clearReschedule(): void {
    this.rescheduleTarget.set(null);
    this.rescheduleSlot.set(null);
    this.rescheduleIssue.set(null);
  }
}
