import { httpResource } from "@angular/common/http";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, Signal, inject, signal } from "@angular/core";
import { Observable, forkJoin, of } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";

import { authConfig } from "../../auth/auth-config";
import {
  ApiErrorBody,
  AvailabilityQuery,
  AvailabilityResponse,
  CatalogState,
  DoctorCatalogResource,
  NamedResource,
  PageResponse,
  PatientApiIssue,
  PatientAppointment,
  PatientHistoryItem,
} from "./patient.models";

function url(path: string, parameters: Record<string, string | number | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const suffix = query.size > 0 ? `?${query}` : "";
  return `${authConfig.apiBaseUrl}${path}${suffix}`;
}

function fieldErrors(error: ApiErrorBody): Readonly<Record<string, string>> {
  return Object.fromEntries(
    (error.fieldErrors ?? []).map((field) => [field.field, field.message]),
  );
}

/** Traduz apenas os códigos contratuais desta jornada, sem depender de texto da API. */
export function patientApiIssue(error: unknown): PatientApiIssue {
  const status = error instanceof HttpErrorResponse ? error.status : undefined;
  const body =
    error instanceof HttpErrorResponse && error.error !== null && typeof error.error === "object"
      ? (error.error as ApiErrorBody)
      : {};
  const codeByStatus: Readonly<Record<number, string>> = {
    0: "FALHA_DE_REDE",
    400: "ENTRADA_INVALIDA",
    401: "NAO_AUTENTICADO",
    403: "ACESSO_NEGADO",
    404: "RECURSO_NAO_ENCONTRADO",
  };
  const code = body.code ?? (status === undefined ? "ERRO_INTERNO" : (codeByStatus[status] ?? "ERRO_INTERNO"));
  const messages: Readonly<Record<string, readonly [string, string]>> = {
    HORARIO_INDISPONIVEL: [
      "Horário não disponível",
      "Esse horário acabou de ser ocupado. Escolha outro após atualizar a disponibilidade.",
    ],
    VERSAO_DESATUALIZADA: [
      "Agendamento atualizado em outro acesso",
      "Recarregue seus agendamentos antes de tentar novamente. Nenhuma alteração foi sobrescrita.",
    ],
    TRANSICAO_INVALIDA: [
      "Esta ação não está mais disponível",
      "O estado do agendamento mudou. Recarregue a lista para ver a situação atual.",
    ],
    NAO_AUTENTICADO: [
      "Sessão expirada",
      "Entre novamente para continuar.",
    ],
    ACESSO_NEGADO: [
      "Acesso não permitido",
      "Não foi possível concluir esta ação no contexto atual.",
    ],
    RECURSO_NAO_ENCONTRADO: [
      "Recurso indisponível",
      "Este agendamento não está disponível no contexto atual. Atualize a lista antes de continuar.",
    ],
    ENTRADA_INVALIDA: [
      "Revise os dados informados",
      "Algum dado não foi aceito. Corrija os campos indicados e tente novamente.",
    ],
    FALHA_DE_REDE: [
      "Falha de conexão",
      "Não foi possível alcançar o serviço. Verifique a conexão e tente novamente.",
    ],
  };
  const [title, description] =
    messages[code] ?? [
      "Não foi possível concluir a ação",
      "Verifique sua conexão e tente novamente. Se o problema persistir, informe o código da solicitação ao suporte.",
    ];

  return {
    code,
    title,
    description: body.requestId ? `${description} Protocolo: ${body.requestId}.` : description,
    fieldErrors: fieldErrors(body),
    isConflict: error instanceof HttpErrorResponse && error.status === 409,
  };
}

@Injectable()
export class PatientAppointmentsApi {
  private readonly http = inject(HttpClient);
  readonly pageSize = 20;
  readonly appointmentsPage = signal(0);
  readonly historyPage = signal(0);

  readonly units = signal<CatalogState<NamedResource>>({ items: [], loading: true, error: null });
  readonly specialties = signal<CatalogState<NamedResource>>({ items: [], loading: true, error: null });
  readonly doctors = signal<CatalogState<DoctorCatalogResource>>({ items: [], loading: true, error: null });
  readonly appointments = httpResource<PageResponse<PatientAppointment>>(
    () => url("/me/agendamentos", { page: this.appointmentsPage(), size: this.pageSize }),
  );
  readonly history = httpResource<PageResponse<PatientHistoryItem>>(
    () => url("/me/historico", { page: this.historyPage(), size: this.pageSize }),
  );

  constructor() {
    this.reloadCatalogs();
  }

  reloadCatalogs(): void {
    this.loadCatalog("/unidades", this.units);
    this.loadCatalog("/especialidades", this.specialties);
    this.loadCatalog("/medicos", this.doctors);
  }

  setAppointmentsPage(page: number): void {
    if (page >= 0) this.appointmentsPage.set(page);
  }

  setHistoryPage(page: number): void {
    if (page >= 0) this.historyPage.set(page);
  }

  availability(query: Signal<AvailabilityQuery | null>) {
    return httpResource<AvailabilityResponse>(() => {
      const value = query();
      return value
        ? url("/disponibilidades", {
            data: value.data,
            unidadeId: value.unidadeId,
            especialidadeId: value.especialidadeId,
            medicoId: value.medicoId,
          })
        : undefined;
    });
  }

  rescheduleAvailability(
    appointmentId: Signal<string | null>,
    date: Signal<string>,
  ) {
    return httpResource<AvailabilityResponse>(() => {
      const id = appointmentId();
      const selectedDate = date();
      return id && selectedDate
        ? url(`/agendamentos/${id}/disponibilidades`, { data: selectedDate })
        : undefined;
    });
  }

  create(slot: { regraAgendaId: string; inicio: string }): Observable<PatientAppointment> {
    return this.http.post<PatientAppointment>(url("/agendamentos"), slot);
  }

  reschedule(
    id: string,
    slot: { regraAgendaId: string; inicio: string },
    expectedVersion: number,
  ): Observable<PatientAppointment> {
    return this.http.post<PatientAppointment>(url(`/agendamentos/${id}/reagendamento`), {
      ...slot,
      expectedVersion,
    });
  }

  cancel(id: string, expectedVersion: number): Observable<PatientAppointment> {
    return this.http.post<PatientAppointment>(url(`/agendamentos/${id}/cancelamento`), {
      expectedVersion,
    });
  }

  /** A API pagina catálogos; a seleção não pode omitir opções após a primeira página. */
  private loadCatalog<T>(
    path: string,
    target: ReturnType<typeof signal<CatalogState<T>>>,
  ): void {
    target.update((state) => ({ ...state, loading: true, error: null }));
    this.allCatalogPages<T>(path)
      .pipe(
        map((items) => ({ items, loading: false, error: null })),
        catchError((error: unknown) => of({ items: [], loading: false, error })),
      )
      .subscribe((state) => target.set(state));
  }

  private allCatalogPages<T>(path: string): Observable<readonly T[]> {
    const size = 100;
    return this.http.get<PageResponse<T>>(url(path, { page: 0, size })).pipe(
      switchMap((firstPage) => {
        const pageCount = Math.ceil(firstPage.totalElements / firstPage.size);
        if (pageCount <= 1) return of(firstPage.items);
        return forkJoin(
          Array.from({ length: pageCount - 1 }, (_, index) =>
            this.http.get<PageResponse<T>>(url(path, { page: index + 1, size })),
          ),
        ).pipe(
          map((pages) => [
            ...firstPage.items,
            ...pages.flatMap((page) => page.items),
          ]),
        );
      }),
    );
  }
}
