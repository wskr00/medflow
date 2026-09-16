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
| Tipografia  | Pilha sem serifa do sistema, títulos 24–30 px e texto operacional 14–16 px.                                                                        |
| Espaçamento | Escala do Tailwind, com `gap-*` em grupos e densidade moderada.                                                                                    |
| Movimento   | `--medflow-duration-fast` (120 ms), `--medflow-duration-standard` (180 ms) e easing padrão; sem animação decorativa.                               |
| Raio        | `--radius: 0.625rem`, aplicado pelos componentes Helm.                                                                                             |

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
- `app-state-panel`: loading, vazio, erro, conflito e sucesso. A tela da jornada fornece texto contextual e a ação de recuperação.
- Formulários: `form()`/Signal Forms com `FormRoot`, `FormField`, `hlmField`, label associado por `for`/`id`, descrição e `hlm-field-error`. Validação local é de formato/obrigatoriedade; regras de negócio continuam no backend.

Erros de `fieldErrors` da resposta contratada devem ser associados ao campo correspondente. Erros sem campo são exibidos em `app-state-panel`/`hlmAlert`. Um `409 VERSAO_DESATUALIZADA` ou conflito de transição não sobrescreve texto local: comunica o conflito e oferece recarregar o recurso.

## Acessibilidade e responsividade

O shell contém skip link, `<nav>` nomeado, `<main>` focalizável e foco no conteúdo após a ativação de rota. A `sheet` fornece navegação móvel com título; não são usados `z-index` manuais. Estados carregando usam `aria-busy`; erros usam alertas semânticos.

Em 1366×768, a navegação ocupa coluna lateral de 17 rem e o conteúdo conserva largura máxima legível. Em 768×1024, a coluna lateral desaparece, o botão Menu abre a sheet e o conteúdo permanece em uma coluna sem rolagem horizontal. Cada jornada deve manter filtros e ação principal visíveis, empilhar tabelas/painéis quando necessário e não exigir arrastar para descobrir conteúdo.
