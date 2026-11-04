# Paciente — refinamento da #57

Branch `codex/57-patient-ux`, baseada na `main` após a #60. Evidências de
04/11/2026 com Angular 22, Spring, PostgreSQL e Keycloak locais, dados sintéticos.

## Direção visual e tarefa

A jornada usa marca MedFlow, IBM Plex auto-hospedada, fundo quente, tinta petróleo,
linhas discretas e tokens compartilhados. Sua navegação é horizontal e tem três
destinos sempre visíveis, inclusive no tablet. Não replica os diretórios da
Administração nem a densidade da Recepção.

A próxima consulta destaca dia, mês/ano e horário; profissional, unidade e
consultório permanecem próximos, com status textual e ações autorizadas. Os
outros agendamentos são mais compactos. O histórico é uma lista cronológica de
consultas finalizadas, com data, profissional e local; ambas as listagens têm
paginação e respeitam a ordenação do backend.

Agendamento mantém três etapas: preferências, data/horário e revisão. Preferências
continuam visíveis na escolha do horário. Os slots têm botões nativos, estado
`aria-pressed` e texto de seleção; o detalhe de revisão é igual ao detalhe de
sucesso. Reagendamento compara horário atual e novo em uma etapa própria, antes
de confirmar. Sucesso permanece visível e utiliza a resposta real do servidor.

Os componentes de slots e dados de revisão pertencem à feature Paciente e têm
os dois consumidores reais: agendar e reagendar. Não há cartão ou dashboard
universal. Estilos compartilhados se limitam à jornada. Os formulários mantêm
Signal Forms e o backend continua responsável pelas regras e autorizações.

## Estados e recuperação

- `409 HORARIO_INDISPONIVEL` remove o slot obsoleto e recarrega os horários;
  especialidade, unidade, profissional e data válidos permanecem selecionados.
- Trocar especialidade limpa o profissional incompatível. Clicar novamente na data
  selecionada mantém uma data válida, evitando consulta de disponibilidade inválida.
- No reagendamento, conflito de versão fecha a revisão, remove o slot e consulta o
  agendamento atual. O paciente precisa conferir esses dados antes de escolher de
  novo; nenhuma atualização de versão libera reenvio silencioso.
- Falha de disponibilidade, ausência de horários e erro ao marcar dias têm mensagens
  e ações de recuperação. Falha de conexão em uma mutação orienta conferir as
  consultas antes de repetir, sem afirmar que a operação não ocorreu.
- Cancelamento pede confirmação. Recusa mantém o diálogo e bloqueia repetição de
  uma versão antiga; é preciso fechar e conferir a consulta atualizada. Sucesso tem
  mensagem própria, lista atualizada e foco no feedback.
- Acesso ao histórico continua operacional. Campos clínicos extras em uma resposta
  de teste não são renderizados, e a jornada não consulta endpoints clínicos.
  Guards, contratos e permissões backend não foram alterados.

Entradas de rota/etapa, feedback e seleção usam movimento curto. Foco acompanha
navegação, revisão e sucesso; o skip link funciona nas telas do Paciente.
`prefers-reduced-motion` é respeitado. Calendários têm células de 44 px nos dois
viewports solicitados; em largura estreita conservam a composição compacta.

## Antes/depois

Massa demo mais dois agendamentos futuros isolados, iguais antes e depois. As
capturas são de página inteira; os tamanhos abaixo indicam o viewport.

| Tela | Antes 1366×768 | Depois 1366×768 | Antes 768×1024 | Depois 768×1024 |
| --- | --- | --- | --- | --- |
| Consultas | [Antes](consultas-before-1366.png) | [Depois](consultas-after-1366.png) | [Antes](consultas-before-768.png) | [Depois](consultas-after-768.png) |
| Agendar | [Antes](agendar-before-1366.png) | [Depois](agendar-after-1366.png) | [Antes](agendar-before-768.png) | [Depois](agendar-after-768.png) |
| Reagendar | [Antes](reagendar-before-1366.png) | [Depois](reagendar-after-1366.png) | [Antes](reagendar-before-768.png) | [Depois](reagendar-after-768.png) |
| Histórico | [Antes](historico-before-1366.png) | [Depois](historico-after-1366.png) | [Antes](historico-before-768.png) | [Depois](historico-after-768.png) |

Fluxo com API real:

- [Revisão antes de agendar](real-booking-review-desktop.png).
- [Horário ocupado depois da seleção](real-booking-conflict-desktop.png).
- [Comparação no tablet](real-reschedule-comparison-tablet.png).
- [Versão desatualizada no tablet](real-reschedule-version-tablet.png).
- [Reagendamento confirmado](real-reschedule-success-tablet.png).
- [Cancelamento confirmado](real-cancellation-tablet.png).

## Validação e limites

- `npm run build`: aprovado.
- `npm test -- --watch=false`: 47 testes em 18 arquivos aprovados, incluindo datas
  civis e a diferença de dia entre UTC e o fuso da clínica.
- `npm run test:e2e`: 36 cenários aprovados; inclui as demais jornadas e as negações
  existentes de acesso clínico. Nove cenários novos usam login real e respostas
  controladas para estados, conflitos, revisão, cancelamento, paginação, teclado,
  preservação de escolhas e restrição de conteúdo.
- Axe sério/crítico e overflow verificados na revisão e no sucesso de agendamento
  e reagendamento em 1366×768 e 768×1024, além do histórico, cancelamento e erro de
  disponibilidade. O teste espera transições finitas terminarem antes de medir
  contraste; movimento reduzido é verificado separadamente. A navegação principal
  também foi verificada sem overflow em 320 px.
- `node scripts/qa-patient-ui.cjs`: agendamento, concorrência de horário real,
  preservação de preferências, confirmação, reagendamento, conflito de versão,
  recuperação, persistência após reload e cancelamento na stack integrada.
- `git diff --check`: aprovado.

O smoke usa a identidade Paciente de demonstração e cria regra de agenda e paciente
concorrente isolados. Uma reserva sintética é inserida após a seleção para provocar
`409`, e uma versão é incrementada para reproduzir concorrência. O `finally`
remove apenas IDs criados pelo smoke; os eventos de auditoria sintéticos ficam.
Não é teste de carga nem validação clínica. Catálogos mantêm o limite existente de
100 itens. As evidências não contêm tokens, senhas ou dados de pessoas reais.
