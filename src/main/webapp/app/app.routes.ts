import { Routes } from "@angular/router";

import { defaultWorkspaceRedirect, requireRole } from "./auth/role.guard";

export const routes: Routes = [
  {
    path: "workspace",
    loadComponent: () =>
      import("./core/layout/workspace-shell.component").then(
        (m) => m.WorkspaceShellComponent,
      ),
    children: [
      {
        path: "",
        pathMatch: "full",
        redirectTo: defaultWorkspaceRedirect,
      },
      {
        path: "patient",
        data: { profile: "patient" },
        canActivate: [requireRole("PATIENT")],
        loadComponent: () =>
          import("./features/foundation/profile-foundation.component").then(
            (m) => m.ProfileFoundationComponent,
          ),
      },
      {
        path: "reception",
        data: { profile: "reception" },
        canActivate: [requireRole("RECEPTIONIST")],
        loadComponent: () =>
          import("./features/foundation/profile-foundation.component").then(
            (m) => m.ProfileFoundationComponent,
          ),
      },
      {
        path: "doctor",
        data: { profile: "doctor" },
        canActivate: [requireRole("DOCTOR")],
        loadComponent: () =>
          import("./features/foundation/profile-foundation.component").then(
            (m) => m.ProfileFoundationComponent,
          ),
      },
      {
        path: "administrator",
        data: { profile: "administrator" },
        canActivate: [requireRole("ADMINISTRATOR")],
        loadComponent: () =>
          import("./features/foundation/profile-foundation.component").then(
            (m) => m.ProfileFoundationComponent,
          ),
      },
      {
        path: "reference-form",
        loadComponent: () =>
          import("./features/reference-form/reference-form.component").then(
            (m) => m.ReferenceFormComponent,
          ),
      },
    ],
  },
  {
    path: "access-denied",
    loadComponent: () =>
      import("./features/access-denied/access-denied.component").then(
        (m) => m.AccessDeniedComponent,
      ),
  },
  { path: "", pathMatch: "full", redirectTo: "workspace" },
  {
    path: "**",
    loadComponent: () =>
      import("./features/not-found/not-found.component").then(
        (m) => m.NotFoundComponent,
      ),
  },
];
