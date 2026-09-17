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
import { AdminIssue, Page, Professional, Specialty } from "./admin.models";
@Component({
  selector: "app-admin-professionals",
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
      <h1 class="text-3xl font-semibold tracking-tight">
        Profissionais da clínica
      </h1>
      <p class="text-muted-foreground mt-1">
        O vínculo de identidade é provisionado e não é editável nesta tela.
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
          <h2 hlmCardTitle>Médicos</h2>
          <button hlmBtn class="min-h-11" type="button" (click)="newValue()">
            Novo médico
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
              title="Carregando profissionais"
              description="Aguarde um momento."
            />
          } @else {
            <div class="flex flex-col gap-2">
              @for (value of values.value()?.items ?? []; track value.id) {
                <button
                  type="button"
                  class="bg-muted min-h-16 rounded-md p-3 text-left"
                  (click)="edit(value)"
                >
                  <span class="block font-medium">{{ value.nome }}</span
                  ><span class="text-muted-foreground text-xs"
                    >CRM {{ value.crmNumero }}-{{ value.crmUf }} ·
                    {{ value.ativo ? "ativo" : "inativo" }}</span
                  >
                </button>
              } @empty {
                <app-state-panel
                  state="empty"
                  title="Nenhum profissional"
                  description="Cadastre um profissional com CRM e especialidade."
                />
              }
            </div>
          }
        </div>
      </section>
      <form hlmCard (submit)="$event.preventDefault(); save()">
        <div hlmCardHeader>
          <h2 hlmCardTitle>
            {{ id() ? "Editar profissional" : "Novo profissional" }}
          </h2>
          <p hlmCardDescription>
            Este formulário não cria contas, não atribui roles e não troca
            subject.
          </p>
        </div>
        <div hlmCardContent class="grid gap-5 md:grid-cols-2">
          <div hlmField class="md:col-span-2">
            <label hlmFieldLabel for="doctor-name">Nome</label
            ><input
              hlmInput
              id="doctor-name"
              class="min-h-11"
              [value]="name()"
              (input)="name.set($any($event.target).value); markDirty()"
            />
          </div>
          <div hlmField>
            <label hlmFieldLabel for="crm-number">CRM</label
            ><input
              hlmInput
              id="crm-number"
              class="min-h-11"
              maxlength="30"
              [value]="crmNumber()"
              (input)="crmNumber.set($any($event.target).value); markDirty()"
            />
          </div>
          <div hlmField>
            <label hlmFieldLabel for="crm-uf">UF</label
            ><input
              hlmInput
              id="crm-uf"
              class="min-h-11"
              maxlength="2"
              [value]="crmUf()"
              (input)="
                crmUf.set($any($event.target).value.toUpperCase()); markDirty()
              "
            />
          </div>
          <div hlmField class="md:col-span-2">
            <label hlmFieldLabel for="doctor-specialties">Especialidades</label
            ><select
              hlmNativeSelect
              id="doctor-specialties"
              multiple
              class="min-h-28"
              (change)="specialties.set(selected($event)); markDirty()"
            >
              @for (item of catalog.value()?.items ?? []; track item.id) {
                <option
                  [value]="item.id"
                  [selected]="specialties().includes(item.id)"
                >
                  {{ item.nome }}
                </option>
              }
            </select>
            <p hlmFieldDescription>Selecione ao menos uma especialidade.</p>
          </div>
          <div hlmField class="md:col-span-2">
            <label hlmFieldLabel for="doctor-active">Estado</label
            ><hlm-native-select
              selectId="doctor-active"
              class="min-h-11"
              [value]="active() ? 'true' : 'false'"
              (valueChange)="active.set($event === 'true'); markDirty()"
              ><option hlmNativeSelectOption value="true">Ativo</option>
              <option hlmNativeSelectOption value="false">
                Inativo
              </option></hlm-native-select
            >
          </div>
        </div>
        <div hlmCardFooter class="justify-end">
          <button hlmBtn type="submit" class="min-h-11" [disabled]="saving()">
            @if (saving()) {
              <hlm-spinner />
            }
            Salvar alterações
          </button>
        </div>
      </form>
    </div>
  </section>`,
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
  protected newValue() {
    this.dirty.set(false);
    this.id.set(null);
    this.version.set(null);
    this.name.set("");
    this.crmNumber.set("");
    this.crmUf.set("");
    this.specialties.set([]);
    this.active.set(true);
  }
  protected edit(value: Professional) {
    this.dirty.set(false);
    this.id.set(value.id);
    this.version.set(value.version);
    this.name.set(value.nome);
    this.crmNumber.set(value.crmNumero);
    this.crmUf.set(value.crmUf);
    this.specialties.set([...value.especialidadeIds]);
    this.active.set(value.ativo);
  }
  protected selected(event: Event) {
    return Array.from((event.target as HTMLSelectElement).selectedOptions).map(
      (option: HTMLOptionElement) => option.value,
    );
  }
  protected save() {
    if (
      !this.name().trim() ||
      !this.crmNumber().trim() ||
      this.crmUf().length !== 2 ||
      !this.specialties().length
    ) {
      this.notice.set({
        code: "INVALID",
        title: "Revise os dados do profissional",
        description:
          "Nome, CRM, UF e ao menos uma especialidade são obrigatórios.",
        conflict: false,
        fields: {},
      });
      return;
    }
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
