import { HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { authConfig } from "../../auth/auth-config";
import { DoctorPeriod } from "./doctor-indicators.models";

@Injectable()
export class DoctorIndicatorsApi {
  url(period: DoctorPeriod) {
    return `${authConfig.apiBaseUrl}/medico/indicadores?${new URLSearchParams({ inicio: period.inicio, fim: period.fim })}`;
  }
}
export function doctorIndicatorsIssue(error: unknown) {
  const status = (error as HttpErrorResponse)?.status;
  if (status === 401)
    return {
      title: "Sessão expirada",
      description: "Entre novamente para consultar sua atividade.",
      session: true,
      context: false,
    };
  if (status === 403)
    return {
      title: "Acesso à atividade não permitido",
      description:
        "Sua sessão precisa de um vínculo médico ativo para consultar estes indicadores.",
      session: true,
      context: false,
    };
  if (status === 404)
    return {
      title: "Contexto da atividade indisponível",
      description:
        "Não foi possível localizar seu contexto de acesso. Recarregue a identidade ou entre novamente.",
      session: true,
      context: true,
    };
  return {
    title: "Não foi possível carregar sua atividade",
    description:
      "Confira sua conexão e tente novamente. O período selecionado foi preservado.",
    session: false,
    context: false,
  };
}
