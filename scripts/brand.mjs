// Builds web-ready logo assets from the vector masters in /brand.
//  - src/_includes/brand/*.svg : clean inline SVGs (fill: currentColor)
//  - .brand/                   : favicon.svg, PNG icons and the default OG image (copied to the site root)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { optimize } from "svgo";
import sharp from "sharp";

const MASTERS = {
  logomark: "brand/logomark/unciv_logomark.svg",
  logotype: "brand/logotype/unciv_logotype-nomargin_h50_optimized.svg",
  logocode: "brand/logotype/unciv_logotype_code.svg",
};
const INCLUDES = "src/_includes/brand";
const OUT = ".brand";
const BG = "#151515";
const FG = "#e8e8e8";

function clean(svg) {
  const { data } = optimize(svg, {
    multipass: true,
    plugins: [
      "preset-default",
      "removeDimensions",
      "removeXMLNS",
      { name: "removeAttrs", params: { attrs: ["fill", "style", "id", "class", "stroke.*", "enable-background"] } },
      // Bake group/path transforms into coordinates so the result is a flat list of paths.
      { name: "convertShapeToPath", params: { convertArcs: true } },
    ],
  });
  return data;
}

function parts(svg) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return { viewBox, inner };
}

const inline = (name, { viewBox, inner }) =>
  `<svg class="logo logo--${name}" viewBox="${viewBox}" fill="currentColor" aria-hidden="true" focusable="false">${inner}</svg>\n`;

const standalone = ({ viewBox, inner }, fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="${fill}">${inner}</svg>`;

// Nest a logo inside a canvas at a given box (keeps aspect ratio, centered).
const nested = ({ viewBox, inner }, x, y, w, h, fill) =>
  `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" fill="${fill}">${inner}</svg>`;

async function main() {
  await mkdir(INCLUDES, { recursive: true });
  await mkdir(OUT, { recursive: true });

  const logos = {};
  for (const [name, file] of Object.entries(MASTERS)) {
    const p = parts(clean(await readFile(file, "utf8")));
    logos[name] = p;
    await writeFile(`${INCLUDES}/${name}.svg`, inline(name, p));
  }

  // favicon.svg follows the browser theme. Its canvas is square (the logo centred, with a little air):
  // Google only shows square favicons in search results.
  const mark = logos.logomark;
  const [vx, vy, vw, vh] = mark.viewBox.split(/[\s,]+/).map(Number);
  const side = Math.max(vw, vh) * 1.06;
  const squareBox = [vx - (side - vw) / 2, vy - (side - vh) / 2, side, side].map((n) => +n.toFixed(2)).join(" ");
  await writeFile(
    `${OUT}/favicon.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${squareBox}"><style>path{fill:#000}@media (prefers-color-scheme:dark){path{fill:#fff}}</style>${mark.inner}</svg>`
  );

  const icon = (size, pad) => {
    const inner = size * (1 - pad * 2);
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${BG}"/>${nested(mark, (size - inner) / 2, (size - inner) / 2, inner, inner, FG)}</svg>`
    );
  };
  const icons = [
    ["favicon-32.png", 32, 0.08],
    ["favicon-48.png", 48, 0.1],
    ["favicon-96.png", 96, 0.1],
    ["apple-touch-icon.png", 180, 0.14],
    ["icon-192.png", 192, 0.14],
    ["icon-512.png", 512, 0.14],
    ["icon-maskable-512.png", 512, 0.24],
  ];
  for (const [file, size, pad] of icons) {
    await sharp(icon(size, pad)).png({ compressionLevel: 9 }).toFile(`${OUT}/${file}`);
  }
  // /favicon.ico: the address some crawlers (Google among them) try first. An ICO file can simply hold
  // a PNG: a 6-byte header, one 16-byte directory entry, then the 48x48 PNG.
  const png48 = await readFile(`${OUT}/favicon-48.png`);
  const ico = Buffer.alloc(22);
  ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); // reserved, type icon, 1 image
  ico.writeUInt8(48, 6); ico.writeUInt8(48, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9); // 48x48, no palette
  ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); // planes, bits per pixel
  ico.writeUInt32LE(png48.length, 14); ico.writeUInt32LE(22, 18); // image size, offset
  await writeFile(`${OUT}/favicon.ico`, Buffer.concat([ico, png48]));

  // Default social card 1200x630. Everything sits inside the centre 630x630 square, because WhatsApp
  // (and other chat apps) show link previews as a square thumbnail cropped from the middle.
  const og = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <rect width="100%" height="100%" fill="${BG}"/>
      ${nested(mark, 450, 70, 300, 368, FG)}
      ${nested(logos.logotype, 330, 470, 540, 51, FG)}
      <rect x="430" y="551" width="340" height="4" fill="#FFCC00"/>
    </svg>`
  );
  await sharp(og).png({ compressionLevel: 9 }).toFile(`${OUT}/og-default.png`);

  // README banner (committed, shown at the top of the repo page). Own dark background, so it reads
  // the same in Codeberg's light and dark themes.
  await mkdir("docs", { recursive: true });
  await writeFile(
    "docs/logo-banner.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" width="1200" height="360">` +
      `<rect width="1200" height="360" fill="${BG}"/>` +
      nested(mark, 130, 70, 180, 220, FG) +
      nested(logos.logotype, 360, 146, 710, 67, FG) +
      `<rect x="360" y="246" width="160" height="4" fill="#FFCC00"/>` +
      `</svg>\n`
  );

  console.log(`[brand] ${Object.keys(logos).length} inline SVGs, favicon, ${icons.length} icons, og image`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
