# Autorização funcional e contextual

Implementação da Issue #11 para a base atualmente disponível do MedFlow. Este documento descreve comportamento implementado e separa, de forma explícita, o que só poderá ser comprovado quando Agendamento, Recepção e Atendimento existirem.

## Modelo implementado

O `SecurityFilterChain` continua responsável por autenticação, validação do JWT e exigência de uma das quatro roles do cliente `medflow-api`. Os controladores declaram o gate funcional com Method Security. Um teste de inventário falha se algum handler atual sob `/api/` não possuir `@PreAuthorize` no método ou na classe.

`AuthenticatedContextService` é o adaptador entre Spring Security e a projeção local de identidade. Ele:

- lê `subject` e authorities do `JwtAuthenticationToken` já validado;
- consulta os vínculos locais, sem criar ou alterar registros;
- só expõe `pacienteId` quando a conta possui `PATIENT` e vínculo de Paciente;
- só expõe `medicoId` quando a conta possui `DOCTOR` e vínculo de Médico ativo;
- não cria hierarquia entre roles.

`AuthenticatedActor`, em `common.auth`, é um record puro, sem dependência de JWT, `Authentication` ou estado global. Os casos de uso futuros podem recebê-lo sem criar dependência dos módulos de negócio em `security`. `ContextAuthorization` é deliberadamente restrito ao gate de Method Security dos catálogos existentes; não é uma ACL nem um motor genérico de políticas.

`GET /api/me` informa o contexto resolvido. Role sem vínculo aparece com o id local nulo e não dispara autocadastro. Receptionist e Administrator não precisam de entidade local própria na clínica única.

## Matriz exercitável agora

| Recurso atual | Patient | Receptionist | Doctor | Administrator |
|---|---|---|---|---|
| `/api/me` | contexto, vínculo opcional | contexto | contexto, somente Médico ativo | contexto |
| catálogos `/unidades`, `/especialidades`, `/medicos` | mínimos ativos, exige vínculo | mínimos ativos | negado | completos; pode incluir inativos |
| `/clinica`, `/consultorios`, regras e bloqueios | negado | negado | negado | permitido |
| mutações de configuração | negado | negado | negado | permitido |

As projeções mínimas não retornam endereço, CRM, flags administrativas, versão, subject ou texto clínico. Não existe conteúdo clínico no modelo atual; portanto, o isolamento de texto clínico da Recepção ainda não pode ser demonstrado contra um recurso real.

## Integração obrigatória nas Issues dependentes

As Issues #10, #12 e #13 devem aplicar autorização em duas etapas, dentro do caso de uso, sem confiar em ids fornecidos pela interface:

1. declarar a role funcional com `@PreAuthorize`;
2. receber `AuthenticatedActor` e exigir explicitamente a role concreta e o vínculo correspondente antes de buscar ou expor estado; ausência de role/vínculo resulta em `403`;
3. consultar por id **e** `actor.pacienteId()`/`actor.medicoId()`, retornando `ResourceNotFoundException` tanto para ausência quanto para contexto alheio;
4. em mutações, adquirir os locks na ordem acordada, recarregar o estado e comparar novamente o proprietário ou médico do agregado bloqueado com o actor antes de validar estado e alterar; diferença resulta no mesmo `404`;
5. montar DTOs a partir de projeções próprias da operação. Projeção de Recepção jamais deve carregar registro clínico.

Aplicação por Issue:

- #10: criação e listagem Patient derivam `pacienteId` do contexto; leitura/reagendamento/cancelamento por id usam consulta escopada e revalidação pós-lock.
- #12: Receptionist opera a clínica única sem vínculo local, recebe somente projeção operacional e nunca ganha acesso por Patient/Doctor implícito.
- #13: agenda, fila, Atendimento e histórico clínico derivam `medicoId` ativo do contexto; acesso a atendimento de outro médico usa `404`, inclusive na revalidação após lock.

Uma conta multi-role só satisfaz uma operação clínica quando possui a role concreta e o vínculo correspondente. `ADMINISTRATOR` isoladamente deixa `pacienteId` e `medicoId` nulos no actor e não concede acesso clínico automático.

## Limite de rastreabilidade

Os testes desta Issue comprovam autenticação/negação HTTP, matriz dos endpoints existentes, vínculo Patient ausente, vínculo Doctor inativo, conta multi-role, contexto administrativo sem herança clínica e ausência de autocadastro. Os cenários de `404` para outro Paciente/Médico, DTO operacional da Recepção sem texto clínico e revalidação real depois do lock permanecem critérios de #10/#12/#13 e da matriz final de RNF002 em #23/#25. Nenhum endpoint, entidade ou helper de recurso fictício foi criado para antecipar essa evidência.
