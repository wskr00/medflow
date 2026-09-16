import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { HlmBadgeImports } from "@spartan-ng/helm/badge";

export type OperationalStatus =
  "AGENDADA" | "EM_ESPERA" | "EM_ATENDIMENTO" | "FINALIZADA" | "CANCELADA";
type BadgeVariant = "default" | "outline" | "secondary" | "destructive";

const labelByStatus = {
  AGENDADA: "Agendada",
  EM_ESPERA: "Em espera",
  EM_ATENDIMENTO: "Em atendimento",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
} as const satisfies Record<OperationalStatus, string>;

const variantByStatus = {
  AGENDADA: "outline",
  EM_ESPERA: "secondary",
  EM_ATENDIMENTO: "default",
  FINALIZADA: "secondary",
  CANCELADA: "destructive",
} as const satisfies Record<OperationalStatus, BadgeVariant>;

@Component({
  selector: "app-status-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmBadgeImports],
  template: '<span hlmBadge [variant]="variant()">{{ label() }}</span>',
})
export class StatusBadgeComponent {
  readonly status = input.required<OperationalStatus>();

  protected readonly label = computed(() => labelByStatus[this.status()]);
  protected readonly variant = computed(() => variantByStatus[this.status()]);
}
