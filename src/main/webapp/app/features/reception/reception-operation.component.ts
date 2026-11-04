import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
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
import {
  NamedResource,
  OperationalAppointment,
  Page,
  ReceptionIssue,
} from "./reception.models";

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
  templateUrl: "./reception-operation.component.html",
  styleUrl: "./reception-operation.component.scss",
})
export class ReceptionOperationComponent {
  private readonly api = inject(ReceptionApi);
  private readonly identity = inject(IdentityService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly initialQuery = this.route.snapshot.queryParamMap;
  protected readonly date = signal(
    this.validDate(this.initialQuery.get("data")) ?? this.today(),
  );
  protected readonly unitId = signal(this.initialQuery.get("unidadeId") ?? "");
  protected readonly doctorId = signal(this.initialQuery.get("medicoId") ?? "");
  protected readonly status = signal(this.initialQuery.get("status") ?? "");
  protected readonly agendaPage = signal(0);
  protected readonly queuePage = signal(0);
  protected readonly busyId = signal<string | null>(null);
  protected readonly notice = signal<ReceptionIssue | null>(null);
  protected readonly units = httpResource<Page<NamedResource>>(() =>
    this.api.catalog("unidades"),
  );
  protected readonly doctors = httpResource<Page<NamedResource>>(() =>
    this.api.catalog("medicos"),
  );
  protected readonly agenda = httpResource<Page<OperationalAppointment>>(() =>
    this.api.agenda({
      data: this.date(),
      unidadeId: this.unitId(),
      medicoId: this.doctorId(),
      status: this.status(),
      page: this.agendaPage(),
      size: 20,
    }),
  );
  protected readonly queue = httpResource<Page<OperationalAppointment>>(() =>
    this.api.queue({
      unidadeId: this.unitId(),
      medicoId: this.doctorId(),
      page: this.queuePage(),
      size: 20,
    }),
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

  protected setDate(value: string) {
    if (value) {
      this.date.set(value);
      this.agendaPage.set(0);
      this.syncUrl();
    }
  }
  protected setFilter(
    kind: "unit" | "doctor" | "status",
    value: string | null | undefined,
  ) {
    ({ unit: this.unitId, doctor: this.doctorId, status: this.status })[
      kind
    ].set(value ?? "");
    this.agendaPage.set(0);
    this.queuePage.set(0);
    this.syncUrl();
  }
  protected clearFilters() {
    this.date.set(this.today());
    this.unitId.set("");
    this.doctorId.set("");
    this.status.set("");
    this.agendaPage.set(0);
    this.queuePage.set(0);
    this.syncUrl();
  }
  protected reloadAll() {
    this.notice.set(null);
    this.agenda.reload();
    this.queue.reload();
  }
  protected checkIn(item: OperationalAppointment) {
    this.mutate(
      item,
      this.api.checkIn(item.id, item.version),
      "Chegada confirmada",
      `${item.paciente.nome} entrou na fila.`,
    );
  }
  protected cancel(item: OperationalAppointment, dialog: HlmDialog) {
    this.busyId.set(item.id);
    this.notice.set(null);
    this.api
      .cancel(item.id, item.version)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => {
          dialog.close();
          this.notice.set({
            code: "SUCCESS",
            title: "Consulta cancelada",
            description: `O horário de ${item.paciente.nome} foi liberado.`,
            conflict: false,
          });
          this.reloadResources();
        },
        error: (error) => {
          this.notice.set(receptionIssue(error));
          this.reloadResources();
        },
      });
  }
  protected time(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
  protected dateTime(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
  protected range(page: Page<unknown>) {
    if (!page.totalElements) return "0";
    return `${page.page * page.size + 1}–${Math.min((page.page + 1) * page.size, page.totalElements)}`;
  }
  protected hasNext(page: Page<unknown> | undefined) {
    return !!page && (page.page + 1) * page.size < page.totalElements;
  }
  protected issue(error: unknown) {
    return receptionIssue(error);
  }
  private mutate(
    item: OperationalAppointment,
    request: ReturnType<ReceptionApi["checkIn"]>,
    title: string,
    description: string,
  ) {
    this.busyId.set(item.id);
    this.notice.set(null);
    request.pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => {
        this.notice.set({
          code: "SUCCESS",
          title,
          description,
          conflict: false,
        });
        this.reloadResources();
      },
      error: (error) => {
        this.notice.set(receptionIssue(error));
        this.reloadResources();
      },
    });
  }
  private reloadResources() {
    this.agenda.reload();
    this.queue.reload();
  }
  private syncUrl() {
    void this.router.navigate([], {
      queryParams: {
        data: this.date(),
        unidadeId: this.unitId() || null,
        medicoId: this.doctorId() || null,
        status: this.status() || null,
      },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }
  private validDate(value: string | null) {
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  }
  private today() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: this.identity?.identity.value()?.timeZone ?? "America/Belem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  }
}
