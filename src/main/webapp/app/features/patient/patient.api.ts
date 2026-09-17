import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { authConfig } from "../../auth/auth-config";
import { Appointment, PatientIssue } from "./patient.models";

function endpoint(
  path: string,
  params: Record<string, string | number | undefined> = {},
): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params))
    if (value !== undefined && value !== "") query.set(name, `${value}`);
  return `${authConfig.apiBaseUrl}${path}${query.size ? `?${query}` : ""}`;
}

export function patientIssue(error: unknown): PatientIssue {
  const response = error as HttpErrorResponse;
  const code =
    response?.error?.code ??
    {
      0: "FALHA_DE_REDE",
      401: "NAO_AUTENTICADO",
      403: "ACESSO_NEGADO",
      404: "RECURSO_NAO_ENCONTRADO",
    }[response?.status] ??
    "ERRO_INTERNO";
  const copy: Record<string, readonly [string, string]> = {
    HORARIO_INDISPONIVEL: [
      "Horário indisponível",
      "Este horário acabou de ser ocupado. Escolha outro.",
    ],
    VERSAO_DESATUALIZADA: [
      "Consulta atualizada",
      "A consulta mudou antes da confirmação. Atualize para continuar.",
    ],
    TRANSICAO_INVALIDA: [
      "Ação não disponível",
      "A situação da consulta mudou. Atualize a lista.",
    ],
    RECURSO_NAO_ENCONTRADO: [
      "Consulta não encontrada",
      "Esta consulta não está disponível para reagendamento. Volte para suas consultas.",
    ],
    NAO_AUTENTICADO: ["Sessão expirada", "Entre novamente para continuar."],
    FALHA_DE_REDE: [
      "Falha de conexão",
      "Não foi possível alcançar o serviço. Tente novamente.",
    ],
  };
  const [title, description] = copy[code] ?? [
    "Não foi possível concluir",
    "Tente novamente em alguns instantes.",
  ];
  return { code, title, description, conflict: response?.status === 409 };
}

@Injectable()
export class PatientApi {
  private readonly http = inject(HttpClient);
  appointments(recorte: "UPCOMING" | "PAST" | "CANCELLED", q?: string) {
    return endpoint("/me/agendamentos", { recorte, q, page: 0, size: 20 });
  }
  appointment(id: string) {
    return endpoint(`/agendamentos/${id}`);
  }
  availability(
    data: string,
    unidadeId: string,
    especialidadeId: string,
    medicoId: string,
  ) {
    return endpoint("/disponibilidades", {
      data,
      unidadeId,
      especialidadeId,
      medicoId,
    });
  }
  availableDates(
    dataDe: string,
    dataAte: string,
    unidadeId: string,
    especialidadeId: string,
    medicoId: string,
  ) {
    return endpoint("/disponibilidades/datas", {
      dataDe,
      dataAte,
      unidadeId,
      especialidadeId,
      medicoId,
    });
  }
  rescheduleAvailability(id: string, data: string) {
    return endpoint(`/agendamentos/${id}/disponibilidades`, { data });
  }
  catalog(name: "unidades" | "especialidades" | "medicos") {
    return endpoint(`/${name}`, { page: 0, size: 100 });
  }
  create(regraAgendaId: string, inicio: string): Observable<Appointment> {
    return this.http.post<Appointment>(endpoint("/agendamentos"), {
      regraAgendaId,
      inicio,
    });
  }
  reschedule(
    id: string,
    regraAgendaId: string,
    inicio: string,
    expectedVersion: number,
  ): Observable<Appointment> {
    return this.http.post<Appointment>(
      endpoint(`/agendamentos/${id}/reagendamento`),
      { regraAgendaId, inicio, expectedVersion },
    );
  }
  cancel(id: string, expectedVersion: number): Observable<Appointment> {
    return this.http.post<Appointment>(
      endpoint(`/agendamentos/${id}/cancelamento`),
      { expectedVersion },
    );
  }
}
