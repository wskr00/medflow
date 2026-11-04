import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "app-medflow-brand",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="flex shrink-0 items-center gap-3">
      <svg
        class="size-9 shrink-0 text-primary"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5 27V9L18 23L31 9V27"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="square"
          stroke-linejoin="round"
        />
        <path d="M5 27H12M24 27H31" stroke="currentColor" stroke-width="3" />
      </svg>
      <span class="text-lg font-semibold tracking-tight">MedFlow</span>
      @if (context()) {
        <span class="text-muted-foreground hidden text-sm sm:inline">{{
          context()
        }}</span>
      }
    </span>
  `,
})
export class MedflowBrandComponent {
  readonly context = input("");
}
