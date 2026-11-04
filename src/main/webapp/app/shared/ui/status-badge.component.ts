import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { HlmBadgeImports } from "@spartan-ng/helm/badge";

export type OperationalStatus =
  "AGENDADA" | "EM_ESPERA" | "EM_ATENDIMENTO" | "FINALIZADA" | "CANCELADA";
const labelByStatus = {
  AGENDADA: "Agendada",
  EM_ESPERA: "Em espera",
  EM_ATENDIMENTO: "Em atendimento",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
} as const satisfies Record<OperationalStatus, string>;

@Component({
  selector: "app-status-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmBadgeImports],
  template:
    '<span hlmBadge variant="outline" class="operational-status" [attr.data-status]="status()"><span class="status-dot" aria-hidden="true"></span>{{ label() }}</span>',
  styles: `
    .operational-status {
      border: 0;
      border-radius: 0.25rem;
      font-size: 0.7rem;
      font-weight: 500;
      padding: 0.3rem 0.45rem;
      white-space: nowrap;
      background: var(--muted);
      color: var(--foreground);
      gap: 0.35rem;
    }
    .status-dot {
      width: 0.35rem;
      height: 0.35rem;
      border-radius: 50%;
      background: currentColor;
    }
    [data-status="EM_ESPERA"] {
      color: var(--warning-foreground);
      background: color-mix(in srgb, var(--warning) 18%, var(--card));
    }
    [data-status="EM_ATENDIMENTO"] {
      color: var(--info);
      background: color-mix(in srgb, var(--info) 10%, var(--card));
    }
    [data-status="FINALIZADA"] {
      color: var(--success);
      background: color-mix(in srgb, var(--success) 10%, var(--card));
    }
    [data-status="CANCELADA"] {
      color: var(--destructive);
      background: color-mix(in srgb, var(--destructive) 8%, var(--card));
    }
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<OperationalStatus>();

  protected readonly label = computed(() => labelByStatus[this.status()]);
}
