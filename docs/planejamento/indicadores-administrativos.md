# Indicadores operacionais do Administrador

Contrato de `GET /api/admin/indicadores`, implementado pela Issue #62 e
destinado ao dashboard Administrativo da Issue #64.

## Consulta

```http
GET /api/admin/indicadores?inicio=2026-09-14&fim=2026-09-20&unidadeId=<uuid>&especialidadeId=<uuid>
```

`inicio` e `fim` são datas locais inclusivas no fuso atual da Clínica. O
intervalo aceita de 1 a 366 dias. `unidadeId` e `especialidadeId` são filtros
opcionais e, quando usados juntos, são aplicados em conjunto. Os identificadores
precisam pertencer à clínica autenticada; recursos inativos existentes continuam
válidos para consulta histórica. O escopo da clínica vem do contexto autenticado,
sem parâmetro `clinicaId` controlado pelo cliente.

## Semântica temporal e estados

A resposta contém duas séries independentes:

- `consultasPorDataAgendada` agrupa cada agendamento pela data local do instante
  `agendamento.inicio`. `totalConsultas` inclui todas as consultas com início
  local no período, inclusive as canceladas. Os campos `agendadas`, `emEspera`,
  `emAtendimento`, `finalizadas` e `canceladas` descrevem o estado atual de cada
  consulta no momento da leitura; não são um histórico de transições.
- `finalizacoesPorDataReal` agrupa atendimentos cujo `finalizado_em` real pertence
  ao período local e cujo agendamento está `FINALIZADA`. A restrição única em
  `atendimento.agendamento_id` garante no máximo uma linha de atendimento por
  agendamento e evita multiplicar contagens no join.

Cancelamentos são consultas atualmente em `CANCELADA` cuja data agendada está no
período. O modelo não registra `cancelado_em` nem eventos de transição, então a
API não afirma quando o cancelamento ocorreu e não calcula taxa de cancelamento.
Também não inclui média de duração: ela é opcional no escopo e não é necessária
para este contrato.

As séries usam datas de referência diferentes e não devem ser somadas. Uma
consulta agendada no fim de um dia pode ser finalizada no dia seguinte. Nomes de
unidades e especialidades correspondem aos nomes atuais dos recursos.

## Resposta

```json
{
  "inicio": "2026-09-14",
  "fim": "2026-09-20",
  "timeZone": "America/Belem",
  "consultasPorDataAgendada": {
    "totalConsultas": 12,
    "agendadas": 3,
    "emEspera": 1,
    "emAtendimento": 0,
    "finalizadas": 6,
    "canceladas": 2,
    "porDia": [
      {"data": "2026-09-16", "totalConsultas": 12, "agendadas": 3,
       "emEspera": 1, "emAtendimento": 0, "finalizadas": 6, "canceladas": 2}
    ],
    "porUnidade": [
      {"id": "00000000-0000-0000-0000-000000000010", "nome": "Unidade Centro",
       "totalConsultas": 12, "agendadas": 3, "emEspera": 1,
       "emAtendimento": 0, "finalizadas": 6, "canceladas": 2}
    ],
    "porEspecialidade": [
      {"id": "00000000-0000-0000-0000-000000000020", "nome": "Clínica Geral",
       "totalConsultas": 12, "agendadas": 3, "emEspera": 1,
       "emAtendimento": 0, "finalizadas": 6, "canceladas": 2}
    ]
  },
  "finalizacoesPorDataReal": {
    "totalFinalizadas": 6,
    "porDia": [{"data": "2026-09-16", "totalFinalizadas": 6}],
    "porUnidade": [
      {"id": "00000000-0000-0000-0000-000000000010", "nome": "Unidade Centro",
       "totalFinalizadas": 6}
    ],
    "porEspecialidade": [
      {"id": "00000000-0000-0000-0000-000000000020", "nome": "Clínica Geral",
       "totalFinalizadas": 6}
    ]
  }
}
```

O exemplo é ilustrativo. Um período sem linhas retorna contagens zero e listas
vazias. A ausência de uma média não é representada como zero porque duração
média não faz parte deste contrato.

## Persistência, consulta e privacidade

As views `vw_admin_indicadores_agendamento` e
`vw_admin_indicadores_finalizacao` são projeções SQL somente de leitura,
versionadas por Flyway. As views `_diario` agregam essas projeções por clínica,
data local, unidade e especialidade; a de agendamento também conta cada um dos
cinco estados atuais. A view de finalização contém somente agendamentos
finalizados com seu Atendimento único e não lê conteúdo clínico.

A consulta administrativa filtra a clínica resolvida do ator antes de devolver
resultados e valida que filtros dimensionais pertencem à mesma clínica. Antes de
agrupar, a API converte as datas locais para o intervalo semiaberto de instantes
e filtra por `inicio` ou `finalizado_em`. Isso preserva os limites de dia local e
permite ao PostgreSQL usar `ix_agendamento_clinica_inicio` e o índice existente
`ix_atendimento_finalizado`; os filtros dimensionais também são aplicados antes
da agregação. A API retorna somente contagens, datas e nomes/IDs de unidade e
especialidade. Não retorna paciente, atendimento, médico, dados clínicos nem
texto livre.

O intervalo sem registros tem `totalConsultas: 0`, `totalFinalizadas: 0` e
`porDia: []`; assim zero real não é confundido com uma data preenchida por dados
inventados. O endpoint exige role Administrador; Paciente, Recepção e Médico
recebem `403`.
