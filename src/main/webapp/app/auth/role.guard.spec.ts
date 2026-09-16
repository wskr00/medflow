import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import Keycloak from "keycloak-js";

import { defaultWorkspaceRedirect, requireRole } from "./role.guard";

function keycloakWithRoles(roles: string[], authenticated = true): Keycloak {
  return {
    authenticated,
    realmAccess: { roles },
    resourceAccess: { "medflow-api": { roles } },
  } as unknown as Keycloak;
}

describe("MedFlow role routing", () => {
  it("allows a directly requested area only for the corresponding Keycloak role", async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Keycloak, useValue: keycloakWithRoles(["DOCTOR"]) },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      requireRole("DOCTOR")(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

    expect(result).toBe(true);
  });

  it("redirects a direct route without the required role to access denied", async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Keycloak, useValue: keycloakWithRoles(["PATIENT"]) },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      requireRole("ADMINISTRATOR")(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe("/access-denied");
  });

  it("chooses the first available area by the explicit multi-role navigation order", async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Keycloak,
          useValue: keycloakWithRoles(["ADMINISTRATOR", "DOCTOR"]),
        },
      ],
    }).compileComponents();

    const redirect = TestBed.runInInjectionContext(() =>
      defaultWorkspaceRedirect({} as never),
    );

    expect(TestBed.inject(Router).serializeUrl(redirect as UrlTree)).toBe(
      "/workspace/doctor",
    );
  });

  it("does not choose a workspace area for an unauthenticated Keycloak session", async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Keycloak,
          useValue: keycloakWithRoles(["PATIENT"], false),
        },
      ],
    }).compileComponents();

    const redirect = TestBed.runInInjectionContext(() =>
      defaultWorkspaceRedirect({} as never),
    );

    expect(TestBed.inject(Router).serializeUrl(redirect as UrlTree)).toBe(
      "/access-denied",
    );
  });
});
