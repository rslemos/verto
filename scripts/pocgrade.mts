import { readFile, writeFile } from "node:fs/promises";
import { PDFDocument, rgb } from "pdf-lib";

const [entrada, saida = entrada.replace(/\.pdf$/i, "-grade.pdf")] =
  process.argv.slice(2);

if (!entrada) throw new Error("Informe o PDF de entrada.");

const pdf = await PDFDocument.load(await readFile(entrada));

for (const page of pdf.getPages()) {
  const { width, height } = page.getSize();

  function grade(passo: number, color: ReturnType<typeof rgb>, opacity: number, thickness: number, labels = false) {
    for (let x = Math.ceil(0 / passo) * passo; x <= width; x += passo) {
      page.drawLine({
        start: { x, y: 0 },
        end: { x, y: height },
        color,
        opacity,
        thickness,
      });
    }

    for (let y = 0; y <= height; y += passo) {
      page.drawLine({
        start: { x: 0, y },
        end: { x: width, y },
        color,
        opacity,
        thickness,
      });

      if (labels) {
        for (let x = 0 + 2; x <= width; x += passo) {
          page.moveTo(x, y + 2);
          page.drawText(`${y}`, {size: 10, color, opacity});
        }
      }
    }
  }

  grade(1, rgb(0.5, 0.5, 0.5), 0.3, 0.1);
  grade(5, rgb(1, 0, 0), 0.35, 0.3);
  grade(10, rgb(0, 0.3, 1), 0.65, 0.6);
  grade(50, rgb(0, 0.85, 0.85), 0.75, 0.8);
  grade(100, rgb(0, 0.7, 0), 0.85, 1, true);
}

await writeFile(saida, await pdf.save());

console.log(`Gerado: ${saida}`);
