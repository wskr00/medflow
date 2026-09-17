# Protótipos do MedFlow — especificação UX revisada

Este documento consolida a especificação de UX das quatro jornadas do MVP. A
especificação deve ser lida junto de `docs/planejamento/contratos-iniciais.md`,
que define os contratos e as regras de autorização usados pelos mocks e pela
integração.

Os arquivos PNG desta pasta são registros históricos da baseline visual. Eles
continuam úteis para referência de composição, hierarquia e linguagem visual,
mas não são especificações normativas quando divergirem deste documento, dos
requisitos ou dos contratos iniciais. As diferenças aprovadas nesta rodada
estão na matriz ao final. As imagens e o arquivo Figma não foram alterados.

## Convenções comuns

O produto usa navegação e mensagens em PT-BR. Instantes retornados pela API são
exibidos no fuso da clínica, sem o frontend calcular disponibilidade ou usar o
relógio local para autorizar ações. Estados de agendamento são exatamente:

`AGENDADA → EM_ESPERA → EM_ATENDIMENTO → FINALIZADA`

ou:

`AGENDADA → CANCELADA`

O frontend trata o backend como autoridade para estado, autorização,
disponibilidade e conflitos. A interface pode esconder ou desabilitar ações
incompatíveis com o estado conhecido, mas deve tratar uma resposta posterior
`409` sem assumir que a ação foi aplicada.

Listas paginadas usam os campos técnicos `items`, `page`, `size` e
`totalElements`. O envelope de erro mantém `status`, `code`, `message`,
`requestId` e `fieldErrors`; os campos de domínio permanecem em PT-BR.

Componentes compartilhados das jornadas:

- shell por perfil, navegação, skip link e gerenciamento de foco entre rotas;
- título de página, cabeçalho e breadcrumbs quando houver mais de um nível;
- `StatusBadge` textual, sem depender apenas de cor;
- skeleton de carregamento por região;
- estado vazio com orientação e ação principal;
- erro inline com tentativa de repetição;
- confirmação para cancelamento, finalização, bloqueio e desativação;
- feedback de sucesso em região `aria-live`;
- aviso de alterações não salvas;
- botões e controles nativos com alvo mínimo de 44 px.

Essa lista define fundações, não uma composição universal. Elementos com
responsabilidade diferente permanecem específicos da jornada, mesmo quando
tenham aparência parecida. Em especial, não há dashboard, cartão de
agendamento, editor de entidade ou painel de ações genérico entre os quatro
perfis.

## Arquitetura de informação por perfil

| Perfil | Prioridade do usuário | Navegação e composição |
|---|---|---|
| Paciente | encontrar, confirmar e acompanhar uma consulta com pouca carga cognitiva | fluxo guiado por agendar, meus agendamentos e histórico; cartões e listas de baixa densidade |
| Recepção | localizar rapidamente o próximo caso e executar transições sem perder a fila | agenda densa e filtros persistentes, ações por consulta e fila sempre contextualizada |
| Médico | atender um paciente por vez sem perder contexto clínico nem alterações digitadas | triagem separada da rota de atendimento; contexto, registro clínico e histórico autorizado; fila secundária |
| Administrador | configurar estrutura e agenda com relações e conflitos visíveis | áreas por domínio, diretórios e editores próprios; master/detail em desktop e rotas/etapas empilhadas em tablet |

Componentes devem receber nomes e contratos ligados à tarefa, como
`ReceptionAgendaTable`, `ClinicalRecordForm` ou `ScheduleRuleEditor`. A
semelhança visual isolada não justifica mover um componente para `shared`.

## Paciente — disponibilidade e agendamento

Requisitos relacionados: RF005, RF006, RF007, RF008, RF009 e RF017.

O fluxo começa pelos filtros de especialidade, unidade, médico opcional e uma
data. A disponibilidade é consultada para uma data por vez:

`GET /api/disponibilidades?data=&unidadeId=&especialidadeId=&medicoId?`

O seletor de datas pode oferecer navegação para o dia anterior e o próximo dia,
mas não deve pressupor que uma semana inteira foi carregada. Cada horário é
apresentado com `regraAgendaId`, `inicio` e `fim`, além dos nomes necessários
para confirmação. O usuário seleciona um único horário e revisa médico,
especialidade, unidade, consultório, data e horário antes de confirmar.

A criação envia somente:

```json
{
  "regraAgendaId": "uuid",
  "inicio": "2026-09-17T14:30:00-03:00"
}
```

O servidor deriva `fim`, paciente autenticado e os demais vínculos. A UI não
gera slots nem envia `pacienteId` para criar a consulta.

Em `AGENDADA` e enquanto o início ainda for futuro, o paciente pode usar
`POST /api/agendamentos/{id}/reagendamento` ou
`POST /api/agendamentos/{id}/cancelamento`. O reagendamento consulta
`GET /api/agendamentos/{id}/disponibilidades?data=` e preserva paciente,
médico, especialidade e unidade; o consultório pode mudar somente quando vier
em uma oferta válida da mesma unidade. A operação inclui `expectedVersion`.

`GET /api/me/agendamentos` mostra somente consultas próprias, com dados
operacionais. `GET /api/me/historico` mostra somente consultas próprias
`FINALIZADA`, também sem texto clínico. Não há autocadastro nesta jornada.

Estados de tela:

- carregando catálogos, filtros ou horários: skeleton e controles não aplicáveis
  desabilitados;
- sem disponibilidade: informar a data e os filtros usados, permitindo trocar
  a data ou limpar filtros;
- horário ocupado (`409 HORARIO_INDISPONIVEL`): manter filtros, limpar somente
  a seleção, recarregar a data e pedir nova escolha;
- confirmação concluída: mostrar o agendamento retornado e ação para consultar
  a lista própria;
- lista ou histórico vazio: explicar a ausência e oferecer agendamento quando
  aplicável;
- sessão expirada ou acesso negado: aplicar o fluxo global de autenticação sem
  mostrar dados recebidos parcialmente.

## Recepção — agenda, check-in, reagendamento, cancelamento e fila

Requisitos relacionados: RF008, RF009, RF010, RF011 e RF012.

A recepção consulta a agenda pela data local da clínica. Pode filtrar unidade,
médico e status; omitida a unidade, a visão pode abranger toda a clínica. A
projeção é estritamente operacional: paciente, médico, especialidade, unidade,
consultório, início, fim, status e `checkInEm`. Texto clínico nunca é exibido.

Para uma consulta futura em `AGENDADA`, a ação da linha ou do menu da consulta
oferece:

- reagendar, usando a disponibilidade vinculada a
  `agendamentoId` e preservando os vínculos permitidos;
- cancelar, com confirmação explícita.

As duas operações usam `expectedVersion` e as mesmas regras de transição do
paciente. Não existe ação de encaixe no MVP.

O check-in usa `POST /api/agendamentos/{id}/check-in` com `expectedVersion`.
O servidor registra `checkInEm` como instante inequívoco, exibido no fuso da clínica, e altera
`AGENDADA` para `EM_ESPERA`. Após sucesso, a UI recarrega agenda e fila.

Uma repetição retorna `409 CHECKIN_JA_REALIZADO`. Isso deve ser apresentado como
informação de que o paciente já está na fila, seguida de recarga de agenda e
fila. A interface não cria uma segunda entrada e não tenta repetir
automaticamente a operação.

A fila é derivada de todas as consultas autorizadas em `EM_ESPERA`. O contrato
atual não filtra a fila silenciosamente por data; pendências de dias anteriores
também aparecem identificadas com a data local da consulta. Caso um filtro de
data seja acrescentado futuramente, a data selecionada deverá aparecer no
título da fila e a mudança deverá ser discutida entre as áreas.

A ordenação é determinística por:

1. `inicio` da consulta;
2. `checkInEm`;
3. `id` do agendamento.

O item da fila deve mostrar pelo menos paciente, horário agendado, horário de
check-in, unidade e consultório quando a visão abranger mais de uma unidade.
O contador usa `totalElements` quando fornecido pela lista paginada; a UI não
inventa indicadores agregados a partir de uma página parcial. Não há polling
obrigatório. Existe uma ação manual “Atualizar” e a tela atualiza após cada
mutação.

Estados de tela:

- agenda carregando: skeleton das linhas;
- nenhum atendimento no resultado: estado vazio com ação para ajustar filtros;
- fila vazia: informar que não há pacientes aguardando;
- falha de rede: erro inline e “Tentar novamente”, preservando filtros;
- transição inválida ou versão desatualizada: recarregar o item e explicar o
  estado atual;
- check-in já realizado: mensagem informativa, sem duplicação;
- agenda agregada: unidade e consultório visíveis em cada item para evitar
  ambiguidade operacional.

## Médico — agenda, atendimento e histórico permitido

Requisitos relacionados: RF013, RF014, RF015, RF016 e RF017.

Agenda e fila são derivadas do médico autenticado. Não existe parâmetro de
frontend que permita trocar o profissional. O médico inicia um atendimento
`EM_ESPERA` pela ação correspondente, preenchendo a versão esperada. O início
cria um único Atendimento e muda a consulta para `EM_ATENDIMENTO`.

O registro contém somente `queixaPrincipal`, `resumoAnamnese`, `conduta` e
`observacoes`. O salvamento é explícito:

1. o usuário salva o rascunho;
2. a UI captura a nova `version` retornada;
3. a finalização usa essa versão;
4. sucesso muda para `FINALIZADA` e torna o registro somente leitura.

Rascunhos incompletos podem ser salvos. A finalização exige queixa principal,
resumo/anamnese e conduta não vazios após `trim`; observações são opcionais.
Falha no salvamento bloqueia a finalização. Falha na finalização mantém o
rascunho persistido e permite sua recuperação.

O histórico do médico é limitado aos atendimentos finalizados daquele paciente realizados
pelo médico autenticado. O atendimento em curso usa o GET autorizado do Atendimento. A resposta contém os
quatro campos do registro clínico conforme o contrato autorizado. O frontend
não deve acrescentar alergias, sinais vitais, medicações ou outros campos que
não façam parte do contrato.

Estados de tela:

- agenda/fila carregando: skeleton e ação de início indisponível;
- fila vazia: informar que não há pacientes aguardando;
- atendimento iniciado: mostrar contexto autorizado e formulário editável;
- rascunho salvo: após reload, informar que o rascunho foi persistido, sem sugerir autosave ou um horário de gravação não contratado;
- alterações não salvas: impedir saída silenciosa e avisar antes de finalizar
  ou navegar;
- `409 VERSAO_DESATUALIZADA`: não sobrescrever; oferecer recarregar e preservar
  o texto local para comparação manual;
- `409 REGISTRO_INCOMPLETO`: marcar campos obrigatórios e focar o primeiro erro;
- atendimento finalizado: exibir registro somente leitura.

## Administrador — estrutura e agenda

Requisitos relacionados: RF002, RF003 e RF004.

A jornada mantém a clínica única e permite administrar suas unidades,
consultórios, especialidades, médicos e regras de agenda. Médicos são
vinculados a subjects previamente provisionados; não há criação de conta,
atribuição de roles ou transferência de subject pelo formulário.

A configuração de agenda usa dia da semana, início, fim, duração, vigência,
médico, especialidade e consultório. Não há campos de intervalo ou
antecedência mínima. Bloqueios são registrados separadamente e alterações que
invalidem reservas existentes devem aparecer como conflito retornado pelo
backend.

A aba “Permissões” do PNG histórico não faz parte desta jornada. Identidade,
roles e autorização são tratados por Keycloak e pelo backend. O Administrador
também não recebe acesso clínico automaticamente.

Estados de tela:

- listas sem itens: estado vazio com ação de cadastro;
- formulário inválido: erro por campo, sem perder dados digitados;
- salvar: controles da entidade desabilitados até a resposta;
- `409 VERSAO_DESATUALIZADA`: recarregar o recurso sem sobrescrever alterações;
- `409 CONFIGURACAO_COM_RESERVAS`: explicar por que desativação ou alteração
  não pode prosseguir;
- bloqueio salvo: atualizar o calendário e a lista de bloqueios.

## Matriz de ajustes nas imagens históricas

| Imagem | Elementos mantidos | Ajustes normativos para implementação |
|---|---|---|
| `paciente-agendamento.png` | filtros, seleção de profissional, resumo, datas, horários e confirmação | A disponibilidade consulta uma data por vez; usar navegação de datas ou carregamento sob demanda. Criar com `regraAgendaId` e `inicio`, deixando `fim` para o servidor. Ações de reagendamento/cancelamento somente em consulta futura `AGENDADA`. Histórico próprio exibe apenas finalizadas operacionais. |
| `recepcao-checkin-fila.png` | agenda diária, estados, fila lateral e ação de check-in | Remover “Novo encaixe”, “+3 encaixes” e os números agregados atuais (“24”, “06” e “03”), pois não há resumo contratado; usar `totalElements` somente quando representar a lista retornada. Incluir “Reagendar” e “Cancelar” para consultas futuras `AGENDADA`, com confirmação e `expectedVersion`. A fila usa `inicio`, `checkInEm` e `id`; check-in repetido é `409 CHECKIN_JA_REALIZADO`. Mostrar unidade/consultório em visão agregada e atualizar manualmente/após mutações. |
| `medico-atendimento.png` | contexto do paciente autorizado, fila, formulário clínico e finalização | Remover autosave, “Registrar observação” duplicado, alergia, pressão, medicação, gênero e “paciente desde” enquanto não estiverem nos requisitos/contrato. Usar salvar explícito, versão retornada e finalização posterior. Histórico limitado aos atendimentos do médico autenticado. |
| `administrador-configuracao.png` | navegação administrativa, calendário semanal, regras e bloqueios | Remover “Intervalo”, “Antecedência mínima”, “Permissões” e busca de pacientes. Incluir telas de clínica/unidades/consultórios, profissionais e especialidades. Regras usam início, fim, duração e vigência; desativação preserva referências históricas. |

## Responsividade

As jornadas devem funcionar em 1366 px e 768 px sem rolagem horizontal do
conteúdo principal, conforme RNF006.

Em 1366 px, o shell lateral e os painéis em colunas podem seguir a composição
dos PNGs. Em 768 px:

- o menu lateral torna-se recolhível ou um menu superior;
- cartões de resumo passam a uma ou duas colunas;
- tabelas da recepção tornam-se cartões empilhados;
- fila fica abaixo da agenda ou em painel recolhível;
- as três áreas médicas seguem paciente → registro → fila recolhível;
- o formulário administrativo fica abaixo do calendário;
- horários e filtros ocupam a largura disponível;
- o foco e as ações principais permanecem visíveis sem depender de arrastar
  elementos ou de rolagem horizontal.

## Acessibilidade

As telas devem:

- usar `lang="pt-BR"`, título de página e landmarks semânticos;
- fornecer skip link e foco visível com `:focus-visible`;
- mover o foco para o título após mudança de rota;
- associar labels a todos os campos e usar `aria-invalid`/
  `aria-describedby` nos erros;
- usar botões, links, tabela, caption e cabeçalhos semânticos;
- anunciar carregamento concluído, sucesso, erro e conflito em região
  `aria-live`;
- comunicar estados por texto além de cor;
- manter contraste suficiente e suporte a `prefers-reduced-motion`;
- manter foco preso em diálogos, permitir Escape e devolver o foco ao controle
  que abriu a confirmação.

Os critérios observáveis para as jornadas são execução por teclado das ações
essenciais, foco sempre perceptível, mensagens associadas ao controle correto,
ausência de violações automáticas críticas na ferramenta escolhida e uso
funcional em 768 px e 1366 px. Métricas adicionais não devem ser inventadas.

## Estados globais e contrato de erro

Todos os erros de API seguem o contrato inicial, mantendo os campos técnicos
`status`, `code`, `message`, `requestId` e `fieldErrors`. Códigos e campos de
domínio permanecem em PT-BR. A UI deve tratar pelo menos:

- `401 NAO_AUTENTICADO`: fluxo de autenticação;
- `403 ACESSO_NEGADO`: tela ou mensagem sem revelar recurso protegido;
- `404 RECURSO_NAO_ENCONTRADO`: recurso indisponível no contexto;
- `409 HORARIO_INDISPONIVEL`: recarregar disponibilidade;
- `409 TRANSICAO_INVALIDA`: recarregar o item;
- `409 CHECKIN_JA_REALIZADO`: informar e recarregar;
- `409 VERSAO_DESATUALIZADA`: impedir sobrescrita;
- `409 REGISTRO_INCOMPLETO`: marcar campos obrigatórios;
- `500 ERRO_INTERNO`: mensagem genérica e `requestId` para suporte.

Componentes não devem depender de mensagens literais espalhadas pela
aplicação. O mapeamento de códigos para mensagens e ações deve ficar
centralizado no adaptador de API.
