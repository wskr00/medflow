# Evidências de acessibilidade e responsividade — Issue #19

## Escopo automatizado

`e2e/accessibility.spec.ts` executa contra uma stack real já iniciada, sem
mocks, para os perfis Paciente, Recepção, Médico e Administração em `1366×768`
e `768×1024`. Em cada rota essencial, a suíte verifica:

- login OIDC no Keycloak local;
- título principal da área autorizada;
- foco por teclado após `Tab`;
- rótulo associado a cada `input`, `select` ou `textarea` visível;
- ausência de overflow horizontal;
- ausência de violações Axe de impacto `critical`;
- ausência de respostas `/api/` com HTTP 5xx e erros no console.

Rotas: `/workspace/patient/consultas`, `/workspace/reception`,
`/workspace/doctor/triagem` e `/workspace/admin/estrutura`.

## Como executar

1. Inicie PostgreSQL e Keycloak sintéticos conforme `compose.yaml`.
2. Inicie o backend com migrations e dados demo, e o Angular em `localhost:4200`.
3. Execute `npm run test:e2e` na raiz do repositório. Para outro host local,
   use `E2E_BASE_URL=http://localhost:4200 npm run test:e2e`.

Dependências: `@playwright/test` e `@axe-core/playwright`; o navegador é
instalado com `npx playwright install chromium`.

## Limites

- A suíte não grava configuração, cria consulta, realiza check-in, salva
  atendimento ou finaliza registro clínico. Esses fluxos exigem massa isolada
  por cenário para não alterar a demonstração compartilhada.
- Axe é uma verificação automatizada complementar: contraste percebido,
  hierarquia de informação e adequação clínica continuam exigindo inspeção
  manual documentada na execução da Issue.
- Capturas de tela são geradas apenas em falha pelo Playwright; não são
  declaradas como evidência até serem efetivamente produzidas.

## Execução registrada em 2026-09-16

Ambiente integrado local: Angular em `localhost:4200`, Spring Boot em
`localhost:8080`, Keycloak em `localhost:8085` e PostgreSQL com as migrations
e `R__synthetic_demo_data.sql`. A saúde do backend respondeu `UP`.

Com Playwright Chromium instalado localmente e `@playwright/test 1.63.0` /
`@axe-core/playwright 4.13.0`, `npm run test:e2e` concluiu **8 de 8** testes
em 12,6 s: os quatro perfis nas duas larguras. Não houve violações Axe de
impacto crítico, respostas API 5xx, erros de console, controles sem rótulo ou
overflow horizontal nas rotas verificadas.

A massa repetível contém os pacientes sintéticos `paciente`,
`paciente.helena` e `paciente.caio`, além dos quatro perfis principais. A
validação não escreveu nessa massa.

Inspeção manual por navegador: a sessão Chrome compartilhada já estava
autenticada como Administrador; abrir a rota do Paciente mostrou corretamente
`Acesso não disponível`, sem dados clínicos. A troca manual de perfil não foi
forçada para não invalidar a sessão compartilhada; os quatro logins foram
exercidos isoladamente pelo navegador real do Playwright na execução acima.
