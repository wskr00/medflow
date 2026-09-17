import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

@Component({
  selector: "app-admin-nav",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `<nav
    class="flex flex-col gap-1"
    aria-label="Configuração administrativa"
  >
    <a
      routerLink="../clinica"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      >Clínica</a
    ><a
      routerLink="../estrutura"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      >Estrutura</a
    ><a
      routerLink="../profissionais"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      >Profissionais</a
    ><a
      routerLink="../especialidades"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      >Especialidades</a
    ><a
      routerLink="../agenda"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      >Agenda semanal</a
    ><a
      routerLink="../bloqueios"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      >Bloqueios</a
    >
  </nav>`,
})
export class AdminNavComponent {}
