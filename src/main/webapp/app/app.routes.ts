import { Routes } from "@angular/router";

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
        loadComponent: () =>
          import("./features/foundation/profile-redirect.component").then(
            (m) => m.ProfileRedirectComponent,
          ),
      },
      {
        path: "patient",
        data: { profile: "patient" },
        loadComponent: () =>
          import("./features/foundation/profile-foundation.component").then(
            (m) => m.ProfileFoundationComponent,
          ),
      },
      {
        path: "reception",
        data: { profile: "reception" },
        loadComponent: () =>
          import("./features/foundation/profile-foundation.component").then(
            (m) => m.ProfileFoundationComponent,
          ),
      },
      {
        path: "doctor",
        data: { profile: "doctor" },
        loadComponent: () =>
          import("./features/foundation/profile-foundation.component").then(
            (m) => m.ProfileFoundationComponent,
          ),
      },
      {
        path: "administrator",
        data: { profile: "administrator" },
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
  { path: "**", redirectTo: "workspace" },
];
