# Requisitos do MedFlow

Baseline detalhada pelo [adendo ao escopo v1.0](escopo/ADENDO-v1.0-planejamento.md), após a rodada da Issue #7. RF001–RF018 permanecem no escopo final; prioridade Importante não significa exclusão. Ver [rastreabilidade e testes](planejamento/testes-e-rastreabilidade.md) para critérios por Issue.

## Requisitos Funcionais

| ID | Requisito |
|---|---|
| RF001 | Autenticar usuário |
| RF002 | Gerenciar estrutura clínica |
| RF003 | Gerenciar profissionais e especialidades |
| RF004 | Configurar agenda e bloqueios |
| RF005 | Consultar disponibilidade |
| RF006 | Agendar consulta |
| RF007 | Consultar próprios agendamentos |
| RF008 | Reagendar consulta |
| RF009 | Cancelar consulta |
| RF010 | Consultar agenda do dia |
| RF011 | Realizar check-in |
| RF012 | Acompanhar fila de atendimento |
| RF013 | Consultar agenda médica |
| RF014 | Iniciar atendimento |
| RF015 | Registrar informações clínicas básicas |
| RF016 | Finalizar atendimento |
| RF017 | Consultar histórico mínimo de atendimentos |
| RF018 | Registrar auditoria de operações críticas |

## Requisitos Não Funcionais

| ID | Requisito |
|---|---|
| RNF001 | Autenticação de acesso |
| RNF002 | Autorização funcional e contextual |
| RNF003 | Rastreabilidade de operações críticas |
| RNF004 | Integridade sob concorrência de agenda |
| RNF005 | Tempo de resposta do fluxo principal |
| RNF006 | Responsividade das interfaces |
| RNF007 | Acessibilidade básica |
| RNF008 | Manutenibilidade arquitetural |
| RNF009 | Reprodutibilidade do ambiente |

## Observações de rastreabilidade

### Critérios operacionais consolidados

- RF002/RF003: uma clínica provisionada; Administração mantém estrutura/profissionais/especialidades, incluindo alteração/desativação e preservação de referências históricas.
- RF004–RF006: regra semanal vigente por médico/especialidade/consultório; slots futuros `[início,fim)`, bloqueios por médico e revalidação transacional no ato de reservar.
- RF008/RF009: Paciente proprietário ou Recepcionista; somente AGENDADA antes do início. Reagendamento preserva id, médico, especialidade e unidade; falha conserva a reserva anterior.
- RF011: check-in na data local da consulta; repetição retorna 409, sem alterar o primeiro instante nem duplicar fila/evento de sucesso.
- RF012: fila derivada apenas de EM_ESPERA, ordenada por início agendado, chegada e id. Pendências anteriores não desaparecem silenciosamente.
- RF014–RF016: médico atribuído inicia um único atendimento; pode salvar rascunho; queixa, resumo e conduta são obrigatórios para finalizar; observações opcionais; finalizado somente leitura.
- RF017: histórico do paciente somente operacional próprio; histórico clínico do médico somente seus atendimentos finalizados. Consulta em andamento usa o recurso de atendimento autorizado.
- RF018: eventos críticos de sucesso e negação conforme [matriz de auditoria](planejamento/seguranca-e-auditoria.md), sem tokens ou texto clínico.

### Métricas preservadas do documento de escopo

| ID | Aceite mensurável |
|---|---|
| RNF001 | 100% dos endpoints protegidos rejeitam ausência de credencial, token inválido ou expirado |
| RNF002 | 100% dos cenários negativos da matriz de autorização negam acesso |
| RNF003 | 100% dos cenários auditáveis geram ator, ação, recurso, data/hora e resultado; logs sem tokens/texto clínico completo |
| RNF004 | Pelo menos 20 tentativas simultâneas sobre mesmo horário, com no máximo uma confirmação conflitante |
| RNF005 | Pelo menos 95% das requisições de disponibilidade, agenda, agendamento, fila e histórico em até 2 s, com até 20 usuários virtuais concorrentes |
| RNF006 | Quatro jornadas executáveis em 768 px e 1366 px, sem perda funcional essencial nem rolagem horizontal do conteúdo principal |
| RNF007 | Ações essenciais por teclado, rótulos associados, nenhuma violação automática crítica na ferramenta adotada |
| RNF008 | CI conclui compilação/testes e verificação arquitetural sem ciclos indevidos entre módulos |
| RNF009 | Clone limpo inicia PostgreSQL/Keycloak, migrations, backend/frontend seguindo instruções, sem ajuste manual não documentado |

Ferramentas, massa e duração de ensaios estão na estratégia de testes. As métricas acima são metas, não resultados já obtidos.

### Relações transversais

- RF001 está diretamente ligado ao RNF001.
- RF006 é um dos principais pontos de validação do RNF004.
- RF018 materializa parte importante do RNF003.
- RNF002 deve ser observado em todas as operações que dependem de perfil,
  propriedade do recurso ou contexto do atendimento.
- RNF006 e RNF007 devem ser validados nas jornadas principais de Paciente,
  Recepção, Médico e Administrador.
- RNF008 deve orientar a estrutura modular do backend e frontend sem exigir
  abstrações desnecessárias.
- RNF009 exige que o ambiente necessário ao projeto possa ser reproduzido de
  forma documentada.
