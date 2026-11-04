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
import { AdminIssue, Page, Professional, ScheduleBlock } from "./admin.models";
@Component({
  selector: "app-admin-blocks",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminApi],
  imports: [
    AdminFeedbackComponent,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    StatePanelComponent,
  ],
  templateUrl: "./admin-blocks.component.html",
  styleUrl: "./admin-editors.scss",
})
export class AdminBlocksComponent {
  private readonly api = inject(AdminApi);
  protected readonly blocks = httpResource<Page<ScheduleBlock>>(() =>
    this.api.blocks(),
  );
  protected readonly doctors = httpResource<Page<Professional>>(() =>
    this.api.list("medicos"),
  );
  protected readonly id = signal<string | null>(null);
  protected readonly version = signal<number | null>(null);
  protected readonly doctorId = signal("");
  protected readonly start = signal("");
  protected readonly end = signal("");
  protected readonly saving = signal(false);
  protected readonly notice = signal<AdminIssue | null>(null);
  private readonly wasActive = signal(false);
  protected readonly active = signal(true);
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
  protected newBlock() {
    if (this.saving() || !discardAdminChanges(this.dirty())) return;
    this.notice.set(null);
    this.wasActive.set(false);
    this.dirty.set(false);
    this.id.set(null);
    this.version.set(null);
    this.doctorId.set("");
    this.start.set("");
    this.end.set("");
    this.active.set(true);
    focusAdminEditor("block-doctor");
  }
  protected edit(block: ScheduleBlock, persisted = false) {
    if (!persisted && (this.saving() || !discardAdminChanges(this.dirty())))
      return;
    this.notice.set(null);
    this.wasActive.set(block.ativo);
    this.dirty.set(false);
    this.id.set(block.id);
    this.version.set(block.version);
    this.active.set(block.ativo);
    this.doctorId.set(block.medico.id);
    this.start.set(block.inicio.slice(0, 16));
    this.end.set(block.fim.slice(0, 16));
    if (!persisted) focusAdminEditor("block-start");
  }
  protected save() {
    if (this.saving() || this.notice()?.code === "VERSAO_DESATUALIZADA") return;
    const fields: Record<string, string> = {};
    if (!this.doctorId()) fields["medicoId"] = "Selecione o profissional.";
    if (!this.start()) fields["inicio"] = "Informe o início do bloqueio.";
    if (!this.end() || this.end() <= this.start())
      fields["fim"] = "O fim deve ser posterior ao início.";
    if (Object.keys(fields).length) {
      this.notice.set(invalidConfiguration(fields));
      focusAdminEditor(
        fields["medicoId"]
          ? "block-doctor"
          : fields["inicio"]
            ? "block-start"
            : "block-end",
      );
      return;
    }
    const payload = {
      medicoId: this.doctorId(),
      inicio: this.start(),
      fim: this.end(),
      ativo: this.active(),
    };
    if (!confirmDeactivation(this.wasActive(), this.active())) return;
    this.notice.set(null);
    this.saving.set(true);
    const request = this.id()
      ? this.api.update<ScheduleBlock>("bloqueios-agenda", this.id()!, {
          ...payload,
          expectedVersion: this.version(),
        })
      : this.api.create<ScheduleBlock>("bloqueios-agenda", payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (block) => {
        this.dirty.set(false);
        this.edit(block, true);
        this.notice.set(
          savedConfiguration(
            "O cadastro foi atualizado. As referências anteriores foram preservadas.",
          ),
        );
        this.blocks.reload();
      },
      error: (error) => this.notice.set(adminIssue(error)),
    });
  }
  protected dateTime(value: string) {
    const [date, time] = value.split("T");
    return `${date.split("-").reverse().join("/")}, ${time.slice(0, 5)}`;
  }
  protected reloadCurrent() {
    const id = this.id();
    if (!id || this.saving() || !confirmReload()) return;
    this.saving.set(true);
    this.api
      .read<ScheduleBlock>(this.api.block(id))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (value) => {
          this.edit(value, true);
          this.notice.set(null);
          this.blocks.reload();
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
