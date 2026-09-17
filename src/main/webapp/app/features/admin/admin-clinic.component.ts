import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import { AdminIssue, Clinic } from "./admin.models";

@Component({
  selector: "app-admin-clinic",
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
  template: ` <section class="mx-auto max-w-3xl">
    <header class="mb-6">
      <p class="text-primary text-xs font-semibold tracking-widest uppercase">
        Configuração
      </p>
      <h1 class="text-3xl font-semibold tracking-tight">Clínica</h1>
      <p class="text-muted-foreground mt-1">
        Dados da única clínica no seu contexto autorizado.
      </p>
    </header>
    @if (clinic.error()) {
      <app-state-panel
        state="error"
        [title]="issue(clinic.error()).title"
        [description]="issue(clinic.error()).description"
      /><button
        hlmBtn
        variant="outline"
        class="mt-3 min-h-11"
        (click)="clinic.reload()"
      >
        Tentar novamente
      </button>
    } @else if (clinic.isLoading()) {
      <app-state-panel
        state="loading"
        title="Carregando clínica"
        description="Aguarde um momento."
      />
    } @else if (clinic.value(); as data) {
      <form hlmCard (submit)="$event.preventDefault(); save(data)">
        <div hlmCardHeader>
          <h2 hlmCardTitle>Dados da clínica</h2>
          <p hlmCardDescription>
            O fuso é aplicado pelo servidor nos horários de trabalho e
            bloqueios.
          </p>
        </div>
        <div hlmCardContent class="grid gap-5">
          <div hlmField>
            <label hlmFieldLabel for="clinic-name">Nome</label
            ><input
              hlmInput
              id="clinic-name"
              class="min-h-11"
              maxlength="200"
              [value]="name()"
              (input)="name.set($any($event.target).value)"
            />
            @if (fieldError("nome")) {
              <hlm-field-error>{{ fieldError("nome") }}</hlm-field-error>
            }
          </div>
          <div hlmField>
            <label hlmFieldLabel for="clinic-zone">Fuso horário IANA</label
            ><input
              hlmInput
              id="clinic-zone"
              class="min-h-11"
              maxlength="64"
              [value]="timeZone()"
              (input)="timeZone.set($any($event.target).value)"
            />
            <p hlmFieldDescription>
              Não converta horários no navegador; use o fuso configurado pela
              clínica.
            </p>
            @if (fieldError("timeZone")) {
              <hlm-field-error>{{ fieldError("timeZone") }}</hlm-field-error>
            }
          </div>
          <div hlmField>
            <label hlmFieldLabel for="clinic-active">Estado</label
            ><hlm-native-select
              selectId="clinic-active"
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
        <div hlmCardFooter class="justify-between">
          <p class="text-muted-foreground text-sm">Versão {{ data.version }}</p>
          <button
            hlmBtn
            type="submit"
            class="min-h-11"
            [disabled]="saving() || !dirty()"
          >
            @if (saving()) {
              <hlm-spinner />
            }
            Salvar alterações
          </button>
        </div>
      </form>
    }
    @if (notice(); as message) {
      <section
        hlmAlert
        class="mt-4"
        [variant]="message.conflict ? 'default' : 'destructive'"
      >
        <h2 hlmAlertTitle>{{ message.title }}</h2>
        <p hlmAlertDescription>{{ message.description }}</p>
      </section>
    }
  </section>`,
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
      return;
    }
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
          this.clinic.set(value);
          this.initialized.set(true);
        },
        error: (error) => this.notice.set(adminIssue(error)),
      });
  }
  protected issue(error: unknown) {
    return adminIssue(error);
  }
  protected fieldError(name: string) {
    return this.notice()?.fields[name];
  }
  canLeave() {
    return (
      !this.dirty() ||
      window.confirm("Há alterações não salvas na clínica. Sair sem salvar?")
    );
  }
}
