import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import Keycloak from 'keycloak-js';

import { IdentityService, MedflowIdentity } from './auth/identity.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly keycloak = inject(Keycloak);
  private readonly identityService = inject(IdentityService);

  protected readonly identity = signal<MedflowIdentity | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.identityService.load().subscribe({
      next: (identity) => {
        this.identity.set(identity);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Não foi possível carregar sua identidade. Tente novamente.');
        this.loading.set(false);
      },
    });
  }

  protected logout(): void {
    void this.keycloak.logout({ redirectUri: window.location.origin });
  }
}
