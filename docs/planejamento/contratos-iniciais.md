# Contratos iniciais do MVP

Contrato de planejamento da Issue #7, revisado entre Produto, Backend, Frontend, Segurança e QA. Não representa API implementada. Decisões de recorte foram delegadas pelo usuário nesta rodada. Prefixo único `/api`; JSON em camelCase, recursos e campos de domínio em português, convenções técnicas (`items`, `version`, `code` etc.) em inglês, UUID como string.

## Convenções compartilhadas

Instantes usam ISO 8601 com offset; recorrências usam data/hora local e fuso IANA da clínica. Respostas de disponibilidade incluem `timeZone`. O backend determina o instante atual e os horários derivados, nunca o relógio do navegador.

Listas operacionais usam `items`, `page` (zero inicial), `size`, `totalElements`; padrão 20, máximo 100. Disponibilidade usa uma data por consulta e retorna `items` e `timeZone`, sem paginação de slots. Catálogos e a lista própria de agendamentos aceitam `q` em RSQL somente pelos aliases documentados para cada endpoint; o servidor rejeita qualquer seletor fora da lista, aplica o escopo autorizado antes do filtro e não expõe a navegação do modelo JPA. Disponibilidade não aceita RSQL: seus filtros continuam explícitos e sua regra é calculada pelo domínio.

Recursos mutáveis possuem `version` inteiro. Alterações recebem `expectedVersion`; divergência retorna `409 VERSAO_DESATUALIZADA`, sem sobrescrever dados. A versão não substitui locks para conflito entre reservas diferentes.

Autorização ocorre antes da validação de estado e de qualquer retorno de dado protegido. O paciente da criação vem do usuário autenticado. IDs de médico, unidade e atendimento enviados pelo navegador nunca concedem permissão.

A autorização contextual é revalidada sobre o estado atual após adquirir os locks, antes da mutação. Verificação prévia não autoriza usar contexto obsoleto dentro da transação.

## Catálogos e configuração

| Operação | Contrato mínimo |
|---|---|
| `GET /api/me` | `subject`, `roles`, `pacienteId?`, `medicoId?`, `clinicaId`, `timeZone`; sem conteúdo clínico |
| `GET /api/unidades`, `/especialidades`, `/medicos` | Projeções de catálogo ativas: id/nome e vínculos necessários à seleção; sem subject, data de nascimento ou contatos privados |
| `GET/PUT /api/clinica` | Clínica única cadastrada no provisionamento reproduzível; administração mantém seus dados com `expectedVersion`, sem criar segunda clínica |
| `GET/POST /api/unidades`, `/consultorios`, `/especialidades`, `/medicos` | Administração autenticada; criação 201 com id/version; consultas paginadas na clínica configurada |
| `PUT /api/{recurso}/{id}` | Atualização administrativa com `expectedVersion`; referências históricas preservadas; desativação via `ativo=false` |
| `GET/POST /api/regras-agenda`; `PUT /api/regras-agenda/{id}` | `medicoId`, `consultorioId`, `especialidadeId`, `diaSemana` (1 segunda a 7 domingo), `horaInicio`, `horaFim`, `duracaoMinutos`, `vigenteDe`, `vigenteAte?`, `ativo` |
| `GET/POST /api/bloqueios-agenda`; `PUT /api/bloqueios-agenda/{id}` | `medicoId`, `inicio`, `fim`, `ativo`; bloqueio médico absoluto; alteração revalida reservas afetadas |

Novos médicos são vinculados a subjects previamente provisionados, com validação de unicidade; não existe criação de conta ou atribuição de roles por um formulário genérico de profissionais. Subject é imutável no CRUD genérico, pois trocá-lo transferiria acesso ao histórico. O procedimento reproduzível de vínculo é parte de #9/#11. Pacientes sintéticos são provisionados junto dos vínculos; não criar autocadastro implicitamente.

Campos de configuração: clínica `{nome,timeZone,ativo}`, unidade `{nome,endereco,ativo}`, consultório `{unidadeId,nome,ativo}`, especialidade `{nome,ativo}`, médico `{nome,crmNumero,crmUf,especialidadeIds,ativo}`. A clínica é derivada do contexto, não escolhida no payload. Identidade é vinculada pelo provisionamento, fora desses formulários. Nome é obrigatório (até 200 caracteres), endereço até 500; CRM exige número e UF, unicidade por número+UF. Registro médico sem vínculo de identidade pode ser configurado, mas não pode autenticar como profissional até provisionado. Atualizações adicionam `expectedVersion`; respostas incluem id/version e os campos autorizados.

Consultas GET de catálogos por Paciente/Recepção retornam projeção mínima ativa; Administração pode incluir inativos para manutenção. Não confundir essa permissão GET com os verbos de escrita, exclusivos da Administração.

## Disponibilidade e agendamento

| Operação | Entrada | Saída e regra |
|---|---|---|
| `GET /api/disponibilidades` | `data`, `unidadeId`, `especialidadeId`, `medicoId?` | `items[{regraAgendaId,medicoId,especialidadeId,consultorioId,inicio,fim}]`, `timeZone`; consulta não reserva horário |
| `POST /api/agendamentos` | `regraAgendaId`, `inicio` | 201, agendamento confirmado; servidor deriva paciente, fim e demais vínculos, revalidando disponibilidade |
| `GET /api/me/agendamentos` | `page`, `size`, `recorte?`, `q?`, `status?`, `dataDe?`, `dataAte?` | Somente próprios, incluindo futuros/passados; dados operacionais |
| `GET /api/agendamentos/{id}` | id | Projeção operacional autorizada; sem registro clínico |
| `POST /api/agendamentos/{id}/reagendamento` | `regraAgendaId`, `inicio`, `expectedVersion` | 200, mesmo id e `AGENDADA`; falha mantém integralmente reserva anterior |
| `POST /api/agendamentos/{id}/cancelamento` | `expectedVersion` | 200, `CANCELADA`, somente a partir de `AGENDADA` |

Projeção operacional: `id`, `version`, `inicio`, `fim`, `status`, `checkInEm` (null antes da chegada), `medico`, `especialidade`, `unidade`, `consultorio` (cada um `{id,nome}`) e `allowedActions:{canReschedule,canCancel}`. As duas ações são calculadas pelo backend a partir do estado atual e do relógio da clínica; a UI não as infere pelo seu próprio relógio. `paciente:{id,nome}` só aparece nas visões operacionais autorizadas da recepção e médico. Nenhum texto clínico integra essa projeção. Disponibilidade inclui também esses objetos de exibição, além dos IDs de seleção, evitando requisições individuais por slot.

RF008 e RF009 autorizam também Recepcionista na clínica. Para reagendar, usa `GET /api/agendamentos/{id}/disponibilidades?data=`, que valida acesso e, antes de revelar slots, rejeita `409 TRANSICAO_INVALIDA` se o agendamento não estiver `AGENDADA` ou já tiver iniciado. Quando válida, a oferta é restrita a seu médico, especialidade e unidade. A API de criação permanece exclusiva do Paciente. Reagendamento mantém paciente, médico, especialidade e unidade; consultório pode mudar para outra oferta válida da mesma unidade. Cancelamento/reagendamento exigem `AGENDADA` e instante atual anterior ao início.

Disponibilidade de reagendamento exclui a própria reserva do cálculo, mas não outras reservas; a confirmação repete essa regra atomicamente. Selecionar exatamente a oferta atual é operação sem alteração: retorna a representação atual, sem incrementar versão nem gerar segundo evento de mutação.

### Filtros RSQL da jornada do paciente

Os operadores e valores são interpretados pelo starter RSQL; `q` pode combinar predicados com `;` (E) e `,` (OU). Não há `sort` recebido do cliente para estas listas.

| Endpoint | Aliases RSQL aceitos | Recorte e ordem do servidor |
|---|---|---|
| `GET /api/unidades` | `id`, `nome` | catálogo ativo para Paciente/Recepção; `nome,id` crescente |
| `GET /api/especialidades` | `id`, `nome` | catálogo ativo para Paciente/Recepção; `nome,id` crescente |
| `GET /api/medicos` | `id`, `nome`, `especialidadeId` | catálogo ativo para Paciente/Recepção; `nome,id` crescente |
| `GET /api/me/agendamentos` | `status`, `inicio`, `medicoId`, `especialidadeId`, `unidadeId` | `recorte=UPCOMING`: AGENDADA futura, início/id crescente; `PAST`: não cancelada já iniciada, início decrescente/id crescente; `CANCELLED`: cancelada, início decrescente/id crescente |

`status`, `dataDe` e `dataAte` permanecem temporariamente aceitos em `GET /api/me/agendamentos`; o backend os combina ao `q` antes da consulta. O novo frontend deve preferir `recorte` e `q` quando precisar de filtros combináveis.

## Recepção e atendimento

| Operação | Contrato mínimo |
|---|---|
| `GET /api/recepcao/agenda` | `data`, `unidadeId?`, `medicoId?`, `status?`; somente visão operacional no contexto autorizado |
| `GET /api/recepcao/fila` | `unidadeId?`, `medicoId?`; somente `EM_ESPERA`, ordem `inicio`, `checkInEm`, `id`, incluindo espera pendente de dia anterior claramente identificada |
| `GET /api/medico/agenda`, `/api/medico/fila` | Médico derivado da identidade, sem parâmetro que permita trocar o profissional; agenda por data, fila em espera |
| `POST /api/agendamentos/{id}/check-in` | `expectedVersion`; somente data local da consulta; 200 altera `AGENDADA` para `EM_ESPERA`; repetição 409, preserva primeiro timestamp e não duplica sucesso de auditoria |
| `POST /api/agendamentos/{id}/atendimento` | `expectedVersion`; 201 cria um único Atendimento e muda para `EM_ATENDIMENTO` atomicamente |
| `GET /api/atendimentos/{id}` | Médico autorizado; `id`, `agendamentoId`, `version`, `iniciadoEm`, `finalizadoEm?`, `registroClinico` |
| `PUT /api/atendimentos/{id}/registro-clinico` | `expectedVersion`, `queixaPrincipal`, `resumoAnamnese`, `conduta`, `observacoes`; 200 retorna nova versão; rascunho incompleto permitido |
| `POST /api/atendimentos/{id}/finalizacao` | `expectedVersion`; valida versão e registro persistido; 200 grava término e `FINALIZADA` na mesma transação |
| `GET /api/me/historico` | Finalizadas próprias, somente projeção operacional, sem texto clínico |
| `GET /api/medico/pacientes/{id}/historico` | Somente atendimentos finalizados desse paciente realizados pelo médico autenticado, com quatro campos clínicos; lista vazia uniforme quando não existem registros autorizados |

Finalização exige queixa, resumo/anamnese e conduta não vazios após trim; observações opcionais. Limites técnicos acordados: queixa até 2.000 caracteres, resumo e conduta até 10.000 cada, observações até 5.000; frontend e backend usam os mesmos limites. Não são validações de conteúdo médico.

Criação/reagendamento/cancelamento/check-in retornam a projeção operacional com versão atual. Início retorna `{agendamento,atendimento}`; salvar registro retorna o Atendimento com nova versão; finalização retorna `{agendamento,atendimento}` com versões atuais e término preenchido. Agenda/fila usam a mesma projeção operacional em envelope paginado; histórico médico usa o Atendimento finalizado e referências operacionais. Agenda ordena por início/id, históricos por início decrescente/id. Sem indicador agregado calculado apenas sobre a página atual: a UI usa `totalElements` da consulta correspondente ou omite o contador.

UI salva explicitamente o rascunho. Havendo alterações locais, deve salvar com sucesso antes de finalizar e usar a versão retornada. Falha de salvamento bloqueia a finalização; falha de finalização mantém o rascunho persistido e permite recuperação do estado pelo GET. Depois de finalizado, nenhuma edição pelo fluxo normal.

## Erros

Formato único inclusive em filtros de autenticação/autorização:

```json
{
  "status": 409,
  "code": "HORARIO_INDISPONIVEL",
  "message": "Este horário não está mais disponível.",
  "requestId": "7eb48042-8dc7-4bcd-83c6-d14ef46b3e92",
  "fieldErrors": []
}
```

`fieldErrors` contém `{field, code, message}` somente quando aplicável, sem valor rejeitado sensível. `400` para formato/campos inválidos; `401` credencial ausente/inválida/expirada; `403` função não permitida; `404` recurso inexistente ou fora do contexto, sem distinguir ambos; `409` conflito de horário/estado/versão; `500` falha interna genérica. Não retornar SQL, stacktrace, token ou texto clínico em mensagens.

Códigos iniciais: `ENTRADA_INVALIDA`, `NAO_AUTENTICADO`, `ACESSO_NEGADO`, `RECURSO_NAO_ENCONTRADO`, `HORARIO_INDISPONIVEL`, `TRANSICAO_INVALIDA`, `CHECKIN_JA_REALIZADO`, `VERSAO_DESATUALIZADA`, `REGISTRO_INCOMPLETO`, `CONFIGURACAO_COM_RESERVAS`, `ERRO_INTERNO`.

Em duplicação simultânea de check-in, a validação pode observar versão antiga; ambos `CHECKIN_JA_REALIZADO` e `VERSAO_DESATUALIZADA` conduzem a recarregar estado, sem repetir o efeito. O contrato não promete deduplicação genérica de todos os comandos após perda de resposta.

## Condição para trabalho paralelo

Estes contratos devem ser transcritos em OpenAPI/exemplos de teste no início das respectivas Issues. Frontend pode trabalhar contra mocks do contrato estabilizado; integração final depende do backend e da autorização. Alterações de contrato após esta rodada precisam ser discutidas entre Backend, Frontend, Segurança e QA antes da adoção.

Catálogos mínimos: Paciente e Recepção podem consultar somente unidades, especialidades e médicos ativos. Unidade/especialidade retornam `{id,nome}` e médico `{id,nome,especialidadeIds}`; não retornam endereço, CRM, ativo, versão ou subject. `incluirInativas=true` e DTOs completos são exclusivos de Administração. Médico não usa catálogo geral neste recorte.
