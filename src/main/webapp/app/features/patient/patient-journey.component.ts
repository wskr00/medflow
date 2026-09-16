import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { FormField, FormRoot, form, required } from "@angular/forms/signals";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmInputImports } from "@spartan-ng/helm/input";
import { HlmNativeSelectImports } from "@spartan-ng/helm/native-select";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";

import { IdentityService } from "../../auth/identity.service";
import { PageHeaderComponent } from "../../shared/ui/page-header.component";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { PatientAppointmentsApi, patientApiIssue } from "./patient-appointments.api";
import { PatientAppointmentsComponent } from "./patient-appointments.component";
import { addCivilDays, formatPatientDateTime } from "./patient-date-time";
import { PatientHistoryComponent } from "./patient-history.component";
import {
  AvailabilityQuery,
  AvailabilitySlot,
  PatientApiIssue,
  PatientFeedback,
  PatientAppointment,
} from "./patient.models";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PatientAppointmentsApi],
  imports: [
    FormField,
    FormRoot,
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmSpinnerImports,
    PageHeaderComponent,
    StatePanelComponent,
    PatientAppointmentsComponent,
    PatientHistoryComponent,
  ],
  template: `
    <app-page-header
      eyebrow="Paciente"
      title="Meus atendimentos"
      description="Consulte horários disponíveis, agende e acompanhe somente os seus atendimentos."
    />

    @if (feedback(); as notice) {
      <section
        hlmAlert
        [variant]="notice.kind === 'error' ? 'destructive' : 'default'"
        aria-live="polite"
      >
        <h2 hlmAlertTitle>{{ notice.title }}</h2>
        <p hlmAlertDescription>{{ notice.description }}</p>
      </section>
    }

    <section hlmCard aria-labelledby="availability-title">
      <div hlmCardHeader>
        <h2 hlmCardTitle id="availability-title">Encontrar horário</h2>
        <p hlmCardDescription>
          A disponibilidade é confirmada pelo servidor para uma data por vez.
        </p>
      </div>
      <div hlmCardContent class="flex flex-col gap-6 pb-6">
        @if (catalogsLoading()) {
          <app-state-panel
            state="loading"
            title="Carregando opções para agendamento"
            description="Aguarde para escolher os filtros."
          />
        } @else if (catalogsError()) {
          <app-state-panel
            state="error"
            title="Não foi possível carregar os filtros"
            description="Verifique a conexão e tente carregar as opções novamente."
          />
          <button hlmBtn variant="outline" type="button" (click)="reloadCatalogs()">
            Tentar novamente
          </button>
        } @else {
          <form [formRoot]="filtersForm" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div hlmField>
              <label hlmFieldLabel for="patient-date">Data</label>
              <input
                hlmInput
                id="patient-date"
                type="date"
                [formField]="filtersForm.data"
                aria-describedby="patient-date-description"
              />
              <p hlmFieldDescription id="patient-date-description">
                Selecione o dia que deseja consultar.
              </p>
              @if (filtersForm.data().touched()) {
                @for (error of filtersForm.data().errors(); track error.kind) {
                  <hlm-field-error [validator]="error.kind">{{ error.message }}</hlm-field-error>
                }
              }
            </div>

            <div hlmField>
              <label hlmFieldLabel for="patient-unit">Unidade</label>
              <hlm-native-select
                selectId="patient-unit"
                [formField]="filtersForm.unidadeId"
                aria-describedby="patient-unit-description"
              >
                <option hlmNativeSelectOption value="">Selecione uma unidade</option>
                @for (unit of api.units().items; track unit.id) {
                  <option hlmNativeSelectOption [value]="unit.id">{{ unit.nome }}</option>
                }
              </hlm-native-select>
              <p hlmFieldDescription id="patient-unit-description">Local do atendimento.</p>
              @if (filtersForm.unidadeId().touched()) {
                @for (error of filtersForm.unidadeId().errors(); track error.kind) {
                  <hlm-field-error [validator]="error.kind">{{ error.message }}</hlm-field-error>
                }
              }
            </div>

            <div hlmField>
              <label hlmFieldLabel for="patient-specialty">Especialidade</label>
              <hlm-native-select
                selectId="patient-specialty"
                [formField]="filtersForm.especialidadeId"
                aria-describedby="patient-specialty-description"
                (valueChange)="onSpecialtyChanged($event)"
              >
                <option hlmNativeSelectOption value="">Selecione uma especialidade</option>
                @for (specialty of api.specialties().items; track specialty.id) {
                  <option hlmNativeSelectOption [value]="specialty.id">{{ specialty.nome }}</option>
                }
              </hlm-native-select>
              <p hlmFieldDescription id="patient-specialty-description">Tipo de atendimento.</p>
              @if (filtersForm.especialidadeId().touched()) {
                @for (error of filtersForm.especialidadeId().errors(); track error.kind) {
                  <hlm-field-error [validator]="error.kind">{{ error.message }}</hlm-field-error>
                }
              }
            </div>

            <div hlmField>
              <label hlmFieldLabel for="patient-doctor">Profissional (opcional)</label>
              <hlm-native-select selectId="patient-doctor" [formField]="filtersForm.medicoId">
                <option hlmNativeSelectOption value="">Qualquer profissional</option>
                @for (doctor of availableDoctors(); track doctor.id) {
                  <option hlmNativeSelectOption [value]="doctor.id">{{ doctor.nome }}</option>
                }
              </hlm-native-select>
              <p hlmFieldDescription>Filtrado pela especialidade escolhida.</p>
            </div>

            <div class="flex flex-wrap items-end gap-3 md:col-span-2 xl:col-span-4">
              <button hlmBtn type="submit">Consultar horários</button>
              <button hlmBtn variant="outline" type="button" (click)="changeDate(-1)" [disabled]="!filterModel().data">
                Dia anterior
              </button>
              <button hlmBtn variant="outline" type="button" (click)="changeDate(1)" [disabled]="!filterModel().data">
                Próximo dia
              </button>
              <button hlmBtn variant="ghost" type="button" (click)="clearFilters()">Limpar filtros</button>
            </div>
          </form>
        }

        @if (availabilityQuery()) {
          @if (availability.isLoading()) {
            <app-state-panel
              state="loading"
              title="Consultando horários"
              description="A disponibilidade está sendo atualizada para os filtros escolhidos."
            />
          } @else if (availability.error()) {
            <app-state-panel
              state="error"
              [title]="apiIssue(availability.error()).title"
              [description]="apiIssue(availability.error()).description"
            />
            <button hlmBtn variant="outline" type="button" (click)="availability.reload()">Tentar novamente</button>
          } @else if (availability.value(); as result) {
            @if (result.items.length === 0) {
              <app-state-panel
                state="empty"
                title="Nenhum horário disponível"
                [description]="emptyAvailabilityDescription()"
              />
            } @else {
              <section aria-labelledby="slots-title" class="flex flex-col gap-3">
                <div class="flex flex-col gap-1">
                  <h3 id="slots-title" class="text-lg font-semibold">Horários disponíveis</h3>
                  <p class="text-muted-foreground text-sm">Fuso da clínica: {{ result.timeZone }}.</p>
                </div>
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  @for (slot of result.items; track slot.regraAgendaId + slot.inicio) {
                    <button
                      hlmBtn
                      variant="outline"
                      type="button"
                      class="h-auto min-h-11 justify-start whitespace-normal py-3 text-start"
                      [attr.aria-pressed]="selectedSlot()?.inicio === slot.inicio"
                      (click)="selectSlot(slot)"
                    >
                      <span class="flex flex-col items-start gap-1">
                        <span class="font-semibold">{{ formatDateTime(slot.inicio) }}</span>
                        <span class="text-muted-foreground text-xs">{{ slot.medico.nome }} · {{ slot.consultorio.nome }}</span>
                      </span>
                    </button>
                  }
                </div>
              </section>
            }
          }
        }

        @if (selectedSlot(); as slot) {
          <section hlmAlert aria-labelledby="appointment-review-title">
            <h3 hlmAlertTitle id="appointment-review-title">Revise antes de confirmar</h3>
            <p hlmAlertDescription>
              {{ slot.especialidade.nome }} com {{ slot.medico.nome }} em {{ slot.unidade.nome }},
              {{ slot.consultorio.nome }}, {{ formatDateTime(slot.inicio) }}.
            </p>
            <div class="flex flex-wrap gap-3">
              <button hlmBtn type="button" [disabled]="creating()" (click)="confirmAppointment()">
                @if (creating()) { <hlm-spinner /> }
                {{ creating() ? "Confirmando..." : "Confirmar agendamento" }}
              </button>
              <button hlmBtn variant="ghost" type="button" [disabled]="creating()" (click)="selectedSlot.set(null)">
                Escolher outro horário
              </button>
            </div>
          </section>
        }
      </div>
    </section>

    @if (createdAppointment(); as appointment) {
      <section hlmAlert aria-live="polite">
        <h2 hlmAlertTitle>Agendamento confirmado</h2>
        <p hlmAlertDescription>
          {{ appointment.especialidade.nome }} com {{ appointment.medico.nome }}, {{ formatDateTime(appointment.inicio) }}.
        </p>
      </section>
    }

    <app-patient-appointments [timeZone]="timeZone()" (feedback)="feedback.set($event)" />
    <app-patient-history [timeZone]="timeZone()" />
  `,
})
export class PatientJourneyComponent {
  protected readonly api = inject(PatientAppointmentsApi);
  private readonly identity = inject(IdentityService);

  protected readonly filterModel = signal({
    data: "",
    unidadeId: "",
    especialidadeId: "",
    medicoId: "",
  });
  protected readonly availabilityQuery = signal<AvailabilityQuery | null>(null);
  protected readonly selectedSlot = signal<AvailabilitySlot | null>(null);
  protected readonly createdAppointment = signal<PatientAppointment | null>(null);
  protected readonly feedback = signal<PatientFeedback | null>(null);
  protected readonly creating = signal(false);

  protected readonly filtersForm = form(
    this.filterModel,
    (path) => {
      required(path.data, { message: "Informe a data para consultar os horários." });
      required(path.unidadeId, { message: "Selecione a unidade." });
      required(path.especialidadeId, { message: "Selecione a especialidade." });
    },
    { submission: { action: async () => this.searchAvailability() } },
  );

  protected readonly availability = this.api.availability(this.availabilityQuery);
  protected readonly availableDoctors = computed(() => {
    const specialtyId = this.filterModel().especialidadeId;
    return this.api.doctors().items.filter(
      (doctor) => !specialtyId || doctor.especialidadeIds.includes(specialtyId),
    );
  });
  protected readonly catalogsLoading = computed(
    () => this.api.units().loading || this.api.specialties().loading || this.api.doctors().loading,
  );
  protected readonly catalogsError = computed(
    () => Boolean(this.api.units().error || this.api.specialties().error || this.api.doctors().error),
  );

  protected searchAvailability(): void {
    const value = this.filterModel();
    this.selectedSlot.set(null);
    this.createdAppointment.set(null);
    this.feedback.set(null);
    this.availabilityQuery.set({
      data: value.data,
      unidadeId: value.unidadeId,
      especialidadeId: value.especialidadeId,
      medicoId: value.medicoId || undefined,
    });
  }

  protected changeDate(days: number): void {
    const value = this.filterModel();
    if (!value.data) return;
    const next = addCivilDays(value.data, days);
    this.filterModel.update((filters) => ({ ...filters, data: next }));
    if (value.unidadeId && value.especialidadeId) this.searchAvailability();
  }

  protected clearFilters(): void {
    this.filterModel.set({ data: "", unidadeId: "", especialidadeId: "", medicoId: "" });
    this.availabilityQuery.set(null);
    this.selectedSlot.set(null);
    this.feedback.set(null);
  }

  protected selectSlot(slot: AvailabilitySlot): void {
    this.selectedSlot.set(slot);
    this.createdAppointment.set(null);
  }

  protected confirmAppointment(): void {
    const slot = this.selectedSlot();
    if (!slot) return;
    this.creating.set(true);
    this.feedback.set(null);
    this.api.create({ regraAgendaId: slot.regraAgendaId, inicio: slot.inicio })
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: (appointment) => {
          this.createdAppointment.set(appointment);
          this.selectedSlot.set(null);
          this.feedback.set({ kind: "success", title: "Agendamento confirmado", description: "O horário foi reservado e sua lista foi atualizada." });
          this.availability.reload();
          this.api.setAppointmentsPage(0);
          this.api.appointments.reload();
        },
        error: (error: unknown) => this.handleMutationError(error, true),
      });
  }

  protected reloadCatalogs(): void {
    this.api.reloadCatalogs();
  }

  protected onSpecialtyChanged(specialtyId: string | null | undefined): void {
    const doctorId = this.filterModel().medicoId;
    const isCompatible = this.api.doctors().items.some(
      (doctor) => doctor.id === doctorId && doctor.especialidadeIds.includes(specialtyId ?? ""),
    );
    if (doctorId && !isCompatible) {
      this.filterModel.update((filters) => ({
        ...filters,
        especialidadeId: specialtyId ?? "",
        medicoId: "",
      }));
    }
  }

  protected emptyAvailabilityDescription(): string {
    const filters = this.availabilityQuery();
    return filters
      ? `Não há horários em ${filters.data} para os filtros selecionados. Escolha outra data ou altere os filtros.`
      : "Altere os filtros para consultar outra disponibilidade.";
  }

  protected formatDateTime(value: string): string {
    return formatPatientDateTime(value, this.timeZone());
  }

  protected apiIssue(error: unknown): PatientApiIssue {
    return patientApiIssue(error);
  }

  protected readonly timeZone = computed(
    () => {
      if (this.identity.identity.hasValue()) return this.identity.identity.value().timeZone;
      if (this.availability.hasValue()) return this.availability.value().timeZone;
      return "UTC";
    },
  );

  private handleMutationError(error: unknown, reloadAvailability: boolean): void {
    const issue = patientApiIssue(error);
    this.feedback.set({ kind: issue.isConflict ? "conflict" : "error", title: issue.title, description: issue.description });
    if (issue.code === "HORARIO_INDISPONIVEL") {
      this.selectedSlot.set(null);
      this.availability.reload();
    }
    if (issue.isConflict) {
      this.api.appointments.reload();
      if (reloadAvailability) this.availability.reload();
    }
  }
}
