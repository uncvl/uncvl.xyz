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

  // favicon.svg follows the browser theme
  const mark = logos.logomark;
  await writeFile(
    `${OUT}/favicon.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox}"><style>path{fill:#000}@media (prefers-color-scheme:dark){path{fill:#fff}}</style>${mark.inner}</svg>`
  );

  const icon = (size, pad) => {
    const inner = size * (1 - pad * 2);
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${BG}"/>${nested(mark, (size - inner) / 2, (size - inner) / 2, inner, inner, FG)}</svg>`
    );
  };
  const icons = [
    ["favicon-32.png", 32, 0.08],
    ["apple-touch-icon.png", 180, 0.14],
    ["icon-192.png", 192, 0.14],
    ["icon-512.png", 512, 0.14],
    ["icon-maskable-512.png", 512, 0.24],
  ];
  for (const [file, size, pad] of icons) {
    await sharp(icon(size, pad)).png({ compressionLevel: 9 }).toFile(`${OUT}/${file}`);
  }

  // Default social card 1200x630
  const og = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <rect width="100%" height="100%" fill="${BG}"/>
      ${nested(mark, 90, 115, 330, 400, FG)}
      ${nested(logos.logotype, 480, 270, 640, 60, FG)}
      <rect x="480" y="370" width="640" height="4" fill="#FFCC00"/>
    </svg>`
  );
  await sharp(og).png({ compressionLevel: 9 }).toFile(`${OUT}/og-default.png`);

  console.log(`[brand] ${Object.keys(logos).length} inline SVGs, favicon, ${icons.length} icons, og image`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
