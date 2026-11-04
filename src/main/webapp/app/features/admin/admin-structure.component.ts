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
import { AdminIssue, Page, Room, Unit } from "./admin.models";

@Component({
  selector: "app-admin-structure",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminApi],
  imports: [
    AdminFeedbackComponent,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSpinnerImports,
    HlmNativeSelectImports,
    StatePanelComponent,
  ],
  templateUrl: "./admin-structure.component.html",
  styleUrl: "./admin-editors.scss",
})
export class AdminStructureComponent {
  private readonly api = inject(AdminApi);
  protected readonly units = httpResource<Page<Unit>>(() =>
    this.api.list("unidades"),
  );
  protected readonly rooms = httpResource<Page<Room>>(() =>
    this.api.list("consultorios"),
  );
  private readonly selected = signal<Unit | null>(null);
  protected readonly selectedId = computed(() => this.selected()?.id ?? null);
  protected readonly unitName = signal("");
  protected readonly address = signal("");
  protected readonly unitActive = signal(true);
  protected readonly roomEditing = signal<Room | null>(null);
  protected readonly roomName = signal("");
  protected readonly roomActive = signal(true);
  protected readonly notice = signal<AdminIssue | null>(null);
  protected readonly saving = signal(false);
  private readonly conflictTarget = signal<"unit" | "room">("unit");
  protected readonly unitDirty = computed(() => {
    const initial = this.selected();
    return (
      this.unitName() !== (initial?.nome ?? "") ||
      this.address() !== (initial?.endereco ?? "") ||
      this.unitActive() !== (initial?.ativo ?? true)
    );
  });
  protected readonly roomDirty = computed(() => {
    const initial = this.roomEditing();
    return (
      !!initial &&
      (this.roomName() !== initial.nome || this.roomActive() !== initial.ativo)
    );
  });
  protected readonly dirty = computed(
    () => this.unitDirty() || this.roomDirty(),
  );
  protected readonly roomsForUnit = computed(() =>
    this.rooms.hasValue()
      ? this.rooms
          .value()
          .items.filter((room) => room.unidadeId === this.selectedId())
      : [],
  );
  canLeave() {
    return !this.saving() && discardAdminChanges(this.dirty());
  }
  protected selectUnit(unit: Unit) {
    if (this.saving() || !discardAdminChanges(this.dirty())) return;
    this.applyUnit(unit);
    this.notice.set(null);
    focusAdminEditor("unit-name");
  }
  private applyUnit(unit: Unit | null) {
    this.selected.set(unit);
    this.unitName.set(unit?.nome ?? "");
    this.address.set(unit?.endereco ?? "");
    this.unitActive.set(unit?.ativo ?? true);
    this.roomEditing.set(null);
  }
  protected newUnit() {
    if (this.saving() || !discardAdminChanges(this.dirty())) return;
    this.applyUnit(null);
    this.notice.set(null);
    focusAdminEditor("unit-name");
  }
  protected saveUnit() {
    if (this.saving() || this.notice()?.code === "VERSAO_DESATUALIZADA") return;
    const fields: Record<string, string> = {};
    if (!this.unitName().trim()) fields["nome"] = "Informe o nome da unidade.";
    if (!this.address().trim())
      fields["endereco"] = "Informe o endereço da unidade.";
    if (Object.keys(fields).length) {
      this.conflictTarget.set("unit");
      this.notice.set(invalidConfiguration(fields));
      focusAdminEditor(fields["nome"] ? "unit-name" : "unit-address");
      return;
    }
    if (
      !confirmDeactivation(this.selected()?.ativo ?? false, this.unitActive())
    )
      return;
    this.saving.set(true);
    this.notice.set(null);
    const payload = {
      nome: this.unitName().trim(),
      endereco: this.address().trim(),
      ativo: this.unitActive(),
    };
    const request = this.selectedId()
      ? this.api.update<Unit>("unidades", this.selectedId()!, {
          ...payload,
          expectedVersion: this.selected()!.version,
        })
      : this.api.create<Unit>("unidades", payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (unit) => {
        this.selected.set(unit);
        this.unitName.set(unit.nome);
        this.address.set(unit.endereco);
        this.unitActive.set(unit.ativo);
        this.units.reload();
        this.notice.set(
          savedConfiguration("Os dados da unidade foram salvos."),
        );
      },
      error: (error) => {
        this.conflictTarget.set("unit");
        this.notice.set(adminIssue(error));
      },
    });
  }
  protected newRoom() {
    if (
      !this.selectedId() ||
      this.saving() ||
      !discardAdminChanges(this.roomDirty())
    )
      return;
    this.roomEditing.set({
      id: "",
      unidadeId: this.selectedId()!,
      nome: "",
      ativo: true,
      version: 0,
    });
    this.roomName.set("");
    this.roomActive.set(true);
    this.notice.set(null);
    focusAdminEditor("room-name");
  }
  protected editRoom(room: Room) {
    if (this.saving() || !discardAdminChanges(this.roomDirty())) return;
    this.applyRoom(room);
    this.notice.set(null);
    focusAdminEditor("room-name");
  }
  private applyRoom(room: Room) {
    this.roomEditing.set(room);
    this.roomName.set(room.nome);
    this.roomActive.set(room.ativo);
  }
  protected cancelRoom() {
    if (this.saving() || !discardAdminChanges(this.roomDirty())) return;
    this.roomEditing.set(null);
    this.notice.set(null);
  }
  protected saveRoom() {
    const room = this.roomEditing();
    if (
      !room ||
      this.saving() ||
      this.notice()?.code === "VERSAO_DESATUALIZADA"
    )
      return;
    if (!this.roomName().trim()) {
      this.conflictTarget.set("room");
      this.notice.set(
        invalidConfiguration({ nome: "Informe o nome do consultório." }),
      );
      focusAdminEditor("room-name");
      return;
    }
    if (!confirmDeactivation(room.ativo, this.roomActive())) return;
    const payload = {
      unidadeId: this.selectedId(),
      nome: this.roomName().trim(),
      ativo: this.roomActive(),
    };
    this.saving.set(true);
    this.notice.set(null);
    const request = room.id
      ? this.api.update<Room>("consultorios", room.id, {
          ...payload,
          expectedVersion: room.version,
        })
      : this.api.create<Room>("consultorios", payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (value) => {
        this.rooms.reload();
        this.applyRoom(value);
        this.notice.set(
          savedConfiguration("Os dados do consultório foram salvos."),
        );
      },
      error: (error) => {
        this.conflictTarget.set("room");
        this.notice.set(adminIssue(error));
      },
    });
  }
  protected reloadCurrent() {
    if (this.saving() || !confirmReload()) return;
    const roomId = this.roomEditing()?.id;
    if (this.conflictTarget() === "room" && roomId) {
      this.saving.set(true);
      this.api
        .read<Room>(this.api.room(roomId))
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: (value) => {
            this.applyRoom(value);
            this.rooms.reload();
            this.notice.set(null);
          },
          error: (error) => this.notice.set(failedAdminReload(error)),
        });
    } else if (this.selectedId()) {
      this.saving.set(true);
      this.api
        .read<Unit>(this.api.unit(this.selectedId()!))
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: (value) => {
            this.selected.set(value);
            this.unitName.set(value.nome);
            this.address.set(value.endereco);
            this.unitActive.set(value.ativo);
            this.units.reload();
            this.notice.set(null);
          },
          error: (error) => this.notice.set(failedAdminReload(error)),
        });
    }
  }
  protected clearSaved() {
    if (this.notice()?.code === "SAVED") this.notice.set(null);
  }
  protected issue(error: unknown) {
    return adminIssue(error);
  }
  protected field(name: string, target: "unit" | "room" = "unit") {
    return this.conflictTarget() === target
      ? this.notice()?.fields[name]
      : undefined;
  }
}
