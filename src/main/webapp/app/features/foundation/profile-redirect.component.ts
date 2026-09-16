import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from "@angular/core";
import { Router } from "@angular/router";

import { IdentityService } from "../../auth/identity.service";

const defaultRouteByRole: Readonly<Record<string, string>> = {
  PATIENT: "/workspace/patient",
  RECEPTIONIST: "/workspace/reception",
  DOCTOR: "/workspace/doctor",
  ADMINISTRATOR: "/workspace/administrator",
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "",
})
export class ProfileRedirectComponent {
  private readonly identity = inject(IdentityService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (!this.identity.identity.hasValue()) return;

      const target =
        this.identity.identity
          .value()
          .roles.map((role) => defaultRouteByRole[role])
          .find((route) => route !== undefined) ?? "/access-denied";

      void this.router.navigateByUrl(target, { replaceUrl: true });
    });
  }
}
