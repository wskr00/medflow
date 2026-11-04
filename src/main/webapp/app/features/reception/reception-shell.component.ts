import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  viewChild,
} from "@angular/core";
import { DOCUMENT } from "@angular/common";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { SessionActionsComponent } from "../../shared/ui/session-actions.component";
import { MedflowBrandComponent } from "../../shared/ui/medflow-brand.component";

@Component({
  selector: "app-reception-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    SessionActionsComponent,
    MedflowBrandComponent,
  ],
  host: { class: "block min-h-dvh" },
  styleUrl: "./reception-shell.component.scss",
  template: `
    <a href="#reception-main" class="skip-link">Ir para o conteúdo</a>
    <div class="reception-workspace">
      <header class="reception-rail">
        <a class="reception-logo" routerLink="/workspace/reception"
          ><app-medflow-brand
        /></a>
        <div class="rail-body">
          <div class="rail-navigation">
            <p class="rail-label">ESPAÇO DE TRABALHO</p>
            <nav aria-label="Recepção">
              <a
                routerLink="/workspace/reception"
                routerLinkActive="is-active"
                [routerLinkActiveOptions]="{
                  paths: 'exact',
                  queryParams: 'ignored',
                  fragment: 'ignored',
                  matrixParams: 'ignored',
                }"
                ariaCurrentWhenActive="page"
                class="rail-current"
                ><svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M4 5h16v15H4zM4 10h16M8 3v4M16 3v4M8 14h3M8 17h6"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                </svg>
                Agenda e fila</a
              >
            </nav>
          </div>
          <div class="rail-note">
            <p>Recepção</p>
            <small
              >Acompanhe a agenda e registre as chegadas. A fila inclui
              pendências de dias anteriores.</small
            >
          </div>
        </div>
        <div class="rail-session">
          <p class="rail-label">RECEPÇÃO</p>
          <app-session-actions />
        </div>
      </header>
      <div class="reception-content" #workspaceContent>
        <router-outlet (activate)="onActivate()" />
      </div>
    </div>
  `,
})
export class ReceptionShellComponent {
  private readonly content =
    viewChild<ElementRef<HTMLElement>>("workspaceContent");
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  protected onActivate(): void {
    afterNextRender(
      () => {
        this.content()
          ?.nativeElement.querySelector("main")
          ?.focus({ preventScroll: true });
        this.document.defaultView?.scrollTo({ top: 0, behavior: "instant" });
      },
      { injector: this.injector },
    );
  }
}
