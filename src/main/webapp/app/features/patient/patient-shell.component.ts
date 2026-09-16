import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { HlmButtonImports } from "@spartan-ng/helm/button";
import { HlmSheetImports } from "@spartan-ng/helm/sheet";

@Component({ selector: "app-patient-shell", changeDetection: ChangeDetectionStrategy.OnPush, imports: [RouterLink, RouterLinkActive, RouterOutlet, HlmButtonImports, HlmSheetImports], template: `
  <header class="border-border flex min-h-14 items-center justify-between gap-3 border-b pb-3"><p class="font-semibold">MedFlow</p><nav class="hidden gap-1 lg:flex" aria-label="Consultas"><a routerLink="consultas" routerLinkActive="bg-accent text-accent-foreground" class="rounded-md px-3 py-2 text-sm font-medium">Consultas</a><a routerLink="agendar" routerLinkActive="bg-accent text-accent-foreground" class="rounded-md px-3 py-2 text-sm font-medium">Agendar consulta</a><a routerLink="historico" routerLinkActive="bg-accent text-accent-foreground" class="rounded-md px-3 py-2 text-sm font-medium">Histórico</a></nav><hlm-sheet side="right"><button hlmSheetTrigger hlmBtn variant="outline" type="button" class="lg:hidden">Menu</button><hlm-sheet-content *hlmSheetPortal><hlm-sheet-header><h2 hlmSheetTitle>Navegação</h2><p hlmSheetDescription>Escolha o que deseja fazer.</p></hlm-sheet-header><nav class="flex flex-col gap-1"><a hlmSheetClose hlmBtn variant="ghost" routerLink="consultas" class="justify-start">Consultas</a><a hlmSheetClose hlmBtn variant="ghost" routerLink="agendar" class="justify-start">Agendar consulta</a><a hlmSheetClose hlmBtn variant="ghost" routerLink="historico" class="justify-start">Histórico</a></nav></hlm-sheet-content></hlm-sheet></header>
  <router-outlet />
` })
export class PatientShellComponent {}
