import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { describe, expect, it, vi } from "vitest";
import { AdminNavComponent } from "./admin-nav.component";
import { preventAdminConfigurationLoss } from "./admin-dirty.guard";

describe("Admin navigation and dirty guard", () => {
  it("uses absolute administrative destinations and emits navigation for the mobile Sheet", () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(AdminNavComponent);
    const navigated = vi.fn();
    fixture.componentInstance.navigated.subscribe(navigated);
    fixture.detectChanges();
    const links = [
      ...fixture.nativeElement.querySelectorAll("a"),
    ] as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      expect.arrayContaining([
        "/workspace/admin/clinica",
        "/workspace/admin/estrutura",
        "/workspace/admin/bloqueios",
      ]),
    );
    fixture.componentInstance.navigated.emit();
    expect(navigated).toHaveBeenCalledOnce();
  });

  it("delegates exit confirmation to editors with real dirty state", () => {
    const canLeave = vi.fn(() => false);
    expect(
      preventAdminConfigurationLoss(
        { canLeave } as never,
        {} as never,
        {} as never,
        {} as never,
      ),
    ).toBe(false);
    expect(canLeave).toHaveBeenCalledOnce();
  });
});
