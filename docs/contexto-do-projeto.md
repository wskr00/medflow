# MedFlow — Contexto do Projeto

## Visão geral

Atualização de planejamento: consultar a [síntese técnica da Issue #7](planejamento/sintese-tecnica.md), os [contratos](planejamento/contratos-iniciais.md) e a [matriz de acesso](planejamento/seguranca-e-auditoria.md). O DOCX v1.0 e os PNGs são baseline histórica; os detalhamentos desta rodada estão nesses documentos.

O MedFlow é uma aplicação web voltada ao fluxo essencial de atendimento
ambulatorial de clínicas de pequeno e médio porte.

O objetivo do MVP é apoiar, de forma integrada, a configuração da clínica,
disponibilidade de agenda, agendamento, recepção, fila, atendimento médico,
registro clínico básico e finalização do atendimento.

## Fluxo principal

`configuração → disponibilidade → agendamento → check-in → fila → atendimento → registro clínico básico → finalização`

## Perfis

- **Paciente**
- **Recepcionista**
- **Médico**
- **Administrador**

## Arquitetura

Baseline técnica:

- Java 25
- Spring Boot 4
- Angular
- PostgreSQL
- Keycloak
- Spartan UI

A aplicação segue uma arquitetura de **monólito modular**, com DDD pragmático,
SOLID, KISS e YAGNI.

Não há intenção de introduzir microservices, infraestrutura distribuída ou
abstrações especulativas no MVP.

## Modelo conceitual

Conceitos principais:

- Clínica
- Unidade
- Consultório
- Especialidade
- Médico
- Paciente
- RegraAgenda
- Agendamento
- Atendimento
- RegistroClinico
- StatusAgendamento
- BloqueioAgenda

O MVP opera uma clínica por instalação, com múltiplas unidades. A recepção e a administração têm escopo operacional da clínica; acesso clínico depende do médico atribuído. Clínica/unidade podem existir sem filhos durante configuração. Regras e agendamentos registram a especialidade ofertada; agenda tem vigência e fuso explícitos. RegistroClinico é valor interno do Atendimento, não exige entidade JPA independente.

Relações conceituais importantes:

- Clínica possui unidades.
- Unidade possui consultórios.
- Médico se relaciona com especialidades.
- Regras de agenda vinculam disponibilidade a profissionais/consultórios.
- Paciente, médico e consultório participam do agendamento.
- Um agendamento pode originar um atendimento.
- O atendimento possui o registro clínico básico correspondente.

O diagrama de classes é **conceitual**. Ele não deve ser interpretado como
mapeamento JPA obrigatório, nem como obrigação de transformar cada elemento em
uma entidade persistida.

A fila pode ser derivada dos agendamentos em `EM_ESPERA`; não há necessidade
de uma entidade `Fila` sem requisito concreto.

Keycloak é infraestrutura de identidade e acesso, não uma entidade de domínio.

## Estados do agendamento

Fluxo principal:

`AGENDADA → EM_ESPERA → EM_ATENDIMENTO → FINALIZADA`

Cancelamento:

`AGENDADA → CANCELADA`

O reagendamento altera a data/horário mantendo o agendamento em `AGENDADA`.

Reagendamento/cancelamento exigem início futuro. Check-in ocorre na data local da consulta e repetição retorna conflito, preservando chegada. Fila usa início agendado, chegada e id como ordenação. Consultas passadas sem comparecimento permanecem `AGENDADA`: faltas/abandono não possuem fluxo de resolução no MVP.

## Registro clínico básico

O MVP limita o registro clínico a:

- queixa principal;
- anamnese ou resumo clínico;
- conduta;
- observações.

O objetivo não é construir um prontuário eletrônico completo.

Queixa, resumo/anamnese e conduta são obrigatórios para finalizar; rascunho incompleto pode ser salvo explicitamente. Observações são opcionais. Registro finalizado é somente leitura. Paciente vê histórico operacional próprio; médico vê registros dos atendimentos sob sua responsabilidade, sem acesso ao histórico de outros médicos.

## Fora de escopo do MVP

- prontuário eletrônico completo;
- prescrições e assinatura digital;
- solicitação de exames;
- integrações laboratoriais;
- integrações com outros prontuários;
- faturamento, convênios e pagamentos;
- dashboards analíticos avançados;
- notificações por SMS, WhatsApp ou e-mail;
- aplicativo mobile nativo;
- RNDS/FHIR;
- alta disponibilidade e infraestrutura cloud de produção;
- IA clínica;
- uso de dados reais de pacientes em desenvolvimento ou testes.

## Como usar esta documentação

Cada Issue deve ser executada considerando:

1. critérios de aceite da própria Issue;
2. RF/RNF relacionados;
3. diagramas pertinentes;
4. contratos já acordados entre backend, frontend e segurança;
5. documentação acadêmica existente.

Caso código e documentação entrem em conflito, a diferença deve ser explicitada
e coordenada antes de uma alteração estrutural.
