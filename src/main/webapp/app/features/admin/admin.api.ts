import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { authConfig } from "../../auth/auth-config";
import {
  AdminIssue,
  Clinic,
  Page,
  Professional,
  Room,
  ScheduleBlock,
  ScheduleRule,
  Specialty,
  Unit,
} from "./admin.models";

function endpoint(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== "") query.set(key, `${value}`);
  return `${authConfig.apiBaseUrl}${path}${query.size ? `?${query}` : ""}`;
}
export function adminIssue(error: unknown): AdminIssue {
  const response = error as HttpErrorResponse;
  const code =
    response?.error?.code ??
    { 0: "FALHA_DE_REDE", 404: "RECURSO_NAO_ENCONTRADO" }[response?.status] ??
    "ERRO_INTERNO";
  const copy: Record<string, readonly [string, string]> = {
    VERSAO_DESATUALIZADA: [
      "Configuração alterada",
      "O formulário foi preservado. Recarregue os dados para comparar a versão atual.",
    ],
    CONFLITO_DE_RESERVAS: [
      "Alteração bloqueada por reservas",
      "A configuração não foi alterada e nenhuma reserva foi cancelada automaticamente.",
    ],
    RECURSO_NAO_ENCONTRADO: [
      "Configuração não encontrada",
      "Ela pode não estar mais disponível neste contexto.",
    ],
    FALHA_DE_REDE: [
      "Falha de conexão",
      "O formulário continua aberto. Verifique a conexão e tente novamente.",
    ],
  };
  const [title, description] = copy[code] ?? [
    "Não foi possível salvar",
    "Revise os campos informados e tente novamente.",
  ];
  const fields = Object.fromEntries(
    (response?.error?.fieldErrors ?? []).map(
      (field: { field: string; message: string }) => [
        field.field,
        field.message,
      ],
    ),
  );
  return {
    code,
    title,
    description,
    conflict: response?.status === 409,
    fields,
  };
}

@Injectable()
export class AdminApi {
  private readonly http = inject(HttpClient);
  clinic() {
    return endpoint("/clinica");
  }
  list(
    resource: "unidades" | "consultorios" | "especialidades" | "medicos",
    params: Record<string, string | number | boolean | undefined> = {},
  ) {
    return endpoint(`/${resource}`, {
      incluirInativas: true,
      page: 0,
      size: 100,
      ...params,
    });
  }
  rules(params: Record<string, string | number | boolean | undefined> = {}) {
    return endpoint("/regras-agenda", {
      incluirInativas: true,
      page: 0,
      size: 100,
      ...params,
    });
  }
  blocks(params: Record<string, string | number | boolean | undefined> = {}) {
    return endpoint("/bloqueios-agenda", {
      incluirInativas: true,
      page: 0,
      size: 100,
      ...params,
    });
  }
  putClinic(payload: Omit<Clinic, "id">): Observable<Clinic> {
    const { version, ...clinic } = payload;
    return this.http.put<Clinic>(this.clinic(), {
      ...clinic,
      expectedVersion: version,
    });
  }
  create<T>(resource: string, payload: object): Observable<T> {
    return this.http.post<T>(endpoint(`/${resource}`), payload);
  }
  update<T>(resource: string, id: string, payload: object): Observable<T> {
    return this.http.put<T>(endpoint(`/${resource}/${id}`), payload);
  }
  unit(id: string) {
    return endpoint(`/unidades/${id}`);
  }
  room(id: string) {
    return endpoint(`/consultorios/${id}`);
  }
  specialty(id: string) {
    return endpoint(`/especialidades/${id}`);
  }
  professional(id: string) {
    return endpoint(`/medicos/${id}`);
  }
  rule(id: string) {
    return endpoint(`/regras-agenda/${id}`);
  }
  block(id: string) {
    return endpoint(`/bloqueios-agenda/${id}`);
  }
}
