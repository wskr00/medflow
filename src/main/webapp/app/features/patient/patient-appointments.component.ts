import { httpResource } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmDialog, HlmDialogImports } from "@spartan-ng/helm/dialog";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";
import { IdentityService } from "../../auth/identity.service";
import { PageHeaderComponent } from "../../shared/ui/page-header.component";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { PatientApi, patientIssue } from "./patient.api";
import { Appointment, Page } from "./patient.models";

@Component({
  selector: "app-patient-appointments", changeDetection: ChangeDetectionStrategy.OnPush, providers: [PatientApi],
  imports: [RouterLink, HlmAlertImports, HlmButtonImports, HlmCardImports, HlmDialogImports, HlmSpinnerImports, PageHeaderComponent, StatePanelComponent],
  template: `<div class="flex flex-col gap-6"><app-page-header title="Consultas" description="Veja sua próxima consulta e os próximos agendamentos." />@if (resource.isLoading()) { <app-state-panel state="loading" title="Carregando consultas" description="Aguarde um momento." /> } @else if (resource.error()) { <app-state-panel state="error" [title]="issue(resource.error()).title" [description]="issue(resource.error()).description" /><button hlmBtn variant="outline" type="button" (click)="resource.reload()">Tentar novamente</button> } @else if (!items().length) { <app-state-panel state="empty" title="Nenhuma consulta futura" description="Escolha um horário quando quiser agendar uma consulta." /><a hlmBtn routerLink="../agendar">Agendar consulta</a> } @else { <section class="grid gap-4 md:grid-cols-2" aria-labelledby="next-appointment-title">@for (appointment of items(); track appointment.id; let first = $first) { <article hlmCard [class.border-primary]="first" [class.shadow-sm]="first" [class.md:col-span-2]="first"><div hlmCardHeader><p class="text-primary text-sm font-semibold">{{ first ? 'PRÓXIMA CONSULTA' : 'OUTRA CONSULTA' }}</p><h2 hlmCardTitle [id]="first ? 'next-appointment-title' : null">{{ appointment.especialidade.nome }}</h2><p hlmCardDescription>{{ dateTime(appointment.inicio) }} · {{ appointment.medico.nome }}</p></div><div hlmCardContent class="flex flex-col gap-3"><p class="text-muted-foreground text-sm">{{ appointment.unidade.nome }} · Consultório {{ appointment.consultorio.nome }}</p>@if (appointment.allowedActions.canReschedule || appointment.allowedActions.canCancel) { <div class="flex flex-wrap gap-3">@if (appointment.allowedActions.canReschedule) { <a hlmBtn variant="outline" [routerLink]="[appointment.id, 'reagendar']">Reagendar</a> } @if (appointment.allowedActions.canCancel) { <hlm-dialog #dialog="hlmDialog"><button hlmDialogTrigger hlmBtn variant="destructive" type="button" (click)="target.set(appointment)">Cancelar consulta</button><hlm-dialog-content *hlmDialogPortal><hlm-dialog-header><h2 hlmDialogTitle>Cancelar consulta?</h2><p hlmDialogDescription>Você cancelará a consulta de {{ appointment.especialidade.nome }} em {{ dateTime(appointment.inicio) }}.</p></hlm-dialog-header>@if (problem(); as item) { <section hlmAlert variant="destructive"><h3 hlmAlertTitle>{{ item.title }}</h3><p hlmAlertDescription>{{ item.description }}</p></section> }<hlm-dialog-footer><button hlmBtn variant="outline" type="button" hlmDialogClose autofocus>Manter consulta</button><button hlmBtn variant="destructive" type="button" [disabled]="saving()" (click)="cancel(dialog)">@if (saving()) { <hlm-spinner /> } Sim, cancelar consulta</button></hlm-dialog-footer></hlm-dialog-content></hlm-dialog> }</div> }</div></article> }</section> }</div>`,
})
export class PatientAppointmentsComponent {
  private readonly api = inject(PatientApi); private readonly identity = inject(IdentityService);
  readonly resource = httpResource<Page<Appointment>>(() => this.api.appointments("UPCOMING"));
  protected readonly items = computed(() => this.resource.value()?.items ?? []); protected readonly target = signal<Appointment | null>(null); protected readonly saving = signal(false); protected readonly problem = signal<ReturnType<typeof patientIssue> | null>(null);
  protected issue(error: unknown) { return patientIssue(error); }
  protected dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: this.identity.identity.value()?.timeZone }).format(new Date(value)); }
  protected cancel(dialog: HlmDialog) { const appointment = this.target(); if (!appointment) return; this.saving.set(true); this.problem.set(null); this.api.cancel(appointment.id, appointment.version).pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { dialog.close(); this.resource.reload(); }, error: (error) => { this.problem.set(patientIssue(error)); this.resource.reload(); } }); }
}
