import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";

import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { StatusBadgeComponent } from "../../shared/ui/status-badge.component";
import { PatientAppointmentsApi, patientApiIssue } from "./patient-appointments.api";
import { formatPatientDateTime } from "./patient-date-time";

@Component({
  selector: "app-patient-history",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButtonImports, HlmCardImports, StatePanelComponent, StatusBadgeComponent],
  template: `
    <section hlmCard aria-labelledby="history-title">
      <div hlmCardHeader>
        <h2 hlmCardTitle id="history-title">Histórico de atendimentos</h2>
        <p hlmCardDescription>Este histórico contém somente informações operacionais autorizadas.</p>
      </div>
      <div hlmCardContent class="flex flex-col gap-4 pb-6">
        <div class="flex justify-end"><button hlmBtn variant="outline" type="button" (click)="api.history.reload()">Atualizar</button></div>
        @if (api.history.isLoading()) {
          <app-state-panel state="loading" title="Carregando histórico" description="Aguarde um momento." />
        } @else if (api.history.error()) {
          <app-state-panel state="error" [title]="issue(api.history.error()).title" [description]="issue(api.history.error()).description" />
        } @else if ((api.history.value()?.items ?? []).length === 0) {
          <app-state-panel state="empty" title="Nenhum atendimento finalizado" description="Quando houver atendimentos finalizados, eles aparecerão aqui sem conteúdo clínico." />
        } @else {
          <div class="grid gap-3 md:grid-cols-2">
            @for (item of api.history.value()?.items ?? []; track item.id) {
              <article class="border-border flex flex-col gap-1 rounded-lg border p-4">
                <div class="flex items-center justify-between gap-3"><h3 class="font-semibold">{{ item.especialidade.nome }}</h3><app-status-badge status="FINALIZADA" /></div>
                <p class="text-muted-foreground text-sm">{{ item.medico.nome }} · {{ format(item.inicio) }}</p>
                <p class="text-muted-foreground text-sm">{{ item.unidade.nome }} · {{ item.consultorio.nome }}</p>
              </article>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class PatientHistoryComponent {
  protected readonly api = inject(PatientAppointmentsApi);
  readonly timeZone = input.required<string>();

  protected format(value: string): string {
    return formatPatientDateTime(value, this.timeZone());
  }

  protected issue(error: unknown) {
    return patientApiIssue(error);
  }
}
