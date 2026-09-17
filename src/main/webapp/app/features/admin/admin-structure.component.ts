import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmInputImports } from "@spartan-ng/helm/input";
import { HlmNativeSelectImports } from "@spartan-ng/helm/native-select";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { AdminApi, adminIssue } from "./admin.api";
import { AdminIssue, Page, Room, Unit } from "./admin.models";

@Component({
  selector: "app-admin-structure",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminApi],
  imports: [
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmSpinnerImports,
    StatePanelComponent,
  ],
  template: ` <section class="space-y-6">
    <header>
      <p class="text-primary text-xs font-semibold tracking-widest uppercase">
        Estrutura
      </p>
      <h1 class="text-3xl font-semibold tracking-tight">
        Unidades e consultórios
      </h1>
      <p class="text-muted-foreground mt-1">
        A clínica é única; cada consultório pertence a uma unidade.
      </p>
    </header>
    @if (notice(); as message) {
      <section
        hlmAlert
        [variant]="message.conflict ? 'default' : 'destructive'"
      >
        <h2 hlmAlertTitle>{{ message.title }}</h2>
        <p hlmAlertDescription>{{ message.description }}</p>
      </section>
    }
    <div class="grid items-start gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <section hlmCard>
        <div hlmCardHeader class="flex-row items-center justify-between">
          <div>
            <h2 hlmCardTitle>Unidades</h2>
            <p hlmCardDescription>Selecione para editar.</p>
          </div>
          <button hlmBtn type="button" class="min-h-11" (click)="newUnit()">
            Nova unidade
          </button>
        </div>
        <div hlmCardContent>
          @if (units.error()) {
            <app-state-panel
              state="error"
              [title]="issue(units.error()).title"
              [description]="issue(units.error()).description"
            />
          } @else if (units.isLoading()) {
            <app-state-panel
              state="loading"
              title="Carregando unidades"
              description="Aguarde um momento."
            />
          } @else {
            <div class="flex flex-col gap-2">
              @for (unit of units.value()?.items ?? []; track unit.id) {
                <button
                  type="button"
                  class="bg-muted min-h-16 rounded-md p-3 text-left"
                  [class.bg-accent]="selectedId() === unit.id"
                  (click)="selectUnit(unit)"
                >
                  <span class="block font-medium">{{ unit.nome }}</span
                  ><span class="text-muted-foreground text-xs">{{
                    unit.ativo ? "Ativa" : "Inativa"
                  }}</span>
                </button>
              } @empty {
                <app-state-panel
                  state="empty"
                  title="Nenhuma unidade"
                  description="Cadastre a primeira unidade da clínica."
                />
              }
            </div>
          }
        </div>
      </section>
      <section hlmCard>
        <div hlmCardHeader>
          <h2 hlmCardTitle>
            {{ selectedId() ? "Detalhe da unidade" : "Nova unidade" }}
          </h2>
          <p hlmCardDescription>
            Alterar ou desativar preserva as referências históricas.
          </p>
        </div>
        <form
          hlmCardContent
          class="grid gap-5"
          (submit)="$event.preventDefault(); saveUnit()"
        >
          <div hlmField>
            <label hlmFieldLabel for="unit-name">Nome</label
            ><input
              hlmInput
              id="unit-name"
              class="min-h-11"
              maxlength="200"
              [value]="unitName()"
              (input)="unitName.set($any($event.target).value); markDirty()"
            />
            @if (field("nome")) {
              <hlm-field-error>{{ field("nome") }}</hlm-field-error>
            }
          </div>
          <div hlmField>
            <label hlmFieldLabel for="unit-address">Endereço</label
            ><input
              hlmInput
              id="unit-address"
              class="min-h-11"
              maxlength="500"
              [value]="address()"
              (input)="address.set($any($event.target).value); markDirty()"
            />
            @if (field("endereco")) {
              <hlm-field-error>{{ field("endereco") }}</hlm-field-error>
            }
          </div>
          <div hlmField>
            <label hlmFieldLabel for="unit-active">Estado</label
            ><hlm-native-select
              selectId="unit-active"
              class="min-h-11"
              [value]="unitActive() ? 'true' : 'false'"
              (valueChange)="unitActive.set($event === 'true'); markDirty()"
              ><option hlmNativeSelectOption value="true">Ativa</option>
              <option hlmNativeSelectOption value="false">
                Inativa
              </option></hlm-native-select
            >
          </div>
          <div class="flex justify-end">
            <button hlmBtn type="submit" class="min-h-11" [disabled]="saving()">
              @if (saving()) {
                <hlm-spinner />
              }
              Salvar unidade
            </button>
          </div>
        </form>
        @if (selectedId()) {
          <div hlmCardContent class="border-border border-t">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="font-semibold">Consultórios</h3>
              <button
                hlmBtn
                variant="outline"
                class="min-h-11"
                (click)="newRoom()"
              >
                Novo consultório
              </button>
            </div>
            <div class="flex flex-col gap-2">
              @for (room of roomsForUnit(); track room.id) {
                <button
                  type="button"
                  class="bg-muted flex min-h-11 items-center justify-between rounded-md px-3 text-left"
                  (click)="editRoom(room)"
                >
                  <span>{{ room.nome }}</span
                  ><span class="text-muted-foreground text-xs">{{
                    room.ativo ? "ativo" : "inativo"
                  }}</span>
                </button>
              } @empty {
                <p class="text-muted-foreground text-sm">
                  Ainda não há consultórios nesta unidade.
                </p>
              }
            </div>
            @if (roomEditing()) {
              <form
                class="mt-4 grid gap-3"
                (submit)="$event.preventDefault(); saveRoom()"
              >
                <div hlmField>
                  <label hlmFieldLabel for="room-name"
                    >Nome do consultório</label
                  ><input
                    hlmInput
                    id="room-name"
                    class="min-h-11"
                    [value]="roomName()"
                    (input)="
                      roomName.set($any($event.target).value); markDirty()
                    "
                  />
                </div>
                <button hlmBtn type="submit" class="min-h-11">
                  Salvar consultório
                </button>
              </form>
            }
          </div>
        }
      </section>
    </div>
  </section>`,
})
export class AdminStructureComponent {
  private readonly api = inject(AdminApi);
  protected readonly units = httpResource<Page<Unit>>(() =>
    this.api.list("unidades"),
  );
  protected readonly rooms = httpResource<Page<Room>>(() =>
    this.api.list("consultorios"),
  );
  protected readonly selectedId = signal<string | null>(null);
  protected readonly unitVersion = signal<number | null>(null);
  protected readonly unitName = signal("");
  protected readonly address = signal("");
  protected readonly unitActive = signal(true);
  protected readonly roomEditing = signal<Room | null>(null);
  protected readonly roomName = signal("");
  protected readonly notice = signal<AdminIssue | null>(null);
  protected readonly dirty = signal(false);
  protected markDirty() {
    this.dirty.set(true);
  }
  canLeave() {
    return (
      !this.dirty() ||
      window.confirm("Há alterações não salvas. Sair sem salvar?")
    );
  }
  protected readonly saving = signal(false);
  protected readonly roomsForUnit = computed(
    () =>
      this.rooms
        .value()
        ?.items.filter((room) => room.unidadeId === this.selectedId()) ?? [],
  );
  protected selectUnit(unit: Unit) {
    this.selectedId.set(unit.id);
    this.unitVersion.set(unit.version);
    this.unitName.set(unit.nome);
    this.address.set(unit.endereco);
    this.unitActive.set(unit.ativo);
    this.roomEditing.set(null);
  }
  protected newUnit() {
    this.dirty.set(false);
    this.selectedId.set(null);
    this.unitVersion.set(null);
    this.unitName.set("");
    this.address.set("");
    this.unitActive.set(true);
    this.roomEditing.set(null);
  }
  protected saveUnit() {
    if (!this.unitName().trim() || !this.address().trim()) {
      this.notice.set({
        code: "INVALID",
        title: "Revise os campos obrigatórios",
        description: "Informe nome e endereço da unidade.",
        conflict: false,
        fields: {
          nome: !this.unitName().trim() ? "Informe o nome." : "",
          endereco: !this.address().trim() ? "Informe o endereço." : "",
        },
      });
      return;
    }
    this.saving.set(true);
    const payload = {
      nome: this.unitName().trim(),
      endereco: this.address().trim(),
      ativo: this.unitActive(),
    };
    const request = this.selectedId()
      ? this.api.update<Unit>("unidades", this.selectedId()!, {
          ...payload,
          expectedVersion: this.unitVersion(),
        })
      : this.api.create<Unit>("unidades", payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (unit) => {
        this.dirty.set(false);
        this.selectUnit(unit);
        this.units.reload();
      },
      error: (error) => this.notice.set(adminIssue(error)),
    });
  }
  protected newRoom() {
    this.dirty.set(false);
    this.roomEditing.set({
      id: "",
      unidadeId: this.selectedId()!,
      nome: "",
      ativo: true,
      version: 0,
    });
    this.roomName.set("");
  }
  protected editRoom(room: Room) {
    this.dirty.set(false);
    this.roomEditing.set(room);
    this.roomName.set(room.nome);
  }
  protected saveRoom() {
    const room = this.roomEditing();
    if (!room || !this.roomName().trim()) return;
    const payload = {
      unidadeId: this.selectedId(),
      nome: this.roomName().trim(),
      ativo: room.ativo,
    };
    const request = room.id
      ? this.api.update<Room>("consultorios", room.id, {
          ...payload,
          expectedVersion: room.version,
        })
      : this.api.create<Room>("consultorios", payload);
    request.subscribe({
      next: () => {
        this.dirty.set(false);
        this.rooms.reload();
        this.roomEditing.set(null);
      },
      error: (error) => this.notice.set(adminIssue(error)),
    });
  }
  protected issue(error: unknown) {
    return adminIssue(error);
  }
  protected field(name: string) {
    return this.notice()?.fields[name];
  }
}
