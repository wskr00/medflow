import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import Keycloak from "keycloak-js";
import { HlmAlertImports } from "@spartan-ng/helm/alert";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmSheetImports } from "@spartan-ng/helm/sheet";
import { HlmSkeletonImports } from "@spartan-ng/helm/skeleton";

import { IdentityService } from "../../auth/identity.service";

interface NavigationItem {
  readonly label: string;
  readonly link: string;
}

const navigationByRole: Readonly<Record<string, NavigationItem>> = {
  PATIENT: { label: "Meus atendimentos", link: "/workspace/patient" },
  RECEPTIONIST: { label: "Recepção", link: "/workspace/reception" },
  DOCTOR: { label: "Atendimento", link: "/workspace/doctor" },
  ADMINISTRATOR: { label: "Configuração", link: "/workspace/administrator" },
};

@Component({
  selector: "app-workspace-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    HlmAlertImports,
    HlmButtonImports,
    HlmSheetImports,
    HlmSkeletonImports,
  ],
  template: `
    <a
      href="#main-content"
      class="bg-background text-foreground sr-only fixed start-4 top-4 rounded-md px-3 py-2 focus:not-sr-only"
    >
      Pular para o conteúdo
    </a>

    @if (identity.identity.isLoading()) {
      <main
        class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 p-6"
        aria-busy="true"
        aria-live="polite"
      >
        <p class="sr-only">Carregando área de trabalho.</p>
        <div hlmSkeleton class="h-10 w-40"></div>
        <div hlmSkeleton class="h-8 w-2/5"></div>
        <div hlmSkeleton class="h-48 w-full"></div>
      </main>
    } @else if (identity.identity.error()) {
      <main class="mx-auto flex min-h-dvh w-full max-w-xl items-center p-6">
        <section hlmAlert variant="destructive">
          <h1 hlmAlertTitle>Não foi possível abrir sua área</h1>
          <p hlmAlertDescription>
            A identidade não foi carregada. Verifique a conexão e tente
            novamente.
          </p>
          <button
            hlmBtn
            variant="outline"
            type="button"
            (click)="identity.identity.reload()"
          >
            Tentar novamente
          </button>
        </section>
      </main>
    } @else if (identity.identity.hasValue()) {
      <div class="min-h-dvh md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
        <aside
          class="border-sidebar-border bg-sidebar text-sidebar-foreground hidden min-h-dvh border-e md:flex md:flex-col"
        >
          <div class="flex flex-col gap-1 p-5">
            <p
              class="text-sidebar-primary text-sm font-semibold tracking-wide uppercase"
            >
              MedFlow
            </p>
            <p class="text-sm font-medium">Operação clínica</p>
          </div>
          <nav
            aria-label="Navegação principal"
            class="flex flex-col gap-1 px-3"
          >
            @for (item of navigation(); track item.link) {
              <a
                [routerLink]="item.link"
                routerLinkActive="bg-sidebar-accent text-sidebar-accent-foreground"
                class="rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"
              >
                {{ item.label }}
              </a>
            }
          </nav>
          <button
            hlmBtn
            variant="ghost"
            type="button"
            class="m-3 mt-auto justify-start"
            (click)="logout()"
          >
            Sair
          </button>
        </aside>

        <div class="min-w-0">
          <header
            class="border-border bg-background flex min-h-16 items-center gap-3 border-b px-4 py-3 md:px-8"
          >
            <hlm-sheet side="left">
              <button
                hlmSheetTrigger
                hlmBtn
                variant="outline"
                type="button"
                class="md:hidden"
              >
                Menu
              </button>
              <hlm-sheet-content *hlmSheetPortal>
                <hlm-sheet-header>
                  <h2 hlmSheetTitle>Navegação</h2>
                  <p hlmSheetDescription>
                    Escolha a área disponível para o seu perfil.
                  </p>
                </hlm-sheet-header>
                <nav aria-label="Navegação móvel" class="flex flex-col gap-1">
                  @for (item of navigation(); track item.link) {
                    <button
                      hlmSheetClose
                      hlmBtn
                      variant="ghost"
                      type="button"
                      [routerLink]="item.link"
                      class="justify-start"
                    >
                      {{ item.label }}
                    </button>
                  }
                </nav>
              </hlm-sheet-content>
            </hlm-sheet>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold">MedFlow</p>
              <p class="text-muted-foreground truncate text-xs">
                {{ identity.identity.value().timeZone }}
              </p>
            </div>
          </header>
          <main
            #mainContent
            id="main-content"
            tabindex="-1"
            class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8"
          >
            <router-outlet (activate)="focusMainContent()" />
          </main>
        </div>
      </div>
    }
  `,
})
export class WorkspaceShellComponent {
  protected readonly identity = inject(IdentityService);
  private readonly keycloak = inject(Keycloak);
  private readonly mainContent =
    viewChild<ElementRef<HTMLElement>>("mainContent");

  protected readonly navigation = computed(() => {
    if (!this.identity.identity.hasValue()) return [];

    return this.identity.identity
      .value()
      .roles.map((role) => navigationByRole[role])
      .filter((item): item is NavigationItem => item !== undefined);
  });

  protected focusMainContent(): void {
    this.mainContent()?.nativeElement.focus();
  }

  protected logout(): void {
    void this.keycloak.logout({ redirectUri: window.location.origin });
  }
}
