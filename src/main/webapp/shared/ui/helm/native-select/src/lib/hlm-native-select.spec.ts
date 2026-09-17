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
});
