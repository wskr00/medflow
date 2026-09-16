# Estratégia de testes e rastreabilidade do MVP

Documento de planejamento da Issue #7. Responsabilidade humana principal: João Vitor Lobo do Nascimento. As áreas sob responsabilidade de Luiz Henrique Assunção Carvalho, Gustavo Henrique Bezerra Santiago, Eric Ric Monteiro Almeida e Lucas Christian Gouveia Ferreira participarão da futura revisão conforme o assunto. Este documento define como o MedFlow deverá ser verificado; não declara funcionalidades implementadas nem testes executados.

## Baseline validável

O fluxo comprometido é:

`configuração → disponibilidade → agendamento → check-in → fila → atendimento → registro clínico básico → finalização → histórico`

O MVP usa uma clínica por instalação, com múltiplas unidades. Recepção e Administração operam em toda a clínica, sem acesso clínico automático. O Paciente acessa apenas seus recursos e recebe histórico operacional. O Médico acessa sua agenda, sua fila e os registros dos atendimentos que realizou, inclusive finalizados.

O ciclo mantido possui cinco estados:

`AGENDADA → EM_ESPERA → EM_ATENDIMENTO → FINALIZADA`

e:

`AGENDADA → CANCELADA`

O reagendamento conserva o identificador e o estado `AGENDADA`. A ausência não cria um sexto estado nesta versão: uma consulta passada sem check-in pode permanecer `AGENDADA`. Esse limite deve aparecer na demonstração e no relatório final, sem ser apresentado como fluxo resolvido.

RF008 e RF017 permanecem comprometidos para a versão final do MVP. A prioridade “Importante” permite simplificação proporcional, mas não exclusão silenciosa.

## Princípios de validação

- Dados, contas, documentos e registros clínicos usados nos testes serão sintéticos.
- Regras de domínio importantes serão verificadas abaixo da interface e novamente nas integrações em que possam falhar.
- PostgreSQL real será usado nos testes de persistência, migrations, locks e concorrência. Banco em memória não comprova RNF004.
- A maior parte da matriz de autorização usará tokens sintéticos controlados; um conjunto menor de smoke tests usará o Keycloak real e o realm reproduzível.
- O frontend não duplicará regras de domínio. Seus testes verificam apresentação, entrada, navegação e reação aos contratos da API.
- Resultados terão vínculo com commit, ambiente, massa, comando e evidência. Planejamento, execução e aprovação serão estados distintos.
- Uma falha conhecida não será omitida para satisfazer uma métrica. O relatório apresentará resultado observado e limitação.
- Não serão feitas afirmações de validação clínica, conformidade legal integral ou avaliação com usuários reais sem evidência correspondente.

## Pirâmide mínima

### Domínio e unidade

JUnit cobre regras de disponibilidade, intervalos, transições, autorização contextual expressa em casos de uso, validação do registro clínico e construção segura dos eventos de auditoria. Vitest cobre componentes, formulários, guards e serviços do Angular.

Esses testes devem ser rápidos e determinísticos. O relógio do backend será substituível nos testes, e o fuso IANA da clínica será fixado na massa sintética.

### Integração de backend

Testes Spring com PostgreSQL exercitam migrations, mapeamentos, queries, paginação, transações, versões e locks. JWTs de teste representam combinações de roles e subjects. O contrato HTTP é verificado desde a autenticação até o payload e o código de erro.

As mutações de estrutura, atividade, vínculos profissionais, regras, bloqueios e agendamentos seguem o protocolo inicial de concorrência:

1. transação em `READ COMMITTED`;
2. lock pessimista da linha singleton de Clínica antes de ler ou revalidar o estado que determina disponibilidade;
3. ordem Clínica → Agendamento → Atendimento quando mais de um recurso for necessário;
4. revalidação depois do lock;
5. nenhuma chamada externa enquanto o lock estiver retido;
6. commit ou rollback libera o lock.

O salvamento do registro pode bloquear somente Atendimento e validar `version`, desde que não tente obter Clínica depois. Leituras de disponibilidade permanecem sem lock; toda confirmação revalida sob lock.

### Integração de frontend

Testes de componentes e serviços verificam estados de carregamento, vazio, sucesso, validação, conflito, acesso negado e falha inesperada. Mocks devem reproduzir os contratos de `contratos-iniciais.md`, inclusive `version`, `requestId`, códigos de erro e paginação.

### Browser e fluxo integrado

Playwright executará as quatro jornadas principais em navegador real. Um cenário ponta a ponta usará Angular, backend, PostgreSQL e Keycloak reais. Variações de UI que não exigem nova comprovação do backend podem usar interceptação controlada de rede.

O cenário integrado mínimo parte apenas da Clínica singleton, identidades e vínculos reproduzíveis. A Administração configura Unidade, Consultório, Médico, Especialidade e Regra de Agenda pela UI/API; em seguida, o cenário percorre disponibilidade, criação, check-in, fila, início, salvamento explícito do registro, finalização e históricos autorizados. A execução também tenta acesso indevido, conflito de horário e transição inválida.

## Massa sintética reproduzível

A massa mínima deverá conter:

- uma clínica singleton com fuso `America/Belem`;
- duas unidades e consultórios ativos em ambas;
- duas especialidades;
- dois médicos, cada um vinculado a subject conhecido, com ao menos um vínculo de especialidade;
- dois pacientes vinculados a subjects conhecidos;
- uma conta de Recepção e uma de Administração;
- regra semanal vigente, bloqueio parcial, slots adjacentes e datas sem disponibilidade;
- agendamentos representativos dos cinco estados;
- consulta passada ainda `AGENDADA`, para evidenciar o limite referente a faltas;
- registros clínicos próprios de cada médico;
- recursos alheios para tentativas negativas de Paciente e Médico;
- conta com múltiplas roles, mas sem vínculo suficiente para ao menos uma operação.

Subjects do realm e vínculos locais precisam ser determinísticos e documentados. Nomes e conteúdos clínicos devem ser inequivocamente fictícios.

## Cenários críticos de domínio e transação

### Configuração e disponibilidade

- Clínica é singleton: existe `GET/PUT /api/clinica`, sem criação irrestrita de segunda clínica.
- Estrutura pode existir incompleta durante configuração, mas só elementos ativos e uma regra válida originam disponibilidade.
- Regra semanal respeita vigência, dia, horário, duração, médico, especialidade e consultório.
- Slots são intervalos `[início, fim)`: adjacência é permitida; qualquer sobreposição por médico ou consultório é rejeitada.
- Apenas horários futuros são ofertados.
- Bloqueio do médico retira slots que o interceptem.
- Bloqueio, inativação ou alteração de regra que afetaria reserva futura existente retorna conflito e não cancela silenciosamente a consulta.
- Subject vinculado a Médico é imutável no CRUD administrativo genérico.
- Intervalo entre consultas e antecedência mínima configurável não fazem parte desta versão.

### Agendamento, reagendamento e cancelamento

- Criação deriva o Paciente da identidade e deriva fim, Médico, Especialidade, Unidade e Consultório da oferta revalidada.
- Vinte tentativas simultâneas para o mesmo intervalo confirmam exatamente uma reserva quando a fixture oferece um slot válido; a propriedade de integridade permanece “no máximo uma” mesmo diante de falha técnica externa.
- Também são testados conflito apenas pelo Médico e conflito apenas pelo Consultório.
- Reagendamento conserva id, Paciente, Médico, Especialidade e Unidade; Consultório pode mudar dentro da Unidade.
- Falha de reagendamento mantém integralmente a reserva anterior.
- Paciente atua somente em consulta própria; Recepção atua em consulta da clínica.
- Cancelamento e reagendamento exigem `AGENDADA` e instante atual anterior ao início, sem antecedência mínima adicional.
- Cancelamento libera a disponibilidade quando não há outro impedimento.
- Conflito de `version` retorna `409 VERSAO_DESATUALIZADA` sem perda de atualização confirmada.
- O MVP não impede dois agendamentos do mesmo Paciente em horários sobrepostos; o limite é documentado e não será transformado em regra implícita.

### Recepção e fila

- Agenda diária aceita filtros acordados e retorna apenas projeção operacional.
- Check-in é permitido somente na data local da consulta.
- Primeiro check-in registra um único instante e transiciona `AGENDADA` para `EM_ESPERA`.
- Repetição consciente retorna `409 CHECKIN_JA_REALIZADO`; corrida que observou versão anterior pode retornar `409 VERSAO_DESATUALIZADA`. Nenhum caso duplica o efeito ou o evento de sucesso.
- Fila é derivada de `EM_ESPERA`, sem entidade ou inserção duplicada.
- Ordem da fila: início agendado, `checkInEm`, id.
- Espera pendente de data anterior é identificada claramente, pois não existe estado de falta.
- Encaixe não faz parte desta versão.

### Atendimento e registro clínico

- Somente o Médico atribuído inicia consulta `EM_ESPERA`.
- Duas solicitações concorrentes de início criam no máximo um Atendimento.
- Rascunho clínico incompleto pode ser salvo explicitamente durante `EM_ATENDIMENTO`.
- Finalização exige queixa principal, resumo/anamnese e conduta após trim; observações são opcionais.
- Falha ao salvar impede a UI de finalizar.
- Falha na finalização preserva o último rascunho confirmado.
- Finalização grava horário e `FINALIZADA` atomicamente.
- Depois de finalizado, o fluxo normal permite leitura e nega alteração.
- Corrida entre salvar e finalizar não pode perder uma gravação confirmada nem finalizar conteúdo incompleto.
- O MVP não impõe limite adicional de atendimentos simultâneos por Médico além das transições do próprio agendamento; o limite é documentado.

### Histórico

- `GET /api/me/agendamentos` cobre consultas próprias em todos os estados.
- Histórico RF017 do Paciente contém somente suas consultas finalizadas e projeção operacional: datas, status, profissional, especialidade, unidade e consultório.
- Paciente não recebe queixa, resumo, conduta ou observações nesta versão.
- Médico recebe os quatro campos clínicos somente de atendimentos que realizou, inclusive finalizados.
- A presença atual do paciente na fila não concede acesso a registros produzidos por outro Médico.
- Consulta sem registros autorizados retorna lista vazia uniforme, sem revelar que existem registros alheios.

### Autenticação e autorização

- Ausência de token, token malformado, expirado, com assinatura, emissor ou audiência incorretos retorna `401`.
- Role válida sem vínculo local necessário retorna negação e não cria vínculo automaticamente.
- Paciente não lê ou altera recurso de outro Paciente.
- Recepção não recebe texto clínico.
- Médico não acessa agenda ou registro de outro Médico.
- Administração não recebe acesso clínico automático.
- Conta multi-role precisa do vínculo correspondente a cada operação.
- Recurso inexistente e recurso fora do contexto retornam `404` uniforme após autenticação, sem revelar existência.
- Erros usam `status`, `code`, `message`, `requestId` e `fieldErrors`, sem SQL, stacktrace, token, corpo clínico ou valor sensível rejeitado.

### Auditoria

- Alteração estrutural, agenda, bloqueio, agendamento, reagendamento, cancelamento, check-in, início, salvamento e finalização geram evento de sucesso quando a mutação é confirmada.
- Leitura de registro ou histórico clínico autorizado gera evento de acesso antes da entrega do conteúdo.
- Negação contextual e conflito classificados como auditáveis permanecem registrados depois do rollback funcional.
- Evento mínimo contém id, ator confiável ou anônimo, ação, tipo/id de recurso, instante UTC, resultado e `requestId`.
- Evento não contém token, senha, cabeçalho Authorization, queixa, resumo, conduta, observações ou corpo HTTP clínico.
- Evento de sucesso e mutação são atômicos; rollback de negócio não deixa sucesso falso.
- Indisponibilidade da auditoria não libera acesso nem confirma mutação crítica.
- Consulta administrativa de auditoria aceita no máximo 31 dias, é paginada, retorna metadados e também é auditada.
- Login, logout e falhas de autenticação são verificados nos eventos do Keycloak, sem duplicar credenciais na aplicação.

## Requisitos não funcionais e procedimento de medição

A coluna “Métrica de escopo” reproduz o compromisso do Documento de Escopo v1.0. A coluna “Procedimento escolhido” detalha uma execução reproduzível desta equipe; ela não altera o requisito nem representa resultado já observado.

| RNF | Métrica de escopo | Procedimento escolhido | Aceite objetivo |
|---|---|---|---|
| RNF001 | 100% dos endpoints protegidos rejeitam credencial ausente, inválida ou expirada | Inventariar endpoints e executar três classes mínimas de falha, além de assinatura, emissor e audiência incorretos | Todas as tentativas aplicáveis retornam `401` e nenhum dado protegido |
| RNF002 | 100% dos cenários negativos da matriz resultam em acesso negado | Matriz endpoint × ação × role × vínculo/contexto, incluindo acesso direto por id e conta multi-role | Toda combinação negativa retorna `403` ou `404` conforme contrato, sem conteúdo protegido |
| RNF003 | 100% dos cenários auditáveis geram ator, ação, recurso, data/hora e resultado; sem tokens nem texto clínico completo | Executar a matriz de auditoria e consultar persistência/eventos após sucesso, rollback, negação e conflito | Todos os eventos esperados existem, sucessos falsos não existem e campos proibidos não aparecem |
| RNF004 | Em ao menos 20 tentativas simultâneas sobre o mesmo horário, no máximo uma reserva conflitante é confirmada | Barreira sincroniza 20 Pacientes distintos sobre um slot válido; repetir três vezes com limpeza controlada e conferir API e banco | Exatamente uma confirmação demonstra o fluxo positivo da fixture; em qualquer execução, nunca mais de uma e nenhuma sobreposição persistida |
| RNF005 | Pelo menos 95% das requisições de disponibilidade, agenda, agendamento, fila e histórico respondem em até 2 s sob até 20 usuários virtuais concorrentes | Registrar ambiente e massa; aquecer por 30 s; executar 20 VUs por 2 min; separar métricas por operação e conflitos planejados | p95 de cada grupo até 2 s e nenhum `5xx` inesperado; o detalhamento por grupo é procedimento mais conservador que o agregado |
| RNF006 | Quatro jornadas executáveis em larguras de 768 px e 1366 px, sem perda essencial nem rolagem horizontal principal | Playwright em 768×1024 e 1366×768 nas jornadas Paciente, Recepção, Médico e Administração | Ações essenciais acessíveis, texto legível e `scrollWidth <= clientWidth` no conteúdo principal |
| RNF007 | Ações essenciais por teclado, rótulos associados e nenhuma violação automática crítica na ferramenta adotada | Playwright com axe nas quatro jornadas, complementado por percurso manual de teclado e inspeção de foco | Zero violações axe de impacto `critical`, controles rotulados, foco visível e conclusão sem mouse |
| RNF008 | CI conclui compilação/testes; verificações arquiteturais não encontram ciclos indevidos | Gradle e npm em instalação limpa; regra ArchUnit de slices para módulos de negócio e dependências permitidas | Builds e testes passam; nenhuma dependência cíclica ou proibida é reportada |
| RNF009 | Clone limpo inicia PostgreSQL, Keycloak, migrations, backend e frontend sem ajuste manual não documentado | Executar em diretório descartável e seguir apenas README/configuração versionada; verificar realm, subjects, health e login | Ambiente inicia no commit avaliado e o fluxo de autenticação/health funciona sem passo oculto |

O teste de RNF005 também medirá mutações em unidades distintas. O lock único da Clínica é uma escolha inicial proporcional ao MVP; sua permanência depende de atender a meta observada, não de suposição sobre desempenho.

## Rastreabilidade dos requisitos funcionais

A Issue #7 mantém a baseline e a Issue #24 valida o fluxo integrado. A tabela aponta as Issues de implementação/interface e o aceite funcional mínimo que deverá estar coberto antes do encerramento.

| RF | Issues principais | Aceite rastreável |
|---|---|---|
| RF001 | #9, #11, #24 | Quatro perfis autenticam por OIDC; backend aceita access token válido e rejeita ausente/inválido/expirado |
| RF002 | #8, #18, #24 | Administração consulta e altera Clínica singleton, cria/consulta/altera/desativa Unidades e Consultórios e preserva referências históricas |
| RF003 | #8, #18, #24 | Administração mantém Médicos, Especialidades e vínculos; inativos não entram em novas ofertas; subject não é trocado no CRUD genérico |
| RF004 | #8, #18, #24 | Administração mantém regras vigentes e bloqueios; períodos inválidos/conflitantes são rejeitados; reservas futuras não são invalidadas silenciosamente |
| RF005 | #10, #15, #24 | Paciente consulta por data, Unidade, Especialidade e Médico opcional; resultado considera regra, bloqueio e ocupação; vazio é tratado |
| RF006 | #10, #15, #24 | Confirmação revalida oferta, deriva vínculos do servidor e cria uma única consulta `AGENDADA`; conflito retorna `409` |
| RF007 | #10, #15, #24 | Paciente lista somente próprios agendamentos futuros/passados, com paginação, filtros e projeção operacional |
| RF008 | #10, #12, #15, #16, #24 | Paciente próprio ou Recepção da clínica reagenda `AGENDADA` futura, no mesmo Médico/Especialidade/Unidade e mesmo id; falha preserva reserva anterior |
| RF009 | #10, #12, #15, #16, #24 | Paciente próprio ou Recepção da clínica cancela `AGENDADA` futura; estado vira `CANCELADA` e horário é recalculado como disponível quando aplicável |
| RF010 | #12, #16, #24 | Recepção consulta agenda por data com filtros e dados operacionais da clínica; vazio não altera estado |
| RF011 | #12, #16, #24 | Recepção faz check-in na data local; primeiro efeito gera `EM_ESPERA` e timestamp; repetição retorna `409` sem duplicar efeito |
| RF012 | #12, #16, #24 | Recepção vê fila da clínica e Médico vê a própria; somente `EM_ESPERA`, sem duplicatas, ordem início/check-in/id |
| RF013 | #13, #17, #24 | Médico autenticado lista somente consultas atribuídas ao seu vínculo profissional, por data e estado |
| RF014 | #13, #17, #24 | Médico atribuído inicia uma única consulta `EM_ESPERA`; criação do Atendimento e `EM_ATENDIMENTO` são atômicos |
| RF015 | #13, #17, #24 | Médico responsável salva explicitamente quatro campos; rascunho incompleto é permitido e conflito de versão não sobrescreve dados |
| RF016 | #13, #17, #24 | Médico responsável finaliza somente com três campos obrigatórios; término e `FINALIZADA` são atômicos; registro fica somente leitura |
| RF017 | #13, #15, #17, #24 | Paciente recebe finalizadas próprias sem texto clínico; Médico recebe registros dos atendimentos que realizou; acesso alheio não é revelado |
| RF018 | #14, #24 | Operações da matriz geram evento mínimo, durável e sanitizado; sucessos são atômicos com a mutação e negações sobrevivem ao rollback |

## Rastreabilidade dos requisitos não funcionais

| RNF | Issues principais | Evidência esperada |
|---|---|---|
| RNF001 | #9, #23, #25 | Inventário de endpoints e relatório de autenticação negativa |
| RNF002 | #11, #23, #25 | Matriz de autorização positiva/negativa executada |
| RNF003 | #14, #23, #25 | Matriz de auditoria e inspeção de campos proibidos |
| RNF004 | #10, #23, #25 | Relatório do teste concorrente com estado final no PostgreSQL |
| RNF005 | #23, #25 | Relatório de carga com ambiente, massa, amostras, p95 por operação e erros |
| RNF006 | #19, #23, #25 | Execução das quatro jornadas nas duas larguras e evidência de overflow |
| RNF007 | #19, #23, #25 | Relatório axe e checklist manual de teclado/foco/rótulos |
| RNF008 | #8–#14, #23, #25 | Resultado da CI e da regra arquitetural de ciclos/dependências |
| RNF009 | #9, #23, #25 | Registro de clone limpo, comandos documentados e smoke de health/login |

As Issues #20, #21 e #22 estão fechadas com `state_reason=duplicate` e correspondem respectivamente a #17, #18 e #19. Elas são histórico administrativo, não evidência de implementação concluída. A Issue #1 também não é evidência suficiente: está fechada, mas a baseline inspecionada não contém todos os seus critérios.

## Dependências e ordem de validação

- #23 pode estruturar fixtures, convenções e comandos desde o início.
- A primeira rodada paralela contém #1 no Backend, #9 em Segurança e #23 em QA, com coordenação dos artefatos compartilhados.
- #8 começa após a correção e integração de #1; #1 deverá ser reaberta porque a baseline não satisfaz todos os seus critérios.
- #11 depende do contexto de identidade de #9.
- #10 depende da estrutura e regras de #8 e dos contratos de identidade/autorização necessários.
- #12 depende de agendamentos válidos produzidos por #10.
- #13 depende do estado `EM_ESPERA` e da fila de #12.
- #14 é transversal; sua infraestrutura deve ser coordenada antes de cada operação crítica, evitando retrofit no fim.
- #15–#18 podem começar contra mocks dos contratos estabilizados; integração depende respectivamente de #10, #12, #13 e #8, além de #11 para autorização.
- #19 depende das quatro jornadas navegáveis.
- #24 depende do fluxo integrado e do ambiente reproduzível.
- #25 depende das implementações de cada RNF e dos procedimentos definidos em #23.

Alteração posterior de contrato compartilhado exige revisão das responsabilidades de Backend, Frontend, Segurança, Produto e QA antes de ser adotada.

## Aceite das Issues de validação

### Issue #23 — Estruturar validação automatizada do fluxo principal

- matriz relaciona RF/RNF, cenário, camada, fixture e evidência;
- dados sintéticos e relógio/fuso são reproduzíveis;
- comandos locais e de CI estão documentados e distinguem dependências externas;
- testes de domínio, persistência, segurança, frontend e browser têm fronteiras claras;
- falhas preservam evidência suficiente para diagnóstico sem expor dados sensíveis;
- estratégia é revisada pelas responsabilidades humanas de Backend, Frontend, Segurança e QA.

### Issue #24 — Validar fluxo integrado ponta a ponta

- ambiente real da aplicação inicia de forma documentada;
- cenário percorre as nove etapas do fluxo comprometido com os quatro perfis necessários;
- cada passo verifica resposta e estado persistido esperado;
- conflito de agenda, acesso indevido e transição inválida são executados no mesmo ambiente;
- relatório vincula execução a commit, massa, comandos e evidências;
- defeitos e etapas não executadas permanecem explícitos.

### Issue #25 — Validar requisitos não funcionais mensuráveis

- cada RNF001–RNF009 possui procedimento, resultado observado e conclusão separada;
- RNF004 registra o resultado das 20 tentativas e o estado final no PostgreSQL;
- RNF005 registra ambiente, massa, duração, volume, p95 por operação e erros;
- RNF006/RNF007 registram as quatro jornadas, duas larguras, axe e verificação manual;
- RNF008 apresenta resultados reais da CI e da regra arquitetural;
- RNF009 apresenta execução a partir de clone limpo;
- limitações são informadas sem substituir medição ausente por estimativa.

## Evidência e diagnóstico

Cada execução relevante deve registrar:

- commit e branch avaliados;
- versões de Java, Gradle, Node, npm, navegador, PostgreSQL e Keycloak;
- comando e configuração;
- massa/fixtures e relógio/fuso;
- resultado esperado e observado;
- `requestId` de falhas HTTP;
- resposta sanitizada e estado persistido pertinente;
- duração e métricas quando aplicável;
- defeitos, limitações e testes não executados.

Screenshots ajudam a documentar interface e responsividade, mas não substituem asserções. Logs não podem carregar token ou texto clínico completo.

## Comandos planejados

Os comandos abaixo são candidatos ao procedimento reproduzível. Eles não foram executados nesta rodada de planejamento e podem ser ajustados quando os arquivos de teste existirem.

```bash
./gradlew test
./gradlew build
npm ci
npm test -- --watch=false
npm run build
docker compose up -d postgres keycloak
docker compose ps
npx playwright test
k6 run tests/performance/fluxo-principal.js
```

O ensaio de RNF009 será executado a partir de clone limpo em diretório temporário, usando somente instruções versionadas. O relatório final apresentará os comandos realmente usados e seus resultados, sem converter esta lista de planejamento em evidência.

## Validação cruzada e contradições resolvidas

- O escopo dizia que check-in duplicado era rejeitado, enquanto uma Issue usava “idempotente”. O acordo preserva idempotência do efeito e retorna `409` para repetição.
- RF008/RF009 incluíam Recepção, mas suas Issues de jornada não. A rastreabilidade passa a incluir #12 e #16.
- RF017 incluía Paciente, mas a tabela resumida de casos de uso o omitia. O histórico do Paciente foi definido como operacional e sem texto clínico.
- O modelo não mostrava Bloqueio nem Especialidade da oferta. Ambos são necessários para os cenários e contratos.
- Protótipos sugeriam encaixe, permissões na aplicação, intervalo, antecedência, autosave e dados clínicos adicionais. Esses elementos não foram adotados como requisitos do MVP.
- A identidade “Administrador” em telas clínicas não representa a matriz acordada e deverá ser corrigida nos protótipos.
- As métricas completas dos RNFs existiam no DOCX, mas não na tabela resumida. Este documento as torna rastreáveis e separa requisito de procedimento.
- O lock singleton de Clínica resolve de forma simples as corridas de configuração e agenda, mas introduz contenção global. RNF005 determinará por evidência se a escolha atende ao MVP.
- A ausência de `NAO_COMPARECEU`, conflito por Paciente e limite global de atendimentos simultâneos é deliberada nesta versão e deve permanecer visível como limitação.

Não restou contradição conhecida que impeça o início de #8, #9 e #23 depois da apresentação da síntese ao usuário. #24 e #25 permanecem naturalmente bloqueadas até existirem fluxo integrado e implementações mensuráveis.
