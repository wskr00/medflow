# Recepção — refinamento visual da #58

Implementação na branch `codex/58-reception-visual`, avaliada em 04/11/2026.

## Decisões e escopo

A composição organiza o trabalho pela agenda e pela fila, com uma faixa lateral
própria da Recepção em desktop e cabeçalho compacto no tablet. Horário e paciente
são os primeiros elementos da linha; profissional, especialidade e local ficam
agrupados. A chegada é a ação principal, com reagendamento e cancelamento
secundários. Não há contagens inventadas nem KPIs calculados de páginas parciais.

A identidade usa fundo quente, petróleo, IBM Plex Sans Variable auto-hospedada e
marca M contínua. Marca, tokens, botões, status e estados vazios são compartilhados
com os demais perfis. Os outros shells não foram substituídos pelo da Recepção.
A pequena transição de entrada de linhas e feedback respeita movimento reduzido.

Foram preservados os componentes Spartan e as permissões retornadas pelo backend.
A fila continua ordenada pelo servidor. Pendências anteriores têm texto explícito;
a numeração representa posição na página/ordem, sem sugerir prioridade clínica.
A paginação da fila agora permite retornar à página anterior.

A leitura do valor de `httpResource` no cabeçalho foi corrigida para usar
`hasValue()`: uma falha HTTP anteriormente podia interromper a renderização antes
da mensagem de erro. Cada região pode ser recarregada independentemente, e filtros
continuam selecionados após erro e conflito. Em mutações, os botões de confirmação
ficam desabilitados enquanto há uma operação em andamento.

## Evidências visuais

As imagens são exclusivamente sintéticas; não contêm tokens nem registros clínicos.
Antes e depois usam a mesma agenda da demonstração, em 27/10/2026. Os cenários de
ação usam quatro pacientes e agendamentos isolados, removidos ao fim do smoke.
As capturas completas usam animações finalizadas para não registrar frames parciais.

| Cenário | Evidência |
| --- | --- |
| Antes, 1366×768 | [desktop](reception-before-desktop.png) |
| Depois, 1366×768 | [desktop](reception-after-desktop.png) |
| Antes, 768×1024 | [tablet](reception-before-tablet.png) |
| Depois, 768×1024 | [tablet](reception-after-tablet.png) |
| Ações autorizadas | [desktop](reception-actions-desktop.png), [tablet e sucesso](reception-actions-tablet.png) |
| Versão desatualizada real | [conflito](reception-conflict.png) |
| Revisão de reagendamento real | [revisão](reception-reschedule-review.png) |
| Estados com falha controlada | [carregamento](reception-loading.png), [erro](reception-error.png), [vazio após recuperação](reception-empty.png) |

A avaliação visual verificou alinhamento à esquerda, agrupamento por tarefa,
distinção entre estados, densidade da agenda, hierarquia de ações, ausência de
sobreposição e área disponível para o conteúdo nos dois tamanhos. O tablet tem
atalhos de fragmento para agenda e fila, com alvos focalizáveis. Cartões sem ações
não recebem um rodapé vazio. Os títulos e labels não dependem apenas de cor.

A aparência foi revisada por imagens renderizadas no Chromium. Isso não equivale
a uma pesquisa com usuários nem garante preferência estética universal.

## Verificações executadas

- `npm run build`: aprovado.
- `npm test -- --watch=false`: 17 arquivos / 44 testes aprovados.
- `npm run test:e2e`: 12 cenários aprovados. Os oito cenários existentes usam
  autenticação Keycloak, API real, os quatro perfis e os dois viewports; verificam
  foco, rótulos, ausência de overflow, erros de console/API e Axe crítico.
- Os três cenários de feedback usam autenticação real e interceptam apenas agenda/fila
  e a resposta de conflito para testar carregamento, falha regional, recuperação,
  preservação da data, `expectedVersion`, ausência de sucesso falso e movimento
  reduzido. Nos cenários de conflito e erro também passam Axe sério/crítico.
- Axe adicional na agenda real preenchida de 27/10/2026: nenhuma violação encontrada.
- `node scripts/qa-reception-ui.cjs`: smoke real, sem interceptação da API, aprovado:
  check-in via teclado atualiza linha/fila, cancelamento no tablet, `409` após
  alteração controlada de versão e reagendamento selecionado/revisado/persistido.
- `git diff --check`: aprovado.

O smoke requer a stack de demonstração local (4200/8080/8085, PostgreSQL via
Compose), usuários sintéticos do realm e execução antes das 08h em America/Belem,
pois utiliza horários fixos do dia. A criação é transacional; em colisão de IDs
não remove registros existentes. O `finally` remove apenas a massa criada por ele.
Eventos de auditoria dessas ações permanecem como evidência de operações sintéticas.

Os testes dos outros perfis cobrem as rotas iniciais; as jornadas completas das
Issues #57, #59 e #60 permanecem trabalhos próprios. Nenhuma regra de autorização
ou projeção clínica foi ampliada nesta mudança.

## Referências da direção

- [Refactoring UI](https://refactoringui.com/): hierarquia, proximidade e definição
  de personalidade antes de detalhes decorativos.
- [NN/g — AI Prototyping](https://www.nngroup.com/articles/ai-prototyping/): evitar
  layouts intercambiáveis e padrões que não correspondem à tarefa.
- [Apple — Motion](https://developer.apple.com/design/human-interface-guidelines/motion):
  movimento com função e alternativa para movimento reduzido.

## Segunda revisão — painéis, rolagem e movimento

A revisão inicial não cobria janelas baixas nem fila com mais de uma página.
A inspeção em 1024×500 encontrou o botão Sair fora dos limites do painel:
a sessão terminava em y=519,9 px. O painel foi reorganizado em três regiões:
marca, corpo rolável e sessão. Na mesma janela a sessão agora termina em y=480 px,
com Sair acessível. O fundo da coluna acompanha toda a extensão da página,
inclusive nas capturas completas. A nota lateral foi reduzida a orientação da
tarefa; o link indica corretamente a rota ativa mesmo com filtros na URL.

No desktop, a fila tem altura limitada à janela e sua lista possui rolagem por
mouse ou teclado, com cabeçalho e paginação acessíveis. Abaixo de 1280 px, a
lista volta à rolagem normal da página. Não há rolagem interna obrigatória no
tablet. A sessão também foi testada com nome longo em 320 px, sem overflow ou
perda do botão Sair.

A entrada das rotas agenda/reagendamento usa 180 ms, deslocamento de 6 px e
opacidade; o painel lateral permanece estável. Linhas e feedback têm entrada
curta, controles têm hover/transição e atualizar mostra spinner com botão
bloqueado durante a consulta. `prefers-reduced-motion` reduz essas animações.
A troca de rota restaura o topo e foca o main, enquanto uma mudança de filtro
não recria a rota nem reinicia a posição da página.

O novo cenário `e2e/reception-panels.spec.ts` verifica limites do painel, Sair,
rolagem a 900 px, overflow, fila de 25 pacientes com ida/volta entre páginas,
rolagem por tecla End, foco nas rotas, eventos reais de animação, movimento
reduzido e Axe sério/crítico. Usa autenticação real e massa operacional
interceptada para reproduzir os extremos sem escrever no banco.

Nova execução: build aprovado, 44 testes unitários e 12 cenários E2E aprovados;
smoke real de chegada/cancelamento/conflito/reagendamento repetido com sucesso.

- [Janela baixa após correção](reception-panel-short.png)
- [Fila longa com paginação visível](reception-queue-long.png)
- [Nome longo em 320 px](reception-header-narrow.png)
- [Reagendamento após restaurar topo e foco](reception-route-focus.png)

O cenário vazio no tablet também foi conferido: o fundo abaixo do conteúdo
permanece claro, sem herdar o fundo escuro da coluna desktop.
[Evidência em 768×1024](reception-empty-tablet.png).

O foco programático é aplicado ao main sem desenhar contorno em torno da página
inteira; links, botões, campos e lista rolável mantêm foco visível.
