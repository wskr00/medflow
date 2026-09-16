import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "app-page-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-col gap-2">
      @if (eyebrow()) {
        <p class="text-primary text-sm font-semibold tracking-wide uppercase">
          {{ eyebrow() }}
        </p>
      }
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">
          {{ title() }}
        </h1>
        @if (description()) {
          <p class="text-muted-foreground max-w-3xl">{{ description() }}</p>
        }
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly eyebrow = input<string>();
  readonly title = input.required<string>();
  readonly description = input<string>();
}
