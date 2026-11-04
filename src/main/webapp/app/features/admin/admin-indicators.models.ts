export interface IndicatorFilters {
  readonly inicio: string;
  readonly fim: string;
  readonly unidadeId: string;
  readonly especialidadeId: string;
}
export interface IndicatorStates {
  readonly totalConsultas: number;
  readonly agendadas: number;
  readonly emEspera: number;
  readonly emAtendimento: number;
  readonly finalizadas: number;
  readonly canceladas: number;
}
export interface ScheduledDay extends IndicatorStates {
  readonly data: string;
}
export interface ScheduledDimension extends IndicatorStates {
  readonly id: string;
  readonly nome: string;
}
export interface FinalizationDay {
  readonly data: string;
  readonly totalFinalizadas: number;
}
export interface FinalizationDimension {
  readonly id: string;
  readonly nome: string;
  readonly totalFinalizadas: number;
}
export interface AdminIndicatorsResponse {
  readonly inicio: string;
  readonly fim: string;
  readonly timeZone: string;
  readonly consultasPorDataAgendada: IndicatorStates & {
    readonly porDia: readonly ScheduledDay[];
    readonly porUnidade: readonly ScheduledDimension[];
    readonly porEspecialidade: readonly ScheduledDimension[];
  };
  readonly finalizacoesPorDataReal: {
    readonly totalFinalizadas: number;
    readonly porDia: readonly FinalizationDay[];
    readonly porUnidade: readonly FinalizationDimension[];
    readonly porEspecialidade: readonly FinalizationDimension[];
  };
}
export interface IndicatorDimension {
  readonly id: string;
  readonly nome: string;
  readonly quantidade: number;
  readonly estados?: IndicatorStates;
}
