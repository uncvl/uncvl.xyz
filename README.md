# uncvl.xyz

Website of **Uncivilization**: events, releases and posts. Static site built with [Eleventy](https://www.11ty.dev/), edited with [Sveltia CMS](https://sveltiacms.app/) at `/admin/`, and deployed from Codeberg CI.

- **Editors:** see [docs/EDITING.md](docs/EDITING.md) (EN/TR).
- **Content notes from the migration:** [docs/CONTENT-NOTES.md](docs/CONTENT-NOTES.md).

## Develop

```sh
npm ci
npm run serve     # http://localhost:8080
npm run build     # → _site/
npm run check     # broken links, missing alt text, CSP-unsafe markup
npm run strip-metadata   # remove EXIF/XMP/GPS from images in src/ (lossless) — run before committing new photos
```

Requires Node 20+.

## Layout

| Path | What |
|---|---|
| `src/events/<yyyy-mm-dd-name>/index.md` | one event: front matter + poster/cover/gallery images next to it |
| `src/releases/<yyyy-mm-dd-name>/index.md` | one release (label discography) |
| `src/artists/<slug>.md` | artist bios, linked from events and releases |
| `src/posts/` | news and announcements |
| `src/pages/` | about, compilation call |
| `src/_data/site.json`, `home.json` | socials, e-mails, navigation, home page texts |
| `src/_includes/` | layouts, macros |
| `src/assets/` | CSS, JS (language switch + click-to-load video), self-hosted fonts |
| `brand/` | vector logo masters; `scripts/brand.mjs` builds inline SVGs, favicons and the social card from them |
| `public/` | copied as-is: `_headers` (CSP, HSTS), `_redirects` (old `.html` URLs), `admin/` (CMS) |
| `templates/` | copy-paste starters for events and releases |

## How it works

- **Images:** every local `<img>` becomes `<picture>` with AVIF/WebP/JPEG in several widths (`@11ty/eleventy-img`). Upload the largest original. Full-size files stay linked.
- **Languages:** EN and TR live in the same file (`text_en` / `text_tr`). A tiny script shows one at a time and remembers the choice. Without JavaScript both are shown.
- **Upcoming/past:** computed from `date` at build time. CI rebuilds daily.
- **Privacy/security:** no third-party requests on page load (fonts are self-hosted, and YouTube loads only after a click via youtube-nocookie). A strict CSP is in `public/_headers`.

## Deploy

`.forgejo/workflows/deploy.yml` builds, checks and deploys to Cloudflare Pages (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets). A commented Codeberg Pages step is included as an alternative.
