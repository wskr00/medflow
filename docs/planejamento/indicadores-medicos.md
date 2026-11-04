git add .
git commit -m "Initial commit"
git push --set-upstream origin main# Indicadores operacionais do Médico

Contrato da API `GET /api/medico/indicadores`, implementada pela Issue #61 e
consumida pela futura tela da Issue #63.

## Consulta

```http
GET /api/medico/indicadores?inicio=2026-09-14&fim=2026-09-20
```

`inicio` e `fim` são datas locais inclusivas no fuso atual da Clínica. O
intervalo precisa ter de 1 a 366 dias. O servidor usa o `medicoId` ativo do
contexto autenticado; não existe parâmetro para selecionar outro médico.

## Semântica temporal

A resposta mantém duas séries separadas para não combinar populações com datas
de referência diferentes:

- `consultasPorDataAgendada` inclui as consultas cujo instante `inicio`
  pertence ao intervalo após conversão para `timeZone`. `totalConsultas` conta
  cada consulta uma vez, inclusive canceladas. Os campos de estado descrevem o
  estado atual dessas consultas no momento da leitura. A série não representa
  um histórico de mudanças de estado.
- `finalizacoesPorDataReal` inclui atendimentos com `finalizadoEm` no intervalo
  local. A duração usa somente a diferença entre `iniciadoEm` e `finalizadoEm`
  persistidos no Atendimento. A média é ponderada pelo número de atendimentos
  finalizados. Com zero finalizações, a média é `null` e a série fica vazia.

Os totais das duas séries não devem ser somados entre si. Uma consulta pode
estar na população agendada de um intervalo e sua finalização ocorrer em outro.

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
      {
        "data": "2026-09-16",
        "totalConsultas": 12,
        "agendadas": 3,
        "emEspera": 1,
        "emAtendimento": 0,
        "finalizadas": 6,
        "canceladas": 2
      }
    ]
  },
  "finalizacoesPorDataReal": {
    "totalFinalizadas": 6,
    "duracaoMediaSegundos": 780.50,
    "porDia": [
      {
        "data": "2026-09-16",
        "totalFinalizadas": 6,
        "duracaoMediaSegundos": 780.50
      }
    ]
  }
}
```

O exemplo é ilustrativo, não representa resultado medido. Os intervalos sem
atividade retornam contagens iguais a zero, `porDia: []` e duração média
`null`. Erros usam o envelope HTTP comum, com `requestId`; perfil sem role
Médico recebe `403` e recurso de contexto inexistente mantém `404` uniforme.

## Persistência e privacidade

As views `vw_medico_indicadores_agendamento_diario` e
`vw_medico_indicadores_finalizacao_diaria` são agregações somente de leitura,
versionadas por Flyway. Elas agrupam por Clínica, Médico e data local. A view
de finalizações usa os tempos reais de Atendimento e status `FINALIZADA` do
Agendamento. Nenhuma view ou DTO seleciona paciente, texto clínico, nome ou
identificador de atendimento. A API também não retorna identificador de
médico: o escopo é sempre o vínculo ativo da identidade autenticada.

## Estados contabilizados

Na série por data agendada, cada consulta está em exatamente um dos estados
atuais: `AGENDADA`, `EM_ESPERA`, `EM_ATENDIMENTO`, `FINALIZADA` ou `CANCELADA`.
`totalConsultas` é a soma da população e inclui todos esses estados. A série de
finalizações é agrupada novamente pela data local do término real; ela não
reclassifica retroativamente a série da data agendada.
