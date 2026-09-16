# Arquitetura frontend inicial

## Organização

```text
src/main/webapp/app/
  auth/                 keycloak-angular e a leitura de identidade
  core/layout/          shell e composição de navegação
  shared/ui/            padrões reais: cabeçalho, status e estados
  features/             páginas lazy por jornada
  shared/ui/helm/       componentes Helm gerados pelo Spartan CLI
```

`core` só contém composição técnica reutilizável; `shared/ui` só contém padrões de domínio com mais de um consumidor esperado. Cada jornada futura mantém página, componentes e API próximos na sua feature. Não há store global. Tipos de contrato e serviços HTTP de uma jornada ficam na própria feature, não no shell.

## Rotas e identidade

As rotas são standalone e lazy. `/workspace` carrega o shell e direciona a primeira área autorizada em `/api/me`: `PATIENT`, `RECEPTIONIST`, `DOCTOR` ou `ADMINISTRATOR`. As quatro rotas de perfil já preservam navegação e foco, mas mostram apenas a referência de fundação; a lógica das jornadas #15–#18 ainda não existe.

`IdentityService.identity` usa `httpResource` para `GET /api/me`. Isso mantém a leitura reativa e passa pelo `HttpClient` já configurado pelo `keycloak-angular`. A fundação não cria interceptor bearer, refresh manual, guard de autenticação próprio ou outra fonte de roles. O backend continua sendo a autoridade para autorização.

## Leituras e mutações

Use `httpResource` para GETs dependentes de filtros/signals e chame `reload()` após mutação, conflito ou nova entrada em contexto. Use `HttpClient` explícito na API da feature para POST, PUT e transições, mantendo `expectedVersion` no payload quando o contrato exigir.

Exemplo de estrutura para uma feature futura, não implementado nesta Issue:

```ts
@Injectable()
export class AppointmentApi {
  private readonly http = inject(HttpClient);

  checkIn(id: string, expectedVersion: number) {
    return this.http.post(`/api/agendamentos/${id}/check-in`, {
      expectedVersion,
    });
  }
}
```

Não encapsular essas chamadas atrás de uma camada genérica sem consumidor. `409 CHECKIN_JA_REALIZADO`, `VERSAO_DESATUALIZADA` e demais códigos seguem o contrato em `docs/planejamento/contratos-iniciais.md` e usam o padrão de conflito/recarga.

## Formulários

`ReferenceFormComponent` é uma implementação pequena para validar a composição Signal Forms + Helm antes das jornadas. Ela demonstra label associado, descrição, erro local e ponto de exibição para erro de servidor; não envia uma mutação fictícia. A API de cada jornada fará a mutação real com `HttpClient` explícito e mapeará o `fieldErrors` retornado.

## Dependência das jornadas

As Issues #15, #16, #17 e #18 devem declarar dependência desta Issue #40 e usar este shell, tokens, estados e convenções HTTP. Elas não devem recriar cores, shell, navegação, status, feedback ou autenticação.
