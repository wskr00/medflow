import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";

import { routes } from "./app.routes";

describe("application routes", () => {
  it("uses a real not-found route and guards every direct profile route", () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const router = TestBed.inject(Router);
    const workspace = router.config.find((route) => route.path === "workspace");
    const profileRoutes = workspace?.children?.filter((route) =>
      ["patient", "reception", "doctor", "administrator"].includes(
        route.path ?? "",
      ),
    );

    expect(
      router.config.find((route) => route.path === "**")?.loadComponent,
    ).toBeTruthy();
    expect(profileRoutes).toHaveLength(4);
    expect(profileRoutes?.every((route) => route.canActivate?.length)).toBe(
      true,
    );
  });
});
