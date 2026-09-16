import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import Keycloak from "keycloak-js";

import { IdentityService, MedflowIdentity } from "../../auth/identity.service";
import { WorkspaceShellComponent } from "./workspace-shell.component";

function resolvedIdentityResource(identity: MedflowIdentity) {
  return {
    value: signal(identity),
    error: signal(undefined),
    isLoading: signal(false),
    hasValue: () => true,
    reload: () => true,
  };
}

describe("WorkspaceShellComponent", () => {
  it("offers a skip link and moves focus to main content after route activation", async () => {
    await TestBed.configureTestingModule({
      imports: [WorkspaceShellComponent],
      providers: [
        provideRouter([]),
        { provide: Keycloak, useValue: { logout: () => Promise.resolve() } },
        {
          provide: IdentityService,
          useValue: {
            identity: resolvedIdentityResource({
              subject: "synthetic-patient",
              roles: ["PATIENT"],
              pacienteId: "patient-1",
              medicoId: null,
              clinicaId: "clinic-1",
              timeZone: "America/Belem",
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkspaceShellComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const main = host.querySelector<HTMLElement>("#main-content");

    expect(
      host.querySelector('a[href="#main-content"]')?.textContent,
    ).toContain("Pular para o conteúdo");
    fixture.componentInstance["focusMainContent"]();
    expect(document.activeElement).toBe(main);
  });
});
