import type { TextLine } from "./extract";
import { normaliseText } from "./normalize";

/**
 * Minimal DOCX reader.
 *
 * A .docx is a ZIP holding `word/document.xml`. The browser can inflate the
 * entry with DecompressionStream, so this needs no dependency — and the XML
 * carries structure a PDF has already thrown away: real paragraph styles, list
 * membership, and bold runs.
 */

const SIGNATURE_EOCD = 0x06054b50;
const SIGNATURE_LOCAL = 0x04034b50;

type ZipEntry = {
  name: string;
  compression: number;
  offset: number;
  size: number;
  uncompressedSize: number;
};

const MAX_ZIP_ENTRIES = 2_000;
const MAX_DOCUMENT_XML_BYTES = 8 * 1024 * 1024;

function readCentralDirectory(view: DataView): ZipEntry[] {
  // The end-of-central-directory record sits at the tail, after an optional
  // comment of up to 64 KB.
  let eocd = -1;
  const from = Math.max(0, view.byteLength - 66_000);
  for (let index = view.byteLength - 22; index >= from; index -= 1) {
    if (view.getUint32(index, true) === SIGNATURE_EOCD) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP archive.");

  const count = view.getUint16(eocd + 10, true);
  if (count > MAX_ZIP_ENTRIES) throw new Error("DOCX_EXPANSION_LIMIT");
  let cursor = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const name = new TextDecoder().decode(
      new Uint8Array(view.buffer, view.byteOffset + cursor + 46, nameLength),
    );
    entries.push({
      name,
      compression: view.getUint16(cursor + 10, true),
      offset: view.getUint32(cursor + 42, true),
      // Compressed size (+20), not the uncompressed size at +24: this bounds
      // the deflate stream that gets inflated.
      size: view.getUint32(cursor + 20, true),
      uncompressedSize: view.getUint32(cursor + 24, true),
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readEntry(buffer: ArrayBuffer, view: DataView, entry: ZipEntry): Promise<string> {
  if (
    entry.uncompressedSize > MAX_DOCUMENT_XML_BYTES ||
    (entry.size > 0 && entry.uncompressedSize / entry.size > 250)
  ) {
    throw new Error("DOCX_EXPANSION_LIMIT");
  }
  if (view.getUint32(entry.offset, true) !== SIGNATURE_LOCAL) {
    throw new Error("Damaged ZIP entry.");
  }
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  const bytes = new Uint8Array(buffer, start, entry.size);

  if (entry.compression === 0) return new TextDecoder().decode(bytes);
  if (entry.compression !== 8) throw new Error("Unsupported ZIP compression.");

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const output = await new Response(stream).arrayBuffer();
  if (output.byteLength > MAX_DOCUMENT_XML_BYTES) throw new Error("DOCX_EXPANSION_LIMIT");
  return new TextDecoder().decode(output);
}

const unescapeXml = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");

/** Turns word/document.xml into positioned lines matching the PDF pipeline. */
function linesFromDocumentXml(xml: string): TextLine[] {
  const paragraphs = xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g) ?? [];
  const lines: TextLine[] = [];
  let y = 0;

  for (const paragraph of paragraphs) {
    // Tabs become spaces; explicit breaks split the paragraph visually.
    const withBreaks = paragraph
      .replace(/<w:tab\b[^>]*\/>/g, " ")
      .replace(/<w:br\b[^>]*\/>/g, " ");

    const text = normaliseText(
      unescapeXml(
        (withBreaks.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g) ?? [])
          .map((node) => node.replace(/<[^>]+>/g, ""))
          .join("") || "",
      ),
    );
    if (!text) continue;

    const isList = /<w:numPr\b/.test(paragraph);
    const styleMatch = paragraph.match(/<w:pStyle\s+w:val="([^"]+)"/);
    const style = styleMatch?.[1] ?? "";
    const isHeadingStyle = /^(heading|title|subtitle)/i.test(style);
    const bold = /<w:b\b(?![^>]*w:val="(?:0|false)")[^>]*\/?>/.test(paragraph);
    const sizeMatch = paragraph.match(/<w:sz\s+w:val="(\d+)"/);
    // w:sz is in half-points.
    const size = sizeMatch ? Number(sizeMatch[1]) / 2 : isHeadingStyle ? 14 : 11;

    y += 1;
    lines.push({
      // Word stores list membership as numbering metadata rather than a glyph,
      // so reinstate a marker for the parser's bullet detection.
      text: isList && !/^[\u2022\u00b7-]/.test(text) ? `\u2022 ${text}` : text,
      x: isList ? 12 : 0,
      right: 100 + text.length,
      y,
      size,
      page: 1,
      emphasis: bold || isHeadingStyle,
      column: 0,
    });
  }
  return lines;
}

export async function extractDocxLines(file: File): Promise<TextLine[]> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const entries = readCentralDirectory(view);
  const document = entries.find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("No document.xml inside that .docx.");
  return linesFromDocumentXml(await readEntry(buffer, view, document));
}
