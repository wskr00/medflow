CREATE VIEW vw_medico_indicadores_agendamento_diario AS
SELECT
    agendamento.clinica_id,
    agendamento.medico_id,
    (agendamento.inicio AT TIME ZONE clinica.time_zone)::date AS data_agendada,
    COUNT(*) AS total_consultas,
    COUNT(*) FILTER (WHERE agendamento.status = 'AGENDADA') AS agendadas,
    COUNT(*) FILTER (WHERE agendamento.status = 'EM_ESPERA') AS em_espera,
    COUNT(*) FILTER (WHERE agendamento.status = 'EM_ATENDIMENTO') AS em_atendimento,
    COUNT(*) FILTER (WHERE agendamento.status = 'FINALIZADA') AS finalizadas,
    COUNT(*) FILTER (WHERE agendamento.status = 'CANCELADA') AS canceladas
FROM agendamento
JOIN clinica ON clinica.id = agendamento.clinica_id
GROUP BY
    agendamento.clinica_id,
    agendamento.medico_id,
    (agendamento.inicio AT TIME ZONE clinica.time_zone)::date;

CREATE VIEW vw_medico_indicadores_finalizacao_diaria AS
SELECT
    agendamento.clinica_id,
    agendamento.medico_id,
    (atendimento.finalizado_em AT TIME ZONE clinica.time_zone)::date AS data_finalizada,
    COUNT(*) AS total_finalizadas,
    SUM(EXTRACT(EPOCH FROM (atendimento.finalizado_em - atendimento.iniciado_em)))
        AS duracao_total_segundos
FROM atendimento
JOIN agendamento ON agendamento.id = atendimento.agendamento_id
JOIN clinica ON clinica.id = agendamento.clinica_id
WHERE atendimento.finalizado_em IS NOT NULL
  AND agendamento.status = 'FINALIZADA'
GROUP BY
    agendamento.clinica_id,
    agendamento.medico_id,
    (atendimento.finalizado_em AT TIME ZONE clinica.time_zone)::date;
