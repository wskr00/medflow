import { ChangeDetectionStrategy, Component, output } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

@Component({
  selector: "app-admin-nav",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  styles: `
    nav {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .admin-nav-link {
      display: flex;
      align-items: center;
      min-height: 2.75rem;
      padding: 0.65rem 0.75rem;
      font-size: 0.875rem;
      border-left: 2px solid transparent;
      transition:
        background-color var(--medflow-duration-fast),
        border-color var(--medflow-duration-fast);
    }
    .admin-nav-link:hover {
      background: color-mix(in srgb, var(--rail-foreground) 10%, transparent);
    }
    .is-active {
      background: color-mix(in srgb, var(--rail-foreground) 8%, transparent);
      border-color: var(--rail-muted);
      font-weight: 600;
    }
    @media (max-width: 1023px) {
      nav {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0;
      }
      .admin-nav-link {
        border-left: 0;
        border-bottom: 2px solid transparent;
        justify-content: center;
        text-align: center;
      }
      .is-active {
        border-bottom-color: var(--rail-muted);
      }
    }
    @media (max-width: 480px) {
      .admin-nav-link {
        font-size: 0.75rem;
        padding: 0.5rem 0.25rem;
      }
    }
  `,
  template: `<nav
    class="flex flex-col gap-1"
    aria-label="Configuração administrativa"
  >
    <a
      routerLink="/workspace/admin/clinica"
      routerLinkActive="is-active"
      ariaCurrentWhenActive="page"
      class="admin-nav-link"
      (click)="navigated.emit()"
      >Clínica</a
    ><a
      routerLink="/workspace/admin/estrutura"
      routerLinkActive="is-active"
      ariaCurrentWhenActive="page"
      class="admin-nav-link"
      (click)="navigated.emit()"
      >Estrutura</a
    ><a
      routerLink="/workspace/admin/profissionais"
      routerLinkActive="is-active"
      ariaCurrentWhenActive="page"
      class="admin-nav-link"
      (click)="navigated.emit()"
      >Profissionais</a
    ><a
      routerLink="/workspace/admin/especialidades"
      routerLinkActive="is-active"
      ariaCurrentWhenActive="page"
      class="admin-nav-link"
      (click)="navigated.emit()"
      >Especialidades</a
    ><a
      routerLink="/workspace/admin/agenda"
      routerLinkActive="is-active"
      ariaCurrentWhenActive="page"
      class="admin-nav-link"
      (click)="navigated.emit()"
      >Horários de trabalho</a
    ><a
      routerLink="/workspace/admin/bloqueios"
      routerLinkActive="is-active"
      ariaCurrentWhenActive="page"
      class="admin-nav-link"
      (click)="navigated.emit()"
      >Bloqueios</a
    >
  </nav>`,
})
export class AdminNavComponent {
  readonly navigated = output<void>();
}
