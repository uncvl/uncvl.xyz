// Bundles browser libraries that don't ship a ready-to-load file into .vendor/ (git-ignored),
// which the build copies to the site root. For now: Trystero (peer-to-peer chat on /chat/).
import { build } from "esbuild";

await build({
  stdin: { contents: `export { joinRoom } from "trystero";`, resolveDir: process.cwd(), loader: "js" },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "eof", // keep the MIT licence notices
  outfile: ".vendor/assets/js/vendor/trystero.js",
  logLevel: "warning",
});
console.log("[vendor] trystero bundled");
