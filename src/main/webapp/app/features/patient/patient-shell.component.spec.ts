import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import Keycloak from "keycloak-js";
import { describe, expect, it } from "vitest";
import { PatientShellComponent } from "./patient-shell.component";

describe("PatientShellComponent", () => {
  it("tem uma única marca e navegação própria, sem sidebar operacional", () => {
    TestBed.configureTestingModule({
      imports: [PatientShellComponent],
      providers: [
        provideRouter([]),
        {
          provide: Keycloak,
          useValue: {
            tokenParsed: { name: "Marina Alves" },
            logout: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PatientShellComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect((text.match(/MedFlow/g) ?? []).length).toBe(1);
    expect(text).toContain("Consultas");
    expect(text).toContain("Marina Alves");
    expect(text).toContain("Sair");
    expect(text).not.toContain("Operação clínica");
    expect(fixture.nativeElement.querySelector("main")?.className).toContain(
      "max-w-6xl",
    );
    expect(fixture.nativeElement.querySelector("main")?.className).toContain(
      "py-8",
    );
  });
});
