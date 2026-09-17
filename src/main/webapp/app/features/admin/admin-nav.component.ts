import { ChangeDetectionStrategy, Component, output } from "@angular/core";
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
      routerLink="/workspace/admin/clinica"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      (click)="navigated.emit()"
      >Clínica</a
    ><a
      routerLink="/workspace/admin/estrutura"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      (click)="navigated.emit()"
      >Estrutura</a
    ><a
      routerLink="/workspace/admin/profissionais"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      (click)="navigated.emit()"
      >Profissionais</a
    ><a
      routerLink="/workspace/admin/especialidades"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      (click)="navigated.emit()"
      >Especialidades</a
    ><a
      routerLink="/workspace/admin/agenda"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      (click)="navigated.emit()"
      >Agenda semanal</a
    ><a
      routerLink="/workspace/admin/bloqueios"
      routerLinkActive="bg-accent text-accent-foreground"
      class="min-h-11 rounded-md px-3 py-2 text-sm font-medium"
      (click)="navigated.emit()"
      >Bloqueios</a
    >
  </nav>`,
})
export class AdminNavComponent {
  readonly navigated = output<void>();
}
