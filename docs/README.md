# Documentação do MedFlow

Esta pasta reúne os artefatos de referência do projeto MedFlow para planejamento,
implementação, validação e acompanhamento acadêmico.

## Planejamento técnico vigente

A rodada da Issue #7 está consolidada em [síntese técnica](planejamento/sintese-tecnica.md), [contratos iniciais](planejamento/contratos-iniciais.md), [segurança e auditoria](planejamento/seguranca-e-auditoria.md) e [testes e rastreabilidade](planejamento/testes-e-rastreabilidade.md). [Evidências da baseline](planejamento/analise-baseline.md) distingue código observado de comportamento planejado.

Os diagramas textuais em `diagramas.md` e a especificação de `prototipos.md` incorporam as revisões. O DOCX de escopo v1.0 e as imagens PNG permanecem preservados como baseline histórica e devem ser lidos com o [adendo de escopo](escopo/ADENDO-v1.0-planejamento.md). Não há funcionalidades implementadas por esta rodada.

## Estrutura

- `contexto-do-projeto.md` — visão rápida e operacional do produto.
- `requisitos.md` — baseline dos requisitos funcionais e não funcionais.
- `autorizacao.md` — implementação da autorização funcional/contextual e contrato para as Issues dependentes.
- `escopo/` — Documento de Escopo e Problem Pitch.
- `planejamento/` — Project Charter e cronograma/acompanhamento.
- `diagramas/` — diagramas de arquitetura, classes, estados e casos de uso.
- `prototipos/` — protótipos das quatro jornadas principais.

## Regra de uso

Antes de iniciar uma Issue, consulte os artefatos relevantes ao trabalho.

Os diagramas e protótipos representam a baseline conceitual aprovada do projeto,
mas não são especificações imutáveis de implementação. Se a implementação indicar
uma modelagem melhor ou exigir mudança de contrato, a diferença deve ser coordenada
antes de o código divergir silenciosamente da documentação.

As Issues e o GitHub Project representam o estado atual do trabalho, responsáveis,
dependências e critérios de aceite.
