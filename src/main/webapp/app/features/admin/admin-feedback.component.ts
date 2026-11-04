import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { AdminIssue } from "./admin.models";

/** Feedback shared by configuration editors; editing stays in each domain screen. */
@Component({
  selector: "app-admin-feedback",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmAlertImports, HlmButtonImports],
  template: `
    @if (issue(); as message) {
      <section
        hlmAlert
        animate.enter="feedback-enter"
        [attr.role]="message.code === 'SAVED' ? 'status' : 'alert'"
        [variant]="
          message.code === 'SAVED' || message.conflict
            ? 'default'
            : 'destructive'
        "
      >
        <h2 hlmAlertTitle>{{ message.title }}</h2>
        <p hlmAlertDescription>{{ message.description }}</p>
        @if (message.code === "VERSAO_DESATUALIZADA") {
          <button
            hlmBtn
            variant="outline"
            type="button"
            class="mt-3 min-h-11"
            [disabled]="busy()"
            (click)="reload.emit()"
          >
            Carregar versão atual
          </button>
          <p class="mt-2 text-sm">
            Você confirma antes de substituir o que digitou.
          </p>
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    :host:empty {
      display: none;
    }
  `,
})
export class AdminFeedbackComponent {
  readonly issue = input<AdminIssue | null>(null);
  readonly busy = input(false);
  readonly reload = output<void>();
}
