# Minha atividade — #63

Implementada na branch `codex/63-doctor-dashboard`, a partir da `main` com a #64
integrada (`7f0a91a`). Validação de 04/11/2026 com stack local Angular 22,
Spring, PostgreSQL e Keycloak, usando dados sintéticos.

## Entrega e semântica

A rota `/workspace/doctor/indicadores` oferece leitura da própria atividade.
O cabeçalho Médico mantém Minha agenda e acrescenta Minha atividade; agenda
continua sendo o destino inicial. O guard de saída do editor clínico permanece
ativo, inclusive ao tentar abrir a nova aba com texto não salvo.

O layout segue o [plano aprovado](../../planejamento/dashboard-medico-ux.md):
papel quente, petróleo, IBM Plex local, resumo tipográfico, gráfico diário de
consultas e tabela de conclusões/tempo. No tablet, o resumo de duração aparece
antes do gráfico. Estados e quantidades não dependem somente de cor.

Indicadores vêm exclusivamente de `GET /api/medico/indicadores` da #61. Não há
consulta a agenda/fila/registro clínico para contar dados, nem seletor de outro
médico. O contexto temporal inicial vem de `/api/me`, sem chamar `/api/clinica`.
Filtros em Signal Forms têm rascunho/aplicação explícita, datas civis inclusivas
até 366 dias, contexto visível e restauração pela URL em reload/Voltar.

Consultas são agrupadas pela data agendada; conclusões usam o término real.
As populações não são somadas. A média global é a recebida do backend; o
frontend apenas formata segundos em horas/minutos/segundos. `null` aparece como
“Sem dados”; zero registrado com conclusões aparece como “0 s”. Valores ausentes
ou inválidos geram erro de leitura, sem zero ou média inventados.

O texto esclarece que a duração vai do início à finalização registrados e pode
incluir intervalos até encerrar o registro. Não há meta de velocidade, ranking,
taxa de ocupação ou inferência de qualidade clínica.

## Reuso e carregamento

`DailyCountChart` foi extraído da Administração para `shared/ui`, junto aos
helpers civis usados pelos dois perfis. Não depende de modelos administrativos.
Tem três consumidores reais e a mesma semântica: série diária de contagens.
A composição de dashboards, filtros e métricas continua nas respectivas features.

Chart.js 4.6.1 mantém imports seletivos, escala com base zero, colunas até 31 dias,
linha sem suavização para intervalos maiores, lacunas `null` e tabela equivalente.
Um dia com registros usa tabela e listas vazias não desenham gráficos. O Médico
projeta seu detalhamento de data/total/cinco estados; a Administração conserva
suas tabelas anteriores. Falha de canvas mantém os dados em HTML. Instâncias e
listeners são destruídos ao atualizar/sair; movimento reduzido desliga animação.

[Conferência dos chunks](bundle-check.json), a partir de `ng build --stats-json`,
verifica transitivamente imports estáticos: Chart.js está fora do carregamento
inicial, da triagem e do editor clínico. É compartilhado pelas rotas lazy dos
dois dashboards. O chunk que o contém tem 162.876 bytes e a rota médica cerca
de 29 kB brutos; esses números são saída do build, não medição de desempenho.

## Evidências integradas

| Cenário | Captura |
| --- | --- |
| Médico principal, 1366×768 | [Desktop](real-desktop.png) |
| Médico principal, 768×1024 | [Tablet](real-tablet.png) |
| Detalhamento de consultas por dia | [Tabela com estados](real-details-tablet.png) |
| Um dia e persistência após reload | [Recorte de um dia](real-one-day-tablet.png) |
| Consultas sem conclusões | [Média sem dados](real-no-completions-tablet.png) |
| Ambas as séries vazias | [Vazio](real-empty-tablet.png) |
| Outra identidade médica | [Segundo médico](real-second-doctor-tablet.png) |

As capturas são de página inteira; os tamanhos indicam o viewport. O arquivo
[integrated-results.json](integrated-results.json) contém somente resultados
agregados sanitizados e verificações de acesso, sem tokens, senhas ou texto clínico.

`node scripts/qa-doctor-indicators.cjs` cria IDs próprios para paciente, unidade,
consultórios, especialidade, doze agendamentos, cinco atendimentos e um médico
temporário. Como o Keycloak local não continha um segundo usuário de demonstração,
o smoke cria uma identidade temporária com role DOCTOR, ligada somente ao médico
sintético, e a remove ao finalizar. Credenciais não são gravadas nas evidências.

Resultado observado no período de 1–7/05/2031:

- Médico principal: **7 consultas**, das quais **2 finalizadas** e **1 cancelada**;
  **3 conclusões reais** com média global de **1800 s / 30 min**.
- As médias diárias são 1200 s para duas conclusões e 3000 s para uma. A média
  simples dos dois dias seria 35 min; a UI mostra corretamente os 30 min recebidos.
- Consultas anteriores terminam dentro do período; um término em 8/05 fica fora.
  No recorte de 1/05 há uma consulta agendada e duas conclusões, com média de 20 min.
- Segundo médico: **3 consultas**, **1 conclusão**, média **600 s / 10 min**.
  Enviar manualmente `medicoId` de outra identidade não muda o escopo de nenhuma
  das duas sessões. O frontend envia apenas início e fim.
- Paciente, Recepção e Administração recebem `403` real no endpoint e acesso
  negado na rota. A resposta e o DOM não contêm o marcador clínico sintético.
- Período, média e filtros persistem após reload; recortes sem conclusões ou
  totalmente vazios mantêm informações e contexto corretos.
- Navegador em `America/Los_Angeles`, clínica em `America/Belem`: as datas civis
  enviadas e os rótulos permanecem corretos.
- Nenhum erro de console/página no fluxo positivo, nem chamada administrativa
  ou clínica individual pelo dashboard. Axe sério/crítico e overflow passam
  nos dois viewports e nas tabelas/estados capturados.

O `finally` remove apenas IDs criados e a identidade temporária. Conferência
após a execução: zero pacientes `qa63-*`, médicos/unidades/especialidades QA63
e zero identidades Keycloak `qa63-medico-*` remanescentes. A massa é de leitura
agregada e não representa validação de regras clínicas ou teste de carga.

## Verificações finais

- `npm test -- --watch=false`: **70 testes em 24 arquivos aprovados**. Inclui
  datas/fuso/366 dias, formatação de duração, `null`/zero, média global recebida,
  rascunho sem nova leitura e ciclo de vida/fallback do gráfico compartilhado.
- `npm run build -- --stats-json`: **aprovado**, sem avisos de compilação.
- `npm run test:e2e`: **51 cenários aprovados**, sete novos de atividade e
  regressões das demais jornadas. Inclui filtros/Enter/URL/reload/Voltar,
  contexto em falha, rede/403/404, resposta antiga, séries parcialmente vazias,
  valor ausente, expansão de todos os dias, fallback, teclado/foco, Axe e
  movimento reduzido. Há ausência de overflow também em 320 px.
- As regressões médicas cobrem edição, conflitos, histórico e finalização nos
  dois viewports; rejeitar a saída para Minha atividade preserva texto local.
  O dashboard administrativo passa após a extração da primitive.
- `git diff HEAD --check`: **aprovado**.

A auditoria espera animações CSS finitas terminarem antes de medir contraste.
Tabelas detalhadas têm rolagem horizontal focalizável quando necessária; a página
principal não tem overflow. O formato dos inputs de data é o nativo do navegador,
com o recorte aplicado também escrito por extenso. As prévias de planejamento
continuam ilustrativas; as imagens desta pasta pertencem à implementação real.
