import { TestBed } from "@angular/core/testing";
import Keycloak from "keycloak-js";

import { SessionActionsComponent } from "./session-actions.component";

describe("SessionActionsComponent", () => {
  it("shows the authenticated name and delegates logout to Keycloak", () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [SessionActionsComponent],
      providers: [
        {
          provide: Keycloak,
          useValue: {
            tokenParsed: {
              name: "Marina Alves",
              preferred_username: "paciente",
            },
            logout,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionActionsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Marina Alves");
    fixture.nativeElement.querySelector("button").click();
    expect(logout).toHaveBeenCalledWith({
      redirectUri: `${window.location.origin}/`,
    });
  });
});
