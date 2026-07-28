/**
 * Hand-writes PDFs that exercise the failure paths.
 *
 * These cannot be produced by rendering HTML — a browser always emits a correct
 * ToUnicode map — so the PDF is assembled directly.
 */
import { writeFile } from "node:fs/promises";

function buildPdf(objects) {
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

function page(content, font) {
  return buildPdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    font,
  ]);
}

const RESUME_LINES = [
  "Priya Raghunathan",
  "Senior Data Engineer",
  "Seattle Washington United States",
  "Summary",
  "Data engineer with nine years building batch and streaming platforms for retail analytics",
  "Experience",
  "Principal Data Engineer at Everstone Retail",
  "Rebuilt the nightly extract transform load pipeline to run in eighteen minutes",
  "Introduced contract testing across thirty downstream datasets",
  "Data Engineer at Lumen Analytics",
  "Built a streaming ingest path sustaining many events per minute",
  "Education",
  "University of Washington",
  "Bachelor of Science in Computer Science",
  "Skills",
  "Languages Python Scala and Structured Query Language",
];

/** Mimics a subsetted font whose glyph indices bear no relation to characters. */
const scramble = (text) =>
  [...text]
    .map((character) => {
      if (/[a-z]/.test(character)) {
        return String.fromCharCode(((character.charCodeAt(0) - 97 + 7) % 26) + 97);
      }
      if (/[A-Z]/.test(character)) {
        return String.fromCharCode(((character.charCodeAt(0) - 65 + 7) % 26) + 65);
      }
      return character;
    })
    .join("");

/**
 * A PDF that renders as a normal resume but whose text layer decodes to
 * nonsense — the shape of a real broken-encoding document.
 */
export async function writeGarbledPdf(path) {
  let content = "BT /F1 11 Tf 60 740 Td 13 TL\n";
  for (const line of RESUME_LINES) {
    content += `(${scramble(line).replace(/[()\\]/g, "")}) Tj T*\n`;
  }
  content += "ET";
  await writeFile(path, page(content, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
  return path;
}

/** A PDF containing a trivial amount of text, i.e. effectively blank. */
export async function writeNearEmptyPdf(path) {
  await writeFile(
    path,
    page(
      "BT /F1 12 Tf 72 700 Td (x) Tj ET",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ),
  );
  return path;
}
