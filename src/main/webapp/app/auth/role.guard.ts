import { inject } from "@angular/core";
import { CanActivateFn, RedirectFunction, Router } from "@angular/router";
import Keycloak from "keycloak-js";
import { AuthGuardData, createAuthGuard } from "keycloak-angular";

export type MedflowRole =
  "PATIENT" | "RECEPTIONIST" | "DOCTOR" | "ADMINISTRATOR";

const navigationOrder: readonly MedflowRole[] = [
  "PATIENT",
  "RECEPTIONIST",
  "DOCTOR",
  "ADMINISTRATOR",
];

const routeByRole: Readonly<Record<MedflowRole, string>> = {
  PATIENT: "/workspace/patient",
  RECEPTIONIST: "/workspace/reception",
  DOCTOR: "/workspace/doctor",
  ADMINISTRATOR: "/workspace/administrator",
};

function hasRole(authData: AuthGuardData, requiredRole: MedflowRole): boolean {
  return (
    authData.grantedRoles.realmRoles.includes(requiredRole) ||
    Object.values(authData.grantedRoles.resourceRoles).some((roles) =>
      roles.includes(requiredRole),
    )
  );
}

function rolesFrom(keycloak: Keycloak): MedflowRole[] {
  return navigationOrder.filter(
    (role) =>
      keycloak.realmAccess?.roles?.includes(role) ||
      Object.values(keycloak.resourceAccess ?? {}).some((resource) =>
        resource.roles?.includes(role),
      ),
  );
}

/** Usa os claims já gerenciados pelo keycloak-angular somente para orientação de navegação. */
export const defaultWorkspaceRedirect: RedirectFunction = () => {
  const router = inject(Router);
  const keycloak = inject(Keycloak);
  if (!keycloak.authenticated) return router.parseUrl("/access-denied");

  const firstRole = rolesFrom(keycloak)[0];

  return router.parseUrl(firstRole ? routeByRole[firstRole] : "/access-denied");
};

/** O frontend limita a navegação; o backend permanece a autoridade de autorização. */
export function requireRole(requiredRole: MedflowRole): CanActivateFn {
  return createAuthGuard<CanActivateFn>(async (_route, _state, authData) => {
    if (authData.authenticated && hasRole(authData, requiredRole)) return true;

    return inject(Router).parseUrl("/access-denied");
  });
}
