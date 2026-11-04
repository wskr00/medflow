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
  selector: "app-doctor-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    SessionActionsComponent,
    MedflowBrandComponent,
  ],
  styleUrl: "./doctor-shell.component.scss",
  template: `
    <a href="#doctor-main" class="skip-link">Pular para o conteúdo</a>
    <header class="medical-header">
      <a routerLink="triagem"><app-medflow-brand /></a
      ><span class="workspace-label">Área médica</span>
      <nav aria-label="Jornada médica">
        <a
          routerLink="triagem"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          >Minha agenda</a
        >
        <a
          routerLink="indicadores"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          >Minha atividade</a
        >
      </nav>
      <app-session-actions />
    </header>
    <main id="doctor-main" #content tabindex="-1">
      <router-outlet (activate)="activate()" />
    </main>
  `,
})
export class DoctorShellComponent {
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
