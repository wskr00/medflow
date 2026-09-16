import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import {
  AutoRefreshTokenService,
  CUSTOM_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  customBearerTokenInterceptor,
  provideKeycloak,
  UserActivityService,
  withAutoRefreshToken,
  type CustomBearerTokenCondition,
} from 'keycloak-angular';

import { authConfig } from './auth-config';

const apiUrl = new URL(authConfig.apiBaseUrl, window.location.origin);

const medflowApiCondition: CustomBearerTokenCondition = {
  shouldAddToken: async (request) => {
    const requestUrl = new URL(request.url, window.location.origin);
    const apiPath = apiUrl.pathname.replace(/\/$/, '');

    return requestUrl.origin === apiUrl.origin &&
      (requestUrl.pathname === apiPath || requestUrl.pathname.startsWith(`${apiPath}/`));
  },
};

export function provideAuthentication(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideKeycloak({
      config: {
        url: authConfig.url,
        realm: authConfig.realm,
        clientId: authConfig.clientId,
      },
      initOptions: {
        onLoad: 'login-required',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      },
      features: [
        withAutoRefreshToken({
          onInactivityTimeout: 'logout',
          sessionTimeout: 30 * 60_000,
        }),
      ],
      providers: [AutoRefreshTokenService, UserActivityService],
    }),
    provideHttpClient(withInterceptors([customBearerTokenInterceptor])),
    {
      provide: CUSTOM_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [medflowApiCondition],
    },
  ]);
}
