import { DOCUMENT } from "@angular/common";
import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  Injector,
  afterNextRender,
  inject,
  signal,
} from "@angular/core";
import { FormField, FormRoot, form, required } from "@angular/forms/signals";
import { RouterLink } from "@angular/router";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCalendarImports } from "@spartan-ng/helm/calendar";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmNativeSelectImports } from "@spartan-ng/helm/native-select";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";
import { IdentityService } from "../../auth/identity.service";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { PatientSlotOptionsComponent } from "./patient-slot-options.component";
import { PatientVisitDetailsComponent } from "./patient-visit-details.component";
import { calendarToday, civilDate, slotKey } from "./patient-time";
import { PatientApi, patientIssue } from "./patient.api";
import {
  Appointment,
  Availability,
  AvailableDates,
  Doctor,
  NamedResource,
  Page,
  Slot,
} from "./patient.models";

@Component({
  selector: "app-patient-booking",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PatientApi],
  imports: [
    RouterLink,
    PatientSlotOptionsComponent,
    PatientVisitDetailsComponent,
    FormField,
    FormRoot,
    HlmAlertImports,
    HlmButtonImports,
    HlmCalendarImports,
    HlmFieldImports,
    HlmNativeSelectImports,
    HlmSpinnerImports,
    StatePanelComponent,
  ],
  templateUrl: "./patient-booking.component.html",
  styleUrls: ["./patient-journey.scss", "./patient-booking.component.scss"],
})
export class PatientBookingComponent {
  protected readonly api = inject(PatientApi);
  private readonly identity = inject(IdentityService);
  protected readonly stage = signal(1);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  protected readonly today = calendarToday(
    this.identity.identity.value()?.timeZone,
  );
  protected readonly date = signal(this.today);
  protected readonly calendarFocus = signal(this.today);
  protected readonly model = signal({
    specialtyId: "",
    unitId: "",
    doctorId: "",
  });
  protected readonly bookingForm = form(
    this.model,
    (path) => {
      required(path.specialtyId, { message: "Selecione uma especialidade." });
      required(path.unitId, { message: "Selecione uma unidade." });
    },
    { submission: { action: async () => this.goStage(2) } },
  );
  protected readonly units = httpResource<Page<NamedResource>>(() =>
    this.api.catalog("unidades"),
  );
  protected readonly specialties = httpResource<Page<NamedResource>>(() =>
    this.api.catalog("especialidades"),
  );
  protected readonly doctorsResource = httpResource<Page<Doctor>>(() =>
    this.api.catalog("medicos"),
  );
  protected readonly doctors = computed(() =>
    (this.doctorsResource.hasValue()
      ? this.doctorsResource.value().items
      : []
    ).filter(
      (doctor) =>
        !this.model().specialtyId ||
        doctor.especialidadeIds.includes(this.model().specialtyId),
    ),
  );
  protected readonly availability = httpResource<Availability>(() => {
    const data = this.model();
    return this.stage() >= 2 && data.specialtyId && data.unitId
      ? this.api.availability(
          this.civilDate(),
          data.unitId,
          data.specialtyId,
          data.doctorId,
        )
      : undefined;
  });
  private readonly availableDateRange = computed(() => {
    const focus = this.calendarFocus();
    const start = new Date(focus.getFullYear(), focus.getMonth(), 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 48);
    return {
      start: this.formatCivilDate(start),
      end: this.formatCivilDate(end),
    };
  });
  protected readonly availableDates = httpResource<AvailableDates>(() => {
    const data = this.model();
    const range = this.availableDateRange();
    return this.stage() >= 2 && data.specialtyId && data.unitId
      ? this.api.availableDates(
          range.start,
          range.end,
          data.unitId,
          data.specialtyId,
          data.doctorId,
        )
      : undefined;
  });
  protected readonly highlightedDates = computed(() =>
    (this.availableDates.hasValue()
      ? this.availableDates.value().items
      : []
    ).map((value) => {
      const [year, month, day] = value.split("-").map(Number);
      return new Date(year, month - 1, day);
    }),
  );
  protected readonly slots = computed(() =>
    this.availability.hasValue() ? this.availability.value().items : [],
  );
  protected readonly selected = signal<Slot | null>(null);
  protected readonly confirmed = signal<Appointment | null>(null);
  protected readonly saving = signal(false);
  protected readonly problem = signal<ReturnType<typeof patientIssue> | null>(
    null,
  );
  protected loading() {
    return (
      this.units.isLoading() ||
      this.specialties.isLoading() ||
      this.doctorsResource.isLoading()
    );
  }
  protected catalogError() {
    return (
      this.units.error() ||
      this.specialties.error() ||
      this.doctorsResource.error()
    );
  }
  protected reloadCatalogs() {
    this.units.reload();
    this.specialties.reload();
    this.doctorsResource.reload();
  }
  protected clearSelection() {
    this.selected.set(null);
    this.problem.set(null);
  }
  protected changeDate(value: Date | undefined) {
    this.date.set(value ?? new Date(this.date()));
    this.clearSelection();
  }
  protected confirm() {
    const item = this.selected();
    if (!item || this.saving()) return;
    this.saving.set(true);
    this.problem.set(null);
    this.api
      .create(item.regraAgendaId, item.inicio)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (appointment) => {
          this.confirmed.set(appointment);
          this.goStage(4);
        },
        error: (error) => {
          const issue = patientIssue(error, "write");
          this.problem.set(issue);
          if (issue.code === "HORARIO_INDISPONIVEL") {
            this.selected.set(null);
            this.goStage(2);
            this.availability.reload();
            this.availableDates.reload();
          }
        },
      });
  }
  protected again() {
    this.selected.set(null);
    this.confirmed.set(null);
    this.problem.set(null);
    this.goStage(1);
  }
  protected time(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
  protected issue(error: unknown) {
    return patientIssue(error);
  }
  protected readonly preferences = computed(() => {
    const model = this.model();
    const specialty = this.specialties.hasValue()
      ? this.specialties
          .value()
          .items.find((item) => item.id === model.specialtyId)?.nome
      : "";
    const unit = this.units.hasValue()
      ? this.units.value().items.find((item) => item.id === model.unitId)?.nome
      : "";
    const doctor = this.doctors().find(
      (item) => item.id === model.doctorId,
    )?.nome;
    return { specialty, unit, doctor: doctor ?? "Qualquer profissional" };
  });
  constructor() {
    effect(() => {
      const selected = this.selected();
      if (
        this.stage() < 2 ||
        this.stage() === 4 ||
        !selected ||
        this.availability.isLoading() ||
        !this.availability.hasValue()
      )
        return;
      if (!this.slots().some((item) => slotKey(item) === slotKey(selected))) {
        this.selected.set(null);
        this.goStage(2);
      }
    });
  }
  protected changeSpecialty(value: string | null | undefined) {
    this.model.update((model) => ({
      ...model,
      specialtyId: value ?? "",
      doctorId: "",
    }));
    this.clearSelection();
  }
  protected choose(slot: Slot) {
    if (this.saving()) return;
    this.selected.set(slot);
    this.problem.set(null);
  }
  protected goStage(stage: number) {
    if (stage === 1) this.selected.set(null);
    this.stage.set(stage);
    afterNextRender(
      () => {
        this.document
          .getElementById("booking-step-title")
          ?.focus({ preventScroll: true });
        this.document
          .getElementById("booking-step-title")
          ?.scrollIntoView?.({ block: "start", behavior: "instant" });
      },
      { injector: this.injector },
    );
  }
  protected retryAvailability() {
    this.availability.reload();
    this.availableDates.reload();
  }
  protected selectedDateLabel() {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(
      this.date(),
    );
  }
  private civilDate() {
    return civilDate(this.date());
  }
  private formatCivilDate(value: Date) {
    return civilDate(value);
  }
}
