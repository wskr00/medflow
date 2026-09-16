package br.com.medflow.security;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.RequestCacheConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import tools.jackson.databind.ObjectMapper;

@Configuration(proxyBeanMethods = false)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableMethodSecurity
public class SecurityConfiguration {

  private static final Set<String> APPLICATION_ROLES = Set.of(
      "PATIENT", "RECEPTIONIST", "DOCTOR", "ADMINISTRATOR");

  @Bean
  SecurityFilterChain securityFilterChain(
      HttpSecurity http,
      JwtAuthenticationConverter jwtAuthenticationConverter,
      ObjectMapper objectMapper) throws Exception {
    AuthenticationEntryPoint authenticationEntryPoint =
        SecurityErrorHandlers.authenticationEntryPoint(objectMapper);
    AccessDeniedHandler accessDeniedHandler = SecurityErrorHandlers.accessDeniedHandler(objectMapper);

    http
        .csrf(AbstractHttpConfigurer::disable)
        .requestCache(RequestCacheConfigurer::disable)
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(authorize -> authorize
            .requestMatchers("/actuator/health").permitAll()
            .requestMatchers("/", "/index.html", "/*.js", "/*.css", "/media/**", "/favicon.ico")
                .permitAll()
            .requestMatchers("/api/**").hasAnyRole(APPLICATION_ROLES.toArray(String[]::new))
            .anyRequest().denyAll())
        .exceptionHandling(exceptionHandling -> exceptionHandling
            .authenticationEntryPoint(authenticationEntryPoint)
            .accessDeniedHandler(accessDeniedHandler))
        .oauth2ResourceServer(resourceServer -> resourceServer
            .authenticationEntryPoint(authenticationEntryPoint)
            .accessDeniedHandler(accessDeniedHandler)
            .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)));
    return http.build();
  }

  @Bean
  JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(new MedflowApiRolesConverter());
    return converter;
  }

  static final class MedflowApiRolesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
      Object resourceAccessClaim = jwt.getClaims().get("resource_access");
      if (!(resourceAccessClaim instanceof Map<?, ?> resourceAccess)) {
        return List.of();
      }
      Object apiClaim = resourceAccess.get("medflow-api");
      if (!(apiClaim instanceof Map<?, ?> apiAccess)) {
        return List.of();
      }
      Object rolesClaim = apiAccess.get("roles");
      if (!(rolesClaim instanceof Collection<?> roles)) {
        return List.of();
      }
      return roles.stream()
          .filter(String.class::isInstance)
          .map(String.class::cast)
          .filter(APPLICATION_ROLES::contains)
          .distinct()
          .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
          .collect(Collectors.toUnmodifiableList());
    }
  }
}
