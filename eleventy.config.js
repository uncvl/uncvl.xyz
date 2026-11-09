import path from "node:path";
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
  eleventyConfig.addWatchTarget("src/assets/");

  // ---- responsive images: every <img> pointing at a local raster becomes <picture> avif/webp/jpeg ----
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    extensions: "html",
    formats: ["avif", "webp", "jpeg"],
    // capped at 1440: full-size masters are linked separately (poster/gallery click-through)
    widths: [320, 480, 720, 960, 1440],
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
  eleventyConfig.addCollection("events", (api) =>
    api
      .getFilteredByGlob("src/events/*/index.md")
      .sort(byDateAsc)
      .map((item, i) => {
        item.data.seq = i + 1;
        return item;
      })
  );
  eleventyConfig.addCollection("upcomingEvents", (api) =>
    api.getFilteredByGlob("src/events/*/index.md").filter((e) => toDate(e.data.date) >= startOfToday()).sort(byDateAsc)
  );
  eleventyConfig.addCollection("pastEvents", (api) =>
    api
      .getFilteredByGlob("src/events/*/index.md")
      .filter((e) => toDate(e.data.date) < startOfToday())
      .sort((a, b) => byDateAsc(b, a))
  );
  eleventyConfig.addCollection("releases", (api) =>
    api
      .getFilteredByGlob("src/releases/*/index.md")
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
      ...api.getFilteredByGlob("src/events/*/index.md"),
      ...api.getFilteredByGlob("src/releases/*/index.md").filter((r) => r.data.status === "released"),
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
