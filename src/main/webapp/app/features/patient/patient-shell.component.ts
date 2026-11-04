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
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { SessionActionsComponent } from "../../shared/ui/session-actions.component";
import { MedflowBrandComponent } from "../../shared/ui/medflow-brand.component";

@Component({
  selector: "app-patient-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    SessionActionsComponent,
    MedflowBrandComponent,
  ],
  styleUrl: "./patient-shell.component.scss",
  template: `
    <a href="#patient-main" class="skip-link">Pular para o conteúdo</a>
    <header class="patient-header">
      <div class="header-top">
        <a routerLink="consultas"><app-medflow-brand /></a
        ><span class="area-label">ESPAÇO DO PACIENTE</span
        ><app-session-actions />
      </div>
      <nav aria-label="Consultas">
        <a
          routerLink="consultas"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          >Consultas</a
        >
        <a
          routerLink="agendar"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          >Agendar consulta</a
        >
        <a
          routerLink="historico"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          >Histórico</a
        >
      </nav>
    </header>
    <main id="patient-main" #content tabindex="-1">
      <router-outlet (activate)="activate()" />
    </main>
  `,
})
export class PatientShellComponent {
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
