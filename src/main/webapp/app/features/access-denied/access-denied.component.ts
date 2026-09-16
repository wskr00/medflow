import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmEmptyImports } from "@spartan-ng/helm/empty";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HlmButtonImports, HlmEmptyImports],
  template: `
    <main class="mx-auto flex min-h-dvh max-w-xl items-center p-6">
      <section hlmEmpty>
        <div hlmEmptyHeader>
          <h1 hlmEmptyTitle>Acesso não disponível</h1>
          <p hlmEmptyDescription>
            Seu perfil não tem uma área de trabalho disponível nesta aplicação.
          </p>
        </div>
        <div hlmEmptyContent>
          <a routerLink="/workspace" hlmBtn variant="outline">Voltar</a>
        </div>
      </section>
    </main>
  `,
})
export class AccessDeniedComponent {}
