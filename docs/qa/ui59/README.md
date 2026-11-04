# Jornada Médica — refinamento da #59

Branch `codex/59-medical-ux`. Evidências obtidas em 04/11/2026, com dados
exclusivamente sintéticos na stack Angular, Spring, PostgreSQL e Keycloak local.

## Composição e identidade

A área médica mantém marca, fonte IBM Plex, superfícies quentes, tokens de estado
e primitives Spartan compartilhados. O shell é próprio: cabeçalho compacto e
registro amplo, sem a coluna lateral da Recepção e sem KPIs decorativos.
A fila aparece primeiro no tablet; no desktop acompanha a agenda. O primeiro
item da primeira página é identificado como próximo na ordem operacional do
backend, sem prioridade clínica inferida. A data completa evita confundir
pendências de outros dias. Agenda e fila possuem paginação.

O atendimento distingue contexto, texto clínico, situação do rascunho, histórico
e confirmação de término. Ações acompanham a rolagem desktop; no tablet há um
segundo botão de salvar no fim do registro e atalho para revisão da finalização.
Não há rodapé vazio em consultas sem ação. Entradas de rota e feedback usam o
movimento curto já definido na identidade, com suporte a movimento reduzido.

O formulário usa Signal Forms com limites equivalentes aos campos contratuais.
Rascunhos incompletos podem ser salvos. Durante o envio os campos ficam bloqueados,
evitando que uma resposta substitua uma edição feita durante a requisição.
A finalização exige texto salvo, os três campos obrigatórios e estado de
atendimento em curso conhecido, e envia a versão ao backend. Rejeição do servidor
fecha a confirmação e mantém o registro editável para correção. Não há autosave.

Conflitos de versão bloqueiam novas gravações até uma comparação explícita:
o texto local permanece na memória, a versão persistida é exibida separadamente,
e o médico confirma que deseja continuar com o texto local. Não há mesclagem
silenciosa nem armazenamento clínico no navegador. A saída com alterações exige
a confirmação já existente; após finalizar, o registro fica somente leitura.

O histórico está disponível também após finalizar e mostra os quatro campos
contratuais com paginação e nova consulta ao reabrir. Ele continua limitado aos
atendimentos finalizados deste paciente realizados pelo médico autenticado.
Nenhum endpoint, guard ou autorização backend foi ampliado.

## Evidências visuais

| Região | Antes | Depois |
| --- | --- | --- |
| Triagem desktop | [1366×768](triage-before-1366.png) | [1366×768](triage-after-1366.png) |
| Triagem tablet | [768×1024](triage-before-768.png) | [768×1024](triage-after-768.png) |
| Atendimento desktop | [1366×768](care-before-1366.png) | [1366×768](care-after-1366.png) |
| Atendimento tablet | [768×1024](care-before-768.png) | [768×1024](care-after-768.png) |

O antes/depois usa a mesma massa demo, agenda de 27/10/2026. A inspeção verificou
legibilidade de horários/paciente, área útil para escrita, agrupamento dos campos,
ações permitidas e ausência de sobreposição nos dois viewports. Avaliação visual
não equivale a teste de preferência com profissionais da clínica.

Smoke com massa isolada e API real:

- [Comparação após conflito de versão](real-comparison.png)
- [Finalizado no tablet](real-completed-tablet.png)
- [Histórico autorizado no tablet](real-history-tablet.png)

## Validação e rastreabilidade

- `npm run build`: aprovado.
- `npm test -- --watch=false`: 44 testes / 17 arquivos aprovados.
- `npm run test:e2e`: 18 cenários aprovados. Os oito cenários integrados existentes
  cobrem as quatro jornadas em desktop/tablet, labels, foco, overflow, erros de
  console/API e Axe crítico. Os quatro cenários da Recepção permanecem aprovados.
- Seis cenários de `doctor-refinement.spec.ts` usam login real e respostas
  controladas para edição, bloqueio de finalização incompleta, cancelamento de
  saída sem salvar, conflito/comparação/recuperação, histórico completo, recusa de
  finalização pelo servidor e sucesso somente leitura nos dois viewports; falha
  de início persiste após recarga. Paciente, Recepção e Administração são negados
  na rota médica antes de requisitar qualquer registro clínico.
- Axe sério/crítico e ausência de overflow passam nas telas finalizadas dos dois
  viewports. Isso complementa, sem substituir, a inspeção manual das demais telas.
- `node scripts/qa-doctor-ui.cjs`: início real, salvamento explícito, recuperação
  após reload, conflito controlado de versão, comparação e salvamento na nova
  versão, finalização no tablet e histórico autorizado aprovados.
- `git diff --check`: aprovado.

O smoke requer a massa de demonstração e os serviços locais nas portas
4200/8080/8085. Cria paciente/agendamento isolados em transação; se houver colisão
de IDs, não remove dados existentes. O finally remove apenas a massa criada;
eventos de auditoria das ações sintéticas permanecem. Nenhuma captura contém
token, senha ou dados de pessoas reais.
