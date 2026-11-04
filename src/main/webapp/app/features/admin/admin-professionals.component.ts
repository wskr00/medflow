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
import { HlmToggleGroupImports } from "@spartan-ng/helm/toggle-group";
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
import { AdminIssue, Page, Professional, Specialty } from "./admin.models";
@Component({
  selector: "app-admin-professionals",
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
    HlmToggleGroupImports,
    StatePanelComponent,
  ],
  templateUrl: "./admin-professionals.component.html",
  styleUrl: "./admin-editors.scss",
})
export class AdminProfessionalsComponent {
  private readonly api = inject(AdminApi);
  protected readonly values = httpResource<Page<Professional>>(() =>
    this.api.list("medicos"),
  );
  protected readonly catalog = httpResource<Page<Specialty>>(() =>
    this.api.list("especialidades"),
  );
  protected readonly id = signal<string | null>(null);
  protected readonly version = signal<number | null>(null);
  protected readonly name = signal("");
  protected readonly crmNumber = signal("");
  protected readonly crmUf = signal("");
  protected readonly specialties = signal<string[]>([]);
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
    this.crmNumber.set("");
    this.crmUf.set("");
    this.specialties.set([]);
    this.active.set(true);
    focusAdminEditor("doctor-name");
  }
  protected edit(value: Professional, persisted = false) {
    if (!persisted && (this.saving() || !discardAdminChanges(this.dirty())))
      return;
    this.notice.set(null);
    this.wasActive.set(value.ativo);
    this.dirty.set(false);
    this.id.set(value.id);
    this.version.set(value.version);
    this.name.set(value.nome);
    this.crmNumber.set(value.crmNumero);
    this.crmUf.set(value.crmUf);
    this.specialties.set([...value.especialidadeIds]);
    this.active.set(value.ativo);
    if (!persisted) focusAdminEditor("doctor-name");
  }
  protected changeSpecialties(value: unknown) {
    this.specialties.set(
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : typeof value === "string"
          ? [value]
          : [],
    );
    this.markDirty();
  }
  protected save() {
    if (this.saving() || this.notice()?.code === "VERSAO_DESATUALIZADA") return;
    const fields: Record<string, string> = {};
    if (!this.name().trim()) fields["nome"] = "Informe o nome do profissional.";
    if (!this.crmNumber().trim()) fields["crmNumero"] = "Informe o CRM.";
    if (!/^[A-Z]{2}$/.test(this.crmUf()))
      fields["crmUf"] = "Informe a UF com duas letras.";
    if (!this.specialties().length)
      fields["especialidadeIds"] = "Escolha ao menos uma especialidade.";
    if (Object.keys(fields).length) {
      this.notice.set(invalidConfiguration(fields));
      focusAdminEditor(
        fields["nome"]
          ? "doctor-name"
          : fields["crmNumero"]
            ? "crm-number"
            : fields["crmUf"]
              ? "crm-uf"
              : "doctor-specialties",
      );
      return;
    }
    if (!confirmDeactivation(this.wasActive(), this.active())) return;
    this.notice.set(null);
    this.saving.set(true);
    const payload = {
      nome: this.name().trim(),
      crmNumero: this.crmNumber().trim(),
      crmUf: this.crmUf(),
      especialidadeIds: this.specialties(),
      ativo: this.active(),
    };
    const request = this.id()
      ? this.api.update<Professional>("medicos", this.id()!, {
          ...payload,
          expectedVersion: this.version(),
        })
      : this.api.create<Professional>("medicos", payload);
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
      .read<Professional>(this.api.professional(id))
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
