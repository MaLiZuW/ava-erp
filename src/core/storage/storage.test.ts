import { describe, expect, it } from "vitest";
import {
  checkAttachmentFile,
  defaultCategory,
  fileMime,
  sniffType,
  type CategoryRule,
} from "./file-check";
import { fitWithin, resizeImage } from "./resize-image";

const MB = 1024 * 1024;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const docs: CategoryRule = {
  code: "datasheet",
  label: "Technický list",
  allowed_mime_types: ["application/pdf", DOCX, XLSX, "image/png", "image/jpeg", "image/webp"],
  max_bytes: 20 * MB,
};
const photo: CategoryRule = {
  code: "photo",
  label: "Foto",
  allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
  max_bytes: 5 * MB,
};

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p)),
  );
const PDF = bytes("%PDF-1.7\n");
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const docxTail = bytes("....[Content_Types].xml....word/document.xml");
const xlsxTail = bytes("....[Content_Types].xml....xl/workbook.xml");

describe("sniffType (magic bytes)", () => {
  it("recognises PDF, images and Office files by content", () => {
    expect(sniffType(PDF)).toBe("application/pdf");
    expect(sniffType(PNG)).toBe("image/png");
    expect(sniffType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffType(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe("image/webp");
    expect(sniffType(bytes(ZIP), docxTail)).toBe(DOCX);
    expect(sniffType(bytes(ZIP), xlsxTail)).toBe(XLSX);
    expect(sniffType(bytes(ZIP), bytes("plain zip"))).toBe("application/zip");
    expect(sniffType(bytes("<svg"))).toBeNull();
  });
});

describe("checkAttachmentFile", () => {
  const f = (name: string, type: string, size = 1000) => ({ name, type, size });

  it("accepts files that match the category (type, extension, size, content)", () => {
    expect(checkAttachmentFile(f("list.pdf", "application/pdf"), { head: PDF }, docs)).toBeNull();
    expect(
      checkAttachmentFile(f("ponuka.docx", DOCX), { head: bytes(ZIP), tail: docxTail }, docs),
    ).toBeNull();
    expect(checkAttachmentFile(f("a.png", "image/png", 4 * MB), { head: PNG }, photo)).toBeNull();
  });

  it("refuses dangerous types always, by extension", () => {
    expect(checkAttachmentFile(f("x.svg", "image/svg+xml"), { head: bytes("<svg") }, docs)).toMatch(
      /nikdy/,
    );
    expect(checkAttachmentFile(f("x.html", "text/html"), { head: bytes("<html") }, docs)).toMatch(
      /nikdy/,
    );
    expect(checkAttachmentFile(f("setup.exe", ""), { head: bytes("MZ") }, docs)).toMatch(/nikdy/);
    expect(checkAttachmentFile(f("makro.xlsm", ""), { head: bytes(ZIP) }, docs)).toMatch(/nikdy/);
  });

  it("refuses a type outside the category, a wrong extension, too large or fake content", () => {
    expect(checkAttachmentFile(f("list.pdf", "application/pdf"), { head: PDF }, photo)).toBe(
      "Do kategórie „Foto“ patria len: PNG, JPEG, WebP.",
    );
    expect(checkAttachmentFile(f("a.jpg", "image/png"), { head: PNG }, photo)).toMatch(/Prípona/);
    expect(checkAttachmentFile(f("a.png", "image/png", 6 * MB), { head: PNG }, photo)).toMatch(
      /väčší ako 5 MB/,
    );
    expect(
      checkAttachmentFile(f("a.pdf", "application/pdf", 21 * MB), { head: PDF }, docs),
    ).toMatch(/väčší ako 20 MB/);
    expect(checkAttachmentFile(f("a.pdf", "application/pdf"), { head: PNG }, docs)).toBe(
      "Obsah súboru nie je platný PDF.",
    );
    // a ZIP renamed to .docx
    expect(
      checkAttachmentFile(f("a.docx", DOCX), { head: bytes(ZIP), tail: bytes("x") }, docs),
    ).toMatch(/nie je platný Word/);
    expect(checkAttachmentFile(f("a.pdf", "application/pdf", 0), { head: PDF }, docs)).toMatch(
      /prázdny/,
    );
  });

  it("derives the type from the extension when the browser gives none", () => {
    expect(fileMime({ name: "Cenník.PDF", type: "" })).toBe("application/pdf");
    expect(fileMime({ name: "foto.jpeg", type: "" })).toBe("image/jpeg");
    expect(fileMime({ name: "x.dwg", type: "" })).toBe("");
  });

  it("new files: images go to photos, the rest to other", () => {
    const rules = [photo, docs, { ...docs, code: "other", label: "Iné" }];
    expect(defaultCategory({ name: "a.webp", type: "image/webp" }, rules)).toBe("photo");
    expect(defaultCategory({ name: "a.pdf", type: "application/pdf" }, rules)).toBe("other");
  });
});

describe("resizeImage", () => {
  it("keeps the ratio with the longer side at 2000 px", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(1000, 6000)).toEqual({ width: 333, height: 2000 });
    expect(fitWithin(2000, 1200)).toBeNull();
  });

  it("returns non-images and undecodable files unchanged", async () => {
    const pdf = new File([PDF], "a.pdf", { type: "application/pdf" });
    expect(await resizeImage(pdf)).toBe(pdf);
    const png = new File([PNG], "a.png", { type: "image/png" }); // jsdom has no canvas decoder
    expect(await resizeImage(png)).toBe(png);
  });
});
