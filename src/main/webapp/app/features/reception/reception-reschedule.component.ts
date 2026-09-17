import { httpResource } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCalendarImports } from "@spartan-ng/helm/calendar";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize, map } from "rxjs";
import { IdentityService } from "../../auth/identity.service";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { ReceptionApi, receptionIssue } from "./reception.api";
import { Availability, OperationalAppointment, Slot } from "./reception.models";

@Component({
  selector: "app-reception-reschedule",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ReceptionApi],
  imports: [RouterLink, HlmAlertImports, HlmButtonImports, HlmCalendarImports, HlmCardImports, HlmSpinnerImports, StatePanelComponent],
  template: `
    <main id="reception-main" tabindex="-1" class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header class="space-y-2"><a routerLink="/workspace/reception" class="text-primary inline-flex min-h-11 items-center font-medium">← Voltar à agenda</a><h1 class="text-3xl font-semibold tracking-tight">Reagendar consulta</h1><p class="text-muted-foreground">Escolha uma nova data e revise a alteração antes de confirmar.</p></header>
      @if (appointment.isLoading()) { <app-state-panel state="loading" title="Carregando consulta" description="Aguarde um momento." /> }
      @else if (appointment.error() || !appointment.value()) { <app-state-panel state="error" [title]="issue(appointment.error()).title" [description]="issue(appointment.error()).description" /><a hlmBtn variant="outline" class="min-h-11" routerLink="/workspace/reception">Voltar à agenda</a> }
      @else { @let current = appointment.value()!;
        <section class="bg-muted rounded-xl p-4"><h2 class="font-semibold">Horário atual</h2><p>{{ current.paciente.nome }} · {{ dateTime(current.inicio) }}</p><p class="text-muted-foreground text-sm">{{ current.especialidade.nome }} · {{ current.medico.nome }} · {{ current.unidade.nome }} · {{ current.consultorio.nome }}</p></section>
        <section hlmCard><div hlmCardContent class="grid gap-6 pt-6 lg:grid-cols-[20rem_1fr]"><section><h2 class="mb-3 font-semibold">Nova data</h2><hlm-calendar [date]="date()" [min]="today" (dateChange)="changeDate($event)" /></section><section class="space-y-3"><h2 class="font-semibold">Horários disponíveis</h2>@if (availability.isLoading()) { <app-state-panel state="loading" title="Buscando horários" description="Aguarde um momento." /> } @else if (availability.error()) { <app-state-panel state="error" [title]="issue(availability.error()).title" [description]="issue(availability.error()).description" /><button hlmBtn variant="outline" type="button" class="min-h-11" (click)="availability.reload()">Tentar novamente</button> } @else if (!slots().length) { <app-state-panel state="empty" title="Sem horários nesta data" description="Escolha outra data para continuar." /> } @else { <div class="grid gap-2 sm:grid-cols-2">@for (item of slots(); track item.regraAgendaId + item.inicio) { <button hlmBtn [variant]="selected() === item ? 'default' : 'outline'" type="button" class="h-auto min-h-11 justify-start py-3 text-left" [attr.aria-pressed]="selected() === item" (click)="choose(item)"><span class="flex flex-col items-start"><span>{{ time(item.inicio) }} · {{ item.consultorio.nome }}</span>@if (selected() === item) { <span class="text-xs font-semibold">Selecionado</span> }</span></button> }</div> }</section></div><div hlmCardFooter><button hlmBtn type="button" class="min-h-11" [disabled]="!selected()" (click)="review.set(true)">Revisar novo horário</button></div></section>
        @if (review() && selected(); as next) { <section hlmCard><div hlmCardHeader><h2 hlmCardTitle>Revisar alteração</h2><p hlmCardDescription>Paciente, médico, especialidade e unidade serão preservados. O horário atual só muda após confirmar.</p></div><div hlmCardContent class="grid gap-4 md:grid-cols-2"><section class="border-border rounded-lg border p-4"><h3 class="mb-3 font-semibold">Atual</h3><dl class="space-y-2 text-sm"><div><dt class="text-muted-foreground">Data e horário</dt><dd class="font-medium">{{ dateTime(current.inicio) }}</dd></div><div><dt class="text-muted-foreground">Local</dt><dd>{{ current.unidade.nome }} · {{ current.consultorio.nome }}</dd></div></dl></section><section class="border-primary rounded-lg border p-4"><h3 class="mb-3 font-semibold">Novo</h3><dl class="space-y-2 text-sm"><div><dt class="text-muted-foreground">Data e horário</dt><dd class="font-medium">{{ dateTime(next.inicio) }}</dd></div><div><dt class="text-muted-foreground">Local</dt><dd>{{ current.unidade.nome }} · {{ next.consultorio.nome }}</dd></div></dl></section></div><div hlmCardFooter class="gap-3"><button hlmBtn variant="outline" type="button" class="min-h-11" (click)="review.set(false)">Voltar</button><button hlmBtn type="button" class="min-h-11" [disabled]="saving()" (click)="confirm(current, next)">@if (saving()) { <hlm-spinner /> } Confirmar novo horário</button></div></section> }
        @if (problem(); as item) { <section hlmAlert [variant]="item.conflict ? 'destructive' : 'default'" aria-live="assertive"><h2 hlmAlertTitle>{{ item.title }}</h2><p hlmAlertDescription>{{ item.description }}</p></section> }
      }
    </main>
  `,
})
export class ReceptionRescheduleComponent {
  private readonly api = inject(ReceptionApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly identity = inject(IdentityService);
  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get("id") ?? "")), { initialValue: "" });
  readonly appointment = httpResource<OperationalAppointment>(() => this.id() ? this.api.appointment(this.id()) : undefined);
  protected readonly today = new Date();
  protected readonly date = signal(new Date());
  protected readonly selected = signal<Slot | null>(null);
  protected readonly review = signal(false);
  protected readonly saving = signal(false);
  protected readonly problem = signal<ReturnType<typeof receptionIssue> | null>(null);
  protected readonly availability = httpResource<Availability>(() => this.id() ? this.api.availability(this.id(), this.civilDate()) : undefined);
  protected readonly slots = computed(() => this.availability.value()?.items ?? []);
  protected choose(slot: Slot) { this.selected.set(slot); this.review.set(false); this.problem.set(null); }
  protected changeDate(value: Date) { this.date.set(value); this.selected.set(null); this.review.set(false); this.problem.set(null); }
  protected confirm(current: OperationalAppointment, item: Slot) { this.saving.set(true); this.problem.set(null); this.api.reschedule(current.id, item.regraAgendaId, item.inicio, current.version).pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => void this.router.navigateByUrl("/workspace/reception"), error: (error) => { const issue = receptionIssue(error); this.problem.set(issue); if (issue.code === "HORARIO_INDISPONIVEL") { this.selected.set(null); this.review.set(false); this.availability.reload(); } if (issue.conflict) this.appointment.reload(); } }); }
  protected issue(error: unknown) { return receptionIssue(error); }
  protected time(value: string) { return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: this.identity.identity.value()?.timeZone }).format(new Date(value)); }
  protected dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: this.identity.identity.value()?.timeZone }).format(new Date(value)); }
  private civilDate() { const value = this.date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
}
