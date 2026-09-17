import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmSheetImports } from "@spartan-ng/helm/sheet";
import { AdminNavComponent } from "./admin-nav.component";
import { SessionActionsComponent } from "../../shared/ui/session-actions.component";
import { MedflowBrandComponent } from "../../shared/ui/medflow-brand.component";

@Component({
  selector: "app-admin-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterOutlet,
    HlmButtonImports,
    HlmSheetImports,
    AdminNavComponent,
    SessionActionsComponent,
    MedflowBrandComponent,
  ],
  template: `
    <a
      href="#admin-main"
      class="bg-primary text-primary-foreground sr-only fixed top-2 left-2 rounded-md px-4 py-3 focus:not-sr-only"
      >Pular para o conteúdo</a
    >
    <div class="min-h-dvh bg-muted/30">
      <header class="border-border bg-background border-b">
        <div
          class="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6"
        >
          <a routerLink="estrutura"
            ><app-medflow-brand context="Administração"
          /></a>
          <div class="ml-auto flex items-center gap-2">
            <app-session-actions /><hlm-sheet #menu="hlmSheet" side="left"
              ><button
                hlmSheetTrigger
                hlmBtn
                variant="outline"
                class="min-h-11 lg:hidden"
              >
                Menu</button
              ><hlm-sheet-content *hlmSheetPortal
                ><hlm-sheet-header
                  ><h2 hlmSheetTitle>Configuração</h2>
                  <p hlmSheetDescription>
                    Estrutura e horários de trabalho da clínica.
                  </p></hlm-sheet-header
                ><app-admin-nav (navigated)="menu.close()" /></hlm-sheet-content
            ></hlm-sheet>
          </div>
        </div>
      </header>
      <div
        class="mx-auto grid max-w-[90rem] lg:grid-cols-[13rem_minmax(0,1fr)]"
      >
        <aside
          class="border-border hidden min-h-[calc(100dvh-4rem)] self-start border-r bg-background p-3 lg:block"
        >
          <app-admin-nav />
        </aside>
        <main
          id="admin-main"
          tabindex="-1"
          class="min-w-0 px-4 py-6 sm:px-6 lg:px-8"
        >
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AdminShellComponent {}
