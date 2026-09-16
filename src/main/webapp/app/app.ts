import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  imports: [RouterOutlet],
  selector: "app-root",
  styleUrl: "./app.scss",
  template: "<router-outlet />",
})
export class App {}
