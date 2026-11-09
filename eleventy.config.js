import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import markdownIt from "markdown-it";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";

const TZ = "Europe/Istanbul";

const md = markdownIt({ html: true, linkify: true, typographer: false, breaks: true });
// External links: no referrer leakage, no window.opener.
const defaultLinkOpen =
  md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet("href") || "";
  if (/^https?:\/\//.test(href)) tokens[idx].attrSet("rel", "noopener noreferrer");
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const toDate = (d) => (d instanceof Date ? d : new Date(d));
const startOfToday = () => {
  const now = new Date();
  // compare in Istanbul local date so an event stays "upcoming" for its whole day
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
  return new Date(`${ymd}T00:00:00Z`);
};

export default function (eleventyConfig) {
  eleventyConfig.setLibrary("md", md);

  // ---- assets ----
  eleventyConfig.addPassthroughCopy({ "src/assets/fonts": "assets/fonts" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ public: "/" });
  eleventyConfig.addPassthroughCopy({ ".brand": "/" });
  // CMS: self-hosted Sveltia bundle + lazily loaded backend chunks (no source maps)
  const noMaps = { filter: ["**/*", "!**/*.map"] };
  eleventyConfig.addPassthroughCopy({ "node_modules/@sveltia/cms/dist/sveltia-cms.js": "admin/sveltia-cms.js" });
  eleventyConfig.addPassthroughCopy({ "node_modules/@sveltia/cms/dist/chunks": "admin/chunks" }, noMaps);
  // full-size masters stay downloadable next to their page bundle (linked from posters/gallery)
  eleventyConfig.addPassthroughCopy("src/events/**/*.{jpg,jpeg,png,webp}");
  eleventyConfig.addPassthroughCopy("src/releases/**/*.{jpg,jpeg,png,webp}");
  eleventyConfig.addPassthroughCopy("src/posts/**/*.{jpg,jpeg,png,webp}");
  eleventyConfig.addPassthroughCopy("src/artists/**/*.{jpg,jpeg,png,webp}");
  eleventyConfig.addWatchTarget("src/assets/");

  // ---- responsive images: every <img> pointing at a local raster becomes <picture> avif/webp/jpeg ----
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    extensions: "html",
    formats: ["avif", "webp", "jpeg"],
    // capped at 1440: full-size masters are linked separately (poster/gallery click-through)
    widths: [400, 800, 1400],
    urlPath: "/img/",
    outputDir: "_site/img/",
    failOnError: true,
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async" },
      pictureAttributes: {},
    },
    sharpJpegOptions: { quality: 78, mozjpeg: true },
    sharpWebpOptions: { quality: 76 },
    sharpAvifOptions: { quality: 55 },
  });

  // ---- collections ----
  const byDateAsc = (a, b) => toDate(a.data.date) - toDate(b.data.date);
  const published = (items) => items.filter((i) => !i.data.draft); // draft: true hides an entry everywhere
  eleventyConfig.addCollection("events", (api) =>
    published(api.getFilteredByGlob("src/events/*/index.md"))
      .sort(byDateAsc)
      .map((item, i) => {
        item.data.seq = i + 1;
        return item;
      })
  );
  eleventyConfig.addCollection("upcomingEvents", (api) =>
    published(api.getFilteredByGlob("src/events/*/index.md")).filter((e) => toDate(e.data.date) >= startOfToday()).sort(byDateAsc)
  );
  eleventyConfig.addCollection("pastEvents", (api) =>
    published(api.getFilteredByGlob("src/events/*/index.md"))
      .filter((e) => toDate(e.data.date) < startOfToday())
      .sort((a, b) => byDateAsc(b, a))
  );
  eleventyConfig.addCollection("releases", (api) =>
    published(api.getFilteredByGlob("src/releases/*/index.md"))
      .sort((a, b) => {
        // released first (newest first), then upcoming/open-call/planned in catalog order
        const ra = a.data.status === "released", rb = b.data.status === "released";
        if (ra !== rb) return ra ? -1 : 1;
        return ra ? toDate(b.data.date) - toDate(a.data.date) : (a.data.order || 0) - (b.data.order || 0);
      })
  );
  eleventyConfig.addCollection("artists", (api) =>
    api.getFilteredByGlob("src/artists/*.md").sort((a, b) => a.data.name.localeCompare(b.data.name, "tr"))
  );
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/posts/**/*.md").filter((p) => !p.data.draft).sort((a, b) => byDateAsc(b, a))
  );

  // ---- filters ----
  eleventyConfig.addFilter("md", (s) => (s ? md.render(String(s)) : ""));
  eleventyConfig.addFilter("mdInline", (s) => (s ? md.renderInline(String(s)) : ""));
  eleventyConfig.addFilter("date", (d, style = "dots") => {
    if (!d) return "";
    const date = toDate(d);
    const p = (o) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...o }).format(date);
    if (style === "iso") return date.toISOString().slice(0, 10);
    if (style === "short") return `${p({ day: "2-digit" })}.${p({ month: "2-digit" })}.${p({ year: "2-digit" })}`;
    if (style === "year") return p({ year: "numeric" });
    if (style === "long-en") return p({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (style === "long-tr")
      return new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
    return `${p({ day: "2-digit" })}.${p({ month: "2-digit" })}.${p({ year: "numeric" })}`;
  });
  eleventyConfig.addFilter("hex", (n, pad = 2) => "0x" + Number(n).toString(16).toUpperCase().padStart(pad, "0"));
  // allow line breaks after underscores in codenames (escapes first, so the result is safe to output raw)
  eleventyConfig.addFilter("wbr", (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/_/g, "_<wbr>"));
  eleventyConfig.addFilter("pad", (n, len = 2) => String(n).padStart(len, "0"));
  eleventyConfig.addFilter("codename", (s) => String(s || "").trim().toUpperCase().replace(/[\s-]+/g, "_"));
  // path of a file inside the page bundle, relative to the input dir (for <img src> and links)
  eleventyConfig.addFilter("bundle", (file, inputPath) => {
    if (!file) return "";
    if (/^(https?:)?\//.test(file)) return file;
    const dir = path.posix.dirname(inputPath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^src\//, ""));
    return "/" + path.posix.join(dir, file);
  });
  // ---- cache-busting: /assets/... URLs carry a content hash, so browsers never run stale CSS/JS ----
  eleventyConfig.addFilter("asset", (url) => {
    try {
      const hash = createHash("md5").update(readFileSync(path.join("src", url))).digest("hex").slice(0, 10);
      return `${url}?v=${hash}`;
    } catch {
      return url;
    }
  });

  // ---- media on R2 (media.uncvl.xyz) ----
  // src/_data/media.json (written by scripts/r2-upload.mjs) lists files that live in the R2 bucket.
  // Those are served from R2 and resized by Cloudflare (/cdn-cgi/image); anything not listed
  // falls back to the local file + build-time eleventy-img pipeline (e.g. fresh CMS uploads).
  const MEDIA_BASE = "https://media.uncvl.xyz";
  const MEDIA_WIDTHS = [400, 800, 1400];
  let MEDIA = {};
  const loadMedia = () => {
    try { MEDIA = JSON.parse(readFileSync("src/_data/media.json", "utf8")); } catch { MEDIA = {}; }
  };
  loadMedia();
  eleventyConfig.on("eleventy.before", loadMedia);
  eleventyConfig.addWatchTarget("src/_data/media.json");
  const mediaKey = (src) => String(src || "").replace(/^\/+/, "");
  const cdn = (key, m, width, extra = "") =>
    `${MEDIA_BASE}/cdn-cgi/image/width=${Math.min(width, m.w || width)},quality=80,format=auto,fit=scale-down${extra}/${key}?v=${m.v}`;
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  // {% image src, alt, sizes, eager %} — src is a site path like /events/<bundle>/poster.jpg
  eleventyConfig.addShortcode("image", (src, alt = "", sizes = "100vw", eager = false) => {
    const key = mediaKey(src);
    const m = MEDIA[key];
    const loading = eager ? `loading="eager" fetchpriority="high"` : `loading="lazy"`;
    if (m && m.w) {
      const widths = [...new Set(MEDIA_WIDTHS.map((w) => Math.min(w, m.w)))];
      const srcset = widths.map((w) => `${cdn(key, m, w)} ${w}w`).join(", ");
      return `<img src="${cdn(key, m, 800)}" srcset="${srcset}" sizes="${esc(sizes)}" width="${m.w}" height="${m.h}" alt="${esc(alt)}" ${loading} decoding="async" eleventy:ignore>`;
    }
    return `<img src="${esc(src)}" alt="${esc(alt)}" sizes="${esc(sizes)}" ${loading}>`; // local → eleventy-img transform
  });
  // Full-size file (poster/gallery click-through): original on R2 if uploaded, else the local master
  eleventyConfig.addFilter("mediaFull", (src) => {
    const key = mediaKey(src);
    return MEDIA[key] ? `${MEDIA_BASE}/${key}?v=${MEDIA[key].v}` : src;
  });
  // Social card image: 1200px JPEG from R2 (crawlers don't negotiate AVIF), or the local path
  eleventyConfig.addFilter("mediaOg", (src) => {
    const key = mediaKey(src);
    const m = MEDIA[key];
    return m && m.w ? cdn(key, m, 1200).replace("format=auto", "format=jpeg") : src;
  });
  // Video (e.g. promo clips) — only rendered when the file is on R2
  eleventyConfig.addFilter("mediaVideo", (src) => {
    const key = mediaKey(src);
    return MEDIA[key] ? `${MEDIA_BASE}/${key}?v=${MEDIA[key].v}` : null;
  });

  // Playable embeds for SoundCloud / Bandcamp links (rendered as click-to-load players).
  // Sources: `listen: [{url, title?, bandcamp_id?}]`, release `links: {bandcamp, soundcloud}` + `bandcamp_id`,
  // artist `links: [{name, url, bandcamp_id?}]`.
  eleventyConfig.addFilter("players", (data) => {
    const items = [];
    for (const l of data.listen || []) items.push(l);
    if (data.links && !Array.isArray(data.links)) {
      if (data.links.bandcamp) items.push({ url: data.links.bandcamp, bandcamp_id: data.bandcamp_id, title: data.title });
      if (data.links.soundcloud) items.push({ url: data.links.soundcloud, title: data.title });
    } else for (const l of data.links || []) items.push({ ...l, title: l.title || data.name });
    const seen = new Set();
    return items.map(toPlayer).filter((p) => p && !seen.has(p.url) && seen.add(p.url));
  });
  function toPlayer(item) {
    let u;
    try { u = new URL(item.url); } catch { return null; }
    const path = u.pathname.split("/").filter(Boolean);
    const label = item.title || u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
    if (/(^|\.)soundcloud\.com$/.test(u.hostname) && path.length) {
      const isTrack = path.length === 2 && !["sets", "tracks", "albums", "likes", "reposts", "popular-tracks"].includes(path[1]);
      const embed = "https://w.soundcloud.com/player/?" + new URLSearchParams({
        url: u.href, color: "#ffcc00", auto_play: "true", hide_related: "true", show_comments: "false",
        show_user: "true", show_reposts: "false", show_teaser: "false", visual: "false",
      });
      return { type: "soundcloud", url: u.href, label, embed, height: isTrack ? 166 : 320 };
    }
    if (/(^|\.)bandcamp\.com$/.test(u.hostname) && item.bandcamp_id) {
      const kind = item.bandcamp_type || (path[0] === "track" ? "track" : "album");
      const embed = `https://bandcamp.com/EmbeddedPlayer/${kind}=${item.bandcamp_id}/size=large/bgcol=151515/linkcol=ffcc00/artwork=small/tracklist=false/transparent=true/`;
      return { type: "bandcamp", url: u.href, label, embed, height: 120 };
    }
    return null; // other links stay plain links
  }

  // { index, prev, next } of the current page inside a sorted collection
  eleventyConfig.addFilter("neighbors", (items, url) => {
    const list = items || [];
    const index = list.findIndex((i) => i.url === url);
    return { index, prev: index > 0 ? list[index - 1] : null, next: index >= 0 && index < list.length - 1 ? list[index + 1] : null };
  });
  eleventyConfig.addFilter("findBySlug", (items, slug) => (items || []).find((i) => i.fileSlug === slug || i.data.slug === slug));
  eleventyConfig.addFilter("eventsWithArtist", (events, slug) =>
    (events || []).filter((e) => (e.data.lineup || []).some((l) => l.artist === slug))
  );
  eleventyConfig.addFilter("releasesWithArtist", (releases, slug) =>
    (releases || []).filter((r) => (r.data.artists || []).includes(slug))
  );
  eleventyConfig.addFilter("byCategory", (items, cat) => (items || []).filter((i) => i.data.category === cat));
  eleventyConfig.addFilter("byType", (items, t) => (items || []).filter((i) => i.data.type === t));
  eleventyConfig.addFilter("groupByYear", (items) => {
    const groups = new Map();
    for (const i of items || []) {
      const y = toDate(i.data.date).getUTCFullYear();
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push(i);
    }
    return [...groups.entries()];
  });
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));
  eleventyConfig.addFilter("absoluteUrl", (url, base) => new URL(url, base).href);
  eleventyConfig.addFilter("stripHtml", (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());

  // Bilingual inline label: both spans render; CSS/JS shows the active language.
  eleventyConfig.addShortcode("t", (en, tr) =>
    `<span class="i18n"><span lang="en" class="l-en">${en}</span><span lang="tr" class="l-tr">${tr ?? en}</span></span>`
  );

  eleventyConfig.addPlugin(feedPlugin, {
    type: "atom",
    outputPath: "/feed.xml",
    collection: { name: "feedItems", limit: 30 },
    metadata: {
      language: "en",
      title: "Uncivilization",
      subtitle: "Events, releases and news from Uncivilization.",
      base: "https://uncvl.xyz/",
      author: { name: "Uncivilization" },
    },
  });
  eleventyConfig.addCollection("feedItems", (api) =>
    [
      ...published(api.getFilteredByGlob("src/events/*/index.md")),
      ...published(api.getFilteredByGlob("src/releases/*/index.md")).filter((r) => r.data.status === "released"),
      ...api.getFilteredByGlob("src/posts/**/*.md").filter((p) => !p.data.draft),
    ].sort((a, b) => toDate(b.data.date) - toDate(a.data.date))
  );

  return {
    dir: { input: "src", includes: "_includes", layouts: "_includes/layouts", data: "_data", output: "_site" },
    // Markdown written in the CMS is never run through a template engine (no surprises with "{{").
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md"],
  };
}
