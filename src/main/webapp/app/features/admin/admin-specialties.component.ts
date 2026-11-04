import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
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
import { AdminIssue, Page, Specialty } from "./admin.models";
@Component({
  selector: "app-admin-specialties",
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
  templateUrl: "./admin-specialties.component.html",
  styleUrl: "./admin-editors.scss",
})
export class AdminSpecialtiesComponent {
  private readonly api = inject(AdminApi);
  protected readonly values = httpResource<Page<Specialty>>(() =>
    this.api.list("especialidades"),
  );
  protected readonly id = signal<string | null>(null);
  protected readonly version = signal<number | null>(null);
  protected readonly name = signal("");
  protected readonly active = signal(true);
  protected readonly saving = signal(false);
  protected readonly notice = signal<AdminIssue | null>(null);
  private readonly wasActive = signal(false);
  protected readonly dirty = signal(false);
  protected markDirty() {
    if (this.notice()?.code === "SAVED") this.notice.set(null);
    this.dirty.set(true);
  }
  canLeave() {
    return (
      !this.saving() &&
      (!this.dirty() ||
        window.confirm("Há alterações não salvas. Sair sem salvar?"))
    );
  }
  protected newValue() {
    if (this.saving() || !discardAdminChanges(this.dirty())) return;
    this.notice.set(null);
    this.wasActive.set(false);
    this.dirty.set(false);
    this.id.set(null);
    this.version.set(null);
    this.name.set("");
    this.active.set(true);
    this.notice.set(null);
    focusAdminEditor("specialty-name");
  }
  protected edit(value: Specialty, persisted = false) {
    if (!persisted && (this.saving() || !discardAdminChanges(this.dirty())))
      return;
    this.notice.set(null);
    this.wasActive.set(value.ativo);
    this.dirty.set(false);
    this.id.set(value.id);
    this.version.set(value.version);
    this.name.set(value.nome);
    this.active.set(value.ativo);
    this.notice.set(null);
    if (!persisted) focusAdminEditor("specialty-name");
  }
  protected save() {
    if (this.saving() || this.notice()?.code === "VERSAO_DESATUALIZADA") return;
    if (!this.name().trim()) {
      this.notice.set({
        code: "INVALID",
        title: "Informe o nome",
        description: "O nome da especialidade é obrigatório.",
        conflict: false,
        fields: { nome: "Informe o nome da especialidade." },
      });
      focusAdminEditor("specialty-name");
      return;
    }
    if (!confirmDeactivation(this.wasActive(), this.active())) return;
    this.notice.set(null);
    this.saving.set(true);
    const payload = { nome: this.name().trim(), ativo: this.active() };
    const request = this.id()
      ? this.api.update<Specialty>("especialidades", this.id()!, {
          ...payload,
          expectedVersion: this.version(),
        })
      : this.api.create<Specialty>("especialidades", payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (value) => {
        this.dirty.set(false);
        this.edit(value, true);
        this.notice.set(
          savedConfiguration(
            "O cadastro foi atualizado. As referências anteriores foram preservadas.",
          ),
        );
        this.values.reload();
      },
      error: (error) => this.notice.set(adminIssue(error)),
    });
  }
  protected reloadCurrent() {
    const id = this.id();
    if (!id || this.saving() || !confirmReload()) return;
    this.saving.set(true);
    this.api
      .read<Specialty>(this.api.specialty(id))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (value) => {
          this.edit(value, true);
          this.notice.set(null);
          this.values.reload();
        },
        error: (error) => this.notice.set(failedAdminReload(error)),
      });
  }
  protected field(name: string) {
    return this.notice()?.fields[name];
  }
  protected issue(error: unknown) {
    return adminIssue(error);
  }
}
