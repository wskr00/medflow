import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { IdentityService } from "../../auth/identity.service";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { StatusBadgeComponent } from "../../shared/ui/status-badge.component";
import { PatientApi, patientIssue } from "./patient.api";
import { Appointment, Page } from "./patient.models";

@Component({
  selector: "app-patient-history",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PatientApi],
  imports: [
    RouterLink,
    HlmButtonImports,
    StatePanelComponent,
    StatusBadgeComponent,
  ],
  templateUrl: "./patient-history.component.html",
  styleUrls: ["./patient-journey.scss", "./patient-history.component.scss"],
})
export class PatientHistoryComponent {
  private readonly api = inject(PatientApi);
  private readonly identity = inject(IdentityService);
  protected readonly page = signal(0);
  readonly resource = httpResource<Page<Appointment>>(() =>
    this.api.appointments("PAST", "status==FINALIZADA", this.page()),
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
  protected issue(error: unknown) {
    return patientIssue(error);
  }
  protected dateTime(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
}
