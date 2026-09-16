package br.com.medflow.scheduling;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

@TestConfiguration(proxyBeanMethods = false)
public class FixedSchedulingClockConfiguration {
  public static final Instant NOW = Instant.parse("2026-09-16T12:00:00Z");

  @Bean
  @Primary
  Clock fixedSchedulingClock() {
    return Clock.fixed(NOW, ZoneOffset.UTC);
  }
}
