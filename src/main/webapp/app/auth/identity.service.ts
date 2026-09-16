import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { authConfig } from './auth-config';

export interface MedflowIdentity {
  subject: string;
  roles: string[];
  pacienteId: string | null;
  medicoId: string | null;
  clinicaId: string | null;
  timeZone: string;
}

@Injectable({ providedIn: 'root' })
export class IdentityService {
  private readonly http = inject(HttpClient);

  load(): Observable<MedflowIdentity> {
    return this.http.get<MedflowIdentity>(`${authConfig.apiBaseUrl}/me`);
  }
}
