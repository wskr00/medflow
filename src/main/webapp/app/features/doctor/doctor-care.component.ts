import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { form, FormField, maxLength, disabled } from "@angular/forms/signals";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmDialog, HlmDialogImports } from "@spartan-ng/helm/dialog";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmSheetImports } from "@spartan-ng/helm/sheet";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { HlmTextareaImports } from "@spartan-ng/helm/textarea";
import { finalize } from "rxjs";
import { IdentityService } from "../../auth/identity.service";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { DoctorApi, doctorIssue } from "./doctor.api";
import {
  ClinicalRecord,
  DoctorIssue,
  DoctorWorkspace,
  Page,
} from "./doctor.models";

const emptyRecord: ClinicalRecord = {
  queixaPrincipal: "",
  resumoAnamnese: "",
  conduta: "",
  observacoes: "",
};
const recordKey = (record: ClinicalRecord) => JSON.stringify(record);

@Component({
  selector: "app-doctor-care",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DoctorApi],
  imports: [
    RouterLink,
    FormField,
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmSheetImports,
    HlmSpinnerImports,
    HlmTextareaImports,
    StatePanelComponent,
  ],
  templateUrl: "./doctor-care.component.html",
  styleUrl: "./doctor-care.component.scss",
})
export class DoctorCareComponent {
  private readonly api = inject(DoctorApi);
  private readonly route = inject(ActivatedRoute);
  private readonly identity = inject(IdentityService);
  private readonly id = this.route.snapshot.paramMap.get("id") ?? "";
  protected readonly workspace = httpResource<DoctorWorkspace>(() =>
    this.api.workspace(this.id),
  );
  protected readonly historyPage = signal(0);
  private readonly historyRequested = signal(false);
  protected readonly history = httpResource<Page<DoctorWorkspace>>(() => {
    if (!this.historyRequested() || !this.workspace.hasValue())
      return undefined;
    return this.api.history(
      this.workspace.value().agendamento.paciente.id,
      this.historyPage(),
    );
  });
  protected readonly draft = signal<ClinicalRecord>(emptyRecord);
  protected readonly saving = signal(false);
  protected readonly recordForm = form(this.draft, (path) => {
    disabled(path, { when: () => this.saving() });
    maxLength(path.queixaPrincipal, 2000);
    maxLength(path.resumoAnamnese, 10000);
    maxLength(path.conduta, 10000);
    maxLength(path.observacoes, 5000);
  });
  protected readonly conflictBlocked = signal(false);
  protected readonly comparing = signal(false);
  protected readonly saved = signal<ClinicalRecord>(emptyRecord);
  protected readonly notice = signal<DoctorIssue | null>(null);
  private readonly seededSessionId = signal<string | null>(null);
  protected readonly dirty = computed(
    () => recordKey(this.draft()) !== recordKey(this.saved()),
  );
  protected readonly complete = computed(() =>
    [
      this.draft().queixaPrincipal,
      this.draft().resumoAnamnese,
      this.draft().conduta,
    ].every((value) => value.trim().length > 0),
  );
  constructor() {
    effect(() => {
      if (!this.workspace.hasValue()) return;
      const data = this.workspace.value();
      if (this.seededSessionId() !== data.atendimento.id) {
        this.seededSessionId.set(data.atendimento.id);
        this.saved.set(data.atendimento.registroClinico);
        this.draft.set(data.atendimento.registroClinico);
      }
    });
  }
  protected save(data: DoctorWorkspace) {
    if (
      !this.dirty() ||
      this.saving() ||
      this.conflictBlocked() ||
      this.recordForm().invalid()
    )
      return;
    this.saving.set(true);
    this.notice.set(null);
    this.api
      .save(data.atendimento.id, data.atendimento.version, this.draft())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => this.applyPersisted(updated),
        error: (error) => this.handleError(error),
      });
  }
  protected finish(data: DoctorWorkspace, dialog: HlmDialog) {
    if (
      this.saving() ||
      this.conflictBlocked() ||
      this.dirty() ||
      !this.complete() ||
      data.agendamento.status !== "EM_ATENDIMENTO"
    )
      return;
    this.saving.set(true);
    this.notice.set(null);
    this.api
      .finish(data.atendimento.id, data.atendimento.version)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          dialog.close();
          this.applyPersisted(updated);
        },
        error: (error) => {
          dialog.close();
          this.handleError(error);
        },
      });
  }
  protected reloadForComparison() {
    this.comparing.set(true);
    this.workspace.reload();
  }
  protected acceptLocal(data: DoctorWorkspace) {
    this.saved.set(data.atendimento.registroClinico);
    this.conflictBlocked.set(false);
    this.comparing.set(false);
    this.notice.set(null);
  }
  private handleError(error: unknown) {
    const issue = doctorIssue(error);
    this.notice.set(issue);
    if (
      issue.code === "VERSAO_DESATUALIZADA" ||
      issue.code === "TRANSICAO_INVALIDA"
    )
      this.conflictBlocked.set(true);
    if (issue.code === "REGISTRO_INCOMPLETO") {
      const fields = [
        ["complaint", this.draft().queixaPrincipal],
        ["history", this.draft().resumoAnamnese],
        ["plan", this.draft().conduta],
      ];
      document
        .getElementById(
          fields.find(([, value]) => !value.trim())?.[0] ?? "complaint",
        )
        ?.focus();
    }
  }
  protected onHistorySheetState(state: "open" | "closed") {
    if (state === "open") {
      if (this.historyRequested()) this.history.reload();
      else this.historyRequested.set(true);
    }
  }
  protected historyHasNext() {
    return (
      this.history.hasValue() &&
      (this.historyPage() + 1) * this.history.value().size <
        this.history.value().totalElements
    );
  }
  protected issue(error: unknown) {
    return doctorIssue(error);
  }
  protected dateTime(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
  @HostListener("window:beforeunload", ["$event"]) protected beforeUnload(
    event: BeforeUnloadEvent,
  ) {
    if (this.dirty()) {
      event.preventDefault();
      event.returnValue = true;
    }
  }
  canLeave(): boolean {
    return (
      !this.dirty() ||
      window.confirm("Você tem alterações não salvas. Sair sem salvar?")
    );
  }
  private applyPersisted(updated: DoctorWorkspace) {
    this.workspace.set(updated);
    this.saved.set(updated.atendimento.registroClinico);
    this.draft.set(updated.atendimento.registroClinico);
  }
}
