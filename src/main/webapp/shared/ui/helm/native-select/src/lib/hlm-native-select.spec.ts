import { ComponentFixture, TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";
import { HlmNativeSelect } from "./hlm-native-select";

describe("HlmNativeSelect", () => {
  it("keeps the native control at the 44px touch target by default", () => {
    TestBed.configureTestingModule({ imports: [HlmNativeSelect] });
    const fixture: ComponentFixture<HlmNativeSelect> =
      TestBed.createComponent(HlmNativeSelect);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("select").className).toContain(
      "min-h-11",
    );
  });
  it("associa a descrição de erro ao select que recebe foco", async () => {
    TestBed.configureTestingModule({ imports: [HlmNativeSelect] });
    const fixture = TestBed.createComponent(HlmNativeSelect);
    fixture.componentRef.setInput("describedBy", "period-error");
    fixture.componentRef.setInput("aria-invalid", true);
    await fixture.whenStable();
    const select = fixture.nativeElement.querySelector("select");
    expect(select.getAttribute("aria-describedby")).toBe("period-error");
    expect(select.getAttribute("aria-invalid")).toBe("true");
  });
});
