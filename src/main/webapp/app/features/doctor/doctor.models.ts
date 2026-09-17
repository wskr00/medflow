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

export interface DoctorAllowedActions {
  readonly canStart: boolean;
  readonly canResume: boolean;
}

export interface DoctorAppointment {
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
  readonly paciente: NamedResource;
  readonly atendimentoId: string | null;
  readonly allowedActions: DoctorAllowedActions;
}

export interface ClinicalRecord {
  readonly queixaPrincipal: string;
  readonly resumoAnamnese: string;
  readonly conduta: string;
  readonly observacoes: string;
}

export interface CareSession {
  readonly id: string;
  readonly agendamentoId: string;
  readonly version: number;
  readonly iniciadoEm: string;
  readonly finalizadoEm: string | null;
  readonly registroClinico: ClinicalRecord;
}

export interface DoctorWorkspace {
  readonly agendamento: DoctorAppointment;
  readonly atendimento: CareSession;
}

export interface DoctorIssue {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly conflict: boolean;
}
