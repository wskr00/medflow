import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { authConfig } from "../../auth/auth-config";
import {
  ClinicalRecord,
  DoctorIssue,
  DoctorWorkspace,
  Page,
  DoctorAppointment,
} from "./doctor.models";

function endpoint(
  path: string,
  params: Record<string, string | number | undefined> = {},
): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params))
    if (value !== undefined && value !== "") query.set(name, `${value}`);
  return `${authConfig.apiBaseUrl}${path}${query.size ? `?${query}` : ""}`;
}

export function doctorIssue(error: unknown): DoctorIssue {
  const response = error as HttpErrorResponse;
  const code =
    response?.error?.code ??
    { 0: "FALHA_DE_REDE", 404: "RECURSO_NAO_ENCONTRADO" }[response?.status] ??
    "ERRO_INTERNO";
  const copy: Record<string, readonly [string, string]> = {
    VERSAO_DESATUALIZADA: [
      "Registro atualizado em outro acesso",
      "Seu texto local continua nesta tela. Recarregue para comparar a versão persistida antes de salvar novamente.",
    ],
    TRANSICAO_INVALIDA: [
      "Ação não disponível",
      "A situação da consulta mudou. Atualize a agenda para continuar.",
    ],
    RECURSO_NAO_ENCONTRADO: [
      "Atendimento não encontrado",
      "Esta consulta pode não estar mais disponível para você.",
    ],
    FALHA_DE_REDE: [
      "Falha de conexão",
      "O texto permanece nesta tela. Verifique sua conexão e tente salvar novamente.",
    ],
  };
  const [title, description] = copy[code] ?? [
    "Não foi possível concluir",
    "O texto continua nesta tela. Tente novamente em alguns instantes.",
  ];
  return { code, title, description, conflict: response?.status === 409 };
}

@Injectable()
export class DoctorApi {
  private readonly http = inject(HttpClient);
  agenda(params: Record<string, string | number | undefined>) {
    return endpoint("/medico/agenda", params);
  }
  queue(params: Record<string, string | number | undefined>) {
    return endpoint("/medico/fila", params);
  }
  workspace(id: string) {
    return endpoint(`/atendimentos/${id}`);
  }
  history(patientId: string) {
    return endpoint(`/medico/pacientes/${patientId}/historico`, {
      page: 0,
      size: 20,
    });
  }
  start(
    appointmentId: string,
    expectedVersion: number,
  ): Observable<DoctorWorkspace> {
    return this.http.post<DoctorWorkspace>(
      endpoint(`/agendamentos/${appointmentId}/atendimento`),
      { expectedVersion },
    );
  }
  save(
    id: string,
    expectedVersion: number,
    registroClinico: ClinicalRecord,
  ): Observable<DoctorWorkspace> {
    return this.http.put<DoctorWorkspace>(
      endpoint(`/atendimentos/${id}/registro-clinico`),
      { expectedVersion, ...registroClinico },
    );
  }
  finish(id: string, expectedVersion: number): Observable<DoctorWorkspace> {
    return this.http.post<DoctorWorkspace>(
      endpoint(`/atendimentos/${id}/finalizacao`),
      { expectedVersion },
    );
  }
}
