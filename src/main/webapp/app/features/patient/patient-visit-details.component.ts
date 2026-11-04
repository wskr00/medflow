import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";
import { IdentityService } from "../../auth/identity.service";
import { Slot } from "./patient.models";

type Visit = Pick<
  Slot,
  "inicio" | "medico" | "especialidade" | "unidade" | "consultorio"
>;
/** The same operational details are reviewed for booking and rescheduling. */
@Component({
  selector: "app-patient-visit-details",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dl>
    <div>
      <dt>Data e horário</dt>
      <dd>{{ dateTime(visit().inicio) }}</dd>
    </div>
    <div>
      <dt>Especialidade</dt>
      <dd>{{ visit().especialidade.nome }}</dd>
    </div>
    <div>
      <dt>Profissional</dt>
      <dd>{{ visit().medico.nome }}</dd>
    </div>
    <div>
      <dt>Unidade</dt>
      <dd>{{ visit().unidade.nome }}</dd>
    </div>
    <div>
      <dt>Consultório</dt>
      <dd>{{ visit().consultorio.nome }}</dd>
    </div>
  </dl>`,
  styles: `
    :host {
      display: block;
    }
    dl {
      display: grid;
      gap: 1.25rem;
    }
    dt {
      font-size: 0.75rem;
      color: var(--muted-foreground);
      margin-bottom: 0.25rem;
    }
    dd {
      font-size: 0.9375rem;
      font-weight: 500;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
  `,
})
export class PatientVisitDetailsComponent {
  private readonly identity = inject(IdentityService);
  readonly visit = input.required<Visit>();
  protected dateTime(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
}
