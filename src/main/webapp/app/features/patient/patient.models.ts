export interface NamedResource {
  readonly id: string;
  readonly nome: string;
}

export interface DoctorCatalogResource extends NamedResource {
  readonly especialidadeIds: readonly string[];
}

export interface PageResponse<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
}

export interface AvailabilitySlot {
  readonly regraAgendaId: string;
  readonly medicoId: string;
  readonly especialidadeId: string;
  readonly consultorioId: string;
  readonly inicio: string;
  readonly fim: string;
  readonly medico: NamedResource;
  readonly especialidade: NamedResource;
  readonly unidade: NamedResource;
  readonly consultorio: NamedResource;
}

export interface AvailabilityResponse {
  readonly items: readonly AvailabilitySlot[];
  readonly timeZone: string;
}

export type AppointmentStatus =
  | "AGENDADA"
  | "EM_ESPERA"
  | "EM_ATENDIMENTO"
  | "FINALIZADA"
  | "CANCELADA";

export interface PatientAppointment {
  readonly id: string;
  readonly version: number;
  readonly inicio: string;
  readonly fim: string;
  readonly status: AppointmentStatus;
  readonly checkInEm: string | null;
  readonly medico: NamedResource;
  readonly especialidade: NamedResource;
  readonly unidade: NamedResource;
  readonly consultorio: NamedResource;
}

/** Histórico do paciente nunca inclui campos do registro clínico. */
export interface PatientHistoryItem {
  readonly id: string;
  readonly inicio: string;
  readonly fim: string;
  readonly status: "FINALIZADA";
  readonly medico: NamedResource;
  readonly especialidade: NamedResource;
  readonly unidade: NamedResource;
  readonly consultorio: NamedResource;
}

export interface AvailabilityQuery {
  readonly data: string;
  readonly unidadeId: string;
  readonly especialidadeId: string;
  readonly medicoId?: string;
}

export interface ApiErrorBody {
  readonly status?: number;
  readonly code?: string;
  readonly message?: string;
  readonly requestId?: string;
  readonly fieldErrors?: readonly {
    readonly field: string;
    readonly code: string;
    readonly message: string;
  }[];
}

export interface PatientApiIssue {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly isConflict: boolean;
}

export interface CatalogState<T> {
  readonly items: readonly T[];
  readonly loading: boolean;
  readonly error: unknown | null;
}

export interface PatientFeedback {
  readonly kind: "success" | "error" | "conflict";
  readonly title: string;
  readonly description: string;
}
