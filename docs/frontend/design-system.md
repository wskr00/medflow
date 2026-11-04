# Design system do frontend

## Objetivo e limites

Esta fundação suporta as jornadas de Paciente (#15), Recepção (#16), Médico (#17) e Administrador (#18), sem implementá-las. A especificação textual em `docs/prototipos.md` prevalece sobre os PNGs históricos. Não há dashboard universal, modo escuro, Storybook, polling, autosave ou biblioteca visual paralela.

O frontend usa Spartan em duas camadas: Brain é dependência npm e fornece comportamento/acessibilidade; Helm é gerado pelo CLI em `src/main/webapp/shared/ui/helm` e pertence ao repositório. Alterações de aparência ocorrem pelos tokens ou por esses componentes Helm, nunca em Brain.

## Tokens MedFlow

`src/main/webapp/tailwind.css` registra os tokens em OKLCH. As telas usam somente classes semânticas (`bg-background`, `text-foreground`, `bg-card`, `border-border`, `bg-primary`, `text-muted-foreground`) e nunca paletas Tailwind cruas.

| Grupo       | Decisão                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superfícies | `background`, `card`, `popover`, `muted` criam contraste calmo para operação clínica.                                                              |
| Ação e foco | `primary` identifica a ação principal; `ring` é o foco visível de 3 px.                                                                            |
| Status      | `success`, `warning`, `info` e `destructive` existem para conteúdo de domínio; variantes Helm continuam sendo a primeira escolha para componentes. |
| Tipografia  | IBM Plex Sans Variable auto-hospedada via Fontsource; títulos 24–44 px conforme a tarefa, texto operacional 14–16 px e números tabulares em horários.                                                                        |
| Espaçamento | Escala do Tailwind, com `gap-*` em grupos e densidade moderada.                                                                                    |
| Movimento   | `--medflow-duration-fast` (120 ms), `--medflow-duration-standard` (180 ms) e easing padrão; entradas breves de linhas e feedback; respeita `prefers-reduced-motion`.                               |
| Raio        | `--radius: 0.375rem`, aplicado pelos componentes Helm.                                                                                             |

O MVP é somente claro. Não há seletor, persistência ou promessa de suporte a modo escuro.

## Componentes Helm instalados

O conjunto é intencionalmente pequeno e foi instalado pelo CLI Spartan:

| Componente                   | Uso de referência                                     |
| ---------------------------- | ----------------------------------------------------- |
| `button`                     | ações primárias, secundárias, sair e navegação móvel. |
| `card`                       | agrupamento de conteúdo de uma tarefa.                |
| `badge`                      | `app-status-badge` para estados operacionais.         |
| `alert`                      | erro, conflito, sucesso e feedback do formulário.     |
| `field`, `input`, `textarea` | composição de formulário e validação acessível.       |
| `empty`, `skeleton`          | ausência e carregamento.                              |
| `sheet`                      | navegação recolhível em tela estreita.                |

`label` e `separator` foram incluídos como dependências transitivas do CLI. Não adicionar componente por conveniência: cada jornada deve usar um Helm existente ou justificar o novo componente no PR. Rodar `npx ng g @spartan-ng/cli:healthcheck` após atualizações Spartan.

## Padrões reutilizáveis

- `app-page-header`: sobrancelha de perfil, título e contexto da tarefa.
- `app-status-badge`: traduz somente os status contratuais de agendamento em rótulos e variantes Helm. Não inventa novos status nem regra de transição.
- `app-medflow-brand`: assinatura visual compartilhada dos cabeçalhos autenticados; o contexto textual é opcional e não substitui a navegação específica de cada perfil.
- `app-state-panel`: loading, vazio, erro, conflito e sucesso. A tela da jornada fornece texto contextual e a ação de recuperação.
- Formulários: `form()`/Signal Forms com `FormRoot`, `FormField`, `hlmField`, label associado por `for`/`id`, descrição e `hlm-field-error`. Validação local é de formato/obrigatoriedade; regras de negócio continuam no backend.
- Escolhas múltiplas pequenas usam `hlm-toggle-group`; `hlm-native-select` permanece adequado para escolha única em formulários quando a semântica nativa é suficiente. Elementos acionáveis expõem cursor, foco e hover; cards meramente informativos não simulam clique.

Erros de `fieldErrors` da resposta contratada devem ser associados ao campo correspondente. Erros sem campo são exibidos em `app-state-panel`/`hlmAlert`. Um `409 VERSAO_DESATUALIZADA` ou conflito de transição não sobrescreve texto local: comunica o conflito e oferece recarregar o recurso.

## Fronteira de reutilização

O design system unifica linguagem, tokens e comportamento acessível; ele não
uniformiza as jornadas. Paciente, Recepção, Médico e Administrador têm tarefas,
densidades e decisões distintas, portanto podem e devem ter composição de
layout, navegação interna e componentes de domínio próprios.

Compartilhar por padrão:

- tokens, tipografia, foco, movimento e breakpoints;
- primitives Brain e componentes Helm;
- sessão, guards, shell técnico, skip link e tratamento base de erros;
- padrões de loading, vazio e feedback somente quando a semântica for igual.

Manter na feature do perfil:

- layout operacional, rotas e navegação secundária;
- tabelas, cartões, filtros, ações e formulários da jornada;
- recuperação de conflitos e componentes com vocabulário de domínio.

Não criar `Dashboard`, `AppointmentCard`, editor genérico de entidades ou
painel universal de ações apenas porque duas telas têm aparência semelhante.
Uma abstração compartilhada exige pelo menos dois consumidores reais e a mesma
semântica, comportamento e requisitos de acessibilidade. Sem isso, a pequena
duplicação visual é preferível ao acoplamento entre jornadas.

## Acessibilidade e responsividade

O shell contém skip link, `<nav>` nomeado, `<main>` focalizável e foco no conteúdo após a ativação de rota. A `sheet` fornece navegação móvel com título; não são usados `z-index` manuais. Estados carregando usam `aria-busy`; erros usam alertas semânticos.

Os shells têm composições próprias. Na Recepção (#58), desktop a partir de
1024 px usa uma faixa lateral de 12,5 rem; em 1366×768 a agenda e a fila ficam
lado a lado. Abaixo de 1280 px, agenda e fila se empilham, com atalhos para as
regiões. Em 768×1024, o cabeçalho é horizontal, a agenda usa cartões e filtros
em duas colunas. As demais jornadas conservam seus shells e recebem os tokens,
a marca e os estados compartilhados.

## Direção visual aplicada na #58

Fundo de papel quente, tinta petróleo e superfícies brancas, com linhas e
proximidade organizando a leitura. A marca usa um M contínuo em lugar da cruz
médica genérica. Status usam rótulo, ponto e cores semânticas; cancelamento,
espera, atendimento e finalização têm tratamentos distintos. A fonte é servida
pelo próprio app, sem chamadas a provedores de fontes em tempo de execução.

A Recepção prioriza horário e paciente, com especialidade, profissional e local
agrupados; a ação de chegada tem maior peso que reagendamento e cancelamento.
A fila mantém a ordem do backend e não apresenta prioridade clínica ou tempo
de espera inferidos. Não há KPIs decorativos nem um shell universal.

Evidências e limites: [revisão da #58](../qa/ui58/README.md).

Na revisão da #58, o painel lateral passou a manter sessão e saída fora da região
rolável. O fundo preenche toda a coluna. A fila possui lista rolável e altura
limitada à janela apenas no desktop; o tablet usa a rolagem da página. Entradas
de rota usam 180 ms e 6 px, com foco/topo restaurados na ativação. Os extremos
1024×500 e 320 px foram acrescentados às evidências e aos testes de painéis.

## Área médica — #59

A identidade compartilhada é aplicada em um cabeçalho compacto e área ampla de
escrita, com composição própria do médico. Triagem usa agenda/fila; atendimento
usa contexto, campos e ações separadas. O tablet oferece salvamento ao fim do
formulário, e o histórico permanece em um painel lateral acessível. Conflitos
exibem comparação explícita sem substituir texto local. Evidências e limites:
[revisão da #59](../qa/ui59/README.md).
