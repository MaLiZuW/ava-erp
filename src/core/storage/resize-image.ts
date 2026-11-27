/**
 * Photos are made smaller in the browser before upload (D23): the longer side at most 2000 px,
 * saved as WebP. A file the browser cannot decode (or a test environment without canvas) is
 * returned unchanged – the size limit of the category still applies.
 */
export const MAX_SIDE = 2000;

/** Target size keeping the ratio; null = no resize needed. */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_SIDE,
): { width: number; height: number } | null {
  if (width <= max && height <= max) return null;
  const k = max / Math.max(width, height);
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

const webpName = (name: string) => `${name.replace(/\.[^.]+$/, "") || "foto"}.webp`;

export async function resizeImage(file: File, max = MAX_SIDE, quality = 0.85): Promise<File> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const target = fitWithin(bitmap.width, bitmap.height, max) ?? {
      width: bitmap.width,
      height: bitmap.height,
    };
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    if (!blob || blob.type !== "image/webp") return file; // browser without WebP encoding
    // a small photo already within limits stays as it is when WebP would not help
    if (!fitWithin(bitmap.width, bitmap.height, max) && blob.size >= file.size) return file;
    return new File([blob], webpName(file.name), { type: "image/webp", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
