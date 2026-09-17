import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmSheetImports } from "@spartan-ng/helm/sheet";

@Component({
  selector: "app-doctor-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    HlmButtonImports,
    HlmSheetImports,
  ],
  template: `
    <a
      href="#doctor-main"
      class="bg-primary text-primary-foreground sr-only fixed top-2 left-2 z-50 rounded-md px-4 py-3 focus:not-sr-only"
      >Pular para o conteúdo</a
    >
    <div class="min-h-dvh bg-background">
      <header class="border-border border-b">
        <div
          class="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8"
        >
          <a routerLink="triagem" class="font-semibold tracking-tight"
            >MedFlow
            <span class="text-muted-foreground font-normal">· Médico</span></a
          >
          <nav
            class="hidden items-center gap-1 md:flex"
            aria-label="Jornada médica"
          >
            <a
              routerLink="triagem"
              routerLinkActive="bg-accent text-accent-foreground"
              class="rounded-md px-3 py-2 text-sm font-medium"
              >Minha agenda</a
            >
          </nav>
          <hlm-sheet side="right"
            ><button
              hlmSheetTrigger
              hlmBtn
              variant="outline"
              type="button"
              class="min-h-11 md:hidden"
            >
              Menu</button
            ><hlm-sheet-content *hlmSheetPortal
              ><hlm-sheet-header
                ><h2 hlmSheetTitle>Jornada médica</h2>
                <p hlmSheetDescription>
                  Acesse sua agenda e seus atendimentos.
                </p></hlm-sheet-header
              >
              <nav class="flex flex-col gap-2">
                <a
                  hlmSheetClose
                  hlmBtn
                  variant="ghost"
                  routerLink="triagem"
                  class="min-h-11 justify-start"
                  >Minha agenda</a
                >
              </nav>
              <button
                hlmSheetClose
                hlmBtn
                variant="outline"
                type="button"
                class="min-h-11"
              >
                Fechar menu
              </button></hlm-sheet-content
            ></hlm-sheet
          >
        </div>
      </header>
      <main
        id="doctor-main"
        tabindex="-1"
        class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      >
        <router-outlet />
      </main>
    </div>
  `,
})
export class DoctorShellComponent {}
