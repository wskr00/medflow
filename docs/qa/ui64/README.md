# Dashboard da Administração — #64

Implementado na branch `codex/64-admin-dashboard`, a partir da `main` com a #57
integrada. Verificação em 04/11/2026, com dados sintéticos e stack local
Angular 22 / Spring / PostgreSQL / Keycloak. Não houve alteração de backend,
permissões ou regras clínicas.

## O que foi entregue

Nova rota `/workspace/admin/indicadores`, carregada sob o guard administrativo.
O shell separa Operação e Configuração e preserva os seis editores, seus guards
de descarte e o destino inicial `estrutura`. Desktop conserva sessão/saída fora
da região de navegação rolável; no tablet, Indicadores tem faixa própria e a
configuração fica em duas linhas de três destinos.

O dashboard segue o [plano de UX/UI](../../planejamento/dashboard-administrativo-ux.md):
papel quente, tinta petróleo, IBM Plex local, linhas discretas, números sem
cartões decorativos e movimento breve. O total de consultas, a situação atual
e as distribuições por unidade/especialidade pertencem à população por data
agendada. Conclusões usam a data real de término e têm seção independente.
Não há taxa de ocupação, taxa de cancelamento, duração média ou variação
percentual calculada no navegador.

Filtros têm rascunho e aplicação explícita. A URL restaura período e dimensões
em reload/Voltar; datas são civis, inclusivas, até 366 dias, com padrão de sete
dias calculado no fuso da clínica. Catálogos percorrem todas as páginas e incluem
inativos para consulta histórica. O recorte exibido identifica os filtros
aplicados, sem acompanhar silenciosamente o rascunho.

Chart.js **4.6.1** é importado somente na rota lazy. Séries de até 31 dias usam
colunas; intervalos maiores usam linha sem suavização, com lacunas `null` e sem
interpolação. Um único dia com registro usa tabela, e listas vazias não geram
gráficos. Distribuições são tabelas HTML com barras complementares; categorias
além das seis iniciais são acessíveis por expansão, sem agrupamento “Outros”.
Há detalhamento dos estados por dimensão e distribuição das conclusões.

Canvas tem nome/descrição e tabela equivalente. Falha gráfica mantém as tabelas
visíveis; gráficos não são controles de navegação. Instâncias/listeners são
destruídos em atualização/saída. Movimento reduzido desliga animação do Chart.js,
além das transições CSS. Não há contagem animada, polling ou conteúdo clínico.

## Evidências com API real

| Estado | Captura |
| --- | --- |
| Leitura em 1366×768 | [Desktop](real-desktop.png) |
| Leitura em 768×1024 | [Tablet](real-tablet.png) |
| Tabelas equivalentes | [Dados por dia](real-tables-tablet.png) |
| Unidade e especialidade combinadas, após reload | [Recorte filtrado](real-filtered-tablet.png) |
| Intervalo vazio, mantendo contexto | [Vazio](real-empty-tablet.png) |

[Resultado agregado sanitizado](integrated-results.json) guarda os valores da
API e o recorte combinado, sem tokens, headers, pacientes ou texto clínico.
As imagens são de página inteira; os tamanhos acima indicam o viewport.

O comando `node scripts/qa-admin-indicators.cjs` executa o smoke reproduzível.
Ele insere em transação um paciente sintético, duas unidades (uma inativa),
consultórios, especialidades, nove agendamentos e quatro atendimentos com IDs
aleatórios próprios. O recorte de 1–7/02/2031 inclui sete consultas, das quais
duas finalizadas e uma cancelada, mas **três conclusões reais**. Um término após
o período e conclusões de consultas anteriores tornam as populações distintas.
O filtro Unidade Centro + Especialidade A retorna duas consultas e uma conclusão.

As verificações observaram:

- Valores da UI iguais aos campos correspondentes da resposta real; nenhuma
  contagem é obtida de listagens paginadas de consultas.
- Filtros combinados, recarga e cadastro inativo preservados; intervalo vazio
  mantém contexto e retorna zero real, com ausência de canvas.
- Fuso do navegador configurado como `America/Los_Angeles`, enquanto a clínica
  usa `America/Belem`; as datas enviadas e os rótulos civis continuam corretos.
- Ausência do marcador clínico sintético no JSON/DOM e de chamadas a endpoints
  clínicos/individuais na leitura administrativa.
- Paciente, Recepção e Médico reais de demonstração recebem `403` no endpoint
  agregado autenticado e são encaminhados para acesso negado na rota.
- Nenhum erro de console/página no fluxo positivo; Axe sério/crítico e overflow
  verificados nas duas larguras, nas tabelas, no filtro e no vazio.

O `finally` remove somente IDs criados pelo smoke, inclusive em falha. Após a
execução, consultas de conferência encontraram **zero** pacientes `qa64-*`,
unidades e especialidades QA64 remanescentes. A massa serve para validar leitura
agregada e semântica temporal; não substitui validação clínica ou teste de carga.

## Testes e regressões

- `npm test -- --watch=false`: **59 testes em 22 arquivos aprovados**.
  Cobrem calendário real, virada de dia no fuso da clínica, limite inclusivo de
  366 dias, filtros inválidos, catálogos paginados/inativos, populações separadas,
  rascunho sem nova consulta, fallback do canvas, movimento reduzido e destruição
  de instâncias.
- `npm run build`: **aprovado**, sem avisos de compilação. O chunk lazy de
  Indicadores é de aproximadamente 200 kB brutos / 59 kB estimados transferidos;
  Chart.js não integra o carregamento inicial das demais jornadas. Esses números
  são saída do build, não medição de rede ou meta de desempenho validada.
- `npm run test:e2e`: **44 cenários aprovados**, incluindo os 36 existentes das
  demais jornadas e oito novos de indicadores. Login real com respostas controladas
  permite testar loading, rede/5xx/403/404, vazio e séries parcialmente vazias,
  resposta antiga cancelada, URL/reload/Voltar, validação por campo, catálogos em
  falha, restauração de inativos, expansão de distribuições, fallback gráfico,
  ausência de contagem calculável, teclado, foco, Axe e movimento reduzido.
- Os cenários de Indicadores cobrem 1366×768 e 768×1024, além de ausência de
  overflow em 320 px. As regressões administrativas verificam os seis editores
  e navegação/sessão em janela curta após o ajuste do shell.
- `git diff --check`: **aprovado**.

O teste de acessibilidade espera animações CSS finitas terminarem antes de medir
contraste. O contraste textual é avaliado pelo Axe; o gráfico também mantém
nomes, unidades, números e tabelas em HTML. Não se afirma certificação completa
de leitor de tela ou conformidade de todos os RNFs.

## Defeitos corrigidos durante a revisão

1. Opções assíncronas no select Helm podiam apagar a seleção visual após reload,
   apesar de o filtro continuar aplicado. O controle agora restaura o valor
   comprometido quando opções projetadas mudam, sem emitir alteração do usuário.
   O observer é desconectado ao destruir o controle. Há regressão unitária e
   E2E para o caso e a suíte dos demais formulários permanece verde.
2. A seção de consultas e o título do gráfico tinham o mesmo ID. Agora os IDs
   de região e gráfico são distintos.
3. Textos auxiliares no resumo foram colocados em elementos `dd`, mantendo a
   estrutura semântica válida da lista de definições, verificada pelo Axe.

## Limites

A API da #62 continua sendo a única fonte dos indicadores. Os nomes dimensionais
são os atuais; estados não são histórico de transições. Não há denominador de
capacidade, horário de cancelamento, comparação entre profissionais ou recursos
analíticos novos no backend. A stack é do MVP de clínica única; o smoke não
simula uma implantação multitenant.

As tabelas detalhadas de sete colunas têm rolagem horizontal própria quando
necessária, com região focalizável. A página principal não tem overflow ou
painéis com rolagens verticais aninhadas. Selects conservam o formato/idioma
nativo do navegador; o intervalo aplicado também é escrito por extenso.

As prévias em `docs/prototipos/admin-dashboard-v1*` permanecem como proposta
ilustrativa, sem chamadas HTTP. As capturas desta pasta pertencem à implementação
integrada. Este relatório registra a validação da implementação da #64.
