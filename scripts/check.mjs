// Post-build sanity checks on _site (no dependencies):
//  - every internal href/src resolves to a file
//  - every <img> has an alt attribute
//  - no inline <script> code or style="" attributes (they would break the strict CSP)
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = "_site";
const errors = [];

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}
const exists = async (p) => !!(await stat(p).catch(() => null));

async function resolves(urlPath) {
  const clean = decodeURI(urlPath.split(/[?#]/)[0]);
  if (!clean) return true;
  const p = path.join(ROOT, clean);
  if (clean.endsWith("/")) return exists(path.join(p, "index.html"));
  return (await exists(p)) || exists(path.join(p, "index.html"));
}

let pages = 0;
for await (const file of walk(ROOT)) {
  if (!file.endsWith(".html") || file.includes(`${path.sep}admin${path.sep}`)) continue;
  pages++;
  const html = await readFile(file, "utf8");
  const rel = "/" + path.relative(ROOT, file).split(path.sep).join("/");

  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|data:|#)/.test(url)) continue;
    const abs = url.startsWith("/") ? url : path.posix.join(path.posix.dirname(rel), url);
    if (!(await resolves(abs))) errors.push(`${rel}: broken link ${url}`);
  }
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
    for (const part of m[1].split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url.startsWith("/") && !(await resolves(url))) errors.push(`${rel}: broken srcset ${url}`);
    }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) errors.push(`${rel}: <img> without alt`);
  if (/\sstyle="/.test(html)) errors.push(`${rel}: inline style attribute (blocked by CSP)`);
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const [, attrs, body] = m;
    if (body.trim() && !/type="application\/ld\+json"/.test(attrs)) errors.push(`${rel}: inline <script> (blocked by CSP)`);
  }
}

// Event sources: videos must be links to our PeerTube instance (the only video host the CSP allows);
// YouTube fields are no longer supported.
const PEERTUBE = JSON.parse(await readFile("src/_data/site.json", "utf8")).peertube.host;
for await (const file of walk("src/events")) {
  if (!file.endsWith("index.md")) continue;
  const fm = ((await readFile(file, "utf8")).match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || "";
  const rel = file.split(path.sep).join("/");
  if (/^\s*youtube(_playlist)?:/m.test(fm)) errors.push(`${rel}: YouTube video field (use videos: with a PeerTube link)`);
  const block = (fm.match(/^videos:\n((?:[ -][^\n]*\n?)*)/m) || [])[1] || "";
  for (const m of block.matchAll(/url:\s*["']?([^"'\s]+)/g)) {
    let ok = false;
    try { const u = new URL(m[1]); ok = u.hostname === PEERTUBE && /^\/(w|videos\/watch|videos\/embed)\/[A-Za-z0-9-]{6,}\/?$/.test(u.pathname); } catch {}
    if (!ok) errors.push(`${rel}: video link is not a ${PEERTUBE} video: ${m[1]}`);
  }
}

// Genre fields (events, artists, releases) must name an existing genre (src/sound/genres) or,
// for flavor, a supergenre (src/sound/supergenres). Names are compared case-insensitively.
const namesIn = async (dir) => {
  const out = new Set();
  for await (const f of walk(dir)) {
    if (!f.endsWith(".md")) continue;
    const m = (await readFile(f, "utf8")).match(/^name:\s*["']?(.+?)["']?\s*$/m);
    if (m) out.add(m[1].toLowerCase());
  }
  return out;
};
const GENRES = await namesIn("src/sound/genres");
const SUPERS = await namesIn("src/sound/supergenres");
const flowList = (fm, key) => {
  const m = fm.match(new RegExp(`^${key}:\\s*(\\[.*\\])\\s*$`, "m"));
  if (m) { try { return JSON.parse(m[1].replace(/'/g, '"')); } catch { return []; } }
  const b = fm.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+[^\\n]*\\n?)*)`, "m"));
  return b ? [...b[1].matchAll(/-\s+["']?(.+?)["']?\s*$/gm)].map((x) => x[1]) : [];
};
for (const dir of ["src/events", "src/artists", "src/releases"]) {
  for await (const file of walk(dir)) {
    if (!file.endsWith(".md")) continue;
    const fm = ((await readFile(file, "utf8")).match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || "";
    const rel = file.split(path.sep).join("/");
    for (const g of flowList(fm, "music_genres")) if (!GENRES.has(String(g).toLowerCase())) errors.push(`${rel}: unknown music genre "${g}" (add it under Sound → Genres)`);
    for (const g of flowList(fm, "flavor")) if (!SUPERS.has(String(g).toLowerCase())) errors.push(`${rel}: unknown supergenre "${g}" in flavor`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n[check] ${errors.length} problem(s) in ${pages} pages`);
  process.exit(1);
}
console.log(`[check] ${pages} pages OK`);
