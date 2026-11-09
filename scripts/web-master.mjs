// Turns a print/design original (huge PNG/JPG) into a "web master" that is safe to commit:
// JPEG, sRGB, metadata stripped, auto-rotated, long edge capped (wide collages get more width).
// The site build then makes the AVIF/WebP/JPEG sizes from this master.
//
// Usage: node scripts/web-master.mjs <input> <output.jpg> [maxLongEdge=2000]
//        (or import { webMaster } from "./web-master.mjs")
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export async function webMaster(input, output, maxLong = 2000) {
  const img = sharp(input, { limitInputPixels: false }).rotate();
  const { width, height } = await img.metadata();
  const wide = width / height >= 2; // panoramas / collages keep more pixels across
  const cap = wide ? Math.round(maxLong * 1.5) : maxLong;
  await mkdir(path.dirname(output), { recursive: true });
  const info = await img
    .resize({ width: cap, height: cap, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#151515" })
    .toColorspace("srgb")
    .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(output);
  return info;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("web-master.mjs")) {
  const [input, output, max] = process.argv.slice(2);
  if (!input || !output) {
    console.error("usage: node scripts/web-master.mjs <input> <output.jpg> [maxLongEdge]");
    process.exit(1);
  }
  const info = await webMaster(input, output, max ? Number(max) : 2000);
  console.log(`${output}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}
