# Síntese da modelagem e do planejamento técnico

Rodada de 16 de setembro de 2026 — Issue #7. O desenho está suficientemente definido para iniciar a base técnica após a apresentação desta síntese. Nenhuma funcionalidade foi implementada nesta fase.

A análise cobriu Produto/Acadêmico, Backend/Domínio, Frontend/UX, Segurança/IAM e QA/Integração, seguida de revisão cruzada dos contratos e das divergências. O usuário delegou as escolhas de recorte e correções durante a rodada. Isso não constitui validação clínica, aprovação do professor ou aprovação nominal dos integrantes da equipe.

Responsabilidades humanas: Luiz Henrique Assunção Carvalho — produto e documentação; Gustavo Henrique Bezerra Santiago — backend e domínio; Eric Ric Monteiro Almeida — frontend e UX; Lucas Christian Gouveia Ferreira — coordenação e segurança; João Vitor Lobo do Nascimento — qualidade e integração.

## Decisões mantidas

- Monólito modular; Java/Spring Boot, Angular/Spartan, PostgreSQL e Keycloak. As versões concretas permanecem as do bootstrap; sua compatibilidade será verificada na preparação do ambiente.
- Quatro perfis: Paciente, Recepcionista, Médico e Administrador, sem hierarquia que conceda acesso clínico automático.
- RF001–RF018 e RNF001–RNF009 permanecem comprometidos. RF008 e RF017, classificados como Importantes, continuam na entrega final em versão mínima.
- Fluxo: configuração → disponibilidade → agendamento → check-in → fila → atendimento → registro clínico → finalização → histórico permitido.
- Estados `AGENDADA`, `EM_ESPERA`, `EM_ATENDIMENTO`, `FINALIZADA`, `CANCELADA`. Fila é uma consulta derivada, sem agregado/tabela próprios.
- Registro clínico com queixa, resumo/anamnese, conduta e observações; sem prontuário completo, prescrições, exames, faturamento ou notificações externas.
- Contas previamente provisionadas; dados sintéticos; nenhuma promessa de infraestrutura de produção ou conformidade legal integral.

## Decisões alteradas ou detalhadas

| Decisão | Justificativa e efeito |
|---|---|
| Uma clínica por instalação, com várias unidades | Evita multiempresa e administração de permissões por unidade; recepção/admin operam a clínica inteira |
| Clínica cadastrada no provisionamento e mantida por Administração | Detalha RF002 para o recorte de instalação única; unidades/consultórios continuam cadastráveis, alteráveis e desativáveis |
| Estrutura permite zero filhos durante configuração | Permite cadastrar clínica/unidade antes dos consultórios; só oferece horários com estrutura completa e ativa |
| BloqueioAgenda explícito | RF004 já exige bloqueios, ausentes do diagrama original |
| Especialidade na regra e no agendamento | Médico pode ter várias especialidades; a reserva precisa preservar qual serviço foi ofertado |
| Vigência, fuso e versão explícitos | Evita ambiguidade temporal, alteração retroativa e sobrescrita concorrente |
| Check-in repetido retorna 409 sem novo efeito | Resolve #12 versus RF011 preservando rejeição da duplicata e único instante de chegada |
| Recepção também reagenda/cancela | Corrige omissão das Issues #12/#16 em relação a RF008/RF009 |
| Fila por início agendado, check-in e id | Preserva ordem da agenda e produz resultado determinístico, sem prioridade clínica adicional |
| Histórico do paciente operacional; clínico só para médico responsável | Fecha RF017 com minimização de acesso e regra contextual testável |
| Rascunho clínico incompleto, salvar explícito | Evita perda silenciosa e complexidade de autosave; três campos obrigatórios na finalização |
| Lock transacional único da clínica | Cobre reserva versus reserva/bloqueio/desativação com protocolo simples; contenção será medida |
| Extras dos protótipos não adotados | Encaixe, alergia/pressão/medicação estruturadas, permissões, intervalo e antecedência configuráveis não têm RF correspondente |

## Modelo de domínio acordado

`Clinica` é a raiz organizacional única, provisionada antes das operações de negócio, com nome, fuso IANA e atividade. `Unidade` pertence à clínica e possui zero ou mais `Consultorio`. Todas as referências históricas são preservadas; desativação substitui exclusão destrutiva.

`Medico` pertence à clínica, possui identificação profissional, estado ativo e vínculo único e imutável com subject do Keycloak. A identificação profissional contém número e UF do CRM. Relaciona-se com várias `Especialidade`; especialidade também pode atender vários médicos. `Paciente` possui identidade local vinculada ao subject, nome e dados mínimos de identificação já previstos. Não criar entidade de domínio Keycloak, hierarquia JPA de usuários ou cadastro completo de pacientes.

`RegraAgenda` vincula médico, especialidade e consultório a dia da semana, intervalo local, duração e vigência. Múltiplas regras representam manhã/tarde. Duração positiva, início anterior ao fim, nenhum intervalo atravessa meia-noite; slots precisam caber inteiramente na regra. Vigência final é inclusiva quando preenchida. Regras ativas com vigências sobrepostas não podem concorrer no mesmo dia/horário pelo mesmo médico ou consultório. Não há intervalo adicional entre slots nem antecedência configurável.

`BloqueioAgenda` é um período absoluto de indisponibilidade do médico. Não criar bloqueio de sala independente sem requisito. `Agendamento` preserva paciente, médico, especialidade, consultório, início/fim confirmados, estado, chegada e versão. Alterar uma regra não reescreve reservas existentes. Intervalos são semiabertos `[início,fim)`, permitindo adjacência.

`Atendimento` pertence a um único agendamento e há no máximo um atendimento por agendamento. Contém início real, término real e `RegistroClinico` como valor interno, sem CRUD independente genérico. Ao iniciar, cria-se registro vazio; durante atendimento pode haver rascunho incompleto. Finalização exige queixa, resumo e conduta não vazios; observações opcionais. Depois, somente leitura.

### Invariantes e disponibilidade

1. Horário ofertado é futuro, cabe na regra vigente, usa estrutura/médico/especialidade ativos e não cruza bloqueio ou agendamento não cancelado do mesmo médico ou consultório.
2. Consulta de disponibilidade não reserva; criação revalida dentro da transação. Fim/duração e proprietário vêm do servidor.
3. Reagendamento é atômico, preserva id, paciente, médico, especialidade e unidade; consultório pode mudar dentro da unidade. Falha mantém a reserva original. Somente `AGENDADA` antes do início.
4. Cancelamento apenas `AGENDADA` antes do início; libera o horário, preserva histórico.
5. Mudança/desativação de configuração, vínculo médico-especialidade ou bloqueio é rejeitada se invalidar reserva futura não cancelada ou consulta em espera/em atendimento. Não há cancelamento em cascata. Retomar atendimento existente usa seus vínculos históricos mesmo se uma configuração deixar de ofertar novas reservas.
6. A regra semanal gera horários em `America/Belem`, fuso inicial da clínica. Persistência usa instantes inequívocos; API usa offset explícito. Alteração de fuso após haver agendamentos é recusada no MVP para evitar reinterpretar datas operacionais.
7. Início do atendimento e criação da linha correspondente são atômicos; término e mudança para `FINALIZADA` também. Constraint única em `atendimento.agendamento_id` protege a cardinalidade.

Não acrescentamos proibição de sobreposição do próprio paciente nem limite de um atendimento aberto por médico: essas regras não estão no recorte contratado. Conflitos por médico/consultório na agenda permanecem obrigatórios.

## Fluxos acordados

| Origem | Ação e ator | Condição | Destino |
|---|---|---|---|
| Sem reserva | Paciente confirma | Oferta revalidada | AGENDADA |
| AGENDADA | Paciente/Recepção reagenda | Autorizado, antes do início, destino livre | AGENDADA, mesmo id |
| AGENDADA | Paciente/Recepção cancela | Autorizado, antes do início | CANCELADA |
| AGENDADA | Recepção faz check-in | Data local da consulta | EM_ESPERA |
| EM_ESPERA | Médico atribuído inicia | Vínculo e versão válidos | EM_ATENDIMENTO |
| EM_ATENDIMENTO | Médico salva rascunho | Vínculo e versão válidos | EM_ATENDIMENTO |
| EM_ATENDIMENTO | Médico finaliza | Registro obrigatório persistido e válido | FINALIZADA |

Outras transições são rejeitadas. Check-in repetido não renova chegada. A fila inclui apenas `EM_ESPERA`, inclusive pendências anteriores identificadas como tal, sem inserir atendimento já iniciado. Atualiza após mutações e por ação manual; WebSocket/polling obrigatório não é necessário.

Limitação deliberada: falta sem check-in permanece `AGENDADA` passada, sem mutação posterior de cancelamento/reagendamento; abandono após chegada não tem transição específica. A agenda permite identificar pendências, mas não as resolve automaticamente. Não há estado `NAO_COMPARECEU`, reabertura ou correção clínica pós-finalização nesta entrega.

## Arquitetura e persistência

| Módulo | Responsabilidade | Dependências de negócio permitidas |
|---|---|---|
| clinic | Estrutura, profissional, especialidade, cadastro sintético de paciente e vínculos locais | Nenhuma |
| scheduling | Regras, bloqueios, disponibilidade, agendamento e transições | clinic |
| reception | Casos de uso operacionais e projeção de fila | scheduling |
| care | Atendimento, registro e histórico autorizado | scheduling; consulta mínima de clinic quando necessária |
| security | JWT, contexto autenticado e políticas | Projeção de vínculos de clinic; sem dependência em care/scheduling |
| audit | Persistência/consulta controlada de eventos mínimos | Nenhuma dependência de domínio reversa |

Casos de uso recebem identidade autenticada e aplicam regras contextuais junto aos recursos. Domínio não importa filtros HTTP. Não compartilhar repositories indiscriminadamente nem criar ciclo `scheduling ↔ care`. Infraestrutura HTTP comum contém somente erros/correlação; nenhuma camada genérica obrigatória por entidade. Segurança na borda e validação contextual no caso de uso evitam que clinic dependa de security enquanto security consulta seus vínculos.

Flyway é o único mecanismo de evolução do esquema, Hibernate usa validação. Migrations numeradas e imutáveis após integração, com coordenação de Gustavo para evitar números concorrentes. Sem `ddl-auto=update`. A clínica singleton é criada de modo reproduzível antes do protocolo de lock; dados de demonstração e subjects são separados do esquema, com procedimento repetível, não dados reais.

### Concorrência escolhida

Em PostgreSQL `READ COMMITTED`, toda mutação que afete configuração, atividade, vínculos de especialidade, regras, bloqueios ou agenda obtém lock pessimista da mesma linha Clínica **antes** de ler/revalidar dependências. O estado carregado antes do lock não pode ser reutilizado como verdade. A autorização contextual é verificada antes de expor o recurso e revalidada sobre o estado atual após adquirir os locks, antes da mutação. Ordem quando aplicável: Clínica → Agendamento → Atendimento. Check-in, início e finalização seguem a mesma ordem.

Salvar rascunho pode bloquear somente Atendimento e verificar sua versão; não solicita Clínica depois. Finalização lê a versão e o registro sob o lock de Atendimento. Nenhuma chamada externa ocorre enquanto o lock estiver retido. Leituras de disponibilidade não precisam de lock e continuam informativas. Commit/rollback libera os locks. Não adotar simultaneamente exclusões GiST ou locks distribuídos nesta fase.

Esse protocolo deliberadamente serializa mutações da clínica; o teste RNF005 avaliará a contenção. É uma escolha técnica do projeto fundamentada nos [locks transacionais do PostgreSQL](https://www.postgresql.org/docs/18/explicit-locking.html), não uma garantia sem testes.

## Contratos segurança e testes

O [contrato inicial](contratos-iniciais.md) fixa rotas, payloads, versões, paginação, datas e erro comum. O [modelo de segurança](seguranca-e-auditoria.md) define matriz de acesso, Keycloak versus backend e eventos auditáveis. A [estratégia de testes e rastreabilidade](testes-e-rastreabilidade.md) relaciona RF/RNF, Issues e cenários.

Erros usam `status`, `code`, `message`, `requestId`, `fieldErrors`, sem dados sensíveis. Autenticação/autorização usam 401/403, inexistente ou inacessível usa 404; conflito de estado/horário/versão usa 409. A autoria do agendamento nunca vem do payload.

Mínimo de validação: domínio, persistência real PostgreSQL, matriz negativa, smoke real Keycloak, componentes Angular e um fluxo E2E completo com dados sintéticos. RNFs preservam métricas do escopo: pelo menos 20 reservas concorrentes; 95% em até 2 s com até 20 usuários virtuais; quatro jornadas em 768/1366 px; teclado/labels e ausência de violações automáticas críticas; compilação/testes sem ciclos; reprodução de clone limpo. São critérios a executar, não resultados observados.

## Discussão cruzada e resolução

| Divergência | Resolução |
|---|---|
| Duplicata check-in: sucesso idempotente ou rejeição | Rejeição 409 e idempotência de efeito, preservando RF011 |
| Ordem por chegada ou horário reservado | Horário agendado, chegada, id; evita que antecipação de chegada reordene a agenda |
| Acrescentar NAO_COMPARECEU | Manter cinco estados e documentar limitação; não ampliar fluxo sem necessidade da entrega |
| Locks por médico/sala ou restrições de intervalo | Lock único da clínica cobre também configuração e desativação; medir contenção |
| Payload de criação com todos os vínculos/fim | RegraAgendaId + início; backend deriva proprietário e vínculos, reduz inconsistência |
| Rotas em português ou inglês | Português consistente com domínio/documentação; não manter duas APIs |
| Histórico ampliado e acesso entre unidades | Clínica única, operacional em todas unidades; acesso clínico somente próprio responsável |
| Extras do protótipo versus requisitos | Especificação UX revisada prevalece; imagens v1.0 ficam claramente históricas |

## Prontidão e primeira rodada de trabalho

Após apresentação da síntese, #27 está pronta para completar a base HTTP/erros/health; #9 está pronta para autenticação/contexto/realm; #23 está pronta para estruturar testes/CI/evidências. A antiga #1 apareceu fechada na leitura inicial, mas foi encontrada excluída (HTTP 410) ao tentar atualizar o planejamento; #27 recupera os critérios ausentes. #8 tem desenho e aceite definidos, mas sua implementação integrada depende dessa base; deve começar na sequência de #27.

Paralelismo inicial proposto: Lucas em #9 (realm, segurança, integração login); Gustavo em #27 (base HTTP/erros/health, depois #8 clinic/configuração/Flyway); João Vitor em #23 (testes/CI). Eric revisa o contrato e apoia apenas a integração de login de #9; Luiz revisa a documentação da #7. Cada Issue executável terá sua branch e worktree na fase de implementação.

Recursos compartilhados são serializados: Gustavo coordena migrations e dependências Gradle; Lucas coordena Compose/configuração de segurança; alterações `build.gradle`, `application.yaml`, `compose.yaml`, `app.config.ts` e `package.json` são combinadas antes de edição. QA começa pelo desenho de fixtures/harness e incorpora dependências já estabilizadas. #8 pode produzir domínio independente, mas APIs só integram com autenticação/autorização e auditoria correspondentes.

Sequência seguinte: #11 após #9; #10 após #8 e políticas #11; #12 após #10; #13 após #12; #14 após contexto #9/#11 e antes de declarar fluxos auditados concluídos. Frontend #15–#18 pode usar mocks do contrato acordado, com integração dependendo de #10/#12/#13/#8 e #11 respectivamente. #19 avalia as quatro jornadas; #24 exige todas elas e auditoria; #25 executa RNFs no fluxo integrado.

## Pendências e documentação afetada

Não resta decisão humana bloqueante de desenho do MVP após a delegação recebida. Permanecem revisão acadêmica da equipe/professor e validação técnica das hipóteses: compatibilidade real das dependências, contenção do lock, reprodução do ambiente e resultados dos testes. Problemas observados podem exigir revisão futura; não antecipar arquitetura adicional.

Atualizados nesta rodada: contexto, requisitos operacionais, diagramas textuais versionáveis, especificação UX, contratos, segurança/auditoria, critérios e rastreabilidade. DOCX v1.0 e PNGs são preservados como baseline histórica com aviso explícito e adendo de leitura; não devem ser usados isoladamente como especificação vigente. A regeneração visual do DOCX/Figma para uma próxima entrega acadêmica é trabalho editorial posterior, sem bloquear implementação contra a documentação textual consolidada.

Ver [evidências da baseline](analise-baseline.md) para o que foi realmente inspecionado. Esta entrega não inclui execução de testes funcionais nem desenvolvimento do fluxo principal.
