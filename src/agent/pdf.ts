import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function makeTextPdf(
  title: string,
  body: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612; // US Letter
  const pageHeight = 792;
  const margin = 54;
  const usableWidth = pageWidth - margin * 2;

  const titleSize = 14;
  const bodySize = 10;
  const lineHeight = 13;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  page.drawText(title, {
    x: margin,
    y: y - titleSize,
    size: titleSize,
    font: bold,
    color: rgb(0, 0, 0),
  });
  y -= titleSize + 18;

  // Naive word wrap
  const sanitize = (s: string) =>
    s.replace(/[^\x20-\x7E\n]/g, "?"); // pdf-lib StandardFont needs latin
  const paragraphs = sanitize(body).split(/\r?\n/);

  for (const para of paragraphs) {
    if (para.trim() === "") {
      y -= lineHeight;
      if (y < margin) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, bodySize) <= usableWidth) {
        line = test;
      } else {
        if (line) {
          page.drawText(line, {
            x: margin,
            y: y - bodySize,
            size: bodySize,
            font,
            color: rgb(0.1, 0.1, 0.1),
          });
          y -= lineHeight;
          if (y < margin) {
            page = doc.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }
        }
        line = w;
      }
    }
    if (line) {
      page.drawText(line, {
        x: margin,
        y: y - bodySize,
        size: bodySize,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= lineHeight;
      if (y < margin) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    }
  }

  return doc.save();
}
