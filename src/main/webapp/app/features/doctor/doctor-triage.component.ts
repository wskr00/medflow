import { httpResource } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmInputImports } from "@spartan-ng/helm/input";
import { HlmSpinnerImports } from "@spartan-ng/helm/spinner";
import { finalize } from "rxjs";
import { IdentityService } from "../../auth/identity.service";
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { StatusBadgeComponent } from "../../shared/ui/status-badge.component";
import { DoctorApi, doctorIssue } from "./doctor.api";
import {
  DoctorAppointment,
  DoctorIssue,
  DoctorWorkspace,
  Page,
} from "./doctor.models";

@Component({
  selector: "app-doctor-triage",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DoctorApi],
  imports: [
    RouterLink,
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
    HlmSpinnerImports,
    StatePanelComponent,
    StatusBadgeComponent,
  ],
  template: `
    <section class="space-y-6">
      <header
        class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div class="space-y-1">
          <p
            class="text-primary text-xs font-semibold tracking-widest uppercase"
          >
            Triagem clínica
          </p>
          <h1 class="text-3xl font-semibold tracking-tight">Minha agenda</h1>
          <p class="text-muted-foreground">
            Inicie atendimentos de pacientes que já estão aguardando.
          </p>
        </div>
        <div class="flex gap-2">
          <input
            hlmInput
            type="date"
            class="min-h-11"
            aria-label="Data da agenda"
            [value]="date()"
            (change)="date.set($any($event.target).value)"
          /><button
            hlmBtn
            variant="outline"
            type="button"
            class="min-h-11"
            (click)="reload()"
          >
            Atualizar
          </button>
        </div>
      </header>
      @if (notice(); as message) {
        <section hlmAlert aria-live="polite">
          <h2 hlmAlertTitle>{{ message.title }}</h2>
          <p hlmAlertDescription>{{ message.description }}</p>
        </section>
      }
      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <aside
          aria-labelledby="doctor-queue-title"
          class="border-border bg-card order-1 space-y-3 rounded-xl border p-4 xl:order-2 xl:sticky xl:top-4"
        >
          <div>
            <h2 id="doctor-queue-title" class="text-xl font-semibold">
              Fila de espera
            </h2>
            <p class="text-muted-foreground text-sm">
              Pacientes prontos para atendimento.
            </p>
          </div>
          @if (queue.error()) {
            <app-state-panel
              state="error"
              [title]="issue(queue.error()).title"
              [description]="issue(queue.error()).description"
            /><button
              hlmBtn
              variant="outline"
              type="button"
              class="mt-3 min-h-11 w-full"
              (click)="queue.reload()"
            >
              Tentar novamente
            </button>
          } @else if (queue.isLoading()) {
            <app-state-panel
              state="loading"
              title="Carregando fila"
              description="Aguarde um momento."
            />
          } @else if (!queueItems().length) {
            <app-state-panel
              state="empty"
              title="Nenhum paciente aguardando"
              description="Os pacientes em espera aparecerão aqui."
            />
          } @else {
            <ol class="space-y-2">
              @for (item of queueItems(); track item.id) {
                <li class="bg-muted rounded-lg p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-semibold">{{ item.paciente.nome }}</p>
                      <p class="text-muted-foreground text-xs">
                        {{ time(item.inicio) }} · {{ item.especialidade.nome }}
                      </p>
                    </div>
                    <app-status-badge [status]="item.status" />
                  </div>
                  @if (item.allowedActions.canResume && item.atendimentoId) {
                    <a
                      hlmBtn
                      class="mt-3 min-h-11 w-full"
                      [routerLink]="['../atendimentos', item.atendimentoId]"
                      >Retomar atendimento</a
                    >
                  } @else if (item.allowedActions.canStart) {
                    <button
                      hlmBtn
                      type="button"
                      class="mt-3 min-h-11 w-full"
                      [disabled]="busyId() === item.id"
                      (click)="start(item)"
                    >
                      @if (busyId() === item.id) {
                        <hlm-spinner />
                      }
                      Iniciar atendimento
                    </button>
                  }
                </li>
              }
            </ol>
          }
        </aside>
        <section
          aria-labelledby="doctor-agenda-title"
          class="order-2 min-w-0 space-y-3 xl:order-1"
        >
          <div class="flex items-baseline justify-between gap-3">
            <div>
              <h2 id="doctor-agenda-title" class="text-xl font-semibold">
                Agenda do dia
              </h2>
              <p class="text-muted-foreground text-sm">
                Consultas atribuídas a você.
              </p>
            </div>
            @if (agenda.value(); as page) {
              <p class="text-muted-foreground text-sm">
                {{ page.totalElements }} consultas
              </p>
            }
          </div>
          @if (agenda.error()) {
            <app-state-panel
              state="error"
              [title]="issue(agenda.error()).title"
              [description]="issue(agenda.error()).description"
            /><button
              hlmBtn
              variant="outline"
              type="button"
              class="mt-3 min-h-11"
              (click)="agenda.reload()"
            >
              Tentar novamente
            </button>
          } @else if (agenda.isLoading()) {
            <app-state-panel
              state="loading"
              title="Carregando agenda"
              description="Aguarde um momento."
            />
          } @else if (!agendaItems().length) {
            <app-state-panel
              state="empty"
              title="Nenhuma consulta nesta data"
              description="Escolha outra data para consultar sua agenda."
            />
          } @else {
            <div
              class="border-border bg-card hidden overflow-hidden rounded-xl border lg:block"
            >
              <table class="w-full text-sm">
                <thead class="bg-muted/70 text-muted-foreground">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">Horário</th>
                    <th class="px-4 py-3 text-left font-medium">Paciente</th>
                    <th class="px-4 py-3 text-left font-medium">Cuidado</th>
                    <th class="px-4 py-3 text-left font-medium">Local</th>
                    <th class="px-4 py-3 text-left font-medium">Situação</th>
                    <th class="px-4 py-3 text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody class="divide-border divide-y">
                  @for (item of agendaItems(); track item.id) {
                    <tr>
                      <td class="px-4 py-4 font-semibold tabular-nums">
                        {{ time(item.inicio) }}
                      </td>
                      <td class="px-4 py-4 font-medium">
                        {{ item.paciente.nome }}
                      </td>
                      <td class="px-4 py-4">{{ item.especialidade.nome }}</td>
                      <td class="px-4 py-4">
                        <span class="block">{{ item.unidade.nome }}</span
                        ><span class="text-muted-foreground text-xs">{{
                          item.consultorio.nome
                        }}</span>
                      </td>
                      <td class="px-4 py-4">
                        <app-status-badge [status]="item.status" />
                      </td>
                      <td class="px-4 py-3 text-right">
                        @if (
                          item.allowedActions.canResume && item.atendimentoId
                        ) {
                          <a
                            hlmBtn
                            class="min-h-11"
                            [routerLink]="[
                              '../atendimentos',
                              item.atendimentoId,
                            ]"
                            >Retomar</a
                          >
                        } @else if (item.allowedActions.canStart) {
                          <button
                            hlmBtn
                            type="button"
                            class="min-h-11"
                            [disabled]="busyId() === item.id"
                            (click)="start(item)"
                          >
                            Iniciar
                          </button>
                        } @else if (item.atendimentoId) {
                          <a
                            hlmBtn
                            variant="outline"
                            class="min-h-11"
                            [routerLink]="[
                              '../atendimentos',
                              item.atendimentoId,
                            ]"
                            >Ver atendimento</a
                          >
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="grid gap-3 lg:hidden">
              @for (item of agendaItems(); track item.id) {
                <article hlmCard>
                  <div hlmCardHeader>
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <p class="font-semibold tabular-nums">
                          {{ time(item.inicio) }} · {{ item.paciente.nome }}
                        </p>
                        <p hlmCardDescription>
                          {{ item.especialidade.nome }} ·
                          {{ item.unidade.nome }}
                        </p>
                      </div>
                      <app-status-badge [status]="item.status" />
                    </div>
                  </div>
                  <div hlmCardContent>
                    <p class="text-muted-foreground text-sm">
                      {{ item.consultorio.nome }}
                    </p>
                  </div>
                  <div hlmCardFooter>
                    @if (item.allowedActions.canResume && item.atendimentoId) {
                      <a
                        hlmBtn
                        class="min-h-11 w-full"
                        [routerLink]="['../atendimentos', item.atendimentoId]"
                        >Retomar atendimento</a
                      >
                    } @else if (item.allowedActions.canStart) {
                      <button
                        hlmBtn
                        type="button"
                        class="min-h-11 w-full"
                        [disabled]="busyId() === item.id"
                        (click)="start(item)"
                      >
                        Iniciar atendimento
                      </button>
                    } @else if (item.atendimentoId) {
                      <a
                        hlmBtn
                        variant="outline"
                        class="min-h-11 w-full"
                        [routerLink]="['../atendimentos', item.atendimentoId]"
                        >Ver atendimento</a
                      >
                    }
                  </div>
                </article>
              }
            </div>
          }
        </section>
      </div>
    </section>
  `,
})
export class DoctorTriageComponent {
  private readonly api = inject(DoctorApi);
  private readonly router = inject(Router);
  private readonly identity = inject(IdentityService);
  protected readonly date = signal(this.today());
  protected readonly busyId = signal<string | null>(null);
  protected readonly notice = signal<DoctorIssue | null>(null);
  protected readonly agenda = httpResource<Page<DoctorAppointment>>(() =>
    this.api.agenda({ data: this.date(), page: 0, size: 30 }),
  );
  protected readonly queue = httpResource<Page<DoctorAppointment>>(() =>
    this.api.queue({ page: 0, size: 20 }),
  );
  protected readonly agendaItems = computed(
    () => this.agenda.value()?.items ?? [],
  );
  protected readonly queueItems = computed(
    () => this.queue.value()?.items ?? [],
  );
  protected start(item: DoctorAppointment) {
    if (!item.allowedActions.canStart) return;
    this.busyId.set(item.id);
    this.notice.set(null);
    this.api
      .start(item.id, item.version)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (workspace: DoctorWorkspace) =>
          void this.router.navigate([
            "/workspace/doctor/atendimentos",
            workspace.atendimento.id,
          ]),
        error: (error) => {
          this.notice.set(doctorIssue(error));
          this.reload();
        },
      });
  }
  protected reload() {
    this.notice.set(null);
    this.agenda.reload();
    this.queue.reload();
  }
  protected issue(error: unknown) {
    return doctorIssue(error);
  }
  protected time(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
  private today() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: this.identity.identity.value()?.timeZone ?? "America/Belem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
}
