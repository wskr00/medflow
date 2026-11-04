# Indicadores da Administração — plano de UX/UI da #64

Proposta de 04/11/2026. Issue escolhida: [#64](https://github.com/wskr00/medflow/issues/64).
Branch: `codex/64-admin-dashboard`, baseada na `main` após o merge da #57
(`05a7702`). Responsável: `190Eric`. A dependência [#62](https://github.com/wskr00/medflow/issues/62)
está concluída e o endpoint já existe. A #63, do Médico, permanece independente.

Implementação posterior deste plano na mesma branch: [evidências e limites da
#64](../qa/ui64/README.md). O protótipo abaixo permanece como proposta ilustrativa.

Este documento e a [prévia estática](../prototipos/admin-dashboard-v1.html) são
planejamento. Não adicionam rota, biblioteca, chamada HTTP ou funcionalidade ao
produto. As imagens [desktop](../prototipos/admin-dashboard-v1-desktop.png) e
[tablet](../prototipos/admin-dashboard-v1-tablet.png) usam números ilustrativos.
O [contrato de indicadores](indicadores-administrativos.md) prevalece sobre a prévia.

## Para quem e para qual decisão

O administrador precisa consultar a operação agregada antes de revisar a
configuração da clínica. A tela responde, nesta ordem:

| Pergunta | Informação | Utilidade e limite |
| --- | --- | --- |
| Qual o volume de consultas deste recorte? | Total por data agendada e série diária | Localizar concentração no calendário; não equivale a procura, disponibilidade ou ocupação. |
| Em que situação estão essas consultas? | Agendadas, em espera, em atendimento, finalizadas e canceladas | Entender a composição atual; não é fila em tempo real nem histórico de transições. |
| Onde o volume se concentra? | Consultas por unidade e especialidade | Orientar investigação e filtro; não implica desempenho ou capacidade de uma unidade. |
| Quantos atendimentos foram concluídos neste intervalo? | Finalizações pela data real do término | Ler entregas do período sem confundir com a data da consulta. |

Não criar conclusões automáticas como “a clínica melhorou”, alertas de capacidade
ou metas sem evidência. O usuário vê quantidades exatas, contexto e meios de
refinar a leitura. Os editores de horários e bloqueios continuam disponíveis na
navegação, sem presumir relação causal ou abrir edição ao clicar em um gráfico.

## Composição e identidade

Nome da rota: **Indicadores** (`/workspace/admin/indicadores`). Título:
“Indicadores da operação”; subtítulo: “Consultas e conclusões no período selecionado”.
Manter o redirecionamento atual da Administração para `estrutura` nesta issue.

Reaproveitar o shell #60, a marca M contínua, IBM Plex Sans, papel quente,
tinta petróleo, linhas discretas e raio de 6 px. Área de leitura alinhada à
esquerda, sem hero, saudações ou ilustrações. A hierarquia vem da tipografia,
proximidade e área disponível. Não envolver cada número em um cartão elevado.

No desktop, navegação de 13 rem com dois grupos: “Operação” com Indicadores;
“Configuração” com os seis destinos existentes. Sessão permanece fora da área
rolável. No tablet, Indicadores tem faixa própria e a configuração conserva
duas linhas de três destinos, evitando uma sétima aba isolada. Ajustar o nome
acessível da navegação para “Administração” e o contexto do shell para
“Leitura da operação” nesta rota. Preservar foco, skip link e guards de saída
dos formulários existentes.

Ordem de leitura:

1. Título, período aplicado e botão secundário “Atualizar”.
2. Faixa de filtros sempre visível na página, sem drawer ou modal.
3. Seção **Por data agendada**: total maior, finalizadas e canceladas menores;
   explicação de que canceladas integram o total.
4. Série diária em aproximadamente 2/3 da largura e lista dos cinco estados no
   restante. A lista mostra números e nomes, sem depender de legenda por cor.
5. Distribuições por unidade e especialidade em duas colunas com linhas
   rotuladas e quantidades; não usar pizza, velocímetro ou mapa.
6. Seção separada **Conclusões por data real**, com total, série e dados
   dimensionais consultáveis em tabela. Explicar por que esse total pode diferir
   das finalizadas na seção anterior.
7. Nota curta sobre atualização e critério de contagem, junto aos dados pertinentes.

Em 1366×768, usar as margens de 32 px do shell, resumo compacto e gráfico de
aproximadamente 200 px de altura. A dobra mostra o contexto, filtros, resumo e
início da leitura diária. Não comprimir todo o dashboard para caber na janela.
Em 768×1024, usar margens de 24 px, filtros em duas colunas e seções empilhadas:
série, estados, unidade, especialidade e conclusões. A página tem uma rolagem
principal; não criar painéis com rolagens aninhadas. Abaixo de 480 px, uma coluna.

## Filtros, contexto e atualização

- Padrão: **Últimos 7 dias**, inclusive hoje, calculado no fuso da clínica obtido
  de `/api/clinica`. Atalhos: Hoje, Últimos 7 dias, Últimos 30 dias e Personalizado.
  Aguardar um fuso válido antes da primeira consulta; se a configuração falhar,
  oferecer nova tentativa, sem substituir silenciosamente pelo fuso do navegador.
- Campos locais `inicio` e `fim` inclusivos, limite de 366 dias; unidade e
  especialidade opcionais, combinadas por AND. Permitir período futuro, pois há
  consultas futuras; as conclusões continuam limitadas aos registros existentes.
- Datas são strings civis `YYYY-MM-DD`. Não usar conversão UTC para construir o
  dia exibido. A resposta `inicio`, `fim`, `timeZone` é o contexto da leitura.
- Formulário com rascunho separado dos filtros aplicados. Escolher campos ou
  atalhos prepara o recorte; **Aplicar filtros** faz uma consulta. Enter envia.
  Indicar “Alterações de filtro ainda não aplicadas” quando houver divergência.
- Mostrar sempre o recorte aplicado acima do resultado: intervalo por extenso,
  unidade/especialidade ou “Todas”, e “Horários no fuso America/Belem”, conforme
  resposta. O rascunho não pode renomear resultados antigos.
- Ao aplicar outro recorte, mostrar carregamento na área de resultados. Não
  manter números antigos sob o título do novo filtro. Ignorar respostas antigas
  de requisições substituídas. O resultado inteiro vem de uma única resposta.
- Sincronizar os filtros aplicados na query string; restaurar em reload/Voltar.
  Validar formato, intervalo e IDs sem fazer chamadas de indicadores inválidas.
- “Limpar filtros” prepara o padrão e exige aplicar; “Atualizar” repete o recorte
  aplicado. Mostrar “Consulta recebida às HH:mm” com horário do cliente no fuso
  informado; não dizer que o servidor gerou os dados nesse instante.
- Não há polling. O estado da agenda é uma fotografia da leitura; atualizar é
  explícito. Em intervalo histórico, “em espera” não significa “esperando agora”.

Catálogos usam `/api/unidades` e `/api/especialidades`, com
`incluirInativas=true`, incluindo rótulo “(inativa)” quando aplicável. Percorrer
todas as páginas (size máximo 100), sem truncar silenciosamente opções. Usar
select nativo Helm enquanto a lista for manejável; se a massa real exigir busca,
planejar controle acessível próprio antes de trocar de primitive. A falha de um
catálogo não deve apagar uma leitura válida nem trocar o filtro por “Todas”.
IDs vindos da URL podem ser resolvidos por detalhe; o backend valida o vínculo.

## Métricas e correspondência exata com a API

Todos os indicadores vêm exclusivamente de `GET /api/admin/indicadores` da #62.
Catálogos e clínica fornecem somente filtros e contexto; não buscar listagens de
agendamentos para contar no navegador. Ordenar ou posicionar pontos é apresentação,
não uma segunda agregação. Não somar dias para recalcular os totais recebidos.

| Rótulo da interface | Campo | Contexto obrigatório |
| --- | --- | --- |
| Consultas no período | `consultasPorDataAgendada.totalConsultas` | Pela data agendada, incluindo canceladas. |
| Finalizadas | `consultasPorDataAgendada.finalizadas` | Dentre as consultas com data agendada no período. |
| Canceladas | `consultasPorDataAgendada.canceladas` | Situação atual; não “cancelamentos realizados no período”. |
| Situação das consultas | Cinco campos de estado de `consultasPorDataAgendada` | Contagens atuais da mesma população. |
| Consultas por dia / unidade / especialidade | `consultasPorDataAgendada.porDia / porUnidade / porEspecialidade` | Unidade: consultas; todos os estados. |
| Atendimentos concluídos | `finalizacoesPorDataReal.totalFinalizadas` | Pela data real de término. |
| Conclusões por dia / unidade / especialidade | Listas de `finalizacoesPorDataReal` | Unidade: atendimentos concluídos; população independente. |

Não somar ou sobrepor as duas séries como partes de um mesmo total. O exemplo
da prévia tem 108 consultas, 54 finalizadas entre elas e 58 conclusões reais:
a diferença é intencional para tornar a distinção verificável. O produto não
exibe duração média, taxa de ocupação, taxa de cancelamento, variação percentual,
comparação com período anterior, receita ou ranking de profissionais nesta issue.

## Visualizações e decisão técnica

**Escolha: Chart.js diretamente, carregado somente na rota de Indicadores.**
Para duas séries temporais pequenas, um wrapper Angular acrescentaria uma
dependência sem necessidade demonstrada. A versão será fixada no lockfile ao
implementar, após validar integração com Angular 22. Comparação considerada:

| Opção | Decisão |
| --- | --- |
| Chart.js | Usar para as duas séries diárias: resize, escala, atualização e tooltip existentes. |
| HTML/CSS | Usar nas distribuições: barras discretas junto a nomes e números em tabela semântica. |
| SVG manual | Viável para desenho estático; exigiria construir escala/resize/interação para os gráficos do produto. |
| D3 / suíte de gráficos maior | Não há interação ou volume que justifique a complexidade adicional neste escopo. |

Séries de até 31 dias: colunas verticais de uma cor. Intervalos maiores: linha
reta, sem suavização ou área preenchida; preservar cada dia retornado, sem
agregação mensal no navegador. Eixo X usa uma grade de datas civis do intervalo,
com `null` posicional para dia ausente e `spanGaps: false`, sem contar esse marcador
como um dado. Não comprimir o tempo removendo datas sem linhas. Lacunas são
explicitadas como dias sem registro, sem interpolar valores nem inventar pontos
zero; a tabela lista os dados recebidos e explica a cobertura do intervalo.
Eixo Y começa em zero, com contagens inteiras. Aumentar passo dos rótulos, sem
eliminar observações. Um único dia com dados usa resumo e tabela, sem gráfico
alongado com um ponto. Lista vazia usa estado vazio local.

Unidades/especialidades: barras horizontais com base zero, valores à direita,
nomes completos com quebra de linha. Ordenação por quantidade decrescente e nome
como desempate, aplicada às linhas já agregadas; explicar “ordem por volume”.
Mostrar seis inicialmente e botão “Ver todas as unidades/especialidades”, com
`aria-expanded`, sem agrupar o restante como “Outros” nem alterar totais. Quando
houver uma categoria, uma linha com o valor basta. Dados por estado permanecem
em tabela acessível, disponíveis em “Ver detalhamento”. Na seção de conclusões,
“Ver dados” inclui as três tabelas de dia, unidade e especialidade retornadas.

Estilo: petróleo para volume; cinza para estruturas; cores semânticas apenas nos
estados, sempre acompanhadas de texto. Gridlines leves em um eixo, sem bordas
duplas, gradientes ou efeitos 3D. Quantidades tabulares, rótulos em 12–14 px e
títulos em 18–20 px. Rótulos e conteúdo essencial ficam em HTML, não só no canvas.

A documentação do [Chart.js sobre acessibilidade](https://www.chartjs.org/docs/latest/general/accessibility.html)
explicita que o conteúdo do canvas não é lido automaticamente por leitores de
tela. Cada gráfico terá nome, descrição curta e tabela HTML equivalente, acessível
por botão adjacente. Tooltip é complementar; nenhuma tarefa dependerá de hover.
As barras para comparação e a base zero seguem a orientação de
[bar charts da ONS](https://service-manual.ons.gov.uk/data-visualisation/chart-types/bar-charts).

Integração: importar apenas controllers/elements/scales usados, sem `chart.js/auto`,
conforme [integração oficial](https://www.chartjs.org/docs/latest/getting-started/integration.html).
Criar instância após o canvas renderizar; sincronizar pela API em
`afterRenderEffect`, sem propagar estado entre signals com effects. Destruir
instâncias/listeners ao sair. Usar container dedicado com altura definida e
`responsive: true`, `maintainAspectRatio: false`, conforme
[responsividade](https://www.chartjs.org/docs/latest/configuration/responsive.html).
Resolver tokens CSS para cores de canvas suportadas, mantendo a fonte após carregada.

Entrada de conteúdo com 180 ms e deslocamento máximo de 6 px; hover/foco com
120 ms. Atualização do gráfico em até 180 ms, sem contadores animados, desenho
sequencial ou looping. Em movimento reduzido, desabilitar animações CSS e
`animation` do Chart.js. Ajustes de resize não repetem animações de entrada.

## Estados e acessibilidade

| Estado | Comportamento planejado |
| --- | --- |
| Primeira leitura | Skeleton nas áreas dos números/gráficos, `aria-busy`, texto “Carregando indicadores”; sem números provisórios. |
| Filtro inválido | Erro por campo associado ao controle; foco no primeiro inválido, sem disparar indicadores. |
| Novo recorte / atualização | Contexto solicitado e estado de carregamento; não apresentar leitura anterior como nova. |
| Sucesso | Recorte da resposta e conteúdo juntos; anúncio curto em `aria-live=polite`, sem mover foco ao topo. |
| Ambas as séries vazias | “Nenhuma consulta ou conclusão neste recorte”; manter filtros, período e zeros reais da resposta; não desenhar gráficos vazios. |
| Só uma série vazia | Mensagem na seção correspondente; a outra permanece utilizável. Zero de consultas não implica zero de conclusões. |
| Rede/5xx | “Não foi possível carregar os indicadores”, ação “Tentar novamente”, filtros preservados; erro não vira zero. |
| 401 | Reutilizar fluxo de sessão existente. |
| 403 | “Sua sessão não tem acesso aos indicadores”; não renderizar dados anteriores; voltar à área permitida e opção de entrar novamente pelo fluxo existente. Sem retry infinito. |
| 404 de filtro/contexto | Identificar recorte indisponível sem revelar recurso de outra clínica; permitir revisar/limpar filtros explicitamente. |
| Falha ao desenhar gráfico | Dados HTML e tabela continuam disponíveis; erro visual não impede a leitura das quantidades. |
| Sem valor calculável | Exibir “Sem dados” para qualquer valor opcional não calculável que venha a integrar contrato futuro; hoje não existe média a simular. |

Controles com alvo de 44 px, foco visível, ordem DOM igual à leitura, títulos
hierárquicos e nomes únicos nos botões de tabela. Contraste textual de 4,5:1 e
elementos gráficos essenciais de 3:1, a medir na implementação. `details`/botões
expõem expansão; tabelas têm caption e cabeçalhos associados. Gráficos não
recebem foco sem interação real. Não bloquear atalhos de teclado na página.

## Plano de implementação e aceite

1. Criar rota lazy e item de navegação; ajustar agrupamento e contexto do shell.
   Gerar componentes pelo CLI Angular, preservar os seis editores e seus guards.
2. Tipar resposta da #62 na feature e criar serviço de leitura específico.
   Separar filtros em rascunho/aplicados, Signal Forms e estado de URL. Usar
   `httpResource` para leituras e proteger acesso a `.value()` com `hasValue()`.
3. Implementar contexto e números em HTML primeiro, incluindo todos os estados
   e tabelas. Não depender do gráfico para tornar o dashboard útil.
4. Instalar Chart.js e implementar gráfico temporal local à feature, com os
   dois consumidores reais (consultas e conclusões), sem componente universal
   de dashboard. Acrescentar barras de distribuição e movimento contido.
5. Validar e registrar evidências em `docs/qa/ui64/README.md` antes de commit/PR.

Gates da implementação (ainda não executados nesta etapa de planejamento):

- Unitários: mapeamento dos campos independentes, zeros/null/erro, limite inclusivo
  de 366 dias, fuso diferente do navegador, ida/volta da URL e filtros aplicados.
- Componentes: indicadores exclusivamente da #62; rascunho não renomeia resultado;
  resposta antiga não vence nova; recorte vazio e séries parcialmente vazias;
  inativas/paginação de catálogos; tabelas equivalentes e destruição do gráfico.
- E2E: login Admin real com fixtures determinísticas e filtros combinados;
  carregamento, falhas recuperáveis, 403, 404, acessibilidade, tabulação, foco,
  movimento reduzido e ausência de overflow em 1366×768 e 768×1024.
- Smoke integrado: dados sintéticos multistatus/multiunidade, troca de recorte e
  conferência dos números da UI contra resposta real. Incluir atendimento
  finalizado em dia diferente da data agendada para detectar mistura de séries.
- Segurança: demais perfis não acessam rota/dados; verificar 403 real do endpoint,
  clínica isolada, ausência de pacientes/texto clínico e de chamadas clínicas.
- Regressão dos seis editores, navegação/sessão em janela curta; build, unitários
  e suíte E2E; console/rede e screenshots sanitizadas nos dois viewports.

A prévia valida composição, hierarquia e reflow com dados ilustrativos. Não é
evidência de API integrada, funcionamento dos filtros, acessibilidade do produto
ou aceite concluído da #64. A issue permanece aberta até a implementação.

Verificação dos artefatos desta proposta: HTML renderizado em Chromium a
1366×768 e 768×1024, fonte local carregada, sete destinos de navegação presentes,
sessão/saída dentro do viewport e ausência de overflow horizontal ou erros de
JavaScript. As duas capturas foram inspecionadas visualmente. Os valores
ilustrativos das séries, estados e distribuições foram conferidos, assim como
os links locais e `git diff --check`. Código do aplicativo e dependências não
foram alterados; build, E2E e integração pertencem aos gates da implementação.
