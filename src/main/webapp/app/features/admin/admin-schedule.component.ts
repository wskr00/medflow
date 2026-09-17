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
import { StatePanelComponent } from "../../shared/ui/state-panel.component";
import { AdminApi, adminIssue } from "./admin.api";
import {
  AdminIssue,
  Page,
  Professional,
  Room,
  ScheduleRule,
  Specialty,
} from "./admin.models";
@Component({
  selector: "app-admin-schedule",
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
        Agenda semanal
      </p>
      <h1 class="text-3xl font-semibold tracking-tight">
        Regras de atendimento
      </h1>
      <p class="text-muted-foreground mt-1">
        Defina profissional, especialidade e consultório na mesma regra.
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
    <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <section hlmCard>
        <div hlmCardHeader class="flex-row justify-between">
          <div>
            <h2 hlmCardTitle>Semana de referência</h2>
            <p hlmCardDescription>Regras vigentes cadastradas.</p>
          </div>
          <button hlmBtn type="button" class="min-h-11" (click)="newRule()">
            Nova regra
          </button>
        </div>
        <div hlmCardContent>
          @if (rules.error()) {
            <app-state-panel
              state="error"
              [title]="issue(rules.error()).title"
              [description]="issue(rules.error()).description"
            />
          } @else if (rules.isLoading()) {
            <app-state-panel
              state="loading"
              title="Carregando regras"
              description="Aguarde um momento."
            />
          } @else {
            <div class="grid gap-2 md:grid-cols-2">
              @for (rule of rules.value()?.items ?? []; track rule.id) {
                <button
                  type="button"
                  class="bg-muted min-h-20 rounded-md p-3 text-left"
                  (click)="edit(rule)"
                >
                  <span class="block font-medium"
                    >{{ day(rule.diaSemana) }} · {{ rule.horaInicio }}–{{
                      rule.horaFim
                    }}</span
                  ><span class="text-muted-foreground block text-xs"
                    >{{ rule.medico.nome }} · {{ rule.consultorio.nome }}</span
                  ><span class="text-muted-foreground text-xs"
                    >{{ rule.duracaoMinutos }} min ·
                    {{ rule.ativo ? "ativa" : "inativa" }}</span
                  >
                </button>
              } @empty {
                <app-state-panel
                  state="empty"
                  title="Nenhuma regra"
                  description="Crie uma regra semanal de atendimento."
                />
              }
            </div>
          }
        </div>
      </section>
      <form hlmCard (submit)="$event.preventDefault(); save()">
        <div hlmCardHeader>
          <h2 hlmCardTitle>{{ id() ? "Editar regra" : "Nova regra" }}</h2>
          <p hlmCardDescription>
            Não há intervalo ou antecedência mínima configuráveis neste MVP.
          </p>
        </div>
        <div hlmCardContent class="grid gap-4">
          <div hlmField>
            <label hlmFieldLabel for="rule-doctor">Profissional</label
            ><hlm-native-select
              selectId="rule-doctor"
              class="min-h-11"
              [value]="doctorId()"
              (valueChange)="doctorId.set($event ?? '')"
              ><option hlmNativeSelectOption value="">Selecione</option>
              @for (item of doctors.value()?.items ?? []; track item.id) {
                <option hlmNativeSelectOption [value]="item.id">
                  {{ item.nome }}
                </option>
              }
            </hlm-native-select>
          </div>
          <div hlmField>
            <label hlmFieldLabel for="rule-specialty">Especialidade</label
            ><hlm-native-select
              selectId="rule-specialty"
              class="min-h-11"
              [value]="specialtyId()"
              (valueChange)="specialtyId.set($event ?? '')"
              ><option hlmNativeSelectOption value="">Selecione</option>
              @for (item of specialties.value()?.items ?? []; track item.id) {
                <option hlmNativeSelectOption [value]="item.id">
                  {{ item.nome }}
                </option>
              }
            </hlm-native-select>
          </div>
          <div hlmField>
            <label hlmFieldLabel for="rule-room">Consultório</label
            ><hlm-native-select
              selectId="rule-room"
              class="min-h-11"
              [value]="roomId()"
              (valueChange)="roomId.set($event ?? '')"
              ><option hlmNativeSelectOption value="">Selecione</option>
              @for (item of rooms.value()?.items ?? []; track item.id) {
                <option hlmNativeSelectOption [value]="item.id">
                  {{ item.nome }}
                </option>
              }
            </hlm-native-select>
          </div>
          <div hlmField>
            <label hlmFieldLabel for="rule-day">Dia da semana</label
            ><hlm-native-select
              selectId="rule-day"
              class="min-h-11"
              [value]="dayValue()"
              (valueChange)="dayValue.set($event ?? '1')"
              ><option hlmNativeSelectOption value="1">Segunda-feira</option>
              <option hlmNativeSelectOption value="2">Terça-feira</option>
              <option hlmNativeSelectOption value="3">Quarta-feira</option>
              <option hlmNativeSelectOption value="4">Quinta-feira</option>
              <option hlmNativeSelectOption value="5">
                Sexta-feira
              </option></hlm-native-select
            >
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div hlmField>
              <label hlmFieldLabel for="rule-start">Início</label
              ><input
                hlmInput
                id="rule-start"
                type="time"
                class="min-h-11"
                [value]="start()"
                (input)="start.set($any($event.target).value)"
              />
            </div>
            <div hlmField>
              <label hlmFieldLabel for="rule-end">Fim</label
              ><input
                hlmInput
                id="rule-end"
                type="time"
                class="min-h-11"
                [value]="end()"
                (input)="end.set($any($event.target).value)"
              />
            </div>
            <div hlmField>
              <label hlmFieldLabel for="rule-duration">Minutos</label
              ><input
                hlmInput
                id="rule-duration"
                type="number"
                min="1"
                class="min-h-11"
                [value]="duration()"
                (input)="duration.set($any($event.target).value)"
              />
            </div>
          </div>
          <div hlmField>
            <label hlmFieldLabel for="rule-validity">Vigente de</label
            ><input
              hlmInput
              id="rule-validity"
              type="date"
              class="min-h-11"
              [value]="validFrom()"
              (input)="validFrom.set($any($event.target).value)"
            />
          </div>
        </div>
        <div hlmCardFooter class="justify-end">
          <button hlmBtn type="submit" class="min-h-11">Salvar regra</button>
        </div>
      </form>
    </div>
  </section>`,
})
export class AdminScheduleComponent {
  private readonly api = inject(AdminApi);
  protected readonly rules = httpResource<Page<ScheduleRule>>(() =>
    this.api.rules(),
  );
  protected readonly doctors = httpResource<Page<Professional>>(() =>
    this.api.list("medicos"),
  );
  protected readonly specialties = httpResource<Page<Specialty>>(() =>
    this.api.list("especialidades"),
  );
  protected readonly rooms = httpResource<Page<Room>>(() =>
    this.api.list("consultorios"),
  );
  protected readonly id = signal<string | null>(null);
  protected readonly version = signal<number | null>(null);
  protected readonly doctorId = signal("");
  protected readonly specialtyId = signal("");
  protected readonly roomId = signal("");
  protected readonly dayValue = signal("1");
  protected readonly start = signal("08:00");
  protected readonly end = signal("09:00");
  protected readonly duration = signal("30");
  protected readonly validFrom = signal(new Date().toISOString().slice(0, 10));
  protected readonly notice = signal<AdminIssue | null>(null);
  protected newRule() {
    this.id.set(null);
    this.version.set(null);
  }
  protected edit(rule: ScheduleRule) {
    this.id.set(rule.id);
    this.version.set(rule.version);
    this.doctorId.set(rule.medico.id);
    this.specialtyId.set(rule.especialidade.id);
    this.roomId.set(rule.consultorio.id);
    this.dayValue.set(`${rule.diaSemana}`);
    this.start.set(rule.horaInicio);
    this.end.set(rule.horaFim);
    this.duration.set(`${rule.duracaoMinutos}`);
    this.validFrom.set(rule.vigenteDe);
  }
  protected save() {
    const payload = {
      medicoId: this.doctorId(),
      especialidadeId: this.specialtyId(),
      consultorioId: this.roomId(),
      diaSemana: +this.dayValue(),
      horaInicio: this.start(),
      horaFim: this.end(),
      duracaoMinutos: +this.duration(),
      vigenteDe: this.validFrom(),
      vigenteAte: null,
      ativo: true,
    };
    if (
      !payload.medicoId ||
      !payload.especialidadeId ||
      !payload.consultorioId ||
      !payload.horaInicio ||
      !payload.horaFim
    ) {
      this.notice.set({
        code: "INVALID",
        title: "Revise a regra",
        description:
          "Preencha profissional, especialidade, consultório e horários.",
        conflict: false,
        fields: {},
      });
      return;
    }
    const request = this.id()
      ? this.api.update<ScheduleRule>("regras-agenda", this.id()!, {
          ...payload,
          expectedVersion: this.version(),
        })
      : this.api.create<ScheduleRule>("regras-agenda", payload);
    request.subscribe({
      next: (rule) => {
        this.edit(rule);
        this.rules.reload();
      },
      error: (error) => this.notice.set(adminIssue(error)),
    });
  }
  protected day(day: number) {
    return ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][day];
  }
  protected issue(error: unknown) {
    return adminIssue(error);
  }
}
