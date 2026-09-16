# Autenticação autorização e auditoria

Decisões de planejamento da Issue #7, sob delegação do usuário para resolver ambiguidades do MVP acadêmico. Responsabilidade humana: Lucas Christian Gouveia Ferreira. Nenhum mecanismo descrito aqui é declarado implementado.

## Contexto organizacional e identidade

Uma clínica por instalação, com múltiplas unidades. Recepção e Administração operam nas unidades dessa clínica; não há multiempresa nem concessão dinâmica por unidade. O backend sempre valida que referências pertencem à clínica configurada. Essa escolha reduz a necessidade de gestão de vínculos organizacionais sem relaxar isolamento clínico.

Keycloak contém contas sintéticas previamente provisionadas, credenciais, sessões e roles de cliente `PATIENT`, `RECEPTIONIST`, `DOCTOR`, `ADMINISTRATOR`, no cliente `medflow-api`. Cliente público separado `medflow-web` usa Authorization Code com PKCE S256. Sem autocadastro, gestão de permissões na SPA ou Keycloak Authorization Services.

SPA mantém tokens em memória, usa redirects/origens explícitos e envia bearer token apenas à API configurada. Backend valida assinatura, emissor, expiração/not-before e audiência `medflow-api`, extraindo roles apenas de `resource_access.medflow-api.roles`. Token de identidade não substitui access token. `/api/me` retorna os vínculos locais autorizados e não aceita que a UI escolha o proprietário do recurso.

O banco mantém o vínculo único entre `sub` do emissor configurado e Paciente/Médico. Nome e e-mail não são chaves de autorização. Usuário com role mas sem vínculo necessário recebe negação; não ganha perfil automaticamente. Seeds de domínio e realm precisam concordar nos subjects e ser reproduzíveis. Administrador de domínio não recebe administração do realm.

Não há hierarquia entre roles. Conta com várias roles exige o vínculo correspondente a cada operação; a escolha de área na UI é apenas navegação. Administrador com role médica adicional só atende consultas atribuídas ao seu vínculo médico.

## Matriz de acesso

| Recurso ou ação | Paciente | Recepcionista | Médico | Administrador |
|---|---|---|---|---|
| Catálogos para seleção | Ativos, mínimos | Operacionais | Própria agenda | Configuração |
| Estrutura, profissionais, regras e bloqueios | Não altera | Não altera | Não altera | Mantém na clínica |
| Disponibilidade | Para si | Para reagendar consulta da clínica | Sem busca geral | Prévia de configuração |
| Criar reserva | Somente para si | Não | Não | Não |
| Ler agendamentos | Próprios | Operacionais da clínica | Atribuídos ao próprio médico | Não automático |
| Reagendar/cancelar | Próprio e AGENDADA futura | Da clínica e AGENDADA futura | Não | Não |
| Check-in | Não | AGENDADA na data local da consulta | Não | Não |
| Fila | Não | Clínica, filtrável por unidade/médico | Própria fila | Não automático |
| Iniciar atendimento | Não | Não | Próprio agendamento EM_ESPERA | Não |
| Salvar/finalizar registro | Não | Não | Próprio atendimento EM_ATENDIMENTO | Não |
| Histórico operacional | Próprias finalizadas | Somente agenda operacional, sem histórico clínico | Próprios atendimentos finalizados | Não automático |
| Histórico clínico | Não no MVP | Não | Somente atendimentos finalizados realizados pelo próprio médico | Não automático |
| Auditoria técnica | Não | Não | Não geral | Consulta restrita de metadados da clínica |

Histórico do paciente retorna id, início/fim agendados, profissional, especialidade, unidade, consultório e status; não retorna queixa, resumo, conduta nem observações. Próprios agendamentos (RF007) já permitem visualizar os demais estados. Essa definição de RF017 é produto do recorte acadêmico, não afirmação sobre direitos legais de acesso a documentos médicos.

Histórico do médico inclui os quatro campos clínicos somente de atendimentos finalizados atribuídos a ele. Atendimento em curso é acessado pelo GET autorizado do Atendimento. Não basta o paciente estar em uma fila atual para obter registros de outro médico. Depois da finalização, leitura continua permitida ao responsável e escrita é negada. Mudança de médico durante atendimento não faz parte do MVP.

## Fronteiras e respostas

Toda API de negócio exige autenticação. Endpoints técnicos mínimos só podem expor status sem configurações internas. Spring Security protege rotas e casos de uso; guardas Angular não substituem isso. Projeções operacionais jamais carregam conteúdo clínico para depois escondê-lo no navegador.

`401` para token ausente/inválido; `403` para função/vínculo ausente; `404` para recurso inexistente ou fora do contexto; `409` para conflito apenas depois da autorização. Listas são filtradas no servidor, incluindo contagens e paginação, e não revelam existência de recursos alheios.

## Matriz de auditoria

| Eventos | Fonte | Resultado esperado |
|---|---|---|
| Login/logout e falhas de autenticação | Eventos do Keycloak habilitados | Procedimento de consulta documentado, sem copiar credenciais para aplicação |
| Criar/alterar/desativar estrutura, profissional, especialidade, regra e bloqueio | Aplicação | Evento de sucesso na mesma transação da alteração |
| Agendar, reagendar e cancelar | Aplicação | Ator, ação, recurso e resultado; transições sem dados clínicos |
| Check-in, início, salvar registro e finalizar | Aplicação | Um evento por mutação efetiva; repetição rejeitada não duplica sucesso |
| Ler registro clínico e histórico clínico | Aplicação | Evento de acesso por requisição autorizada, com recurso e resultado, sem conteúdo |
| Acesso contextual/funcional negado e comandos conflitantes | Aplicação | Resultado NEGADO/CONFLITO durável fora da transação revertida |
| Consulta administrativa de auditoria | Aplicação | Acesso rastreável, sem edição/exclusão dos eventos pela API |

Evento mínimo: id, ator confiável (ou anônimo), ação, tipo/id de recurso, instante UTC, resultado, requestId. Não registrar tokens, cabeçalhos Authorization, senhas, corpos HTTP clínicos ou valores de campos rejeitados. IDs técnicos de recursos têm acesso restrito, mesmo sem texto clínico.

Mutações críticas e evento de sucesso são atômicos: se a auditoria falhar, a operação não é confirmada. Negações/conflitos são registrados após rollback em transação independente; sua indisponibilidade não libera o acesso. Falha de auditoria deve ser observável como falha técnica; não prometer durabilidade durante indisponibilidade total. Leitura clínica auditável só entrega conteúdo após persistir o evento de acesso.

Consulta de eventos: `GET /api/auditoria?dataDe=&dataAte=&page=&size=`, protegida por `ADMINISTRATOR`, intervalo obrigatório de no máximo 31 dias e paginação limitada. Retorna apenas metadados da clínica. Sem dashboard, política de retenção automatizada, expurgo ou garantia contra alteração por administrador do banco no MVP.

## Verificação e limites

Testar outro paciente/médico, acesso direto por ID, contexto errado, conta multi-role sem vínculo, administrador sem role clínica, token expirado/emissor/audiência inválidos e ausência de texto clínico nas respostas operacionais/logs. Conferir eventos de negação após rollback e ausência de evento de sucesso após rollback de negócio.

Compose `start-dev` e credenciais sintéticas são locais. Não há declaração de prontidão para produção, conformidade legal integral ou revogação instantânea de JWT já emitido. Validade e renovação do access token serão configuradas e documentadas em #9; a política de demonstração é access token de 5 minutos, com renovação enquanto a sessão for válida.

Referências técnicas: [adaptador oficial Keycloak](https://www.keycloak.org/securing-apps/javascript-adapter) para SPA/PKCE/memória; [Spring Security Resource Server JWT](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html) para validação de JWT e audiência. As permissões de negócio são decisões do MedFlow, não prescrições dessas fontes.

Paciente e Recepção consultam apenas os catálogos mínimos ativos de unidade, especialidade e médico. Solicitar inativos, DTO administrativo, clínica, consultório, regra ou bloqueio é negado. Médico não recebe busca geral de catálogo; mutações de configuração permanecem exclusivas de Administração.
