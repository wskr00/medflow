package br.com.medflow.clinic.api;

import br.com.medflow.clinic.application.ClinicConfigurationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ClinicConfigurationController {

  private static final String ALL_ROLES = "hasAnyRole('PATIENT','RECEPTIONIST','DOCTOR','ADMINISTRATOR')";
  private final ClinicConfigurationService service;

  public ClinicConfigurationController(ClinicConfigurationService service) { this.service = service; }

  @GetMapping("/clinica") @PreAuthorize("hasRole('ADMINISTRATOR')")
  ConfigurationApi.ClinicResponse clinica() { return ConfigurationApi.clinic(service.clinica()); }

  @PutMapping("/clinica") @PreAuthorize("hasRole('ADMINISTRATOR')")
  ConfigurationApi.ClinicResponse alterarClinica(@Valid @RequestBody ClinicInput input) {
    return ConfigurationApi.clinic(service.alterarClinica(input.expectedVersion(), input.nome(), input.timeZone(), input.ativo()));
  }

  @GetMapping("/unidades") @PreAuthorize(ALL_ROLES)
  ConfigurationApi.PageResponse<ConfigurationApi.UnidadeResponse> unidades(
      @RequestParam(defaultValue = "false") boolean incluirInativas,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") int size) {
    return page(service.unidades(incluirInativas), page, size, ConfigurationApi::unidade);
  }

  @PostMapping("/unidades") @PreAuthorize("hasRole('ADMINISTRATOR')")
  ResponseEntity<ConfigurationApi.UnidadeResponse> criarUnidade(@Valid @RequestBody UnidadeInput input) {
    var value = ConfigurationApi.unidade(service.criarUnidade(input.nome(), input.endereco(), input.ativo()));
    return ResponseEntity.created(URI.create("/api/unidades/" + value.id())).body(value);
  }

  @PutMapping("/unidades/{id}") @PreAuthorize("hasRole('ADMINISTRATOR')")
  ConfigurationApi.UnidadeResponse alterarUnidade(@PathVariable UUID id, @Valid @RequestBody UnidadeUpdate input) {
    return ConfigurationApi.unidade(service.alterarUnidade(id, input.expectedVersion(), input.nome(), input.endereco(), input.ativo()));
  }

  @GetMapping("/consultorios") @PreAuthorize(ALL_ROLES)
  ConfigurationApi.PageResponse<ConfigurationApi.ConsultorioResponse> consultorios(
      @RequestParam(defaultValue = "false") boolean incluirInativas,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") int size) {
    return page(service.consultorios(incluirInativas), page, size, ConfigurationApi::consultorio);
  }

  @PostMapping("/consultorios") @PreAuthorize("hasRole('ADMINISTRATOR')")
  ResponseEntity<ConfigurationApi.ConsultorioResponse> criarConsultorio(@Valid @RequestBody ConsultorioInput input) {
    var value = ConfigurationApi.consultorio(service.criarConsultorio(input.unidadeId(), input.nome(), input.ativo()));
    return ResponseEntity.created(URI.create("/api/consultorios/" + value.id())).body(value);
  }

  @PutMapping("/consultorios/{id}") @PreAuthorize("hasRole('ADMINISTRATOR')")
  ConfigurationApi.ConsultorioResponse alterarConsultorio(@PathVariable UUID id,
      @Valid @RequestBody ConsultorioUpdate input) {
    return ConfigurationApi.consultorio(service.alterarConsultorio(id, input.unidadeId(), input.expectedVersion(),
        input.nome(), input.ativo()));
  }

  @GetMapping("/especialidades") @PreAuthorize(ALL_ROLES)
  ConfigurationApi.PageResponse<ConfigurationApi.EspecialidadeResponse> especialidades(
      @RequestParam(defaultValue = "false") boolean incluirInativas,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") int size) {
    return page(service.especialidades(incluirInativas), page, size, ConfigurationApi::especialidade);
  }

  @PostMapping("/especialidades") @PreAuthorize("hasRole('ADMINISTRATOR')")
  ResponseEntity<ConfigurationApi.EspecialidadeResponse> criarEspecialidade(@Valid @RequestBody NamedInput input) {
    var value = ConfigurationApi.especialidade(service.criarEspecialidade(input.nome(), input.ativo()));
    return ResponseEntity.created(URI.create("/api/especialidades/" + value.id())).body(value);
  }

  @PutMapping("/especialidades/{id}") @PreAuthorize("hasRole('ADMINISTRATOR')")
  ConfigurationApi.EspecialidadeResponse alterarEspecialidade(@PathVariable UUID id,
      @Valid @RequestBody NamedUpdate input) {
    return ConfigurationApi.especialidade(service.alterarEspecialidade(id, input.expectedVersion(), input.nome(), input.ativo()));
  }

  @GetMapping("/medicos") @PreAuthorize(ALL_ROLES)
  ConfigurationApi.PageResponse<ConfigurationApi.MedicoResponse> medicos(
      @RequestParam(defaultValue = "false") boolean incluirInativas,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") int size) {
    return page(service.medicos(incluirInativas), page, size, ConfigurationApi::medico);
  }

  @PostMapping("/medicos") @PreAuthorize("hasRole('ADMINISTRATOR')")
  ResponseEntity<ConfigurationApi.MedicoResponse> criarMedico(@Valid @RequestBody MedicoInput input) {
    var value = ConfigurationApi.medico(service.criarMedico(input.nome(), input.crmNumero(), input.crmUf(),
        input.especialidadeIds(), input.ativo()));
    return ResponseEntity.created(URI.create("/api/medicos/" + value.id())).body(value);
  }

  @PutMapping("/medicos/{id}") @PreAuthorize("hasRole('ADMINISTRATOR')")
  ConfigurationApi.MedicoResponse alterarMedico(@PathVariable UUID id, @Valid @RequestBody MedicoUpdate input) {
    return ConfigurationApi.medico(service.alterarMedico(id, input.expectedVersion(), input.nome(), input.crmNumero(),
        input.crmUf(), input.especialidadeIds(), input.ativo()));
  }

  private static <S, T> ConfigurationApi.PageResponse<T> page(List<S> source, int page, int size,
      Function<S, T> mapper) {
    if (size < 1 || size > 100) throw new IllegalArgumentException("size inválido");
    int from = Math.min(page * size, source.size());
    int to = Math.min(from + size, source.size());
    return new ConfigurationApi.PageResponse<>(source.subList(from, to).stream().map(mapper).toList(), page, size, source.size());
  }

  record ClinicInput(@NotBlank @Size(max = 200) String nome, @NotBlank @Size(max = 64) String timeZone,
      boolean ativo, @PositiveOrZero long expectedVersion) { }
  record UnidadeInput(@NotBlank @Size(max = 200) String nome, @NotBlank @Size(max = 500) String endereco,
      boolean ativo) { }
  record UnidadeUpdate(@NotBlank @Size(max = 200) String nome, @NotBlank @Size(max = 500) String endereco,
      boolean ativo, @PositiveOrZero long expectedVersion) { }
  record ConsultorioInput(@NotNull UUID unidadeId, @NotBlank @Size(max = 200) String nome, boolean ativo) { }
  record ConsultorioUpdate(@NotNull UUID unidadeId, @NotBlank @Size(max = 200) String nome, boolean ativo,
      @PositiveOrZero long expectedVersion) { }
  record NamedInput(@NotBlank @Size(max = 200) String nome, boolean ativo) { }
  record NamedUpdate(@NotBlank @Size(max = 200) String nome, boolean ativo, @PositiveOrZero long expectedVersion) { }
  record MedicoInput(@NotBlank @Size(max = 200) String nome, @NotBlank @Size(max = 30) String crmNumero,
      @Pattern(regexp = "[A-Za-z]{2}") String crmUf, @NotEmpty List<@NotNull UUID> especialidadeIds, boolean ativo) { }
  record MedicoUpdate(@NotBlank @Size(max = 200) String nome, @NotBlank @Size(max = 30) String crmNumero,
      @Pattern(regexp = "[A-Za-z]{2}") String crmUf, @NotEmpty List<@NotNull UUID> especialidadeIds, boolean ativo,
      @PositiveOrZero long expectedVersion) { }
}
