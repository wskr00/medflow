# Evidências da baseline de planejamento

Inspeção em 16 de setembro de 2026, vinculada à Issue #7.

## Fontes e estado observado

- Repositório canônico: https://github.com/wskr00/medflow. O remote local ainda usa o endereço anterior, que redireciona para este repositório.
- `main` e `develop`, após consulta ao remoto, apontavam para `55a96d6c84c77ae8f54d1b2cf1b1ff62cfbbff70`.
- Nenhum Pull Request aberto foi encontrado durante a inspeção.
- A documentação fornecida em `docs/` estava fora do versionamento no checkout principal. Foi copiada integralmente para o worktree documental, preservando os originais.
- O Project MedFlow — 2026.2 contém #7–#19 e #23–#25. #7, #8, #9 e #23 estavam em Ready; as demais em Backlog. Esse estado administrativo não comprova critérios técnicos satisfeitos.
- Na leitura inicial, #20–#22 estavam fechadas com motivo `duplicate`; correspondiam a #17–#19 e não representavam funcionalidades concluídas. Na atualização final, deixaram de aparecer na listagem; #20 também retornou HTTP 410. Essas entradas são evidência histórica, não tarefas a recriar.
- #1 está fechada, mas o código atual não demonstra todos os seus critérios: não há controller `/api/health`, contrato global de erros, request ID ou rota de exemplo com validação.
- Atualização durante a rodada: a consulta posterior da #1 retornou HTTP 410, indicando exclusão no GitHub. A #27 foi criada para recuperar os critérios faltantes; a exclusão não foi realizada nesta rodada. A observação inicial acima é preservada como evidência temporal.
- Os runs recentes retornados pelo GitHub são execuções históricas de assistência de código, não evidência de CI do MVP atual.

## Bootstrap inspecionado

Backend: aplicação Spring Boot, teste `contextLoads`, dependências de JPA, Flyway, validação, Security e Resource Server; nenhum domínio, controller ou migration. O `application.yaml` contém apenas o nome da aplicação.

Frontend: Angular com rotas vazias, tela inicial e teste gerado. Há dependências de Keycloak e Spartan, mas a presença da dependência não demonstra integração funcional.

Ambiente: Compose declara PostgreSQL e Keycloak em desenvolvimento; importação de realm está comentada. Credenciais de demonstração são explícitas no Compose. A reprodução completa ainda precisa ser comprovada em clone limpo.

Não foram executados testes funcionais, carga ou avaliação de acessibilidade nesta rodada documental. Não há resultado clínico ou de usabilidade com pessoas reais.

## Inconsistências verificadas

| Fonte | Inconsistência | Encaminhamento |
|---|---|---|
| RF011 no escopo e #12 | Duplicata rejeitada versus check-in idempotente | Explicitar idempotência do efeito e resposta de conflito para repetição; preservar o instante original |
| RF008/RF009 e #16 | Recepcionista pode reagendar/cancelar no escopo, mas jornada só detalha check-in/fila | Completar critérios e contrato da recepção |
| RF017 e tabela de casos de uso do escopo | RF017 admite Paciente, mas a tabela resume Paciente como RF001/RF005–RF009 | Corrigir rastreabilidade; decidir conteúdo do histórico |
| RF004 e classes | Bloqueio não aparece no modelo | Acrescentar conceito explícito de bloqueio |
| RF005 e classes | Especialidade ofertada não está explícita na regra/reserva | Vincular especialidade para evitar ambiguidade de médico com múltiplas especialidades |
| Classes e cadastro | Cardinalidade mínima de um filho impede estrutura vazia durante configuração | Permitir zero filhos até a estrutura estar apta a ofertar horários |
| Protótipos e escopo | Encaixe, permissões administrativas, alergia, pressão e medicação estruturadas, antecedência e intervalo configuráveis não estão contratados | Identificar como elementos não adotados no MVP, sem novos RFs implícitos |
| Protótipos e perfis | Identidade Administrador aparece em telas de recepção e atendimento | Corrigir orientação por perfil e não sugerir acesso clínico por administração |
| RNFs e requisitos resumidos | Métricas do DOCX não aparecem na tabela Markdown/Issues | Transportar métricas sem inventar novos resultados |

## Integridade acadêmica

A revisão técnica é apoio à avaliação da equipe. Não constitui aprovação dos responsáveis humanos nem validação com profissionais clínicos. A frase do escopo de que os protótipos foram elaborados “para validar os fluxos” descreve intenção; os artefatos, isoladamente, não comprovam estudo de usabilidade.

O DOCX v1.0 e as imagens permanecem fontes históricas. Complementos e decisões desta rodada devem ser consultados junto deles; pendências explicitadas não devem ser tratadas como requisitos aprovados.
