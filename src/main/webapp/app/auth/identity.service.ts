import { httpResource } from "@angular/common/http";
import { Injectable } from "@angular/core";

import { authConfig } from "./auth-config";

export interface MedflowIdentity {
  subject: string;
  roles: string[];
  pacienteId: string | null;
  medicoId: string | null;
  clinicaId: string | null;
  timeZone: string;
}

@Injectable({ providedIn: "root" })
export class IdentityService {
  /** Fonte reativa da identidade autorizada pelo backend. */
  readonly identity = httpResource<MedflowIdentity>(
    () => `${authConfig.apiBaseUrl}/me`,
  );
}
