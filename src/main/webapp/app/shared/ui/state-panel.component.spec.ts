import { TestBed } from "@angular/core/testing";

import { StatePanelComponent } from "./state-panel.component";

describe("StatePanelComponent", () => {
  it("renders an accessible error state without custom alert markup", async () => {
    await TestBed.configureTestingModule({
      imports: [StatePanelComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(StatePanelComponent);
    fixture.componentRef.setInput("state", "error");
    fixture.componentRef.setInput("title", "Falha ao carregar agenda");
    fixture.componentRef.setInput(
      "description",
      "Tente novamente preservando os filtros.",
    );
    fixture.detectChanges();

    const alert = (fixture.nativeElement as HTMLElement).querySelector(
      '[role="alert"]',
    );
    expect(alert?.textContent).toContain("Falha ao carregar agenda");
    expect(alert?.textContent).toContain("preservando os filtros");
  });

  it("renders an empty state with contextual text", async () => {
    await TestBed.configureTestingModule({
      imports: [StatePanelComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(StatePanelComponent);
    fixture.componentRef.setInput("state", "empty");
    fixture.componentRef.setInput("title", "Fila vazia");
    fixture.componentRef.setInput(
      "description",
      "Não há pacientes aguardando.",
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      "Fila vazia",
    );
  });
});
