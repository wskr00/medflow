import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmInputImports } from "@spartan-ng/helm/input";
import { HlmNativeSelectImports } from "@spartan-ng/helm/native-select";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { AdminFeedbackComponent } from "./admin-feedback.component";
import {
  savedConfiguration,
  invalidConfiguration,
  discardAdminChanges,
  confirmDeactivation,
  confirmReload,
  focusAdminEditor,
  failedAdminReload,
} from "./admin-editor.utils";
import { AdminApi, adminIssue } from "./admin.api";
import { AdminIssue, Clinic } from "./admin.models";

@Component({
  selector: "app-admin-clinic",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminApi],
  imports: [
    AdminFeedbackComponent,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmSpinnerImports,
    StatePanelComponent,
  ],
  templateUrl: "./admin-clinic.component.html",
  styleUrl: "./admin-editors.scss",
})
export class AdminClinicComponent {
  private readonly api = inject(AdminApi);
  protected readonly clinic = httpResource<Clinic>(() => this.api.clinic());
  protected readonly name = signal("");
  protected readonly timeZone = signal("");
  protected readonly active = signal(true);
  protected readonly saving = signal(false);
  protected readonly notice = signal<AdminIssue | null>(null);
  private readonly initialized = signal(false);
  protected readonly dirty = computed(
    () =>
      this.initialized() &&
      !!this.clinic.value() &&
      (this.name() !== this.clinic.value()!.nome ||
        this.timeZone() !== this.clinic.value()!.timeZone ||
        this.active() !== this.clinic.value()!.ativo),
  );
  constructor() {
    effect(() => {
      if (!this.clinic.hasValue()) return;
      const data = this.clinic.value();
      if (!this.initialized()) {
        this.name.set(data.nome);
        this.timeZone.set(data.timeZone);
        this.active.set(data.ativo);
        this.initialized.set(true);
      }
    });
  }
  protected save(data: Clinic) {
    if (this.saving() || this.notice()?.code === "VERSAO_DESATUALIZADA") return;
    if (!this.name().trim() || !this.timeZone().trim()) {
      this.notice.set({
        code: "INVALID",
        title: "Revise os campos obrigatórios",
        description: "Informe nome e fuso horário.",
        conflict: false,
        fields: {
          nome: !this.name().trim() ? "Informe o nome da clínica." : "",
          timeZone: !this.timeZone().trim() ? "Informe o fuso IANA." : "",
        },
      });
      focusAdminEditor(!this.name().trim() ? "clinic-name" : "clinic-zone");
      return;
    }
    if (!confirmDeactivation(data.ativo, this.active())) return;
    this.saving.set(true);
    this.notice.set(null);
    this.api
      .putClinic({
        nome: this.name().trim(),
        timeZone: this.timeZone().trim(),
        ativo: this.active(),
        version: data.version,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (value) => {
          this.applyClinic(value);
          this.notice.set(
            savedConfiguration("Os dados da clínica foram salvos."),
          );
        },
        error: (error) => this.notice.set(adminIssue(error)),
      });
  }
  private applyClinic(value: Clinic) {
    this.clinic.set(value);
    this.name.set(value.nome);
    this.timeZone.set(value.timeZone);
    this.active.set(value.ativo);
    this.initialized.set(true);
  }
  protected reloadCurrent() {
    if (this.saving() || !confirmReload()) return;
    this.saving.set(true);
    this.api
      .read<Clinic>(this.api.clinic())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (value) => {
          this.applyClinic(value);
          this.notice.set(null);
        },
        error: (error) => this.notice.set(failedAdminReload(error)),
      });
  }
  protected clearSaved() {
    if (this.notice()?.code === "SAVED") this.notice.set(null);
  }
  protected issue(error: unknown) {
    return adminIssue(error);
  }
  protected fieldError(name: string) {
    return this.notice()?.fields[name];
  }
  canLeave() {
    return (
      !this.saving() &&
      (!this.dirty() ||
        window.confirm("Há alterações não salvas na clínica. Sair sem salvar?"))
    );
  }
}
