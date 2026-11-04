import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { IdentityService } from "../../auth/identity.service";
import { Slot } from "./patient.models";
import { slotKey } from "./patient-time";

@Component({
  selector: "app-patient-slot-options",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButtonImports],
  template: `
    <div class="slot-grid" role="group" aria-label="Horários disponíveis">
      @for (slot of visible(); track key(slot)) {
        <button
          hlmBtn
          variant="outline"
          type="button"
          class="slot-option"
          [attr.aria-pressed]="isSelected(slot)"
          [disabled]="disabled()"
          (click)="choose.emit(slot)"
        >
          <span class="slot-time">{{ time(slot.inicio) }}</span>
          <span class="slot-person">{{ slot.medico.nome }}</span>
          <span class="slot-room">{{ slot.consultorio.nome }}</span>
          @if (isSelected(slot)) {
            <span class="slot-selected">✓ Selecionado</span>
          }
        </button>
      }
    </div>
    @if (slots().length > 6) {
      <button
        hlmBtn
        type="button"
        variant="ghost"
        class="mt-3"
        [disabled]="disabled()"
        (click)="expanded.set(!expanded())"
      >
        {{ expanded() ? "Mostrar menos horários" : "Ver mais horários" }}
      </button>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    button {
      min-height: 2.75rem;
    }
    .slot-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }
    .slot-option {
      height: auto;
      min-height: 6.5rem;
      display: flex;
      align-items: start;
      justify-content: start;
      flex-direction: column;
      gap: 0.15rem;
      padding: 1rem;
      white-space: normal;
      text-align: left;
      transition:
        background-color var(--medflow-duration-fast),
        border-color var(--medflow-duration-fast);
    }
    .slot-option[aria-pressed="true"] {
      border: 2px solid var(--primary);
      background: var(--accent);
      padding: calc(1rem - 1px);
      color: var(--foreground);
    }
    .slot-time {
      font-size: 1.125rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .slot-person,
    .slot-room {
      font-size: 0.8125rem;
      line-height: 1.5;
    }
    .slot-room {
      color: var(--muted-foreground);
    }
    .slot-selected {
      color: var(--primary);
      font-size: 0.75rem;
      font-weight: 600;
    }
    @media (min-width: 1280px) {
      button {
        min-height: 2.75rem;
      }
      .slot-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 480px) {
      button {
        min-height: 2.75rem;
      }
      .slot-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class PatientSlotOptionsComponent {
  private readonly identity = inject(IdentityService);
  readonly slots = input.required<readonly Slot[]>();
  readonly selected = input<Slot | null>(null);
  readonly disabled = input(false);
  readonly choose = output<Slot>();
  protected readonly expanded = signal(false);
  protected readonly visible = computed(() =>
    this.expanded() ? this.slots() : this.slots().slice(0, 6),
  );
  protected readonly key = slotKey;
  protected isSelected(slot: Slot) {
    const selected = this.selected();
    return !!selected && slotKey(selected) === slotKey(slot);
  }
  protected time(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeStyle: "short",
      timeZone: this.identity.identity.value()?.timeZone,
    }).format(new Date(value));
  }
}
