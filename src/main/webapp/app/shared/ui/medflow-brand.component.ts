import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "app-medflow-brand",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="flex shrink-0 items-center gap-3">
      <span
        class="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg font-bold"
        aria-hidden="true"
        >+</span
      >
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
