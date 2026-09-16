package br.com.medflow.scheduling;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.clinic.persistence.ClinicaRepository;
import br.com.medflow.common.http.BusinessConflictException;
import br.com.medflow.scheduling.application.SchedulingConfigurationService;
import br.com.medflow.scheduling.domain.BloqueioAgenda;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Exercita Flyway/Hibernate e invariantes contra PostgreSQL, não banco em memória. */
@SpringBootTest
@Import(PostgresTestConfiguration.class)
@Transactional
class ConfigurationPersistenceIntegrationTests {

  @Autowired private ClinicConfigurationService clinic;
  @Autowired private SchedulingConfigurationService scheduling;
  @Autowired private ClinicaRepository clinicas;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private DataSource dataSource;

  @Test
  void provisionsSingletonAndRejectsStaleVersion() {
    var singleton = clinic.clinica();
    assertThat(singleton.id()).isEqualTo(java.util.UUID.fromString("00000000-0000-0000-0000-000000000001"));
    assertThat(singleton.timeZone()).isEqualTo("America/Belem");

    assertThatThrownBy(() -> clinic.alterarClinica(singleton.version() + 1,
        singleton.nome(), singleton.timeZone(), singleton.ativo()))
        .isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("VERSAO_DESATUALIZADA");
  }

  @Test
  void persistsAgendaRulesAndRejectsOverlapButAllowsAdjacency() {
    var especialidade = clinic.criarEspecialidade("Clínica geral", true);
    var unidade = clinic.criarUnidade("Unidade central", "Rua Sintética, 1", true);
    var consultorio = clinic.criarConsultorio(unidade.id(), "Sala 1", true);
    var medico = clinic.criarMedico("Médico Sintético", "12345", "PA", List.of(especialidade.id()), true);
    LocalDate inicioVigencia = LocalDate.of(2026, 9, 21);

    var primeira = command(medico.id(), especialidade.id(), consultorio.id(), LocalTime.of(8, 0), LocalTime.of(10, 0), inicioVigencia);
    var adjacente = command(medico.id(), especialidade.id(), consultorio.id(), LocalTime.of(10, 0), LocalTime.of(12, 0), inicioVigencia);
    scheduling.criarRegra(primeira);
    scheduling.criarRegra(adjacente);

    assertThatThrownBy(() -> scheduling.criarRegra(command(medico.id(), especialidade.id(), consultorio.id(),
        LocalTime.of(9, 30), LocalTime.of(11, 0), inicioVigencia)))
        .isInstanceOf(BusinessConflictException.class);
  }

  @Test
  void requiresSpecialtyLinkedToDoctorAndValidAbsoluteBlock() {
    var vinculada = clinic.criarEspecialidade("Pediatria", true);
    var naoVinculada = clinic.criarEspecialidade("Cardiologia", true);
    var unidade = clinic.criarUnidade("Unidade norte", "Rua Sintética, 2", true);
    var consultorio = clinic.criarConsultorio(unidade.id(), "Sala 2", true);
    var medico = clinic.criarMedico("Médica Sintética", "67890", "PA", List.of(vinculada.id()), true);

    assertThatThrownBy(() -> scheduling.criarRegra(command(medico.id(), naoVinculada.id(), consultorio.id(),
        LocalTime.of(8, 0), LocalTime.of(9, 0), LocalDate.of(2026, 9, 21))))
        .isInstanceOf(BusinessConflictException.class);
    assertThatThrownBy(() -> new BloqueioAgenda(null, null, Instant.parse("2026-09-21T12:00:00Z"),
        Instant.parse("2026-09-21T11:00:00Z"), true))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void keepsDoctorSubjectAbsentUntilOneWayProvisioning() {
    var especialidade = clinic.criarEspecialidade("Dermatologia", true);
    var medico = clinic.criarMedico("Profissional sem conta", "54321", "PA", List.of(especialidade.id()), true);
    assertThat(medico.subject()).isNull();

    var provisionado = clinic.provisionarSubjectMedico(medico.id(), "subject-medico-sintetico");
    assertThat(provisionado.subject()).isEqualTo("subject-medico-sintetico");
    assertThatThrownBy(() -> clinic.provisionarSubjectMedico(medico.id(), "outro-subject"))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void databaseConstraintRejectsInvalidBlockInterval() {
    var especialidade = clinic.criarEspecialidade("Neurologia", true);
    var medico = clinic.criarMedico("Médico para constraint", "11111", "PA", List.of(especialidade.id()), true);
    UUID clinicaId = clinic.clinica().id();

    assertThatThrownBy(() -> jdbc.update("""
        insert into bloqueio_agenda (id, clinica_id, medico_id, inicio, fim, ativo, version)
        values (?, ?, ?, ?, ?, true, 0)
        """, UUID.randomUUID(), clinicaId, medico.id(), Timestamp.from(Instant.parse("2026-09-21T12:00:00Z")),
        Timestamp.from(Instant.parse("2026-09-21T12:00:00Z"))))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void databaseConstraintRejectsRepeatedCrm() {
    var especialidade = clinic.criarEspecialidade("Ortopedia", true);
    var medico = clinic.criarMedico("Médico com CRM", "22222", "PA", List.of(especialidade.id()), true);
    UUID clinicaId = clinic.clinica().id();
    assertThatThrownBy(() -> jdbc.update("""
        insert into medico (id, clinica_id, nome, crm_numero, crm_uf, ativo, version)
        values (?, ?, ?, ?, ?, true, 0)
        """, UUID.randomUUID(), clinicaId, "CRM repetido", medico.crmNumero(), medico.crmUf()))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void singletonRepositoryTakesRealPessimisticLock() throws Exception {
    clinicas.findSingletonForUpdate().orElseThrow();
    assertThatThrownBy(() -> {
      try (var connection = dataSource.getConnection();
          var statement = connection.prepareStatement(
              "select id from clinica where singleton = true for update nowait")) {
        statement.executeQuery();
      }
    }).isInstanceOf(java.sql.SQLException.class);
  }

  private static SchedulingConfigurationService.RegraCommand command(java.util.UUID medicoId,
      java.util.UUID especialidadeId, java.util.UUID consultorioId, LocalTime inicio, LocalTime fim,
      LocalDate vigenteDe) {
    return new SchedulingConfigurationService.RegraCommand(medicoId, especialidadeId, consultorioId,
        DayOfWeek.MONDAY, inicio, fim, 30, vigenteDe, null, true, 0);
  }
}
