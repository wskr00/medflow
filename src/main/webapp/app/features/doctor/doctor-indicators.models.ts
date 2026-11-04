export interface DoctorPeriod {
  readonly inicio: string;
  readonly fim: string;
}
export interface DoctorIndicatorStates {
  readonly totalConsultas: number;
  readonly agendadas: number;
  readonly emEspera: number;
  readonly emAtendimento: number;
  readonly finalizadas: number;
  readonly canceladas: number;
}
export interface DoctorScheduledDay extends DoctorIndicatorStates {
  readonly data: string;
}
export interface DoctorFinalizationDay {
  readonly data: string;
  readonly totalFinalizadas: number;
  readonly duracaoMediaSegundos: number | null;
}
export interface DoctorIndicatorsReport extends DoctorPeriod {
  readonly timeZone: string;
  readonly consultasPorDataAgendada: DoctorIndicatorStates & {
    readonly porDia: readonly DoctorScheduledDay[];
  };
  readonly finalizacoesPorDataReal: {
    readonly totalFinalizadas: number;
    readonly duracaoMediaSegundos: number | null;
    readonly porDia: readonly DoctorFinalizationDay[];
  };
}
