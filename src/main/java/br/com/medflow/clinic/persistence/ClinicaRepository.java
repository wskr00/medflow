package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Clinica;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ClinicaRepository extends JpaRepository<Clinica, UUID> {
  Optional<Clinica> findBySingletonTrue();

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select c from Clinica c where c.singleton = true")
  Optional<Clinica> findSingletonForUpdate();
}
