import { Component } from "@angular/core";
import { signal } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  imports: [RouterOutlet],
  selector: "app-root",
  styles: [],
  templateUrl: "./app.html",
})
export class App {
  protected readonly title = signal("verto");
}
