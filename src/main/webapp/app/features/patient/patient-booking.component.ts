import { httpResource } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { FormField, FormRoot, form, required } from "@angular/forms/signals";
import { RouterLink } from "@angular/router";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCalendarImports } from "@spartan-ng/helm/calendar";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmNativeSelectImports } from "@spartan-ng/helm/native-select";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";
import { IdentityService } from "../../auth/identity.service";
import { PageHeaderComponent } from "../../shared/ui/page-header.component";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { PatientApi, patientIssue } from "./patient.api";
import { Availability, Doctor, NamedResource, Page, Slot } from "./patient.models";

@Component({
  selector: "app-patient-booking", changeDetection: ChangeDetectionStrategy.OnPush, providers: [PatientApi],
  imports: [RouterLink, FormField, FormRoot, HlmAlertImports, HlmButtonImports, HlmCalendarImports, HlmCardImports, HlmFieldImports, HlmNativeSelectImports, HlmSpinnerImports, PageHeaderComponent, StatePanelComponent],
  template: `
    <div class="flex flex-col gap-6">
      <app-page-header title="Agendar consulta" description="Escolha o cuidado, o local e um horário disponível." />
      @if (stage() < 4) { <p class="text-muted-foreground text-sm">Etapa {{ stage() }} de 3</p> }
      @if (stage() === 4) {
        <section hlmCard><div hlmCardHeader><h2 hlmCardTitle>Consulta agendada</h2><p hlmCardDescription>{{ success() }}</p></div><div hlmCardContent class="flex flex-col gap-2">@if (confirmed(); as item) { <dl class="grid gap-2 text-sm"><div><dt class="inline font-medium">Especialidade: </dt><dd class="inline">{{ item.especialidade.nome }}</dd></div><div><dt class="inline font-medium">Profissional: </dt><dd class="inline">{{ item.medico.nome }}</dd></div><div><dt class="inline font-medium">Data e horário: </dt><dd class="inline">{{ dateTime(item.inicio) }}</dd></div><div><dt class="inline font-medium">Unidade: </dt><dd class="inline">{{ item.unidade.nome }}</dd></div><div><dt class="inline font-medium">Consultório: </dt><dd class="inline">{{ item.consultorio.nome }}</dd></div></dl> }</div><div hlmCardFooter class="gap-3"><a hlmBtn routerLink="../consultas">Ver consultas</a><button hlmBtn variant="outline" type="button" (click)="again()">Agendar outra consulta</button></div></section>
      } @else if (stage() === 1) {
        <section hlmCard><div hlmCardHeader><h2 hlmCardTitle>Cuidado e local</h2><p hlmCardDescription>Selecione o que precisa e onde deseja ser atendido.</p></div><div hlmCardContent>
          @if (loading()) { <app-state-panel state="loading" title="Carregando opções" description="Aguarde um momento." /> } @else if (catalogError()) { <app-state-panel state="error" title="Não foi possível carregar opções" description="Tente novamente." /><button hlmBtn variant="outline" type="button" (click)="reloadCatalogs()">Tentar novamente</button> } @else {
            <form [formRoot]="bookingForm" class="flex max-w-xl flex-col gap-4">
              <div hlmField><label hlmFieldLabel for="specialty">Especialidade</label><hlm-native-select selectId="specialty" aria-required="true" [formField]="bookingForm.specialtyId" (valueChange)="clearSelection()"><option hlmNativeSelectOption value="">Selecione uma especialidade</option>@for (item of specialties.value()?.items ?? []; track item.id) { <option hlmNativeSelectOption [value]="item.id">{{ item.nome }}</option> }</hlm-native-select>@if (bookingForm.specialtyId().touched()) { @for (error of bookingForm.specialtyId().errors(); track error.kind) { <hlm-field-error [validator]="error.kind">{{ error.message }}</hlm-field-error> } }</div>
              <div hlmField><label hlmFieldLabel for="unit">Unidade</label><hlm-native-select selectId="unit" aria-required="true" [formField]="bookingForm.unitId" (valueChange)="clearSelection()"><option hlmNativeSelectOption value="">Selecione uma unidade</option>@for (item of units.value()?.items ?? []; track item.id) { <option hlmNativeSelectOption [value]="item.id">{{ item.nome }}</option> }</hlm-native-select>@if (bookingForm.unitId().touched()) { @for (error of bookingForm.unitId().errors(); track error.kind) { <hlm-field-error [validator]="error.kind">{{ error.message }}</hlm-field-error> } }</div>
              <div hlmField><label hlmFieldLabel for="doctor">Profissional</label><hlm-native-select selectId="doctor" [formField]="bookingForm.doctorId" (valueChange)="clearSelection()"><option hlmNativeSelectOption value="">Qualquer profissional</option>@for (item of doctors(); track item.id) { <option hlmNativeSelectOption [value]="item.id">{{ item.nome }}</option> }</hlm-native-select><p hlmFieldDescription>Você pode deixar que a clínica indique um profissional.</p></div>
              <button hlmBtn type="submit">Escolher data e horário</button>
            </form>
          }
        </div></section>
      } @else if (stage() === 2) {
        <section hlmCard><div hlmCardContent class="grid gap-6 pt-6 lg:grid-cols-[20rem_1fr]"><section><h2 class="mb-3 font-semibold">Data</h2><hlm-calendar [date]="date()" [min]="today" (dateChange)="changeDate($event)" /></section><section class="flex flex-col gap-3"><h2 class="font-semibold">Horários disponíveis</h2>@if (problem(); as message) { <section hlmAlert aria-live="polite"><h3 hlmAlertTitle>{{ message.title }}</h3><p hlmAlertDescription>{{ message.description }}</p></section> } @if (availability.isLoading()) { <app-state-panel state="loading" title="Buscando horários" description="Aguarde um momento." /> } @else if (availability.error()) { <app-state-panel state="error" [title]="issue(availability.error()).title" [description]="issue(availability.error()).description" /><button hlmBtn variant="outline" type="button" (click)="availability.reload()">Tentar novamente</button> } @else if (!slots().length) { <app-state-panel state="empty" title="Sem horários nesta data" description="Escolha outra data para consultar a agenda." /> } @else { <div class="grid gap-2 sm:grid-cols-2">@for (item of visibleSlots(); track item.regraAgendaId + item.inicio) { <button hlmBtn [variant]="selected() === item ? 'default' : 'outline'" type="button" class="min-h-11 h-auto justify-start py-3 text-start" [attr.aria-pressed]="selected() === item" (click)="selected.set(item)"><span class="flex flex-col items-start"><strong>{{ time(item.inicio) }}</strong><span class="text-xs" [class.text-primary-foreground]="selected() === item" [class.text-muted-foreground]="selected() !== item">{{ model().doctorId ? item.consultorio.nome : item.medico.nome + ' · ' + item.consultorio.nome }}</span>@if (selected() === item) { <span class="text-xs font-semibold">Selecionado</span> }</span></button> }</div>@if (slots().length > 5 && !more()) { <button hlmBtn variant="ghost" type="button" (click)="more.set(true)">Ver mais horários</button> } }</section></div><div hlmCardFooter class="gap-3"><button hlmBtn variant="outline" type="button" (click)="stage.set(1)">Voltar</button><button hlmBtn type="button" [disabled]="!selected()" (click)="stage.set(3)">Revisar consulta</button></div></section>
      } @else {
        <section hlmCard><div hlmCardHeader><h2 hlmCardTitle>Revise sua consulta</h2></div><div hlmCardContent>@if (selected(); as item) { <p>{{ item.especialidade.nome }} com {{ item.medico.nome }}, {{ dateTime(item.inicio) }}. {{ item.unidade.nome }}, consultório {{ item.consultorio.nome }}.</p> } @if (problem(); as message) { <section hlmAlert variant="destructive"><h2 hlmAlertTitle>{{ message.title }}</h2><p hlmAlertDescription>{{ message.description }}</p></section> }</div><div hlmCardFooter class="gap-3"><button hlmBtn variant="outline" type="button" (click)="stage.set(2)">Voltar</button><button hlmBtn type="button" [disabled]="saving()" (click)="confirm()">@if (saving()) { <hlm-spinner /> } Confirmar agendamento</button></div></section>
      }
    </div>
  `,
})
export class PatientBookingComponent {
  protected readonly api = inject(PatientApi); private readonly identity = inject(IdentityService);
  protected readonly stage = signal(1); protected readonly today = new Date(); protected readonly date = signal(new Date());
  protected readonly model = signal({ specialtyId: "", unitId: "", doctorId: "" });
  protected readonly bookingForm = form(this.model, (path) => { required(path.specialtyId, { message: "Selecione uma especialidade." }); required(path.unitId, { message: "Selecione uma unidade." }); }, { submission: { action: async () => this.stage.set(2) } });
  protected readonly units = httpResource<Page<NamedResource>>(() => this.api.catalog("unidades")); protected readonly specialties = httpResource<Page<NamedResource>>(() => this.api.catalog("especialidades")); protected readonly doctorsResource = httpResource<Page<Doctor>>(() => this.api.catalog("medicos"));
  protected readonly doctors = computed(() => (this.doctorsResource.value()?.items ?? []).filter((doctor) => !this.model().specialtyId || doctor.especialidadeIds.includes(this.model().specialtyId)));
  protected readonly availability = httpResource<Availability>(() => { const data = this.model(); return this.stage() >= 2 && data.specialtyId && data.unitId ? this.api.availability(this.civilDate(), data.unitId, data.specialtyId, data.doctorId) : undefined; });
  protected readonly slots = computed(() => this.availability.value()?.items ?? []); protected readonly more = signal(false); protected readonly visibleSlots = computed(() => this.more() ? this.slots() : this.slots().slice(0, 5)); protected readonly selected = signal<Slot | null>(null); protected readonly confirmed = signal<Slot | null>(null); protected readonly saving = signal(false); protected readonly problem = signal<ReturnType<typeof patientIssue> | null>(null); protected readonly success = signal("");
  protected loading() { return this.units.isLoading() || this.specialties.isLoading() || this.doctorsResource.isLoading(); } protected catalogError() { return this.units.error() || this.specialties.error() || this.doctorsResource.error(); } protected reloadCatalogs() { this.units.reload(); this.specialties.reload(); this.doctorsResource.reload(); }
  protected clearSelection() { this.selected.set(null); this.more.set(false); this.problem.set(null); } protected changeDate(value: Date) { this.date.set(value); this.clearSelection(); }
  protected confirm() { const item = this.selected(); if (!item) return; this.saving.set(true); this.problem.set(null); this.api.create(item.regraAgendaId, item.inicio).pipe(finalize(() => this.saving.set(false))).subscribe({ next: () => { this.confirmed.set(item); this.success.set(`${item.especialidade.nome} com ${item.medico.nome}, ${this.dateTime(item.inicio)}.`); this.stage.set(4); }, error: (error) => { const issue = patientIssue(error); this.problem.set(issue); if (issue.code === "HORARIO_INDISPONIVEL") { this.selected.set(null); this.stage.set(2); this.availability.reload(); } } }); }
  protected again() { this.selected.set(null); this.confirmed.set(null); this.problem.set(null); this.stage.set(1); } protected time(value: string) { return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: this.identity.identity.value()?.timeZone }).format(new Date(value)); } protected dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: this.identity.identity.value()?.timeZone }).format(new Date(value)); } protected issue(error: unknown) { return patientIssue(error); }
  private civilDate() { const value = this.date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
}
