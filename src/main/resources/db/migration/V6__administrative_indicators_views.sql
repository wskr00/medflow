CREATE INDEX ix_agendamento_clinica_inicio
    ON agendamento (clinica_id, inicio);

CREATE VIEW vw_admin_indicadores_agendamento AS
SELECT
    agendamento.clinica_id,
    agendamento.inicio,
    (agendamento.inicio AT TIME ZONE clinica.time_zone)::date AS data_agendada,
    agendamento.status,
    unidade.id AS unidade_id,
    unidade.nome AS unidade_nome,
    especialidade.id AS especialidade_id,
    especialidade.nome AS especialidade_nome
FROM agendamento
JOIN clinica ON clinica.id = agendamento.clinica_id
JOIN consultorio ON consultorio.id = agendamento.consultorio_id
JOIN unidade ON unidade.id = consultorio.unidade_id
JOIN especialidade ON especialidade.id = agendamento.especialidade_id;

CREATE VIEW vw_admin_indicadores_agendamento_diario AS
SELECT
    clinica_id,
    data_agendada,
    unidade_id,
    unidade_nome,
    especialidade_id,
    especialidade_nome,
    COUNT(*) AS total_consultas,
    COUNT(*) FILTER (WHERE status = 'AGENDADA') AS agendadas,
    COUNT(*) FILTER (WHERE status = 'EM_ESPERA') AS em_espera,
    COUNT(*) FILTER (WHERE status = 'EM_ATENDIMENTO') AS em_atendimento,
    COUNT(*) FILTER (WHERE status = 'FINALIZADA') AS finalizadas,
    COUNT(*) FILTER (WHERE status = 'CANCELADA') AS canceladas
FROM vw_admin_indicadores_agendamento
GROUP BY clinica_id, data_agendada, unidade_id, unidade_nome,
    especialidade_id, especialidade_nome;

CREATE VIEW vw_admin_indicadores_finalizacao AS
SELECT
    agendamento.clinica_id,
    atendimento.finalizado_em,
    (atendimento.finalizado_em AT TIME ZONE clinica.time_zone)::date AS data_finalizada,
    unidade.id AS unidade_id,
    unidade.nome AS unidade_nome,
    especialidade.id AS especialidade_id,
    especialidade.nome AS especialidade_nome
FROM atendimento
JOIN agendamento ON agendamento.id = atendimento.agendamento_id
JOIN clinica ON clinica.id = agendamento.clinica_id
JOIN consultorio ON consultorio.id = agendamento.consultorio_id
JOIN unidade ON unidade.id = consultorio.unidade_id
JOIN especialidade ON especialidade.id = agendamento.especialidade_id
WHERE atendimento.finalizado_em IS NOT NULL
  AND agendamento.status = 'FINALIZADA';

CREATE VIEW vw_admin_indicadores_finalizacao_diaria AS
SELECT
    clinica_id,
    data_finalizada,
    unidade_id,
    unidade_nome,
    especialidade_id,
    especialidade_nome,
    COUNT(*) AS total_finalizadas
FROM vw_admin_indicadores_finalizacao
GROUP BY clinica_id, data_finalizada, unidade_id, unidade_nome,
    especialidade_id, especialidade_nome;
