import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import Keycloak from "keycloak-js";

@Component({
  selector: "app-session-actions",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButtonImports],
  host: { class: "flex min-w-0 items-center gap-2 sm:gap-3" },
  template: `
    <p class="text-muted-foreground min-w-0 truncate text-sm">
      <span class="sr-only">Usuário conectado: </span>{{ userName }}
    </p>
    <button
      hlmBtn
      variant="outline"
      type="button"
      class="min-h-11 shrink-0"
      (click)="logout()"
    >
      Sair
    </button>
  `,
})
export class SessionActionsComponent {
  private readonly keycloak = inject(Keycloak);

  protected get userName(): string {
    const claims = this.keycloak.tokenParsed as
      { name?: string; preferred_username?: string } | undefined;
    return claims?.name?.trim() || claims?.preferred_username || "Usuário";
  }

  protected logout(): void {
    void this.keycloak.logout({ redirectUri: `${window.location.origin}/` });
  }
}
