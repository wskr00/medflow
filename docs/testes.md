# Testes do MedFlow

Este documento descreve a infraestrutura mínima de validação da Issue #23. Responsabilidade humana: João Vitor Lobo do Nascimento — qualidade, integração e validação. Além do bootstrap, as Issues funcionais acrescentam os cenários dos requisitos que implementam.

## Comando local consolidado

O comando abaixo executa build e testes do backend, instalação reproduzível, testes e build do frontend:

```bash
MEDFLOW_DB_URL=jdbc:postgresql://localhost:55433/medflow_qa \
MEDFLOW_DB_USERNAME=medflow_qa \
MEDFLOW_DB_PASSWORD=medflow_qa \
JAVA_HOME=/usr/lib/jvm/java-25-openjdk \
./scripts/teste-baseline.sh
```

O PostgreSQL precisa estar ativo antes da execução. As credenciais acima são exclusivamente sintéticas. A porta `55433` é apenas um exemplo local para evitar conflito com a stack de desenvolvimento; a CI usa o serviço PostgreSQL na porta padrão do runner.

O script encerra na primeira falha, usa o datasource informado e define `SPRING_DOCKER_COMPOSE_ENABLED=false`, evitando iniciar a stack Compose global. Ele não altera configuração do Spring, Compose ou Keycloak. O workflow `.github/workflows/ci.yml` executa backend e frontend em jobs separados e arquiva os relatórios JUnit por sete dias mesmo quando o job falha.

## Baseline observada em 16 de setembro de 2026

| Verificação                                                   | Resultado observado                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                      | Concluiu; npm informou 7 vulnerabilidades de severidade alta e scripts de instalação ainda não aprovados |
| `npm test -- --watch=false`                                   | Passou: 1 arquivo, 2 testes do componente inicial                                                        |
| `npm run build`                                               | Passou; bundle de produção gerado                                                                        |
| `./gradlew test` sem datasource                               | Falhou em `contextLoads` ao criar o datasource                                                           |
| `./gradlew test` com PostgreSQL 18 e variáveis de datasource  | Passou: 1 teste                                                                                          |
| `./gradlew build` com PostgreSQL 18 e variáveis de datasource | Passou                                                                                                   |

A falha sem datasource não foi mascarada. A configuração reproduzível pertence à #27. O script aceita `MEDFLOW_DB_*` ou `SPRING_DATASOURCE_*` e exporta ambos; a CI fornece os dois conjuntos para permanecer compatível antes e depois da integração de #27.

`npm audit --json` confirmou que as 7 ocorrências são transitivas, não dependências diretas: `smol-toml <= 1.7.0` (GHSA-7w5x-hrqm-74c2, negação de serviço por TOML malformado) chega por `nx`/pacotes `@nx`, usados pela dependência de desenvolvimento `@spartan-ng/cli`. O npm informa correção disponível. Nenhum `npm audit fix` ou upgrade automático foi aplicado; a compatibilidade deve ser avaliada antes da integração.

Os dois testes frontend e o teste de contexto apenas comprovam que o bootstrap atual compila e inicializa nas condições descritas. Eles não comprovam RFs, RNFs, autenticação, integração do fluxo ou comportamento clínico.

## Camadas previstas

| Camada                  | Objetivo                                                          | Momento de inclusão                              |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| Unidade/domínio         | Regras, estados e validações sem infraestrutura                   | Junto da Issue funcional correspondente          |
| Persistência PostgreSQL | Migrations, constraints, queries, locks e rollback                | Introduzida por #8 e ampliada por #10             |
| API                     | Status, payload, estado persistido, erros e `requestId`           | A partir de #27 e em cada API funcional          |
| Segurança               | JWT controlado para matriz; smoke com Keycloak real               | Após integração de #9/#11                        |
| Frontend                | Componentes, formulários, loading, vazio, conflito e erro         | Em #15–#18                                       |
| E2E                     | Fluxo completo com Angular, backend, PostgreSQL e Keycloak        | Em #24, após as jornadas existirem               |
| RNFs                    | Concorrência, carga, responsividade, acessibilidade e clone limpo | Em #25, sobre fluxo integrado                    |

Não foi adicionada regra ArchUnit vazia: ela deve nascer quando os módulos reais existirem e quando a dependência de teste estiver coordenada com o responsável pelo `build.gradle`. Também não foram criadas fixtures sem consumidor: perfis do Keycloak, estados persistidos e os 20 pacientes concorrentes devem nascer junto dos testes reais correspondentes. Playwright, axe e carga com 20 usuários ficam para o momento em que exista comportamento real a provar.

## Cenários funcionais posteriores

As Issues funcionais devem acrescentar testes para transições permitidas e proibidas, conflito por Médico e Consultório, disponibilidade obsoleta, cancelamento que libera horário, reagendamento que preserva a reserva anterior em caso de falha, fronteiras de autorização e auditoria sem texto clínico.

A #10 acrescenta a fixture consumida de 20 pacientes distintos e o teste sincronizado contra PostgreSQL real. Cada uma de três rodadas usa barreiras de prontidão/início, limite de tempo por `Future` e um slot válido diferente; o aceite automatizado exige exatamente uma confirmação e 19 conflitos esperados por rodada, sem falha inesperada.

## Evidência automatizada de disponibilidade e agendamento (#10)

Os testes `AppointmentPersistenceIntegrationTests` e `AppointmentHttpIntegrationTests` cobrem RF005–RF009 e a implementação inicial de RNF004. Usam relógio fixo, fuso `America/Belem`, dados sintéticos e PostgreSQL Testcontainers. Exercitam vigência inclusiva, estrutura ativa, bloqueio, conflito por médico e consultório, sobreposição parcial, adjacência, cancelamento, paginação/filtros próprios, versões, no-op, rollback de reagendamento, projeções e fronteiras `403`/`404`. Também comprovam que criar/alterar bloqueio ou encurtar/desativar uma regra não invalida reserva futura, e que a autorização contextual é repetida depois de uma espera real pelo lock da Clínica.

Execução isolada reproduzível:

```bash
./gradlew test --tests 'br.com.medflow.scheduling.Appointment*IntegrationTests'
```

Essa evidência não substitui o ensaio integrado final da #25 nem mede RNF005.

## Evidência e diagnóstico

Uma falha deve registrar, conforme aplicável:

- commit e comando exato;
- versões relevantes do ambiente;
- fixture e relógio/fuso usados;
- resultado esperado e observado;
- resposta HTTP sanitizada e `requestId`;
- estado persistido antes/depois;
- relatório gerado pela ferramenta;
- limitação ou dependência ainda não integrada.

Relatórios locais do Gradle ficam em `build/reports/tests/test/`. Vitest imprime arquivo, quantidade de testes e duração no console. A CI preserva o log de cada job; artefatos adicionais devem ser publicados apenas quando houver conteúdo útil e sem dados sensíveis.

## Próximas integrações

- #27 deve tornar health, erro comum, correlação, validação HTTP e datasource verificáveis.
- #9 deve fornecer realm e contas sintéticas reproduzíveis, mais smoke de token válido/ausente/inválido/expirado.
- #11 deve materializar a matriz contextual positiva e negativa.
- #8 introduziu migrations e configuração clínica; #10 acrescentou disponibilidade, reservas e concorrência real de agenda no PostgreSQL.
- #24 executará o fluxo completo; #25 medirá RNF001–RNF009 sem substituir resultados ausentes por estimativas.

Até essas integrações, a CI criada nesta Issue é uma base de regressão do bootstrap, não evidência de conclusão do MVP.
