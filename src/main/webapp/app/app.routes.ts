import { Routes } from "@angular/router";

import { defaultWorkspaceRedirect, requireRole } from "./auth/role.guard";
import { preventDoctorCareLoss } from "./features/doctor/doctor-care.guard";
import { preventAdminConfigurationLoss } from "./features/admin/admin-dirty.guard";

export const routes: Routes = [
  {
    path: "workspace",
    pathMatch: "full",
    redirectTo: defaultWorkspaceRedirect,
  },
  {
    path: "workspace/patient",
    canActivate: [requireRole("PATIENT")],
    loadComponent: () =>
      import("./features/patient/patient-shell.component").then(
        (m) => m.PatientShellComponent,
      ),
    children: [
      { path: "", pathMatch: "full", redirectTo: "consultas" },
      {
        path: "consultas",
        title: "Consultas | MedFlow",
        loadComponent: () =>
          import("./features/patient/patient-appointments.component").then(
            (m) => m.PatientAppointmentsComponent,
          ),
      },
      {
        path: "agendar",
        title: "Agendar consulta | MedFlow",
        loadComponent: () =>
          import("./features/patient/patient-booking.component").then(
            (m) => m.PatientBookingComponent,
          ),
      },
      {
        path: "historico",
        title: "Histórico | MedFlow",
        loadComponent: () =>
          import("./features/patient/patient-history.component").then(
            (m) => m.PatientHistoryComponent,
          ),
      },
      {
        path: "consultas/:id/reagendar",
        title: "Reagendar consulta | MedFlow",
        loadComponent: () =>
          import("./features/patient/patient-reschedule.component").then(
            (m) => m.PatientRescheduleComponent,
          ),
      },
    ],
  },
  {
    path: "workspace/reception",
    canActivate: [requireRole("RECEPTIONIST")],
    loadComponent: () =>
      import("./features/reception/reception-shell.component").then(
        (m) => m.ReceptionShellComponent,
      ),
    children: [
      {
        path: "",
        title: "Operação da recepção | MedFlow",
        loadComponent: () =>
          import("./features/reception/reception-operation.component").then(
            (m) => m.ReceptionOperationComponent,
          ),
      },
      {
        path: "consultas/:id/reagendar",
        title: "Reagendar consulta | MedFlow",
        loadComponent: () =>
          import("./features/reception/reception-reschedule.component").then(
            (m) => m.ReceptionRescheduleComponent,
          ),
      },
    ],
  },
  {
    path: "workspace/doctor",
    canActivate: [requireRole("DOCTOR")],
    loadComponent: () =>
      import("./features/doctor/doctor-shell.component").then(
        (m) => m.DoctorShellComponent,
      ),
    children: [
      { path: "", pathMatch: "full", redirectTo: "triagem" },
      {
        path: "triagem",
        title: "Minha agenda | MedFlow",
        loadComponent: () =>
          import("./features/doctor/doctor-triage.component").then(
            (m) => m.DoctorTriageComponent,
          ),
      },
      {
        path: "atendimentos/:id",
        title: "Atendimento | MedFlow",
        canDeactivate: [preventDoctorCareLoss],
        loadComponent: () =>
          import("./features/doctor/doctor-care.component").then(
            (m) => m.DoctorCareComponent,
          ),
      },
    ],
  },
  {
    path: "workspace/admin",
    canActivate: [requireRole("ADMINISTRATOR")],
    loadComponent: () =>
      import("./features/admin/admin-shell.component").then(
        (m) => m.AdminShellComponent,
      ),
    children: [
      { path: "", pathMatch: "full", redirectTo: "estrutura" },
      {
        path: "clinica",
        title: "Clínica | MedFlow",
        canDeactivate: [preventAdminConfigurationLoss],
        loadComponent: () =>
          import("./features/admin/admin-clinic.component").then(
            (m) => m.AdminClinicComponent,
          ),
      },
      {
        path: "estrutura",
        title: "Estrutura | MedFlow",
        canDeactivate: [preventAdminConfigurationLoss],
        loadComponent: () =>
          import("./features/admin/admin-structure.component").then(
            (m) => m.AdminStructureComponent,
          ),
      },
      {
        path: "profissionais",
        title: "Profissionais | MedFlow",
        canDeactivate: [preventAdminConfigurationLoss],
        loadComponent: () =>
          import("./features/admin/admin-professionals.component").then(
            (m) => m.AdminProfessionalsComponent,
          ),
      },
      {
        path: "especialidades",
        title: "Especialidades | MedFlow",
        canDeactivate: [preventAdminConfigurationLoss],
        loadComponent: () =>
          import("./features/admin/admin-specialties.component").then(
            (m) => m.AdminSpecialtiesComponent,
          ),
      },
      {
        path: "agenda",
        title: "Agenda semanal | MedFlow",
        canDeactivate: [preventAdminConfigurationLoss],
        loadComponent: () =>
          import("./features/admin/admin-schedule.component").then(
            (m) => m.AdminScheduleComponent,
          ),
      },
      {
        path: "bloqueios",
        title: "Bloqueios | MedFlow",
        canDeactivate: [preventAdminConfigurationLoss],
        loadComponent: () =>
          import("./features/admin/admin-blocks.component").then(
            (m) => m.AdminBlocksComponent,
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
