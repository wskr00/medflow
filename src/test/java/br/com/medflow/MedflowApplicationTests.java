package br.com.medflow;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
class MedflowApplicationTests {

	@Test
	void contextLoads() {
	}

}
