import { Component } from "@angular/core";
import { signal } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

@Component({
  imports: [RouterOutlet],
  selector: "app-root",
  styles: [],
  templateUrl: "./app.html",
})
export class App {
  protected readonly title = signal("verto");

  protected async onPdfSelected($event: Event) {
    console.log("onPdfSelected", $event);
    const input = $event.target as HTMLInputElement;
    const file = input.files![0]!;
    const pdf = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent({ includeMarkedContent: true });
      const itens = content.items
        .filter(i => "str" in i)
        .filter(i => i.str.trim() !== "")
        .map((i) => ({ str: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]), w: Math.round(i.width) }))
        .sort((a, b) => b.y - a.y || a.x - b.x);
      console.table(itens);
      const nomes = new Map(Object.entries(pdfjsLib.OPS).map(([nome, num]) => [num, nome]));
      const ops = await page.getOperatorList();
      const linhas = ops.fnArray.map((fn, i) => ({
        i,
        op: nomes.get(fn) ?? `?${fn}`,
        args: ops.argsArray[i]?.join(", "),
      }));
      // console.table(linhas);
      const contagem = new Map<string, number>();
      for (const l of linhas) contagem.set(l.op, (contagem.get(l.op) ?? 0) + 1);
      console.table([...contagem].map(([op, vezes]) => ({ op, vezes })).sort((a, b) => b.vezes - a.vezes));

      // 1) quais cores de preenchimento aparecem, e quantas vezes
      const cores = new Map<string, number>();
      for (const l of linhas) {
        if (l.op !== "setFillRGBColor") continue;
        const k = JSON.stringify(l.args);
        cores.set(k, (cores.get(k) ?? 0) + 1);
      }
      console.table([...cores].map(([cor, vezes]) => ({ cor, vezes })));

      // 2) como são os desenhos (use console.log, não table: dá para expandir os arrays no DevTools)
      console.log(linhas.filter((l) => l.op === "constructPath").slice(0, 8));
    }
  }
}
