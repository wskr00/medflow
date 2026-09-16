import { TestBed } from '@angular/core/testing';
import Keycloak from 'keycloak-js';
import { of } from 'rxjs';
import { App } from './app';
import { IdentityService } from './auth/identity.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: Keycloak, useValue: { logout: () => Promise.resolve() } },
        {
          provide: IdentityService,
          useValue: {
            load: () => of({
              subject: 'usuario-sintetico',
              roles: ['PATIENT'],
              pacienteId: null,
              medicoId: null,
              clinicaId: null,
              timeZone: 'America/Belem',
            }),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Sessão autenticada');
    expect(compiled.textContent).toContain('PATIENT');
  });
});
