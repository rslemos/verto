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

  protected onPdfSelected($event: Event) {
    console.log("onPdfSelected", $event);
  }

  protected async pickPdf(): Promise<void> {
    try {
      const [handle] = await window.showOpenFilePicker({
        startIn: "downloads",
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        excludeAcceptAllOption: true,
      });
      const file = await handle.getFile();
      console.log(`${file.name}: ${file.size} bytes`);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // cancelou o diálogo
      throw e;
    }
  }
}
