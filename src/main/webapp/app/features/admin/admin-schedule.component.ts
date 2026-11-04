import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import {
  AdminIssue,
  Page,
  Professional,
  Room,
  ScheduleRule,
  Specialty,
} from "./admin.models";
@Component({
  selector: "app-admin-schedule",
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
  templateUrl: "./admin-schedule.component.html",
  styleUrl: "./admin-editors.scss",
})
export class AdminScheduleComponent {
  private readonly api = inject(AdminApi);
  protected readonly rules = httpResource<Page<ScheduleRule>>(() =>
    this.api.rules(),
  );
  protected readonly doctors = httpResource<Page<Professional>>(() =>
    this.api.list("medicos"),
  );
  protected readonly specialties = httpResource<Page<Specialty>>(() =>
    this.api.list("especialidades"),
  );
  protected readonly rooms = httpResource<Page<Room>>(() =>
    this.api.list("consultorios"),
  );
  protected readonly availableSpecialties = computed(() => {
    if (!this.specialties.hasValue() || !this.doctors.hasValue()) return [];
    const doctor = this.doctors
      .value()
      .items.find((item) => item.id === this.doctorId());
    return this.specialties
      .value()
      .items.filter(
        (item) =>
          doctor?.especialidadeIds.includes(item.id) &&
          (item.ativo || item.id === this.specialtyId()),
      );
  });
  protected changeDoctor(value: string) {
    this.doctorId.set(value);
    this.specialtyId.set("");
    this.markDirty();
  }
  protected readonly id = signal<string | null>(null);
  protected readonly version = signal<number | null>(null);
  protected readonly doctorId = signal("");
  protected readonly specialtyId = signal("");
  protected readonly roomId = signal("");
  protected readonly dayValue = signal("1");
  protected readonly start = signal("08:00");
  protected readonly end = signal("09:00");
  protected readonly duration = signal("30");
  private localDate() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  protected readonly validFrom = signal(this.localDate());
  protected readonly validUntil = signal("");
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
  protected newRule() {
    if (this.saving() || !discardAdminChanges(this.dirty())) return;
    this.notice.set(null);
    this.wasActive.set(false);
    this.dirty.set(false);
    this.id.set(null);
    this.version.set(null);
    this.doctorId.set("");
    this.specialtyId.set("");
    this.roomId.set("");
    this.dayValue.set("1");
    this.start.set("08:00");
    this.end.set("09:00");
    this.duration.set("30");
    this.active.set(true);
    this.validUntil.set("");
    this.validFrom.set(this.localDate());
    focusAdminEditor("rule-doctor");
  }
  protected edit(rule: ScheduleRule, persisted = false) {
    if (!persisted && (this.saving() || !discardAdminChanges(this.dirty())))
      return;
    this.notice.set(null);
    this.wasActive.set(rule.ativo);
    this.dirty.set(false);
    this.id.set(rule.id);
    this.version.set(rule.version);
    this.active.set(rule.ativo);
    this.doctorId.set(rule.medico.id);
    this.specialtyId.set(rule.especialidade.id);
    this.roomId.set(rule.consultorio.id);
    this.dayValue.set(`${rule.diaSemana}`);
    this.start.set(rule.horaInicio);
    this.end.set(rule.horaFim);
    this.duration.set(`${rule.duracaoMinutos}`);
    this.validFrom.set(rule.vigenteDe);
    this.validUntil.set(rule.vigenteAte ?? "");
    if (!persisted) focusAdminEditor("rule-start");
  }
  protected save() {
    if (this.saving() || this.notice()?.code === "VERSAO_DESATUALIZADA") return;
    const payload = {
      medicoId: this.doctorId(),
      especialidadeId: this.specialtyId(),
      consultorioId: this.roomId(),
      diaSemana: +this.dayValue(),
      horaInicio: this.start(),
      horaFim: this.end(),
      duracaoMinutos: +this.duration(),
      vigenteDe: this.validFrom(),
      vigenteAte: this.validUntil() || null,
      ativo: this.active(),
    };
    const fields: Record<string, string> = {};
    if (!payload.medicoId) fields["medicoId"] = "Selecione o profissional.";
    if (!payload.especialidadeId)
      fields["especialidadeId"] =
        "Selecione uma especialidade do profissional.";
    if (!payload.consultorioId)
      fields["consultorioId"] = "Selecione o consultório.";
    if (!payload.horaInicio) fields["horaInicio"] = "Informe o início.";
    if (!payload.horaFim || payload.horaFim <= payload.horaInicio)
      fields["horaFim"] = "O fim deve ser posterior ao início.";
    if (!Number.isInteger(payload.duracaoMinutos) || payload.duracaoMinutos < 1)
      fields["duracaoMinutos"] =
        "Informe a duração em minutos inteiros, maior que zero.";
    if (!payload.vigenteDe)
      fields["vigenteDe"] = "Informe o início da vigência.";
    if (payload.vigenteAte && payload.vigenteAte < payload.vigenteDe)
      fields["vigenteAte"] =
        "O fim da vigência deve ser igual ou posterior ao início.";
    if (Object.keys(fields).length) {
      this.notice.set(invalidConfiguration(fields));
      const ids: Record<string, string> = {
        medicoId: "rule-doctor",
        especialidadeId: "rule-specialty",
        consultorioId: "rule-room",
        horaInicio: "rule-start",
        horaFim: "rule-end",
        duracaoMinutos: "rule-duration",
        vigenteDe: "rule-validity",
        vigenteAte: "rule-valid-until",
      };
      focusAdminEditor(ids[Object.keys(fields)[0]]);
      return;
    }
    if (!confirmDeactivation(this.wasActive(), this.active())) return;
    this.notice.set(null);
    this.saving.set(true);
    const request = this.id()
      ? this.api.update<ScheduleRule>("regras-agenda", this.id()!, {
          ...payload,
          expectedVersion: this.version(),
        })
      : this.api.create<ScheduleRule>("regras-agenda", payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (rule) => {
        this.dirty.set(false);
        this.edit(rule, true);
        this.notice.set(
          savedConfiguration(
            "O cadastro foi atualizado. As referências anteriores foram preservadas.",
          ),
        );
        this.rules.reload();
      },
      error: (error) => this.notice.set(adminIssue(error)),
    });
  }
  protected day(day: number) {
    return ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][day];
  }
  protected reloadCurrent() {
    const id = this.id();
    if (!id || this.saving() || !confirmReload()) return;
    this.saving.set(true);
    this.api
      .read<ScheduleRule>(this.api.rule(id))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (value) => {
          this.edit(value, true);
          this.notice.set(null);
          this.rules.reload();
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
