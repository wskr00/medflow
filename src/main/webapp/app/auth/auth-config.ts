export interface MedflowRuntimeConfig {
  keycloakUrl?: string;
  keycloakRealm?: string;
  keycloakClientId?: string;
  apiBaseUrl?: string;
}

const runtimeConfig = (globalThis as typeof globalThis & {
  __MEDFLOW_CONFIG__?: MedflowRuntimeConfig;
}).__MEDFLOW_CONFIG__ ?? {};

export const authConfig = {
  url: runtimeConfig.keycloakUrl ?? 'http://localhost:8085',
  realm: runtimeConfig.keycloakRealm ?? 'medflow',
  clientId: runtimeConfig.keycloakClientId ?? 'medflow-web',
  apiBaseUrl: runtimeConfig.apiBaseUrl ?? '/api',
} as const;
