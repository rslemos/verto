import { Component } from "@angular/core";
import { resource } from "@angular/core";
import { signal } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  imports: [RouterOutlet],
  selector: "app-root",
  styles: [],
  template: `
    @if (greeting.isLoading()) {
      <h1>Carregando...</h1>
    } @else {
      <h1>{{ greeting.value() }}</h1>
    }

    <router-outlet/>
  `,
})
export class App {
  protected readonly name = signal("verto");

  protected readonly greeting = resource({
    params: () => this.name(),
    loader: async ({params: name}) => {
      return "Hello verto!";
    },
  });
}
