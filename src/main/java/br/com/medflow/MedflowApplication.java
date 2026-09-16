package br.com.medflow;

import java.time.Clock;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class MedflowApplication {

	public static void main(String[] args) {
		SpringApplication.run(MedflowApplication.class, args);
	}

	@Bean
	Clock applicationClock() {
		return Clock.systemUTC();
	}

}
