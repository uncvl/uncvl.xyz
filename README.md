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

- **Images:** served from R2 (see below) and resized by Cloudflare: AVIF/WebP chosen per browser, 400/800/1400 px. Images not yet on R2 fall back to the local `@11ty/eleventy-img` pipeline.
- **Languages:** EN and TR live in the same file (`text_en` / `text_tr`). A tiny script shows one at a time and remembers the choice. Without JavaScript both are shown.
- **Upcoming/past:** computed from `date` at build time. CI rebuilds daily.
- **Privacy/security:** no third-party requests on page load (fonts are self-hosted, and YouTube loads only after a click via youtube-nocookie). A strict CSP is in `public/_headers`.

## Media on Cloudflare R2

Images and videos are served from the public bucket `uncvl-media` at `https://media.uncvl.xyz`, resized on request by Cloudflare (`/cdn-cgi/image/…`). Originals and private material go to the private bucket `uncvl-archive`.

- **CMS uploads** go straight to R2 under `uploads/` through the site's own endpoint `/api/media` (`worker/index.js`). It accepts editors whose Codeberg account can push to this repo, so there are no keys to share. Only `/api/*` runs Worker code; pages are served as static assets.
- `src/_data/media.json` lists what is on R2 (width, height, content version). Images listed there are loaded from R2. Images that aren't listed (e.g. fresh CMS uploads) still work from git through the local image pipeline.
- Upload with the maintainer key in your environment (never commit keys):

```sh
# PowerShell: $env:R2_ACCOUNT_ID="…"; $env:R2_ACCESS_KEY_ID="…"; $env:R2_SECRET_ACCESS_KEY="…"
npm run r2:media -- --dry-run          # preview
npm run r2:media                       # upload src images → uncvl-media, update media.json
npm run r2:media -- --prune            # …and delete the local copies that are verified on R2
npm run r2:file -- <file.mp4> events/<bundle>/<file.mp4>   # single file (e.g. promo video)
npm run r2:archive -- ../reference_sources reference_sources   # originals → uncvl-archive (private)
```

Then commit `src/_data/media.json` (and the removed local files).

## Deploy

`.forgejo/workflows/deploy.yml` builds, checks and runs `wrangler deploy` (Worker `uncvl`, config in `wrangler.jsonc`). It needs the secrets `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers", limited to this account and the uncvl.xyz zone) and `CLOUDFLARE_ACCOUNT_ID`. Wrangler output is filtered so e-mail addresses never reach the public CI log.

Local test of the Worker: `npm run build && npx wrangler dev --local` (put `CODEBERG_API=…` in `.dev.vars` to point the login check at a mock).
