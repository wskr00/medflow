import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  viewChild,
} from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { AdminNavComponent } from "./admin-nav.component";
import { SessionActionsComponent } from "../../shared/ui/session-actions.component";
import { MedflowBrandComponent } from "../../shared/ui/medflow-brand.component";

@Component({
  selector: "app-admin-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterOutlet,
    AdminNavComponent,
    SessionActionsComponent,
    MedflowBrandComponent,
  ],
  styleUrl: "./admin-shell.component.scss",
  template: `
    <a href="#admin-main" class="skip-link">Pular para o conteúdo</a>
    <div class="admin-workspace">
      <header class="admin-rail">
        <a routerLink="estrutura" class="brand"><app-medflow-brand /></a>
        <div class="admin-navigation">
          <p class="rail-label">ADMINISTRAÇÃO</p>
          <app-admin-nav />
        </div>
        <div class="admin-session"><app-session-actions /></div>
      </header>
      <div class="admin-content">
        <div class="workspace-context">
          <span>Configuração da clínica</span><span>Administração</span>
        </div>
        <main id="admin-main" #content tabindex="-1">
          <router-outlet (activate)="activate()" />
        </main>
      </div>
    </div>
  `,
})
export class AdminShellComponent {
  private readonly content = viewChild<ElementRef<HTMLElement>>("content");
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  protected activate() {
    afterNextRender(
      () => {
        this.content()?.nativeElement.focus({ preventScroll: true });
        this.document.defaultView?.scrollTo({ top: 0, behavior: "instant" });
      },
      { injector: this.injector },
    );
  }
}
