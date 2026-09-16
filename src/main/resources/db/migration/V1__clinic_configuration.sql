CREATE TABLE clinica (
    id UUID PRIMARY KEY,
    singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK (singleton),
    nome VARCHAR(200) NOT NULL,
    time_zone VARCHAR(64) NOT NULL,
    ativo BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);

INSERT INTO clinica (id, singleton, nome, time_zone, ativo, version)
VALUES ('00000000-0000-0000-0000-000000000001', TRUE, 'Clínica MedFlow', 'America/Belem', TRUE, 0);

CREATE TABLE unidade (
    id UUID PRIMARY KEY,
    clinica_id UUID NOT NULL REFERENCES clinica(id),
    nome VARCHAR(200) NOT NULL,
    endereco VARCHAR(500) NOT NULL,
    ativo BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE consultorio (
    id UUID PRIMARY KEY,
    unidade_id UUID NOT NULL REFERENCES unidade(id),
    nome VARCHAR(200) NOT NULL,
    ativo BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE especialidade (
    id UUID PRIMARY KEY,
    clinica_id UUID NOT NULL REFERENCES clinica(id),
    nome VARCHAR(200) NOT NULL,
    ativo BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE medico (
    id UUID PRIMARY KEY,
    clinica_id UUID NOT NULL REFERENCES clinica(id),
    nome VARCHAR(200) NOT NULL,
    crm_numero VARCHAR(30) NOT NULL,
    crm_uf VARCHAR(2) NOT NULL,
    subject VARCHAR(255) CHECK (subject IS NULL OR btrim(subject) <> ''),
    ativo BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_medico_crm UNIQUE (clinica_id, crm_numero, crm_uf)
);

CREATE UNIQUE INDEX uk_medico_subject ON medico(subject) WHERE subject IS NOT NULL;

CREATE TABLE paciente (
    id UUID PRIMARY KEY,
    clinica_id UUID NOT NULL REFERENCES clinica(id),
    nome VARCHAR(200) NOT NULL,
    subject VARCHAR(255) NOT NULL UNIQUE,
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (btrim(subject) <> '')
);

CREATE TABLE medico_especialidade (
    medico_id UUID NOT NULL REFERENCES medico(id),
    especialidade_id UUID NOT NULL REFERENCES especialidade(id),
    PRIMARY KEY (medico_id, especialidade_id)
);

CREATE TABLE regra_agenda (
    id UUID PRIMARY KEY,
    clinica_id UUID NOT NULL REFERENCES clinica(id),
    medico_id UUID NOT NULL REFERENCES medico(id),
    especialidade_id UUID NOT NULL REFERENCES especialidade(id),
    consultorio_id UUID NOT NULL REFERENCES consultorio(id),
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    duracao_minutos INTEGER NOT NULL CHECK (duracao_minutos > 0),
    vigente_de DATE NOT NULL,
    vigente_ate DATE,
    ativo BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (hora_inicio < hora_fim),
    CHECK (vigente_ate IS NULL OR vigente_de <= vigente_ate)
);

CREATE INDEX ix_regra_agenda_consulta ON regra_agenda (clinica_id, ativo, dia_semana, vigente_de, vigente_ate);

CREATE TABLE bloqueio_agenda (
    id UUID PRIMARY KEY,
    clinica_id UUID NOT NULL REFERENCES clinica(id),
    medico_id UUID NOT NULL REFERENCES medico(id),
    inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fim TIMESTAMP WITH TIME ZONE NOT NULL,
    ativo BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (inicio < fim)
);

CREATE INDEX ix_bloqueio_agenda_consulta ON bloqueio_agenda (clinica_id, medico_id, ativo, inicio, fim);
