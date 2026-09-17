export interface NamedResource {
  readonly id: string;
  readonly nome: string;
}
export interface Doctor extends NamedResource {
  readonly especialidadeIds: readonly string[];
}
export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
}
export interface Slot {
  readonly regraAgendaId: string;
  readonly inicio: string;
  readonly fim: string;
  readonly medico: NamedResource;
  readonly especialidade: NamedResource;
  readonly unidade: NamedResource;
  readonly consultorio: NamedResource;
}
export interface Availability {
  readonly items: readonly Slot[];
  readonly timeZone: string;
}
export interface AvailableDates {
  readonly items: readonly string[];
  readonly timeZone: string;
}
export interface Appointment {
  readonly id: string;
  readonly version: number;
  readonly inicio: string;
  readonly fim: string;
  readonly status:
    "AGENDADA" | "EM_ESPERA" | "EM_ATENDIMENTO" | "FINALIZADA" | "CANCELADA";
  readonly medico: NamedResource;
  readonly especialidade: NamedResource;
  readonly unidade: NamedResource;
  readonly consultorio: NamedResource;
  readonly allowedActions: {
    readonly canReschedule: boolean;
    readonly canCancel: boolean;
  };
}
export type PatientIssue = {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly conflict: boolean;
};
