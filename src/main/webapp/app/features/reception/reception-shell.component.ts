import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "app-reception-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  host: { class: "block min-h-dvh" },
  template: `
    <a
      href="#reception-main"
      class="bg-primary text-primary-foreground fixed left-4 top-2 z-50 -translate-y-20 rounded-md px-4 py-3 focus:translate-y-0"
    >
      Ir para o conteúdo
    </a>
    <header class="border-border bg-card border-b">
      <div class="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6">
        <div class="flex items-center gap-3">
          <span class="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg font-bold" aria-hidden="true">+</span>
          <span class="text-lg font-semibold tracking-tight">MedFlow</span>
          <span class="text-muted-foreground hidden text-sm sm:inline">Recepção</span>
        </div>
        <span class="text-muted-foreground text-sm">Operação da clínica</span>
      </div>
    </header>
    <router-outlet />
  `,
})
export class ReceptionShellComponent {}
