import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { EMPTY, expand, reduce } from "rxjs";
import { authConfig } from "../../auth/auth-config";
import { Page, Specialty, Unit } from "./admin.models";
import { IndicatorFilters } from "./admin-indicators.models";

@Injectable()
export class AdminIndicatorsApi {
  private readonly http = inject(HttpClient);
  url(filters: IndicatorFilters) {
    const query = new URLSearchParams({
      inicio: filters.inicio,
      fim: filters.fim,
    });
    if (filters.unidadeId) query.set("unidadeId", filters.unidadeId);
    if (filters.especialidadeId)
      query.set("especialidadeId", filters.especialidadeId);
    return `${authConfig.apiBaseUrl}/admin/indicadores?${query}`;
  }
  catalog<T extends Unit | Specialty>(name: "unidades" | "especialidades") {
    const page = (index: number) =>
      this.http.get<Page<T>>(`${authConfig.apiBaseUrl}/${name}`, {
        params: { incluirInativas: true, page: index, size: 100 },
      });
    return page(0).pipe(
      expand(
        (result) =>
          (result.page + 1) * result.size < result.totalElements
            ? page(result.page + 1)
            : EMPTY,
        1,
      ),
      reduce(
        (items, result) => [...items, ...result.items],
        [] as readonly T[],
      ),
    );
  }
}
export function indicatorIssue(error: unknown) {
  const response = error as HttpErrorResponse;
  if (response?.status === 403)
    return {
      title: "Acesso aos indicadores não permitido",
      description:
        "Sua sessão não tem acesso a esta leitura. Volte à sua área ou entre com uma conta autorizada.",
      denied: true,
    };
  if (response?.status === 404)
    return {
      title: "Recorte indisponível",
      description:
        "Um cadastro selecionado não está disponível nesta clínica. Revise ou limpe os filtros e aplique novamente.",
      denied: false,
    };
  if (response?.status === 401)
    return {
      title: "Sessão expirada",
      description: "Entre novamente para consultar os indicadores.",
      denied: true,
    };
  return {
    title: "Não foi possível carregar os indicadores",
    description:
      "Confira sua conexão e tente novamente. Os filtros foram preservados.",
    denied: false,
  };
}
