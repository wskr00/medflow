import { httpResource } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmDialog, HlmDialogImports } from "@spartan-ng/helm/dialog";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmInputImports } from "@spartan-ng/helm/input";
import { HlmNativeSelectImports } from "@spartan-ng/helm/native-select";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";
import { IdentityService } from "../../auth/identity.service";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { StatusBadgeComponent } from "../../shared/ui/status-badge.component";
import { ReceptionApi, receptionIssue } from "./reception.api";
import { NamedResource, OperationalAppointment, Page, ReceptionIssue } from "./reception.models";

@Component({
  selector: "app-reception-operation",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ReceptionApi],
  imports: [
    RouterLink,
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmSpinnerImports,
    StatePanelComponent,
    StatusBadgeComponent,
  ],
  template: `
    <main id="reception-main" tabindex="-1" class="mx-auto flex max-w-[90rem] flex-col gap-6 px-4 py-6 sm:px-6">
      <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="space-y-1">
          <p class="text-primary text-xs font-semibold tracking-widest uppercase">Recepção</p>
          <h1 class="text-3xl font-semibold tracking-tight">Agenda do dia</h1>
          <p class="text-muted-foreground">Confirme chegadas e mantenha a fila atualizada.</p>
        </div>
        <button hlmBtn variant="outline" type="button" class="min-h-11" (click)="reloadAll()">Atualizar operação</button>
      </header>

      <section aria-label="Filtros da agenda" class="border-border bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-5">
        <div hlmField>
          <label hlmFieldLabel for="operation-date">Data</label>
          <input hlmInput id="operation-date" type="date" class="min-h-11" [value]="date()" (change)="setDate($any($event.target).value)" />
        </div>
        <div hlmField>
          <label hlmFieldLabel for="operation-unit">Unidade</label>
          <hlm-native-select selectId="operation-unit" class="min-h-11" [value]="unitId()" (valueChange)="setFilter('unit', $event)">
            <option hlmNativeSelectOption value="">Todas as unidades</option>
            @for (unit of units.value()?.items ?? []; track unit.id) { <option hlmNativeSelectOption [value]="unit.id">{{ unit.nome }}</option> }
          </hlm-native-select>
        </div>
        <div hlmField>
          <label hlmFieldLabel for="operation-doctor">Profissional</label>
          <hlm-native-select selectId="operation-doctor" class="min-h-11" [value]="doctorId()" (valueChange)="setFilter('doctor', $event)">
            <option hlmNativeSelectOption value="">Todos os profissionais</option>
            @for (doctor of doctors.value()?.items ?? []; track doctor.id) { <option hlmNativeSelectOption [value]="doctor.id">{{ doctor.nome }}</option> }
          </hlm-native-select>
        </div>
        <div hlmField>
          <label hlmFieldLabel for="operation-status">Situação</label>
          <hlm-native-select selectId="operation-status" class="min-h-11" [value]="status()" (valueChange)="setFilter('status', $event)">
            <option hlmNativeSelectOption value="">Todas as situações</option>
            <option hlmNativeSelectOption value="AGENDADA">Agendada</option>
            <option hlmNativeSelectOption value="EM_ESPERA">Em espera</option>
            <option hlmNativeSelectOption value="EM_ATENDIMENTO">Em atendimento</option>
            <option hlmNativeSelectOption value="FINALIZADA">Finalizada</option>
            <option hlmNativeSelectOption value="CANCELADA">Cancelada</option>
          </hlm-native-select>
        </div>
        <div class="flex items-end"><button hlmBtn variant="ghost" type="button" class="min-h-11 w-full" (click)="clearFilters()">Limpar filtros</button></div>
      </section>

      @if (notice(); as message) {
        <section hlmAlert aria-live="polite"><h2 hlmAlertTitle>{{ message.title }}</h2><p hlmAlertDescription>{{ message.description }}</p></section>
      }

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="agenda-title" class="min-w-0 space-y-3">
          <div class="flex items-baseline justify-between gap-3"><h2 id="agenda-title" class="text-xl font-semibold">Agenda</h2>@if (agenda.value(); as page) { <p class="text-muted-foreground text-sm">{{ range(page) }} de {{ page.totalElements }}</p> }</div>
          @if (agenda.isLoading()) { <app-state-panel state="loading" title="Carregando agenda" description="Aguarde um momento." /> }
          @else if (agenda.error()) { <app-state-panel state="error" [title]="issue(agenda.error()).title" [description]="issue(agenda.error()).description" /><button hlmBtn variant="outline" type="button" class="mt-3 min-h-11" (click)="agenda.reload()">Tentar novamente</button> }
          @else if (!agendaItems().length) { <app-state-panel state="empty" title="Nenhuma consulta encontrada" description="Altere a data ou remova os filtros para consultar outra agenda." /><button hlmBtn variant="outline" type="button" class="mt-3 min-h-11" (click)="clearFilters()">Limpar filtros</button> }
          @else {
            <div class="border-border bg-card hidden overflow-hidden rounded-xl border lg:block">
              <table class="w-full border-collapse text-sm">
                <thead class="bg-muted/70 text-muted-foreground"><tr><th class="px-4 py-3 text-left font-medium">Horário</th><th class="px-4 py-3 text-left font-medium">Paciente</th><th class="px-4 py-3 text-left font-medium">Atendimento</th><th class="px-4 py-3 text-left font-medium">Local</th><th class="px-4 py-3 text-left font-medium">Situação</th><th class="px-4 py-3 text-right font-medium">Ações</th></tr></thead>
                <tbody class="divide-border divide-y">
                  @for (item of agendaItems(); track item.id) {
                    <tr><td class="px-4 py-4 align-top font-semibold tabular-nums">{{ time(item.inicio) }}</td><td class="px-4 py-4 align-top font-medium">{{ item.paciente.nome }}</td><td class="px-4 py-4 align-top"><span class="block">{{ item.especialidade.nome }}</span><span class="text-muted-foreground block text-xs">{{ item.medico.nome }}</span></td><td class="px-4 py-4 align-top"><span class="block">{{ item.unidade.nome }}</span><span class="text-muted-foreground block text-xs">{{ item.consultorio.nome }}</span></td><td class="px-4 py-4 align-top"><app-status-badge [status]="item.status" /></td><td class="px-4 py-3"><div class="flex justify-end gap-2">@if (item.allowedActions.canCheckIn) { <button hlmBtn type="button" class="min-h-11" [disabled]="busyId() === item.id" (click)="checkIn(item)">@if (busyId() === item.id) { <hlm-spinner /> } Confirmar chegada</button> }@if (item.allowedActions.canReschedule) { <a hlmBtn variant="outline" class="min-h-11" [routerLink]="['consultas', item.id, 'reagendar']">Reagendar</a> }@if (item.allowedActions.canCancel) { <hlm-dialog #dialog="hlmDialog"><button hlmBtn hlmDialogTrigger variant="ghost" type="button" class="min-h-11">Cancelar</button><hlm-dialog-content *hlmDialogPortal><hlm-dialog-header><h2 hlmDialogTitle>Cancelar consulta?</h2><p hlmDialogDescription>{{ item.paciente.nome }} · {{ dateTime(item.inicio) }} · {{ item.especialidade.nome }}.</p></hlm-dialog-header><hlm-dialog-footer><button hlmBtn hlmDialogClose variant="outline" type="button" class="min-h-11" autofocus>Manter consulta</button><button hlmBtn variant="destructive" type="button" class="min-h-11" [disabled]="busyId() === item.id" (click)="cancel(item, dialog)">Cancelar consulta</button></hlm-dialog-footer></hlm-dialog-content></hlm-dialog> }</div></td></tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="grid gap-3 lg:hidden">@for (item of agendaItems(); track item.id) { <article hlmCard><div hlmCardHeader><div class="flex items-start justify-between gap-3"><div><p class="font-semibold tabular-nums">{{ time(item.inicio) }} · {{ item.paciente.nome }}</p><p hlmCardDescription>{{ item.especialidade.nome }} · {{ item.medico.nome }}</p></div><app-status-badge [status]="item.status" /></div></div><div hlmCardContent><p class="text-muted-foreground text-sm">{{ item.unidade.nome }} · {{ item.consultorio.nome }}</p></div><div hlmCardFooter class="flex-wrap gap-2">@if (item.allowedActions.canCheckIn) { <button hlmBtn type="button" class="min-h-11" [disabled]="busyId() === item.id" (click)="checkIn(item)">Confirmar chegada</button> }@if (item.allowedActions.canReschedule) { <a hlmBtn variant="outline" class="min-h-11" [routerLink]="['consultas', item.id, 'reagendar']">Reagendar</a> }@if (item.allowedActions.canCancel) { <hlm-dialog #mobileDialog="hlmDialog"><button hlmBtn hlmDialogTrigger variant="ghost" type="button" class="min-h-11">Cancelar</button><hlm-dialog-content *hlmDialogPortal><hlm-dialog-header><h2 hlmDialogTitle>Cancelar consulta?</h2><p hlmDialogDescription>{{ item.paciente.nome }} · {{ dateTime(item.inicio) }} · {{ item.especialidade.nome }}.</p></hlm-dialog-header><hlm-dialog-footer><button hlmBtn hlmDialogClose variant="outline" type="button" class="min-h-11" autofocus>Manter consulta</button><button hlmBtn variant="destructive" type="button" class="min-h-11" (click)="cancel(item, mobileDialog)">Cancelar consulta</button></hlm-dialog-footer></hlm-dialog-content></hlm-dialog> }</div></article> }</div>
            <div class="flex justify-between gap-3"><button hlmBtn variant="outline" type="button" class="min-h-11" [disabled]="agendaPage() === 0" (click)="agendaPage.set(agendaPage() - 1)">Anterior</button><button hlmBtn variant="outline" type="button" class="min-h-11" [disabled]="!hasNext(agenda.value())" (click)="agendaPage.set(agendaPage() + 1)">Próxima</button></div>
          }
        </section>

        <aside aria-labelledby="queue-title" class="border-border bg-card space-y-3 rounded-xl border p-4 xl:sticky xl:top-4">
          <div class="flex items-baseline justify-between gap-3"><div><h2 id="queue-title" class="text-xl font-semibold">Fila de espera</h2><p class="text-muted-foreground text-xs">Inclui pendências de dias anteriores</p></div>@if (queue.value(); as page) { <span class="bg-warning/20 text-warning-foreground rounded-full px-2.5 py-1 text-xs font-semibold">{{ page.totalElements }} na fila</span> }</div>
          @if (queue.isLoading()) { <app-state-panel state="loading" title="Carregando fila" description="Aguarde um momento." /> }
          @else if (queue.error()) { <app-state-panel state="error" [title]="issue(queue.error()).title" [description]="issue(queue.error()).description" /><button hlmBtn variant="outline" type="button" class="min-h-11" (click)="queue.reload()">Tentar novamente</button> }
          @else if (!queueItems().length) { <app-state-panel state="empty" title="Nenhum paciente aguardando" description="Os check-ins confirmados aparecerão aqui." /> }
          @else { <ol class="space-y-2">@for (item of queueItems(); track item.id) { <li class="rounded-lg p-3" [class.bg-warning/15]="item.pendenteDeDiaAnterior" [class.border-warning/40]="item.pendenteDeDiaAnterior" [class.border]="item.pendenteDeDiaAnterior" [class.bg-muted]="!item.pendenteDeDiaAnterior"><p class="font-semibold">{{ item.paciente.nome }}</p><p class="text-muted-foreground text-xs">Agendado {{ dateTime(item.inicio) }} · chegada {{ item.checkInEm ? time(item.checkInEm) : 'pendente' }}</p><p class="text-muted-foreground text-xs">{{ item.unidade.nome }} · {{ item.consultorio.nome }}</p>@if (item.pendenteDeDiaAnterior) { <p class="text-warning-foreground mt-1 text-xs font-semibold">Pendente de dia anterior</p> }</li> }</ol>@if (hasNext(queue.value())) { <button hlmBtn variant="outline" type="button" class="min-h-11 w-full" (click)="queuePage.set(queuePage() + 1)">Ver próximos</button> } }
        </aside>
      </div>
    </main>
  `,
})
export class ReceptionOperationComponent {
  private readonly api = inject(ReceptionApi);
  private readonly identity = inject(IdentityService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly initialQuery = this.route.snapshot.queryParamMap;
  protected readonly date = signal(this.validDate(this.initialQuery.get("data")) ?? this.today());
  protected readonly unitId = signal(this.initialQuery.get("unidadeId") ?? "");
  protected readonly doctorId = signal(this.initialQuery.get("medicoId") ?? "");
  protected readonly status = signal(this.initialQuery.get("status") ?? "");
  protected readonly agendaPage = signal(0);
  protected readonly queuePage = signal(0);
  protected readonly busyId = signal<string | null>(null);
  protected readonly notice = signal<ReceptionIssue | null>(null);
  protected readonly units = httpResource<Page<NamedResource>>(() => this.api.catalog("unidades"));
  protected readonly doctors = httpResource<Page<NamedResource>>(() => this.api.catalog("medicos"));
  protected readonly agenda = httpResource<Page<OperationalAppointment>>(() => this.api.agenda({ data: this.date(), unidadeId: this.unitId(), medicoId: this.doctorId(), status: this.status(), page: this.agendaPage(), size: 20 }));
  protected readonly queue = httpResource<Page<OperationalAppointment>>(() => this.api.queue({ unidadeId: this.unitId(), medicoId: this.doctorId(), page: this.queuePage(), size: 20 }));
  protected readonly agendaItems = computed(() => this.agenda.value()?.items ?? []);
  protected readonly queueItems = computed(() => this.queue.value()?.items ?? []);

  protected setDate(value: string) { if (value) { this.date.set(value); this.agendaPage.set(0); this.syncUrl(); } }
  protected setFilter(kind: "unit" | "doctor" | "status", value: string | null | undefined) { ({ unit: this.unitId, doctor: this.doctorId, status: this.status }[kind]).set(value ?? ""); this.agendaPage.set(0); this.queuePage.set(0); this.syncUrl(); }
  protected clearFilters() { this.date.set(this.today()); this.unitId.set(""); this.doctorId.set(""); this.status.set(""); this.agendaPage.set(0); this.queuePage.set(0); this.syncUrl(); }
  protected reloadAll() { this.notice.set(null); this.agenda.reload(); this.queue.reload(); }
  protected checkIn(item: OperationalAppointment) { this.mutate(item, this.api.checkIn(item.id, item.version), "Chegada confirmada", `${item.paciente.nome} entrou na fila.`); }
  protected cancel(item: OperationalAppointment, dialog: HlmDialog) { this.busyId.set(item.id); this.notice.set(null); this.api.cancel(item.id, item.version).pipe(finalize(() => this.busyId.set(null))).subscribe({ next: () => { dialog.close(); this.notice.set({ code: "SUCCESS", title: "Consulta cancelada", description: `O horário de ${item.paciente.nome} foi liberado.`, conflict: false }); this.reloadResources(); }, error: (error) => { this.notice.set(receptionIssue(error)); this.reloadResources(); } }); }
  protected time(value: string) { return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: this.identity.identity.value()?.timeZone }).format(new Date(value)); }
  protected dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: this.identity.identity.value()?.timeZone }).format(new Date(value)); }
  protected range(page: Page<unknown>) { if (!page.totalElements) return "0"; return `${page.page * page.size + 1}–${Math.min((page.page + 1) * page.size, page.totalElements)}`; }
  protected hasNext(page: Page<unknown> | undefined) { return !!page && (page.page + 1) * page.size < page.totalElements; }
  protected issue(error: unknown) { return receptionIssue(error); }
  private mutate(item: OperationalAppointment, request: ReturnType<ReceptionApi["checkIn"]>, title: string, description: string) { this.busyId.set(item.id); this.notice.set(null); request.pipe(finalize(() => this.busyId.set(null))).subscribe({ next: () => { this.notice.set({ code: "SUCCESS", title, description, conflict: false }); this.reloadResources(); }, error: (error) => { this.notice.set(receptionIssue(error)); this.reloadResources(); } }); }
  private reloadResources() { this.agenda.reload(); this.queue.reload(); }
  private syncUrl() { void this.router.navigate([], { queryParams: { data: this.date(), unidadeId: this.unitId() || null, medicoId: this.doctorId() || null, status: this.status() || null }, queryParamsHandling: "merge", replaceUrl: true }); }
  private validDate(value: string | null) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
  private today() { const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: this.identity?.identity.value()?.timeZone ?? "America/Belem", year: "numeric", month: "2-digit", day: "2-digit" }); return formatter.format(new Date()); }
}
