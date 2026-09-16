import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { HlmCardImports } from "@spartan-ng/helm/card";

import { PageHeaderComponent } from "../../shared/ui/page-header.component";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { StatusBadgeComponent } from "../../shared/ui/status-badge.component";

type ProfileKey = "patient" | "reception" | "doctor" | "administrator";

interface ProfileFoundationCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
}

const copyByProfile: Readonly<Record<ProfileKey, ProfileFoundationCopy>> = {
  patient: {
    eyebrow: "Paciente",
    title: "Meus atendimentos",
    description: "Acompanhamento de agendamentos e histórico autorizado.",
    emptyTitle: "Nenhum atendimento para exibir",
    emptyDescription:
      "Quando a jornada de agendamento estiver disponível, ela aparecerá aqui.",
  },
  reception: {
    eyebrow: "Recepção",
    title: "Recepção",
    description: "Agenda operacional, chegada e fila de atendimento.",
    emptyTitle: "Nenhum resultado na agenda",
    emptyDescription: "A jornada de recepção será conectada a este espaço.",
  },
  doctor: {
    eyebrow: "Médico",
    title: "Atendimento",
    description: "Fila autorizada, contexto e registro clínico essencial.",
    emptyTitle: "Nenhum paciente aguardando",
    emptyDescription:
      "A fila do profissional será apresentada aqui quando a jornada estiver pronta.",
  },
  administrator: {
    eyebrow: "Administrador",
    title: "Configuração da clínica",
    description: "Estrutura, profissionais e regras de agenda.",
    emptyTitle: "Configuração ainda não disponível",
    emptyDescription:
      "As telas administrativas utilizarão este shell sem criar uma segunda navegação.",
  },
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    HlmCardImports,
    PageHeaderComponent,
    StatePanelComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-header
      [eyebrow]="copy().eyebrow"
      [title]="copy().title"
      [description]="copy().description"
    />

    <section hlmCard>
      <div hlmCardHeader>
        <h2 hlmCardTitle>Fundação de interface</h2>
        <p hlmCardDescription>
          Este espaço preserva a hierarquia da jornada sem antecipar regras de
          negócio.
        </p>
      </div>
      <div hlmCardContent class="flex flex-col gap-4 pb-6">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="text-muted-foreground"
            >Padrão de estado operacional:</span
          >
          <app-status-badge status="AGENDADA" />
        </div>
        <app-state-panel
          state="empty"
          [title]="copy().emptyTitle"
          [description]="copy().emptyDescription"
        />
        <a
          routerLink="/workspace/reference-form"
          class="text-primary w-fit text-sm font-medium underline underline-offset-4"
          >Ver formulário de referência</a
        >
      </div>
    </section>
  `,
})
export class ProfileFoundationComponent {
  readonly profile = input<ProfileKey>("patient");
  protected readonly copy = computed(() => copyByProfile[this.profile()]);
}
