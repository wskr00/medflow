import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { authConfig } from "../../auth/auth-config";
import { OperationalAppointment, ReceptionIssue } from "./reception.models";

function endpoint(path: string, params: Record<string, string | number | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(name, `${value}`);
  }
  return `${authConfig.apiBaseUrl}${path}${query.size ? `?${query}` : ""}`;
}

export function receptionIssue(error: unknown): ReceptionIssue {
  const response = error as HttpErrorResponse;
  const code = response?.error?.code ?? ({
    0: "FALHA_DE_REDE",
    401: "NAO_AUTENTICADO",
    403: "ACESSO_NEGADO",
    404: "RECURSO_NAO_ENCONTRADO",
  }[response?.status] ?? "ERRO_INTERNO");
  const copy: Record<string, readonly [string, string]> = {
    CHECKIN_JA_REALIZADO: ["Chegada já registrada", "A agenda e a fila serão atualizadas."],
    HORARIO_INDISPONIVEL: ["Horário indisponível", "Outro atendimento ocupou este horário. Escolha outro."],
    VERSAO_DESATUALIZADA: ["Consulta atualizada", "Outra pessoa alterou esta consulta. Atualize para continuar."],
    TRANSICAO_INVALIDA: ["Ação não disponível", "A situação da consulta mudou. Atualize a operação."],
    RECURSO_NAO_ENCONTRADO: ["Consulta não encontrada", "Ela não está mais disponível nesta operação."],
    FALHA_DE_REDE: ["Falha de conexão", "Não foi possível alcançar o serviço. Tente novamente."],
  };
  const [title, description] = copy[code] ?? ["Não foi possível concluir", "Tente novamente em alguns instantes."];
  return { code, title, description, conflict: response?.status === 409 };
}

@Injectable()
export class ReceptionApi {
  private readonly http = inject(HttpClient);

  agenda(params: Record<string, string | number | undefined>) {
    return endpoint("/recepcao/agenda", params);
  }

  queue(params: Record<string, string | number | undefined>) {
    return endpoint("/recepcao/fila", params);
  }

  catalog(name: "unidades" | "medicos") {
    return endpoint(`/${name}`, { page: 0, size: 100 });
  }

  appointment(id: string) {
    return endpoint(`/agendamentos/${id}`);
  }

  availability(id: string, data: string) {
    return endpoint(`/agendamentos/${id}/disponibilidades`, { data });
  }

  checkIn(id: string, expectedVersion: number): Observable<OperationalAppointment> {
    return this.http.post<OperationalAppointment>(endpoint(`/agendamentos/${id}/check-in`), { expectedVersion });
  }

  cancel(id: string, expectedVersion: number): Observable<OperationalAppointment> {
    return this.http.post<OperationalAppointment>(endpoint(`/agendamentos/${id}/cancelamento`), { expectedVersion });
  }

  reschedule(id: string, regraAgendaId: string, inicio: string, expectedVersion: number): Observable<OperationalAppointment> {
    return this.http.post<OperationalAppointment>(endpoint(`/agendamentos/${id}/reagendamento`), {
      regraAgendaId,
      inicio,
      expectedVersion,
    });
  }
}
