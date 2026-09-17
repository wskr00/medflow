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

interface KeycloakRoleFixture {
  readonly medflowApiRoles?: string[];
  readonly realmRoles?: string[];
  readonly otherClientRoles?: string[];
  readonly authenticated?: boolean;
}

function keycloakWithRoles({
  medflowApiRoles = [],
  realmRoles = [],
  otherClientRoles = [],
  authenticated = true,
}: KeycloakRoleFixture): Keycloak {
  return {
    authenticated,
    realmAccess: { roles: realmRoles },
    resourceAccess: {
      "medflow-api": { roles: medflowApiRoles },
      "medflow-web": { roles: otherClientRoles },
    },
  } as unknown as Keycloak;
}

describe("MedFlow role routing", () => {
  it("allows a directly requested area only for the corresponding Keycloak role", async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Keycloak,
          useValue: keycloakWithRoles({ medflowApiRoles: ["DOCTOR"] }),
        },
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
        {
          provide: Keycloak,
          useValue: keycloakWithRoles({ medflowApiRoles: ["PATIENT"] }),
        },
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

  it("routes a doctor to the dedicated clinical journey", async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Keycloak,
          useValue: keycloakWithRoles({
            medflowApiRoles: ["ADMINISTRATOR", "DOCTOR"],
          }),
        },
      ],
    }).compileComponents();

    const redirect = TestBed.runInInjectionContext(() =>
      defaultWorkspaceRedirect({} as never),
    );

    expect(TestBed.inject(Router).serializeUrl(redirect as UrlTree)).toBe(
      "/workspace/doctor/triagem",
    );
  });

  it("routes an administrator to the dedicated configuration journey", async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Keycloak,
          useValue: keycloakWithRoles({ medflowApiRoles: ["ADMINISTRATOR"] }),
        },
      ],
    }).compileComponents();
    const redirect = TestBed.runInInjectionContext(() =>
      defaultWorkspaceRedirect({} as never),
    );
    expect(TestBed.inject(Router).serializeUrl(redirect as UrlTree)).toBe(
      "/workspace/admin/estrutura",
    );
  });

  it("routes a patient directly to appointments instead of the workspace root", async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Keycloak,
          useValue: keycloakWithRoles({ medflowApiRoles: ["PATIENT"] }),
        },
      ],
    }).compileComponents();

    const redirect = TestBed.runInInjectionContext(() =>
      defaultWorkspaceRedirect({} as never),
    );

    expect(TestBed.inject(Router).serializeUrl(redirect as UrlTree)).toBe(
      "/workspace/patient/consultas",
    );
  });

  it("does not choose a workspace area for an unauthenticated Keycloak session", async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Keycloak,
          useValue: keycloakWithRoles({
            medflowApiRoles: ["PATIENT"],
            authenticated: false,
          }),
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

  it("does not authorize an isolated realm role", async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Keycloak,
          useValue: keycloakWithRoles({ realmRoles: ["DOCTOR"] }),
        },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      requireRole("DOCTOR")(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      "/access-denied",
    );
  });

  it("does not authorize a role granted by another client", async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Keycloak,
          useValue: keycloakWithRoles({ otherClientRoles: ["DOCTOR"] }),
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
