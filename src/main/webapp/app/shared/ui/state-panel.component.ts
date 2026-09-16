import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmEmptyImports } from "@spartan-ng/helm/empty";
import { HlmSkeletonImports } from "@spartan-ng/helm/skeleton";

export type ViewState = "loading" | "empty" | "error" | "conflict" | "success";

@Component({
  selector: "app-state-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmAlertImports, HlmEmptyImports, HlmSkeletonImports],
  template: `
    @switch (state()) {
      @case ("loading") {
        <section
          aria-busy="true"
          aria-live="polite"
          class="flex flex-col gap-3"
        >
          <p class="sr-only">{{ title() }}</p>
          <div hlmSkeleton class="h-5 w-2/5"></div>
          <div hlmSkeleton class="h-16 w-full"></div>
          <div hlmSkeleton class="h-16 w-full"></div>
        </section>
      }
      @case ("empty") {
        <section hlmEmpty>
          <div hlmEmptyHeader>
            <h2 hlmEmptyTitle>{{ title() }}</h2>
            <p hlmEmptyDescription>{{ description() }}</p>
          </div>
        </section>
      }
      @case ("error") {
        <section hlmAlert variant="destructive">
          <h2 hlmAlertTitle>{{ title() }}</h2>
          <p hlmAlertDescription>{{ description() }}</p>
        </section>
      }
      @case ("conflict") {
        <section hlmAlert>
          <h2 hlmAlertTitle>{{ title() }}</h2>
          <p hlmAlertDescription>{{ description() }}</p>
        </section>
      }
      @case ("success") {
        <section hlmAlert>
          <h2 hlmAlertTitle>{{ title() }}</h2>
          <p hlmAlertDescription>{{ description() }}</p>
        </section>
      }
    }
  `,
})
export class StatePanelComponent {
  readonly state = input.required<ViewState>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
