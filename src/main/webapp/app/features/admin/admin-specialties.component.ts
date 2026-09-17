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
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { AdminApi, adminIssue } from "./admin.api";
import { AdminIssue, Page, Specialty } from "./admin.models";
@Component({
  selector: "app-admin-specialties",
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
  template: `<section class="space-y-6">
    <header>
      <p class="text-primary text-xs font-semibold tracking-widest uppercase">
        Profissionais
      </p>
      <h1 class="text-3xl font-semibold tracking-tight">Especialidades</h1>
      <p class="text-muted-foreground mt-1">
        Dados administrativos que podem ser associados a profissionais.
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
    <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section hlmCard>
        <div hlmCardHeader class="flex-row items-center justify-between">
          <div>
            <h2 hlmCardTitle>Especialidades existentes</h2>
            <p hlmCardDescription>Inclui registros inativos.</p>
          </div>
          <button hlmBtn type="button" class="min-h-11" (click)="newValue()">
            Nova especialidade
          </button>
        </div>
        <div hlmCardContent>
          @if (values.error()) {
            <app-state-panel
              state="error"
              [title]="issue(values.error()).title"
              [description]="issue(values.error()).description"
            />
          } @else if (values.isLoading()) {
            <app-state-panel
              state="loading"
              title="Carregando especialidades"
              description="Aguarde um momento."
            />
          } @else {
            <div class="grid gap-2 sm:grid-cols-2">
              @for (value of values.value()?.items ?? []; track value.id) {
                <button
                  type="button"
                  class="bg-muted min-h-16 rounded-md p-3 text-left"
                  (click)="edit(value)"
                >
                  <span class="block font-medium">{{ value.nome }}</span
                  ><span class="text-muted-foreground text-xs">{{
                    value.ativo ? "ativa" : "inativa"
                  }}</span>
                </button>
              } @empty {
                <app-state-panel
                  state="empty"
                  title="Nenhuma especialidade"
                  description="Cadastre uma especialidade para associar profissionais."
                />
              }
            </div>
          }
        </div>
      </section>
      <form hlmCard (submit)="$event.preventDefault(); save()">
        <div hlmCardHeader>
          <h2 hlmCardTitle>
            {{ id() ? "Editar especialidade" : "Nova especialidade" }}
          </h2>
          <p hlmCardDescription>Desativar preserva referências anteriores.</p>
        </div>
        <div hlmCardContent class="grid gap-5">
          <div hlmField>
            <label hlmFieldLabel for="specialty-name">Nome</label
            ><input
              hlmInput
              id="specialty-name"
              class="min-h-11"
              maxlength="200"
              [value]="name()"
              (input)="name.set($any($event.target).value)"
            />
            @if (notice()?.fields?.["nome"]) {
              <hlm-field-error>{{
                notice()?.fields?.["nome"]
              }}</hlm-field-error>
            }
          </div>
          <div hlmField>
            <label hlmFieldLabel for="specialty-active">Estado</label
            ><hlm-native-select
              selectId="specialty-active"
              class="min-h-11"
              [value]="active() ? 'true' : 'false'"
              (valueChange)="active.set($event === 'true')"
              ><option hlmNativeSelectOption value="true">Ativa</option>
              <option hlmNativeSelectOption value="false">
                Inativa
              </option></hlm-native-select
            >
          </div>
        </div>
        <div hlmCardFooter class="justify-end">
          <button hlmBtn type="submit" class="min-h-11" [disabled]="saving()">
            @if (saving()) {
              <hlm-spinner />
            }
            Salvar
          </button>
        </div>
      </form>
    </div>
  </section>`,
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
  protected newValue() {
    this.id.set(null);
    this.version.set(null);
    this.name.set("");
    this.active.set(true);
    this.notice.set(null);
  }
  protected edit(value: Specialty) {
    this.id.set(value.id);
    this.version.set(value.version);
    this.name.set(value.nome);
    this.active.set(value.ativo);
    this.notice.set(null);
  }
  protected save() {
    if (!this.name().trim()) {
      this.notice.set({
        code: "INVALID",
        title: "Informe o nome",
        description: "O nome da especialidade é obrigatório.",
        conflict: false,
        fields: { nome: "Informe o nome da especialidade." },
      });
      return;
    }
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
        this.edit(value);
        this.values.reload();
      },
      error: (error) => this.notice.set(adminIssue(error)),
    });
  }
  protected issue(error: unknown) {
    return adminIssue(error);
  }
}
