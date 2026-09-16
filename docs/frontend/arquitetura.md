# Arquitetura frontend inicial

## Organização

```text
src/main/webapp/app/
  auth/                 keycloak-angular e a leitura de identidade
  shared/ui/            padrões reais: cabeçalho, status e estados
  features/             páginas lazy por jornada
  shared/ui/helm/       componentes Helm gerados pelo Spartan CLI
```

`shared/ui` só contém padrões de domínio com mais de um consumidor esperado. Cada jornada mantém página, layout, navegação e API próximos na sua feature. Não há shell global, store global ou cabeçalho universal: a composição visual é responsabilidade do perfil.

## Composição por perfil

Cada feature possui o próprio layout quando sua tarefa o exige. A jornada do
Paciente usa cabeçalho horizontal único e navegação de Consultas, Agendar e
Histórico; não herda sidebar, marca ou navegação de outro perfil.

| Perfil | Modo de trabalho | Composição inicial |
|---|---|---|
| Paciente | episódico, guiado e de baixa densidade | agendar, meus agendamentos e histórico; filtros, grade de horários, revisão e listas próprias |
| Recepção | operação contínua e de alta densidade | agenda com toolbar e tabela mais painel de fila em desktop; cartões operacionais e fila abaixo/recolhível em tablet |
| Médico | triagem seguida de tarefa clínica focada | agenda/fila próprias e rota dedicada de atendimento com contexto do paciente, editor clínico central e fila retrátil |
| Administrador | configuração por conjuntos de domínio | navegação por clínica/unidades, consultórios, profissionais/especialidades, agenda e bloqueios; master/detail em desktop e fluxo empilhado em tablet |

Componentes dessas composições permanecem nas respectivas features. A
responsividade não consiste apenas em empilhar a mesma tela: ordem, densidade e
forma de interação podem mudar entre 1366×768 e 768×1024, preservando a tarefa
principal e o contexto necessário.

## Rotas e identidade

As rotas são standalone e lazy. A rota vazia de `/workspace` encaminha a jornada já implementada do Paciente; outras jornadas só entram quando tiverem a própria composição. A rota direta usa `createAuthGuard` do `keycloak-angular`, que verifica exclusivamente as client roles de `medflow-api` já gerenciadas pela sessão e retorna `UrlTree` para acesso negado quando necessário. Realm roles ou roles de outros clients não liberam navegação. Isso limita a navegação, mas o backend continua sendo a autoridade de autorização.

`IdentityService.identity` usa `httpResource` para `GET /api/me`. Isso mantém a leitura reativa e passa pelo `HttpClient` já configurado pelo `keycloak-angular`. Um `401` nessa leitura volta ao fluxo de login do Keycloak; não há interceptor bearer, refresh manual ou nova fonte de roles. `withComponentInputBinding()` entrega o `profile` da rota diretamente ao componente de referência, sem leitura manual de `ActivatedRoute.snapshot`.

A wildcard renderiza uma página de não encontrado em vez de redirecionar silenciosamente.

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

`ReferenceFormComponent` é uma implementação pequena para validar a composição Signal Forms + Helm antes das jornadas. `FormRoot` executa a submissão declarada no Signal Form, marca campos inválidos como tocados e demonstra label associado, descrição e sucesso local; não envia uma mutação fictícia. A apresentação de erro de servidor é uma ação de demonstração explícita e local, separada da submissão válida. A API de cada jornada fará a mutação real com `HttpClient` explícito e mapeará o `fieldErrors` retornado.

## Dependência das jornadas

As Issues #15, #16, #17 e #18 devem declarar dependência desta Issue #40 e usar seus tokens, primitives, autenticação e convenções HTTP. Elas não devem recriar esses fundamentos, mas devem substituir os placeholders e construir navegação, layouts e componentes adequados ao próprio perfil.
