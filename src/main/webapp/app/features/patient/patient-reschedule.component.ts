import { DOCUMENT } from "@angular/common";
import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCalendarImports } from "@spartan-ng/helm/calendar";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize, map } from "rxjs";
import { IdentityService } from "../../auth/identity.service";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { PatientApi, patientIssue } from "./patient.api";
import {
  Appointment,
  Availability,
  PatientIssue,
  Slot,
} from "./patient.models";
import { PatientSlotOptionsComponent } from "./patient-slot-options.component";
import { PatientVisitDetailsComponent } from "./patient-visit-details.component";
import { calendarToday, civilDate, slotKey } from "./patient-time";

@Component({
  selector: "app-patient-reschedule",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PatientApi],
  imports: [
    RouterLink,
    HlmAlertImports,
    HlmButtonImports,
    HlmCalendarImports,
    HlmSpinnerImports,
    StatePanelComponent,
    PatientSlotOptionsComponent,
    PatientVisitDetailsComponent,
  ],
  templateUrl: "./patient-reschedule.component.html",
  styleUrls: ["./patient-journey.scss", "./patient-reschedule.component.scss"],
})
export class PatientRescheduleComponent {
  private readonly api = inject(PatientApi);
  private readonly route = inject(ActivatedRoute);
  private readonly identity = inject(IdentityService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly id = toSignal(
    this.route.paramMap.pipe(map((params) => params.get("id") ?? "")),
    { initialValue: "" },
  );
  readonly appointment = httpResource<Appointment>(() =>
    this.id() ? this.api.appointment(this.id()) : undefined,
  );
  protected readonly today = calendarToday(
    this.identity.identity.value()?.timeZone,
  );
  protected readonly date = signal(this.today);
  protected readonly selected = signal<Slot | null>(null);
  protected readonly review = signal(false);
  protected readonly saving = signal(false);
  protected readonly problem = signal<PatientIssue | null>(null);
  protected readonly completed = signal<Appointment | null>(null);
  protected readonly conflictBlocked = signal(false);
  protected readonly availability = httpResource<Availability>(() =>
    this.id() &&
    this.appointment.hasValue() &&
    this.appointment.value().allowedActions.canReschedule &&
    !this.completed()
      ? this.api.rescheduleAvailability(this.id(), civilDate(this.date()))
      : undefined,
  );
  protected readonly slots = computed(() =>
    this.availability.hasValue() ? this.availability.value().items : [],
  );
  constructor() {
    effect(() => {
      const selected = this.selected();
      if (
        !selected ||
        !this.availability.hasValue() ||
        this.availability.isLoading() ||
        this.completed()
      )
        return;
      if (!this.slots().some((slot) => slotKey(slot) === slotKey(selected))) {
        this.selected.set(null);
        this.review.set(false);
      }
    });
  }
  protected choose(slot: Slot) {
    if (this.saving()) return;
    this.selected.set(slot);
    this.review.set(false);
    this.problem.set(null);
  }
  protected changeDate(date: Date | undefined) {
    if (this.saving()) return;
    this.date.set(date ?? new Date(this.date()));
    this.selected.set(null);
    this.review.set(false);
    this.problem.set(null);
  }
  protected showReview() {
    if (!this.selected() || this.saving() || this.conflictBlocked()) return;
    this.review.set(true);
    this.focus("reschedule-review-title");
  }
  protected backToTimes() {
    this.review.set(false);
    this.focus("reschedule-times-title");
  }
  protected confirm(current: Appointment, item: Slot) {
    if (
      this.saving() ||
      this.conflictBlocked() ||
      !current.allowedActions.canReschedule ||
      !this.selected()
    )
      return;
    this.saving.set(true);
    this.problem.set(null);
    this.api
      .reschedule(current.id, item.regraAgendaId, item.inicio, current.version)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (appointment) => {
          this.completed.set(appointment);
          this.selected.set(null);
          this.review.set(false);
          this.focus("reschedule-success-title");
        },
        error: (error) => {
          const issue = patientIssue(error, "write");
          this.problem.set(issue);
          this.review.set(false);
          if (issue.conflict) {
            this.selected.set(null);
            this.availability.reload();
            if (issue.code !== "HORARIO_INDISPONIVEL") {
              this.conflictBlocked.set(true);
              this.appointment.reload();
            }
          }
          this.focus("reschedule-feedback");
        },
      });
  }
  protected acceptUpdated() {
    if (this.appointment.isLoading() || !this.appointment.hasValue()) return;
    this.conflictBlocked.set(false);
    this.problem.set(null);
    this.selected.set(null);
    this.review.set(false);
    this.availability.reload();
    this.focus("reschedule-times-title");
  }
  protected issue(error: unknown) {
    return patientIssue(error);
  }
  protected dateTime(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
  protected dateLabel() {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(
      this.date(),
    );
  }
  private focus(id: string) {
    afterNextRender(
      () => {
        const element = this.document.getElementById(id);
        element?.focus({ preventScroll: true });
        element?.scrollIntoView?.({ block: "start", behavior: "instant" });
      },
      { injector: this.injector },
    );
  }
}
