export interface NamedResource {
  readonly id: string;
  readonly nome: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
}

export interface AllowedActions {
  readonly canCheckIn: boolean;
  readonly canReschedule: boolean;
  readonly canCancel: boolean;
}

export interface OperationalAppointment {
  readonly id: string;
  readonly version: number;
  readonly inicio: string;
  readonly fim: string;
  readonly status: "AGENDADA" | "EM_ESPERA" | "EM_ATENDIMENTO" | "FINALIZADA" | "CANCELADA";
  readonly checkInEm: string | null;
  readonly medico: NamedResource;
  readonly especialidade: NamedResource;
  readonly unidade: NamedResource;
  readonly consultorio: NamedResource;
  readonly paciente: NamedResource;
  readonly pendenteDeDiaAnterior: boolean;
  readonly allowedActions: AllowedActions;
}

export interface Slot {
  readonly regraAgendaId: string;
  readonly inicio: string;
  readonly fim: string;
  readonly consultorio: NamedResource;
}

export interface Availability {
  readonly items: readonly Slot[];
  readonly timeZone: string;
}

export interface ReceptionIssue {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly conflict: boolean;
}
