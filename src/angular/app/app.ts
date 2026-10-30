import { Component } from "@angular/core";
import { inject } from "@angular/core";
import { resource } from "@angular/core";
import { signal } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { Database } from "./database";

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
  private readonly db = inject(Database);

  protected readonly greeting = resource({
    params: () => this.name(),
    loader: async ({params: name}) => {
      const rows = await this.db.transaction(async (tx) => {
        const ins = await tx.execute("INSERT INTO ativo (nome) VALUES ($1::text)", [name]);
        console.log("INSERTED ", ins);
        const result = await tx.query("SELECT 'Hello, ' || UPPER($1::text) || ' (' || MAX(id) || ' id máximo)' AS message FROM ativo", [name]);
        const del = await tx.execute("DELETE FROM ativo WHERE nome = $1::text", [name]);
        console.log("DELETED", del);
        return result;
      });
      return rows?.[0]?.["message"];
    },
  });
}
