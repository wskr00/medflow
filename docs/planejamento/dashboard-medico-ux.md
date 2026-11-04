# Minha atividade — plano de UX/UI da #63

Proposta de 04/11/2026 para a [#63 — dashboard do Médico](https://github.com/wskr00/medflow/issues/63).
Branch `codex/63-doctor-dashboard`, criada a partir da `main` no merge da #64
(`7f0a91a`). Responsável: `190Eric`. A dependência [#61](https://github.com/wskr00/medflow/issues/61)
está concluída e sua API já existe. Nesta etapa há somente planejamento e prévia
estática; a issue permanece aberta.

Implementação posterior na mesma branch: [evidências e limites da #63](../qa/ui63/README.md).
O protótipo e as verificações desta proposta permanecem como registro do planejamento.

Referências do projeto: [contrato da #61](indicadores-medicos.md),
[identidade visual](../frontend/design-system.md) e jornada Médica #59.
Prévia: [HTML](../prototipos/doctor-dashboard-v1.html),
[desktop](../prototipos/doctor-dashboard-v1-desktop.png),
[tablet](../prototipos/doctor-dashboard-v1-tablet.png) e
[vazio](../prototipos/doctor-dashboard-v1-empty-tablet.png).
Os números dessas imagens são ilustrativos e não vêm da API.

## Papel da tela

O Médico acompanha **a própria atividade**, sem perder o acesso à agenda e ao
atendimento. A tela responde a três perguntas:

| Pergunta | Leitura disponível | Utilidade e limite |
| --- | --- | --- |
| Como se distribuem minhas consultas neste período? | Volume diário e situação atual das consultas com data agendada no intervalo | Reconhecer concentração no calendário; não representa capacidade, demanda reprimida ou fila ao vivo. |
| Quantos atendimentos concluí neste intervalo? | Total e distribuição diária pelo término real | Consultar conclusões, inclusive de consultas agendadas fora do intervalo. |
| Qual foi o tempo médio registrado nesses atendimentos? | Média do backend e médias diárias na tabela de conclusões | Contextualizar o intervalo entre início e finalização registrados; não medir qualidade, produtividade ou tempo exclusivo de contato com o paciente. |

Nome no menu e título: **Minha atividade**. Rota proposta:
`/workspace/doctor/indicadores`. Subtítulo: “Suas consultas e atendimentos no período
selecionado.” Manter `triagem` como destino inicial e a marca ligada à agenda.
A atividade é uma leitura complementar, acessada voluntariamente.

## Composição própria do Médico

Preservar o cabeçalho horizontal da #59: marca, Área médica, navegação e sessão.
Dois destinos visíveis: **Minha agenda** e **Minha atividade**, com `aria-current`.
No tablet, as duas abas dividem uma linha sob marca/sessão. A navegação não vira
uma sidebar. Ao sair do editor clínico para Indicadores, manter o guard atual
de texto não salvo; abrir o dashboard nunca salva nem descarta o atendimento.

Fundo de papel quente, petróleo para números e ação, IBM Plex local e bordas
discretas. Conteúdo alinhado à esquerda, ocupando a largura útil do shell.
Sem saudação, hero ou grade de cartões idênticos. Cada seção comunica sua
população antes de mostrar números.

Composição em 1366×768:

1. Título e descrição, com link secundário “Ir para minha agenda”.
2. Faixa temporal compacta: período, datas quando personalizado, Aplicar e
   Atualizar. Abaixo, intervalo aplicado por extenso e fuso da clínica.
3. Duas seções alinhadas, com aproximadamente 3/5 e 2/5 da largura:
   **Consultas pela data agendada** à esquerda e **Atendimentos pelo término real**
   à direita. O total de consultas tem mais peso tipográfico; estados usam
   quantidades menores e rótulos. À direita, conclusões e tempo médio ficam
   próximos porque pertencem à mesma população.
4. Abaixo: **Consultas por dia** à esquerda e **Conclusões por dia** à direita.
   A primeira usa gráfico simples; a segunda usa tabela de data, quantidade e
   tempo médio. As duas seções superiores permitem a leitura rápida sem exigir
   interpretar o gráfico.
5. Nota de atualização, sem indicação de monitoramento em tempo real.

Em 768×1024, cabeçalho e filtros reorganizados, com uma única coluna de conteúdo:
resumo de consultas, resumo de conclusões/tempo, gráfico e tabela. **Tempo médio
fica antes do gráfico**, sem ser relegado ao fim da página. Não comprimir tudo
para caber numa tela. Usar margens de 24 px e rolagem principal da página.
Em telas estreitas, métricas e filtros também empilham. Desktop mantém margens
de 32 px, alvo mínimo de 44 px e sessão acessível, inclusive com janela baixa.

## Métricas sem mistura de datas

Única fonte de indicadores: `GET /api/medico/indicadores?inicio=&fim=`.
Não consultar agenda, fila ou atendimentos individuais para calcular números.
Não consultar `/api/admin/indicadores` nem adicionar filtro de profissional.

| Rótulo | Campo da resposta | Contexto que acompanha o valor |
| --- | --- | --- |
| Consultas no período | `consultasPorDataAgendada.totalConsultas` | Pela data agendada; inclui canceladas. |
| Agendadas / Em espera / Em atendimento / Finalizadas / Canceladas | Campos correspondentes de `consultasPorDataAgendada` | Situação atual das consultas com data agendada no intervalo. |
| Consultas por dia | `consultasPorDataAgendada.porDia` | Quantidade de consultas; cada ponto usa a data agendada. |
| Atendimentos concluídos | `finalizacoesPorDataReal.totalFinalizadas` | Pela data real do término, não pela data da consulta. |
| Tempo médio registrado | `finalizacoesPorDataReal.duracaoMediaSegundos` | Início até finalização registrados; média ponderada do conjunto de conclusões retornado. |
| Conclusões por dia | `finalizacoesPorDataReal.porDia` | Data real, total finalizado e média daquela data, recebidos da API. |

A API não retorna paciente, texto clínico nem identificador de atendimento.
Seu escopo vem do médico ativo autenticado. A UI não envia `medicoId`, `subject`,
`pacienteId` ou `clinicaId`; não oferece seleção de outros profissionais.

“Em espera” num intervalo histórico significa o estado atual dessas consultas,
não pacientes esperando hoje. Mostrar “Situação atual das consultas do recorte”.
Não criar botão que filtre a fila a partir desses números: a API da fila é outro
fluxo e não oferece a mesma semântica temporal.

As duas populações não são somadas nem apresentadas como numerador/denominador.
A prévia usa **28 consultas**, **15 finalizadas entre elas** e **18 conclusões
reais**. Essa diferença intencional ajuda a validar que a UI não trata os dois
campos de finalização como equivalentes.

## Tempo médio: formato e interpretação

Exibir minutos e segundos por extenso curto: **22 min 10 s**, sem relógio que
pareça horário do dia. Se exceder uma hora, usar “1 h 12 min 10 s”. Arredondar
somente a apresentação para o segundo mais próximo; preservar o valor bruto da
API para a tabela/formatação. Não converter zero válido em ausência de dado.

- `duracaoMediaSegundos: null` → **Sem dados**. Com zero conclusões, mostrar
  “Nenhum atendimento concluído neste recorte para calcular a média.”
- Média zero com conclusões → **0 s**, conforme dado retornado.
- Campo ausente/inválido ou contagem inválida → erro de leitura, sem inventar
  média ou substituí-la por zero. Se total positivo vier com média `null`,
  conservar “Sem dados”, sem alegar que houve zero conclusões.
- Não calcular a média global a partir das médias diárias. O backend já usa
  duração total / quantidade de atendimentos, com ponderação correta.

Na prévia, quantidades diárias `[2,3,1,4,3,3,2]` e médias em segundos
`[1200,1500,900,1800,1200,1000,1170]` produzem média ponderada de **1330 s**.
A média simples dos sete números seria diferente. A implementação deve exibir
o campo global recebido, mesmo quando a tabela contenha volumes diários desiguais.

Texto de apoio visível: “Do início à finalização registrados. Pode incluir
intervalos até o encerramento do registro.” Não chamar esse número de “tempo de
consulta presencial” nem rotular um resultado como bom/ruim. Não usar setas,
semáforos, comparação com colegas ou metas de velocidade.

## Filtro temporal e navegação

- Padrão **Últimos 7 dias**, incluindo hoje. Opções: Hoje, Últimos 7 dias,
  Últimos 30 dias e Personalizado. Datas locais inclusivas, limite de 366 dias.
- Fuso inicial vem de `IdentityService` (`/api/me`), já autorizado ao Médico.
  **Não buscar `/api/clinica`**, endpoint administrativo. Sem contexto/fuso válido,
  oferecer recuperação antes de construir o período; não assumir fuso do navegador.
- A resposta `inicio`, `fim`, `timeZone` identifica a leitura recebida. Escrever
  intervalo e fuso perto dos resultados, não só dentro do formulário.
- Separar rascunho dos filtros aplicados. Trocar campos/atalhos não renomeia
  resultados nem dispara uma consulta. “Aplicar período” efetiva o recorte;
  Enter funciona. Rascunho divergente mostra “Alterações de período ainda não
  aplicadas”. “Restaurar últimos 7 dias” prepara o padrão, com aplicação explícita.
- Guardar somente `inicio` e `fim` na query string. Reload/Voltar restauram
  a seleção; URL inválida não consulta indicadores e oferece correção por campo.
- Consulta substituída é cancelada/ignorada; números de período anterior não
  aparecem sob o novo título. Loading nunca é zero. Atualizar repete o recorte
  aplicado, sem incorporar silenciosamente o rascunho.
- Botão “Atualizar” explícito; sem polling. Mostrar “Consulta recebida às HH:mm”
  como hora de recebimento pelo cliente, sem atribuir timestamp ao servidor.
- “Ir para minha agenda” abre a rota existente, sem inventar filtros temporais
  não suportados. Não transportar um período de sete dias para uma agenda de um dia.

## Gráfico e tabela: pouca interação, dados legíveis

Usar **um gráfico temporal de contagens**. Até 31 dias, colunas; acima disso,
linha sem suavização e sem preenchimento. Eixo Y em zero, quantidades inteiras,
datas em posições reais, lacunas explícitas `null`, `spanGaps: false`. Não somar
por semana/mês no navegador nem reduzir dias ausentes a zero fictício. Não
desenhar gráfico de um ponto ou uma moldura vazia: resumo/tabela bastam.

O gráfico tem título, intervalo, unidade “consultas”, números quando couberem,
descrição e ação “Ver dados: Consultas por dia”. A tabela equivalente inclui
data, total e os cinco estados recebidos, com cabeçalhos e nomes acessíveis.
Tooltip é complementar; nenhuma informação depende de hover.

**Conclusões por dia** usa tabela visível: Data / Concluídos / Tempo médio.
Isso mostra quantidade e duração lado a lado, sem dois eixos, sem gráfico de
médias e sem sugerir correlação causal. Para períodos longos, 14 linhas iniciais,
“Ver todos os dias” com `aria-expanded`, sem ocultar a possibilidade de consultar
o conjunto completo. Ordenar por data crescente, sem recalcular dados.

Reaproveitar Chart.js 4.6.1 já instalado, sem outra biblioteca de gráficos.
Na implementação, extrair **somente o gráfico de contagem diária** hoje em
`AdminIndicatorChart` para uma primitive compartilhada, com seus testes de
ciclo de vida, fallback e movimento. Há dois consumidores administrativos reais
e o terceiro médico com a mesma semântica de série diária de contagens.
Remover dependências de modelos/helpers administrativos dessa primitive; apenas
datas, pontos, rótulos e unidade entram nela. Adaptadores de DTO e composição
continuam em cada perfil. Não extrair dashboard, filtros, métricas ou shell universal.

Preservar lazy loading da biblioteca, imports seletivos, container responsivo,
cleanup de instâncias/listeners e fallback HTML. Conferir os chunks de build para
que a extração não carregue Chart.js ao abrir triagem/atendimento. A exigência de
nome e alternativa textual vem da [documentação de acessibilidade do Chart.js](https://www.chartjs.org/docs/latest/general/accessibility.html);
os imports seletivos seguem a [integração oficial](https://www.chartjs.org/docs/latest/getting-started/integration.html).

## Estados, foco e movimento

| Estado | Tratamento |
| --- | --- |
| Inicial/atualizando | Skeleton com `aria-busy`, contexto solicitado e anúncio curto; sem zeros provisórios. |
| Sem ambas as populações | Contagens zero reais, média “Sem dados”, período preservado, mensagens nas seções, sem gráfico vazio. |
| Consultas presentes, sem conclusões | Manter volume/estados e gráfico; média “Sem dados” e tabela de conclusões vazia. |
| Sem consultas, com conclusões reais | Manter total e duração das conclusões; consultas zero e sem gráfico. Não apagar a seção válida. |
| Rede/5xx | “Não foi possível carregar sua atividade”, filtros preservados e “Tentar novamente”. Não reutilizar erros de salvamento clínico. |
| 401/403 | Recuperação pelo fluxo de sessão existente ou retorno à área permitida; esconder resultados anteriores. Sem retry automático infinito. |
| 404 de contexto | Contexto indisponível com tentativa de recarregar identidade ou entrar novamente; sem revelar outro profissional. |
| Filtro inválido | Erros associados ao input e foco no primeiro inválido; sem chamada inválida ao backend. |
| Falha do canvas | Tabela equivalente permanece utilizável e mensagem explica a alternativa. |

Ordem de foco: navegação, agenda, filtro, aplicar, atualizar, ações das tabelas.
O shell mantém skip link e foco no main ao trocar rota. Aplicar/atualizar período
mantém o foco na ação e anuncia resultado sem levar o usuário ao topo. Tabelas
expandidas podem ter rolagem horizontal própria apenas quando necessária; a
página não ganha rolagem horizontal nem painéis verticais aninhados.

Foco visível, controles de 44 px, contraste textual 4,5:1 e elementos essenciais
do gráfico 3:1, a medir na implementação. Nomes e números não dependem de cor.
Entrada de rota/resultado em 180 ms, deslocamento máximo de 6 px; hover 120 ms.
Sem contadores crescendo ou cores ligadas à rapidez do atendimento. Movimento
reduzido desliga CSS e animação do Chart.js; resize não repete a entrada.

## Sequência de implementação e aceite futuro

1. Criar rota lazy e segunda aba do shell Médico, com guard e saída do editor
   preservados. Usar CLI Angular para componentes novos.
2. Tipar a resposta #61 na feature e configurar leitura por `httpResource`, com
   `hasValue()` antes de ler dados, filtros em Signal Forms e estado na URL.
3. Implementar resumos, formatação de duração, tabela diária e estados antes
   do gráfico; nenhuma agregação local ou leitura clínica para obter indicadores.
4. Extrair a primitive de gráfico com regressão da #64, integrar o novo consumidor
   e ajustar reflow, foco, movimento e contrastes.
5. Executar gates e registrar resultados em `docs/qa/ui63/README.md`.

Gates ainda não executados nesta etapa:

- Unitários: datas civis/fuso, máximo inclusivo de 366 dias, URL, `null` versus
  zero, frações de segundo, durações acima de uma hora e média global recebida
  diferente da média simples diária. Ciclo de vida e fallback do gráfico extraído.
- Componentes: somente endpoint da #61; totais independentes; rascunho não afeta
  resultado aplicado; séries parcialmente vazias; não calcular sobre páginas de
  agenda/fila; zero real e falha de API com estados distintos.
- E2E: filtros/Enter/reload/Voltar, loading, erro e recuperação, identidade em
  falha, acesso negado, tabelas completas, teclado/foco, Axe, movimento reduzido,
  1366×768 e 768×1024; verificação adicional de overflow em 320 px.
- Smoke real: Médico de demonstração, dados sintéticos com horários atravessando
  meia-noite e fronteiras do período, volumes diários desiguais e pelo menos
  um término fora da data agendada. Conferir resposta, contagens e média da UI.
- Segurança: segunda identidade médica com outro conjunto de dados para provar
  isolamento; Paciente/Recepção/Admin com `403` no endpoint; rota negada; ausência
  de paciente/texto clínico na API/DOM e de chamadas clínicas no dashboard.
- Regressão: iniciar, editar, retomar e finalizar atendimento; tentar sair com
  texto não salvo para a nova aba e manter a opção de permanecer no editor.
  Verificar também dashboard administrativo após extração da primitive.
- Build, suíte unitária/E2E, console/rede, screenshots sanitizadas e remoção dos
  IDs sintéticos ao final, sem afirmar validação clínica ou carga nesta issue.

A prévia estática é uma proposta de composição e estados. Não consome API,
não adiciona rota e não demonstra que os critérios de implementação foram aceitos.

Verificação desta etapa de planejamento: prévia renderizada em Chromium nos
dois viewports e no estado vazio em tablet, com fonte local carregada, saída
dentro da janela e ausência de overflow horizontal ou erros de JavaScript.
As três capturas foram inspecionadas visualmente. Totais ilustrativos, média
ponderada e links locais foram conferidos; `git diff --check` passou. Não foram
alterados código do aplicativo, dependências ou testes do produto.
