# Adendo ao escopo versão 1.0

16 de setembro de 2026 — Issue #7. Este adendo documenta o refinamento autorizado durante a rodada técnica e deve acompanhar `MedFlow_Documento_de_Escopo_v1.0.docx`. O arquivo Word original é preservado; suas imagens e formulações resumidas não devem ser tomadas isoladamente como especificação atual.

O conjunto RF001–RF018/RNF001–RNF009 e as métricas do escopo são mantidos. A classificação Importante de RF008/RF017 não os remove da entrega final. Não foram adicionados encaixes, prescrições, sinais vitais, prontuário completo, notificações ou funcionalidades de produção.

| Seção original | Complemento vigente |
|---|---|
| RF002 | Uma clínica por instalação, cadastrada no provisionamento reproduzível e mantida por Administração; múltiplas unidades/consultórios com cadastro, consulta, alteração e desativação |
| RF003 | Especialidade ativa e vínculo médico-especialidade validado; subject do médico não é editável no CRUD genérico |
| RF004 | Regra semanal com vigência, especialidade, consultório e duração; bloqueio por médico e intervalo absoluto; alterações não invalidam reservas futuras ou em curso |
| RF005/RF006 | Slots futuros derivados em intervalos semiabertos; confirmação revalida sob lock transacional; paciente/fim são derivados pelo servidor |
| RF008/RF009 | Paciente proprietário e Recepção da clínica; AGENDADA antes do início; reagendamento atômico conserva médico, especialidade e unidade |
| RF011 | Duplicata continua rejeitada, com 409 e efeito único; check-in na data local da consulta |
| RF012 | Fila derivada ordenada por início agendado, check-in e id; somente EM_ESPERA, com pendências anteriores identificadas |
| RF015/RF016 | Rascunho incompleto permitido; queixa/resumo/conduta obrigatórios na finalização; observações opcionais; salvar explícito, sem autosave |
| RF017 | Paciente: próprias finalizadas com dados operacionais. Médico: registros dos seus atendimentos finalizados; registro em curso pelo endpoint do atendimento. Nenhum acesso clínico automático a Administração/Recepção |
| RF018/RNF003 | Matriz de operações e leituras clínicas auditáveis em documento específico; sem tokens/texto clínico em eventos |
| Seção 8 | Paciente também se associa a RF017, omitido na tabela resumida original |
| Seção 9 | Imagens são referências visuais históricas; extras sem requisito foram retirados da especificação UX revisada |
| Apêndice A | Modelo textual atualizado inclui BloqueioAgenda, especialidade na regra/reserva, vigência/fuso e cardinalidade zero durante configuração |

A delegação do usuário permite fechar essas decisões técnicas e de recorte, sem atribuir aprovação pessoal aos integrantes ou ao professor. Revisão acadêmica posterior pode originar nova versão consolidada do Word. Não foi feita validação clínica ou estudo com usuários reais nesta rodada.

Documentos normativos complementares: [síntese](../planejamento/sintese-tecnica.md), [contratos](../planejamento/contratos-iniciais.md), [segurança](../planejamento/seguranca-e-auditoria.md), [testes](../planejamento/testes-e-rastreabilidade.md), [diagramas](../diagramas.md) e [UX](../prototipos.md).
