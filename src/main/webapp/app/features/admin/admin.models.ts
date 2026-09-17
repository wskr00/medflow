export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
}
export interface NamedResource {
  readonly id: string;
  readonly nome: string;
}
export interface Versioned {
  readonly id: string;
  readonly version: number;
  readonly ativo: boolean;
}
export interface Clinic extends Versioned {
  readonly nome: string;
  readonly timeZone: string;
}
export interface Unit extends Versioned {
  readonly nome: string;
  readonly endereco: string;
}
export interface Room extends Versioned {
  readonly unidadeId: string;
  readonly nome: string;
}
export interface Specialty extends Versioned {
  readonly nome: string;
}
export interface Professional extends Versioned {
  readonly nome: string;
  readonly crmNumero: string;
  readonly crmUf: string;
  readonly especialidadeIds: readonly string[];
}
export interface ScheduleRule extends Versioned {
  readonly medico: NamedResource;
  readonly especialidade: NamedResource;
  readonly unidade: NamedResource;
  readonly consultorio: NamedResource;
  readonly diaSemana: number;
  readonly horaInicio: string;
  readonly horaFim: string;
  readonly duracaoMinutos: number;
  readonly vigenteDe: string;
  readonly vigenteAte: string | null;
}
export interface ScheduleBlock extends Versioned {
  readonly medico: NamedResource;
  readonly inicio: string;
  readonly fim: string;
}
export interface AdminIssue {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly conflict: boolean;
  readonly fields: Readonly<Record<string, string>>;
}
