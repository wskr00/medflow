import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmInputImports } from "@spartan-ng/helm/input";
import { HlmNativeSelectImports } from "@spartan-ng/helm/native-select";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { AdminApi, adminIssue } from "./admin.api";
import { AdminIssue, Page, Professional, ScheduleBlock } from "./admin.models";
@Component({
  selector: "app-admin-blocks",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminApi],
  imports: [
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    StatePanelComponent,
  ],
  template: `<section class="space-y-6">
    <header>
      <p class="text-primary text-xs font-semibold tracking-widest uppercase">
        Bloqueios
      </p>
      <h1 class="text-3xl font-semibold tracking-tight">
        Indisponibilidade de profissional
      </h1>
      <p class="text-muted-foreground mt-1">
        Bloqueios são absolutos e o servidor revalida reservas afetadas.
      </p>
    </header>
    @if (notice(); as message) {
      <section
        hlmAlert
        [variant]="message.conflict ? 'default' : 'destructive'"
      >
        <h2 hlmAlertTitle>{{ message.title }}</h2>
        <p hlmAlertDescription>{{ message.description }}</p>
        <button
          hlmBtn
          variant="outline"
          type="button"
          class="mt-3 min-h-11"
          (click)="blocks.reload()"
        >
          Recarregar bloqueios
        </button>
      </section>
    }
    <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
      <section hlmCard>
        <div hlmCardHeader class="flex-row justify-between">
          <div>
            <h2 hlmCardTitle>Bloqueios cadastrados</h2>
            <p hlmCardDescription>
              Todos os horários são exibidos no fuso da clínica.
            </p>
          </div>
          <button hlmBtn type="button" class="min-h-11" (click)="newBlock()">
            Novo bloqueio
          </button>
        </div>
        <div hlmCardContent>
          @if (blocks.error()) {
            <app-state-panel
              state="error"
              [title]="issue(blocks.error()).title"
              [description]="issue(blocks.error()).description"
            />
          } @else if (blocks.isLoading()) {
            <app-state-panel
              state="loading"
              title="Carregando bloqueios"
              description="Aguarde um momento."
            />
          } @else {
            <div class="flex flex-col gap-2">
              @for (block of blocks.value()?.items ?? []; track block.id) {
                <button
                  type="button"
                  class="bg-muted hover:bg-accent focus-visible:ring-ring/50 min-h-16 rounded-md p-3 text-left outline-none transition-colors focus-visible:ring-3"
                  (click)="edit(block)"
                >
                  <span class="block font-medium">{{ block.medico.nome }}</span
                  ><span class="text-muted-foreground text-xs"
                    >{{ dateTime(block.inicio) }}–{{ dateTime(block.fim) }} ·
                    {{ block.ativo ? "ativo" : "inativo" }}</span
                  >
                </button>
              } @empty {
                <app-state-panel
                  state="empty"
                  title="Nenhum bloqueio"
                  description="Cadastre uma indisponibilidade quando necessário."
                />
              }
            </div>
          }
        </div>
      </section>
      <form hlmCard (submit)="$event.preventDefault(); save()">
        <div hlmCardHeader>
          <h2 hlmCardTitle>{{ id() ? "Editar bloqueio" : "Novo bloqueio" }}</h2>
          <p hlmCardDescription>
            Preencha horário local; o servidor resolve no fuso da clínica.
          </p>
        </div>
        <div hlmCardContent class="grid gap-5">
          <div hlmField>
            <label hlmFieldLabel for="block-doctor">Profissional</label
            ><hlm-native-select
              selectId="block-doctor"
              class="min-h-11"
              [value]="doctorId()"
              (valueChange)="doctorId.set($event ?? ''); markDirty()"
              ><option hlmNativeSelectOption value="">Selecione</option>
              @for (item of doctors.value()?.items ?? []; track item.id) {
                <option hlmNativeSelectOption [value]="item.id">
                  {{ item.nome }}
                </option>
              }
            </hlm-native-select>
          </div>
          <div hlmField>
            <label hlmFieldLabel for="block-start">Início</label
            ><input
              hlmInput
              id="block-start"
              type="datetime-local"
              class="min-h-11"
              [value]="start()"
              (input)="start.set($any($event.target).value); markDirty()"
            />
          </div>
          <div hlmField>
            <label hlmFieldLabel for="block-end">Fim</label
            ><input
              hlmInput
              id="block-end"
              type="datetime-local"
              class="min-h-11"
              [value]="end()"
              (input)="end.set($any($event.target).value); markDirty()"
            />
          </div>
        </div>
        <div hlmCardFooter class="justify-end">
          <button hlmBtn type="submit" class="min-h-11">Salvar bloqueio</button>
        </div>
      </form>
    </div>
  </section>`,
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
  protected newBlock() {
    this.dirty.set(false);
    this.id.set(null);
    this.version.set(null);
    this.doctorId.set("");
    this.start.set("");
    this.end.set("");
  }
  protected edit(block: ScheduleBlock) {
    this.dirty.set(false);
    this.id.set(block.id);
    this.version.set(block.version);
    this.doctorId.set(block.medico.id);
    this.start.set(block.inicio.slice(0, 16));
    this.end.set(block.fim.slice(0, 16));
  }
  protected save() {
    if (!this.doctorId() || !this.start() || !this.end()) {
      this.notice.set({
        code: "INVALID",
        title: "Revise o bloqueio",
        description: "Profissional, início e fim são obrigatórios.",
        conflict: false,
        fields: {},
      });
      return;
    }
    const payload = {
      medicoId: this.doctorId(),
      inicio: this.start(),
      fim: this.end(),
      ativo: true,
    };
    const request = this.id()
      ? this.api.update<ScheduleBlock>("bloqueios-agenda", this.id()!, {
          ...payload,
          expectedVersion: this.version(),
        })
      : this.api.create<ScheduleBlock>("bloqueios-agenda", payload);
    request.subscribe({
      next: (block) => {
        this.dirty.set(false);
        this.edit(block);
        this.blocks.reload();
      },
      error: (error) => this.notice.set(adminIssue(error)),
    });
  }
  protected dateTime(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }
  protected issue(error: unknown) {
    return adminIssue(error);
  }
}
