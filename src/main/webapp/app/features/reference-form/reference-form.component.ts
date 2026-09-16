import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { FormField, FormRoot, form, required } from "@angular/forms/signals";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmCardImports } from "@spartan-ng/helm/card";
import { HlmFieldImports } from "@spartan-ng/helm/field";
import { HlmTextareaImports } from "@spartan-ng/helm/textarea";

import { PageHeaderComponent } from "../../shared/ui/page-header.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    FormRoot,
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmTextareaImports,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header
      eyebrow="Referência"
      title="Formulário com Signal Forms"
      description="Composição mínima para formulários das jornadas, sem antecipar uma mutação de domínio."
    />

    <section hlmCard class="max-w-2xl">
      <div hlmCardHeader>
        <h2 hlmCardTitle>Mensagem para a equipe</h2>
        <p hlmCardDescription>
          Exemplo de label, validação local e apresentação de erro retornado
          pelo servidor.
        </p>
      </div>
      <div hlmCardContent class="pb-6">
        <form [formRoot]="referenceForm" class="flex flex-col gap-5">
          <div hlmField>
            <label hlmFieldLabel for="reference-message">Mensagem</label>
            <textarea
              hlmTextarea
              id="reference-message"
              rows="4"
              [formField]="referenceForm.message"
              aria-describedby="reference-message-description"
            ></textarea>
            <p hlmFieldDescription id="reference-message-description">
              Campo obrigatório; os fluxos reais usam a validação contratada
              pelo backend.
            </p>
            @if (referenceForm.message().touched()) {
              @for (
                error of referenceForm.message().errors();
                track error.kind
              ) {
                <hlm-field-error [validator]="error.kind">{{
                  error.message
                }}</hlm-field-error>
              }
            }
            @if (serverError(); as error) {
              <hlm-field-error forceShow>{{ error }}</hlm-field-error>
            }
          </div>

          @if (submitted()) {
            <section hlmAlert>
              <h3 hlmAlertTitle>Referência validada</h3>
              <p hlmAlertDescription>
                Uma mutação real será implementada na API da jornada com
                HttpClient explícito.
              </p>
            </section>
          }

          <div class="flex flex-wrap gap-3">
            <button hlmBtn type="submit">Validar exemplo</button>
            <button
              hlmBtn
              variant="outline"
              type="button"
              (click)="demonstrateServerError()"
            >
              Demonstrar erro de servidor
            </button>
          </div>
        </form>
      </div>
    </section>
  `,
})
export class ReferenceFormComponent {
  private readonly model = signal({ message: "" });
  protected readonly serverError = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly referenceForm = form(
    this.model,
    (path) => {
      required(path.message, {
        message: "Informe uma mensagem antes de continuar.",
      });
    },
    {
      submission: {
        action: async () => {
          this.serverError.set(null);
          this.submitted.set(true);
        },
      },
    },
  );

  protected demonstrateServerError(): void {
    this.submitted.set(false);
    this.serverError.set(
      "Exemplo de erro do servidor: revise o campo antes de enviar.",
    );
  }
}
