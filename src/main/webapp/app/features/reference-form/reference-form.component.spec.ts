import { TestBed } from "@angular/core/testing";

import { ReferenceFormComponent } from "./reference-form.component";

describe("ReferenceFormComponent", () => {
  it("associates the label with the control and announces a required-field error", async () => {
    await TestBed.configureTestingModule({
      imports: [ReferenceFormComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReferenceFormComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const label = host.querySelector('label[for="reference-message"]');
    const textarea =
      host.querySelector<HTMLTextAreaElement>("#reference-message");
    const form = host.querySelector("form");

    expect(label).toBeTruthy();
    expect(textarea?.id).toBe("reference-message");

    form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    expect(host.textContent).toContain(
      "Informe uma mensagem antes de continuar.",
    );
  });

  it("lets FormRoot handle a valid Enter-style submission", async () => {
    await TestBed.configureTestingModule({
      imports: [ReferenceFormComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReferenceFormComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const textarea =
      host.querySelector<HTMLTextAreaElement>("#reference-message");
    const form = host.querySelector("form");
    if (!textarea || !form)
      throw new Error("Formulário de referência não renderizado.");

    textarea.value = "Mensagem válida";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.textContent).toContain("Referência validada");
    expect(host.textContent).not.toContain("Exemplo de erro do servidor");
  });

  it("shows a server-error presentation only through its explicit local demonstration action", async () => {
    await TestBed.configureTestingModule({
      imports: [ReferenceFormComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReferenceFormComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const button = Array.from(host.querySelectorAll("button")).find((element) =>
      element.textContent?.includes("Demonstrar erro de servidor"),
    );
    (button as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.textContent).toContain("Exemplo de erro do servidor");
    expect(host.textContent).not.toContain("Referência validada");
  });
});
