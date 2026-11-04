import { ComponentFixture, TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";
import { HlmNativeSelect } from "./hlm-native-select";
import { Component, signal } from "@angular/core";
import { vi } from "vitest";

@Component({
  imports: [HlmNativeSelect],
  template: `<hlm-native-select
    [value]="'saved'"
    (valueChange)="changes.push($event)"
    ><option value="">Todas</option>
    @if (loaded()) {
      <option value="saved">Cadastro histórico</option>
    }
  </hlm-native-select>`,
})
class AsyncOptions {
  readonly loaded = signal(false);
  readonly changes: unknown[] = [];
}

describe("HlmNativeSelect", () => {
  it("restaura o valor quando opções assíncronas chegam sem emitir uma alteração do usuário", async () => {
    TestBed.configureTestingModule({ imports: [AsyncOptions] });
    const fixture = TestBed.createComponent(AsyncOptions);
    await fixture.whenStable();
    fixture.componentInstance.loaded.set(true);
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.querySelector("select").value).toBe("saved"),
    );
    expect(fixture.componentInstance.changes).toEqual([]);
  });
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
