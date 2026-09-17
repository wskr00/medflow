import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmDialog, HlmDialogImports } from "@spartan-ng/helm/dialog";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmSheetImports } from "@spartan-ng/helm/sheet";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { HlmTextareaImports } from "@spartan-ng/helm/textarea";
import { finalize } from "rxjs";
import { IdentityService } from "../../auth/identity.service";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { DoctorApi, doctorIssue } from "./doctor.api";
import {
  ClinicalRecord,
  DoctorIssue,
  DoctorWorkspace,
  Page,
} from "./doctor.models";

const emptyRecord: ClinicalRecord = {
  queixaPrincipal: "",
  resumoAnamnese: "",
  conduta: "",
  observacoes: "",
};
const recordKey = (record: ClinicalRecord) => JSON.stringify(record);

@Component({
  selector: "app-doctor-care",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DoctorApi],
  imports: [
    RouterLink,
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmSheetImports,
    HlmSpinnerImports,
    HlmTextareaImports,
    StatePanelComponent,
  ],
  template: `
    @if (workspace.isLoading()) {
      <app-state-panel
        state="loading"
        title="Carregando atendimento"
        description="Recuperando o contexto do atendimento."
      />
    } @else if (workspace.error()) {
      <section class="space-y-4">
        <app-state-panel
          state="error"
          [title]="issue(workspace.error()).title"
          [description]="issue(workspace.error()).description"
        /><a
          hlmBtn
          variant="outline"
          routerLink="/workspace/doctor/triagem"
          class="min-h-11"
          >Voltar para a agenda</a
        >
      </section>
    } @else if (workspace.value(); as data) {
      <section class="mx-auto max-w-5xl space-y-6">
        <a
          routerLink="/workspace/doctor/triagem"
          class="text-primary inline-flex min-h-11 items-center text-sm font-medium"
          >← Voltar para minha agenda</a
        >
        <header class="border-border bg-card rounded-xl border p-5 sm:p-6">
          <div
            class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div class="space-y-1">
              <p
                class="text-primary text-xs font-semibold tracking-widest uppercase"
              >
                Atendimento em curso
              </p>
              <h1 class="text-3xl font-semibold tracking-tight">
                {{ data.agendamento.paciente.nome }}
              </h1>
              <p class="text-muted-foreground">
                {{ data.agendamento.especialidade.nome }} ·
                {{ data.agendamento.medico.nome }}
              </p>
            </div>
            <p class="text-muted-foreground text-sm">
              {{ dateTime(data.agendamento.inicio) }}<br />{{
                data.agendamento.unidade.nome
              }}
              · {{ data.agendamento.consultorio.nome }}
            </p>
          </div>
        </header>
        @if (notice(); as message) {
          <section
            hlmAlert
            [variant]="message.conflict ? 'default' : 'destructive'"
            aria-live="polite"
          >
            <h2 hlmAlertTitle>{{ message.title }}</h2>
            <p hlmAlertDescription>{{ message.description }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              @if (message.conflict) {
                <button
                  hlmBtn
                  variant="outline"
                  type="button"
                  class="min-h-11"
                  (click)="reloadForComparison()"
                >
                  Recarregar para comparar
                </button>
              }
              <button
                hlmBtn
                variant="ghost"
                type="button"
                class="min-h-11"
                (click)="notice.set(null)"
              >
                Dispensar
              </button>
            </div>
          </section>
        }
        @if (data.atendimento.finalizadoEm) {
          <section aria-labelledby="completed-title" class="space-y-4">
            <div hlmAlert>
              <h2 hlmAlertTitle>Atendimento finalizado</h2>
              <p hlmAlertDescription>
                Registro concluído em
                {{ dateTime(data.atendimento.finalizadoEm) }}. Esta versão é
                somente leitura.
              </p>
            </div>
            <article hlmCard>
              <div hlmCardHeader>
                <h2 id="completed-title" hlmCardTitle>Registro clínico</h2>
              </div>
              <dl hlmCardContent class="grid gap-5 sm:grid-cols-2">
                <div>
                  <dt class="text-muted-foreground text-sm">
                    Queixa principal
                  </dt>
                  <dd class="mt-1 whitespace-pre-wrap">
                    {{ data.atendimento.registroClinico.queixaPrincipal }}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-foreground text-sm">
                    Resumo da anamnese
                  </dt>
                  <dd class="mt-1 whitespace-pre-wrap">
                    {{ data.atendimento.registroClinico.resumoAnamnese }}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-foreground text-sm">Conduta</dt>
                  <dd class="mt-1 whitespace-pre-wrap">
                    {{ data.atendimento.registroClinico.conduta }}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-foreground text-sm">Observações</dt>
                  <dd class="mt-1 whitespace-pre-wrap">
                    {{
                      data.atendimento.registroClinico.observacoes ||
                        "Não informado"
                    }}
                  </dd>
                </div>
              </dl>
            </article>
          </section>
        } @else {
          <form
            class="space-y-5"
            (submit)="$event.preventDefault(); save(data)"
          >
            <section aria-labelledby="record-title" class="space-y-1">
              <h2 id="record-title" class="text-xl font-semibold">
                Registro clínico
              </h2>
              <p class="text-muted-foreground text-sm">
                Salve o rascunho quando quiser. Os três primeiros campos são
                necessários somente para finalizar.
              </p>
            </section>
            <div hlmField>
              <label hlmFieldLabel for="complaint">Queixa principal</label
              ><textarea
                hlmTextarea
                id="complaint"
                class="min-h-28"
                maxlength="2000"
                [value]="draft().queixaPrincipal"
                (input)="setField('queixaPrincipal', $any($event.target).value)"
              ></textarea>
              <p hlmFieldDescription>Obrigatória para finalizar.</p>
            </div>
            <div hlmField>
              <label hlmFieldLabel for="history">Resumo da anamnese</label
              ><textarea
                hlmTextarea
                id="history"
                class="min-h-36"
                maxlength="10000"
                [value]="draft().resumoAnamnese"
                (input)="setField('resumoAnamnese', $any($event.target).value)"
              ></textarea>
              <p hlmFieldDescription>Obrigatório para finalizar.</p>
            </div>
            <div hlmField>
              <label hlmFieldLabel for="plan">Conduta</label
              ><textarea
                hlmTextarea
                id="plan"
                class="min-h-36"
                maxlength="10000"
                [value]="draft().conduta"
                (input)="setField('conduta', $any($event.target).value)"
              ></textarea>
              <p hlmFieldDescription>Obrigatória para finalizar.</p>
            </div>
            <div hlmField>
              <label hlmFieldLabel for="notes">Observações</label
              ><textarea
                hlmTextarea
                id="notes"
                class="min-h-28"
                maxlength="5000"
                [value]="draft().observacoes"
                (input)="setField('observacoes', $any($event.target).value)"
              ></textarea>
              <p hlmFieldDescription>Opcional.</p>
            </div>
            <div
              class="border-border flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <p class="text-muted-foreground text-sm">
                @if (dirty()) {
                  Alterações não salvas nesta tela.
                } @else {
                  Rascunho salvo · versão clínica
                  {{ data.atendimento.version }}.
                }
              </p>
              <div class="flex flex-col gap-2 sm:flex-row">
                <hlm-sheet side="right"
                  ><button
                    hlmSheetTrigger
                    hlmBtn
                    variant="outline"
                    type="button"
                    class="min-h-11"
                    (click)="loadHistory()"
                  >
                    Histórico do paciente</button
                  ><hlm-sheet-content *hlmSheetPortal
                    ><hlm-sheet-header
                      ><h2 hlmSheetTitle>Histórico de atendimentos</h2>
                      <p hlmSheetDescription>
                        Somente atendimentos finalizados deste paciente.
                      </p></hlm-sheet-header
                    >
                    @if (history.isLoading()) {
                      <app-state-panel
                        state="loading"
                        title="Carregando histórico"
                        description="Aguarde um momento."
                      />
                    } @else if (history.error()) {
                      <app-state-panel
                        state="error"
                        [title]="issue(history.error()).title"
                        [description]="issue(history.error()).description"
                      />
                    } @else if (!history.value()?.items?.length) {
                      <app-state-panel
                        state="empty"
                        title="Sem histórico disponível"
                        description="Não há atendimentos finalizados para exibir."
                      />
                    } @else {
                      <ol class="space-y-3">
                        @for (
                          item of history.value()?.items ?? [];
                          track item.atendimento.id
                        ) {
                          <li
                            class="border-border rounded-lg border p-3 text-sm"
                          >
                            <p class="font-medium">
                              {{ dateTime(item.agendamento.inicio) }}
                            </p>
                            <p
                              class="text-muted-foreground mt-1 whitespace-pre-wrap"
                            >
                              {{
                                item.atendimento.registroClinico.queixaPrincipal
                              }}
                            </p>
                          </li>
                        }
                      </ol>
                    }
                  </hlm-sheet-content></hlm-sheet
                ><button
                  hlmBtn
                  variant="outline"
                  type="submit"
                  class="min-h-11"
                  [disabled]="saving() || !dirty()"
                >
                  @if (saving()) {
                    <hlm-spinner />
                  }
                  Salvar rascunho</button
                ><hlm-dialog #finishDialog="hlmDialog"
                  ><button
                    hlmBtn
                    hlmDialogTrigger
                    type="button"
                    class="min-h-11"
                    [disabled]="saving() || dirty() || !complete()"
                  >
                    Finalizar atendimento</button
                  ><hlm-dialog-content *hlmDialogPortal
                    ><hlm-dialog-header
                      ><h2 hlmDialogTitle>Finalizar atendimento?</h2>
                      <p hlmDialogDescription>
                        A consulta só será finalizada com o rascunho salvo e os
                        campos obrigatórios preenchidos. Depois disso, o
                        registro ficará somente para leitura.
                      </p></hlm-dialog-header
                    ><hlm-dialog-footer
                      ><button
                        hlmBtn
                        hlmDialogClose
                        variant="outline"
                        type="button"
                        class="min-h-11"
                        autofocus
                      >
                        Revisar registro</button
                      ><button
                        hlmBtn
                        type="button"
                        class="min-h-11"
                        (click)="finish(data, finishDialog)"
                      >
                        Confirmar finalização
                      </button></hlm-dialog-footer
                    ></hlm-dialog-content
                  ></hlm-dialog
                >
              </div>
            </div>
          </form>
        }
      </section>
    }
  `,
})
export class DoctorCareComponent {
  private readonly api = inject(DoctorApi);
  private readonly route = inject(ActivatedRoute);
  private readonly identity = inject(IdentityService);
  private readonly id = this.route.snapshot.paramMap.get("id") ?? "";
  protected readonly workspace = httpResource<DoctorWorkspace>(() =>
    this.api.workspace(this.id),
  );
  private readonly historyRequested = signal(false);
  protected readonly history = httpResource<Page<DoctorWorkspace>>(() => {
    const patientId = this.workspace.value()?.agendamento.paciente.id;
    return this.historyRequested() && patientId
      ? this.api.history(patientId)
      : undefined;
  });
  protected readonly draft = signal<ClinicalRecord>(emptyRecord);
  protected readonly saved = signal<ClinicalRecord>(emptyRecord);
  protected readonly saving = signal(false);
  protected readonly notice = signal<DoctorIssue | null>(null);
  private readonly seededSessionId = signal<string | null>(null);
  protected readonly dirty = computed(
    () => recordKey(this.draft()) !== recordKey(this.saved()),
  );
  protected readonly complete = computed(() =>
    [
      this.draft().queixaPrincipal,
      this.draft().resumoAnamnese,
      this.draft().conduta,
    ].every((value) => value.trim().length > 0),
  );
  constructor() {
    effect(() => {
      const data = this.workspace.value();
      if (data && this.seededSessionId() !== data.atendimento.id) {
        this.seededSessionId.set(data.atendimento.id);
        this.saved.set(data.atendimento.registroClinico);
        this.draft.set(data.atendimento.registroClinico);
      }
    });
  }
  protected setField(field: keyof ClinicalRecord, value: string) {
    this.draft.update((record) => ({ ...record, [field]: value }));
  }
  protected save(data: DoctorWorkspace) {
    if (!this.dirty()) return;
    this.saving.set(true);
    this.notice.set(null);
    this.api
      .save(data.atendimento.id, data.atendimento.version, this.draft())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => this.applyPersisted(updated),
        error: (error) => this.notice.set(doctorIssue(error)),
      });
  }
  protected finish(data: DoctorWorkspace, dialog: HlmDialog) {
    if (this.dirty() || !this.complete()) return;
    this.saving.set(true);
    this.notice.set(null);
    this.api
      .finish(data.atendimento.id, data.atendimento.version)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          dialog.close();
          this.applyPersisted(updated);
        },
        error: (error) => this.notice.set(doctorIssue(error)),
      });
  }
  protected reloadForComparison() {
    this.workspace.reload();
    this.notice.set(null);
  }
  protected loadHistory() {
    this.historyRequested.set(true);
  }
  protected issue(error: unknown) {
    return doctorIssue(error);
  }
  protected dateTime(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
  @HostListener("window:beforeunload", ["$event"]) protected beforeUnload(
    event: BeforeUnloadEvent,
  ) {
    if (this.dirty()) {
      event.preventDefault();
      event.returnValue = true;
    }
  }
  canLeave(): boolean {
    return (
      !this.dirty() ||
      window.confirm("Você tem alterações não salvas. Sair sem salvar?")
    );
  }
  private applyPersisted(updated: DoctorWorkspace) {
    this.workspace.set(updated);
    this.saved.set(updated.atendimento.registroClinico);
    this.draft.set(updated.atendimento.registroClinico);
  }
}
