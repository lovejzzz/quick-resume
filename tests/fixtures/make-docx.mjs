/**
 * Builds the .docx fixture at test time.
 *
 * A .docx is a ZIP of XML, and both are written here rather than committed as a
 * binary so the fixture stays reviewable in a diff. Only stored + deflate
 * entries are needed, so the archive is assembled directly.
 */
import { deflateRawSync, crc32 } from "node:zlib";
import { writeFile } from "node:fs/promises";

const paragraph = ({ text, bold = false, list = false, size = 0 }) => {
  const runProps = `${bold ? "<w:b/>" : ""}${size ? `<w:sz w:val="${size * 2}"/>` : ""}`;
  const numbering = list ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : "";
  const paraProps =
    numbering || runProps
      ? `<w:pPr>${numbering}${runProps ? `<w:rPr>${runProps}</w:rPr>` : ""}</w:pPr>`
      : "";
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<w:p>${paraProps}<w:r>${runProps ? `<w:rPr>${runProps}</w:rPr>` : ""}<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
};

const BODY = [
  { text: "Rosa Delgado", bold: true, size: 22 },
  { text: "Operations Manager" },
  { text: "rosa.delgado@example.com | (503) 555-0166 | Portland, OR" },
  { text: "EXPERIENCE", bold: true, size: 12 },
  { text: "Operations Manager — Cascade Foods, 2019 – Present", bold: true },
  { text: "Cut warehouse pick times by 34% across three sites", list: true },
  { text: "Managed a team of 22 across two shifts", list: true },
  { text: "Logistics Coordinator — Ridge Supply, 2016 – 2019", bold: true },
  { text: "Consolidated 9 regional carriers into 3 national contracts", list: true },
  { text: "EDUCATION", bold: true, size: 12 },
  { text: "Portland State University — B.S. Supply Chain Management, 2012 – 2016" },
  { text: "SKILLS", bold: true, size: 12 },
  { text: "Systems: SAP, NetSuite, Excel" },
];

const FILES = {
  "[Content_Types].xml":
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  "_rels/.rels":
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  "word/document.xml":
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    BODY.map(paragraph).join("") +
    "</w:body></w:document>",
};

export async function writeDocxFixture(path) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const [name, content] of Object.entries(FILES)) {
    const raw = Buffer.from(content, "utf8");
    const deflated = deflateRawSync(raw);
    const nameBytes = Buffer.from(name, "utf8");
    const checksum = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(deflated.length, 18); // compressed size
    local.writeUInt32LE(raw.length, 22); // uncompressed size
    local.writeUInt16LE(nameBytes.length, 26);
    chunks.push(local, nameBytes, deflated);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(8, 10);
    header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(deflated.length, 20);
    header.writeUInt32LE(raw.length, 24);
    header.writeUInt16LE(nameBytes.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, nameBytes);

    offset += local.length + nameBytes.length + deflated.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(FILES).length, 8);
  end.writeUInt16LE(Object.keys(FILES).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  await writeFile(path, Buffer.concat([...chunks, directory, end]));
  return path;
}
