import {readFile} from "node:fs/promises";
import {inspect} from "node:util";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import {extractPaths} from "../src/angular/app/pdf/utils";
import {withState} from "../src/angular/app/pdf/utils";
import {setupPdfJs} from "../src/angular/app/pdf/utils";
import {zip} from "../src/angular/app/pdf/utils";
import {extractRectangles} from "../src/angular/app/pdf/utils";

setupPdfJs(pdfjsLib);

const file = "/home/rslemos/Downloads/PosicaoConsolidada_08687988788_20261103.pdf";

const data = new Uint8Array(await readFile(file));
const pdf = await pdfjsLib.getDocument({ data }).promise;

const nomesOps = new Map(
  Object.entries(pdfjsLib.OPS).map(([nome, numero]) => [numero, nome]),
);

console.log(`Arquivo: ${file}`);
console.log(`Páginas: ${pdf.numPages}`);


for (let n = 1; n <= pdf.numPages; n++) {
  const page = await pdf.getPage(n);
  const content = await page.getTextContent({ includeMarkedContent: true });

  const itens = content.items
    .filter(item => "str" in item)
    .filter(item => item.str.trim() !== "")
    .map(item => ({
      str: item.str,
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      w: Math.round(item.width),
      h: Math.round(item.height),
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  function getText(x: number, y: number, w: number, h: number) {
    const found = itens
      .filter(v =>
        v.x >= x
        && v.y >= y
        && v.x + v.w <= x + w
        && v.y + v.h <= y + h);
    if (found.length === 1)
      return found[0];

    if (found.length === 0)
      return null;

    throw new Error(`Foram encontrados ${found.length} itens: ${found.map(item => JSON.stringify(item)).join(", ")}`);
  }

  if (n === 1)
    console.log("Emissão", getText(27, 710, 100, 10));

  const ops = await page.getOperatorList();

  const linhas = ops.fnArray.map((fn, i) => ({
    i,
    fn: nomesOps.get(fn) ?? `?${fn}`,
    args: ops.argsArray[i],
  }));

  const contagem = new Map<string, number>();
  for (const linha of linhas) {
    contagem.set(linha.fn, (contagem.get(linha.fn) ?? 0) + 1);
  }
  const cores = new Map<string, number>();

  for (const linha of linhas) {
    if (linha.fn !== "setFillRGBColor") continue;

    const cor = JSON.stringify(linha.args);
    cores.set(cor, (cores.get(cor) ?? 0) + 1);
  }

  console.log(`\n========== PÁGINA ${n} ==========`);

  console.log("\n--- Dimensões ---");
  console.log(page.view);

  console.log(`\n--- Texto --- (${itens.length})`);
  Object.entries(Object.groupBy(itens, item => item.y))
    .sort(([a], [b]) => (+b) - (+a))
    .forEach(([y, itens]) => {
    console.log(`[${y}]: ${itens!.map(item => `(${item.x}) "${item.str} [${item.w}×${item.h}]"`).join(" | ")}:`);
  });

  console.log("\n--- Operações (histograma) ---");
  console.log(inspect(
    [...contagem].sort((a, b) => b[1] - a[1]),
    { colors: true },
  ));

  // console.log("\n--- Paths (decode completo) ---");
  // console.log(inspect([...withState(zip(ops.fnArray, ops.argsArray), extractPaths)], { colors: true, depth: 4, breakLength: 120, maxArrayLength: null }));


  const [rectgen, rejectgen1, rejectgen2] = extractRectangles(withState(zip(ops.fnArray, ops.argsArray), extractPaths));

  const rectangles = [...rectgen];

  console.log("\n--- Retângulos ---");
  console.log(inspect(rectangles, { colors: true, depth: 4, breakLength: 120, maxArrayLength: null }));

  console.log("\n--- Retângulos (comprimentos) ---");
  console.log(inspect(rectangles.map(({ i, lengths }) => ({ i, min: Math.min(...lengths), max: Math.max(...lengths) }))))

  console.log("\n--- ¬Retângulos por segmentos ---");
  console.log(inspect([...rejectgen1], { colors: true, depth: 4, breakLength: 120, maxArrayLength: null }));

  console.log("\n--- ¬Retângulos por ângulos ---");
  console.log(inspect([...rejectgen2], { colors: true, depth: 4, breakLength: 120, maxArrayLength: null }));

  break;

  console.log("\n--- Operações (lista completa) ---");
  console.log(inspect(linhas, { colors: true, depth: 4, breakLength: 120 }));

  break;

  console.log("\n--- Cores de preenchimento ---");
  console.log(inspect([...cores], { colors: true }));

  console.log("\n--- Primeiros constructPath ---");
  console.log(inspect(
    linhas.filter((l) => l.fn === "constructPath").slice(0, 8),
    { depth: 8, colors: true },
  ));

  console.log("\n--- Nomes ops ---");
  console.log(inspect(nomesOps, { colors: true }));
}
