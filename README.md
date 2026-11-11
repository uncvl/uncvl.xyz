[![Uncivilization](docs/logo-banner.svg)](https://uncvl.xyz)

# uncvl.xyz

This is the home of **[uncvl.xyz](https://uncvl.xyz)**, the website of **Uncivilization**. Everything on the site lives here: our events, our label releases, artist pages and news.

You don't need to know anything about code to add to it. There is a simple editor in the browser, and this page explains the rest.

> **Türkçe:** Bu depo, Uncivilization'ın sitesi [uncvl.xyz](https://uncvl.xyz)'nin evidir. Etkinlik, yayın, sanatçı ya da haber eklemek için kod bilmene gerek yok: **[uncvl.xyz/admin](https://uncvl.xyz/admin/)** adresinden Codeberg hesabınla giriş yap, formu doldur, kaydet. Adım adım anlatım için: [docs/EDITING.md](docs/EDITING.md) (Türkçe bölüm aşağıda).

---

## What's on the website

| Page | What you'll find there |
|---|---|
| **Home** | Who we are, upcoming events, latest releases and news |
| **[Events](https://uncvl.xyz/events/)** | Every Uncivilization night, past and upcoming, grouped as Art, Break, Bass, Punk and Synth. Each event has its poster, lineup, times, venue, tickets and photos |
| **[Releases](https://uncvl.xyz/releases/)** | Our label's records, with players for Bandcamp and SoundCloud |
| **Artists** | One page per artist: bio, links, and every event and release they were part of |
| **[Posts](https://uncvl.xyz/posts/)** | News and announcements, like open calls |
| **[About](https://uncvl.xyz/about/)** | The Uncivilization story |
| **[Concept](https://uncvl.xyz/concept/)** | The ideas behind it all: existence and extinction, the [World Building Project](https://uncvl.xyz/concept/world-building/), the [Sound](https://uncvl.xyz/sound/) and, later, the themes |

Every page is in **English and Turkish**. Visitors switch with the **EN | TR** button at the top, and the site remembers their choice.

---

## How to add or change something

1. Go to **[uncvl.xyz/admin](https://uncvl.xyz/admin/)**.
2. Click **Sign in with Codeberg** and log in with your Codeberg account.
3. Pick what you want to work on: **Events**, **Releases**, **Artists**, **Posts** or **Settings**.
4. Click **New** (or open an existing one), fill in the form and upload the poster or photos.
5. Click **Save**. This keeps your work as a **draft**. Nothing is public yet.
6. When it's ready, set it to **Ready** and then **Publish**.

About a minute or two later, your change is live on uncvl.xyz.

A more detailed guide, in both English and Turkish, is in **[docs/EDITING.md](docs/EDITING.md)**.

### Good to know

- **No access?** You need a free [Codeberg](https://codeberg.org) account, and someone from the crew has to add you to the Uncivilization team. Ask in the group.
- **Write both languages if you can.** Each form has an English and a Turkish box. If one is empty, the page shows the other language instead.
- **Upload the biggest version** of a poster or photo. The site makes the smaller versions for phones itself.
- **Upcoming and past sort themselves.** Once an event's date has passed, it moves to the past events on its own. You don't have to do anything.
- **Codename** is the computer-science name of a night, like *zero day exploit* or *break protocol*. It shows as the big glitchy title on the event page.
- **Mistakes are safe.** Every change is saved with its history, so anything can be undone. If something goes wrong while the site is being updated, the old version simply stays online.

### Need help?

Ask in the crew group, or write to [info@uncvl.xyz](mailto:info@uncvl.xyz).

---

<details>
<summary><strong>Technical details (for maintainers)</strong></summary>

### Overview

- Static site built with [Eleventy](https://www.11ty.dev/) 3. Content is Markdown with front matter.
- Edited with [Sveltia CMS](https://sveltiacms.app/) at `/admin/`. Login is Codeberg OAuth (PKCE), using the editorial workflow (drafts are pull requests).
- Built and deployed by Forgejo Actions on Codeberg (`.forgejo/workflows/deploy.yml`) to a Cloudflare Worker with static assets (`wrangler.jsonc`, Worker `uncvl`).
- Media lives on Cloudflare R2 (`uncvl-media`, public at `https://media.uncvl.xyz`). Originals and private material are in `uncvl-archive` (private).
- Open questions from the content migration: [docs/CONTENT-NOTES.md](docs/CONTENT-NOTES.md).

### Develop

Requires Node 20 or newer.

```sh
npm ci
npm run serve            # http://localhost:8080
npm run build            # → _site/
npm run check            # broken links, missing alt text, CSP-unsafe markup
npm run strip-metadata   # remove EXIF/XMP/GPS from images in src/ (lossless); run before committing new photos
```

### Layout

| Path | What |
|---|---|
| `src/events/<yyyy-mm-dd-name>/index.md` | one event: front matter, with any local images next to it |
| `src/releases/<yyyy-mm-dd-name>/index.md` | one release (label discography) |
| `src/artists/<slug>.md` | artist bios, linked from events and releases |
| `src/posts/` | news and announcements |
| `src/pages/` | about, concept and world building pages (fixed settings like the URL are in the `.11tydata.js` files next to them) |
| `src/calls/` | open calls (e.g. the compilation call), shown in the CALLS box on the home page |
| `src/sound/genres/`, `src/sound/supergenres/` | music genres and supergenres → /sound/ pages; events, artists and releases link to them by name |
| `src/_data/site.json`, `home.json`, `vocab.json`, `sound.json` | socials, e-mails, navigation, home page texts; lists for activities and act types; Sound page texts |
| `src/_data/media.json` | manifest of images on R2 (width, height, content version) |
| `src/_includes/` | layouts, macros |
| `src/assets/` | CSS, JS (language switch, click-to-load players), self-hosted fonts |
| `brand/` | vector logo masters. `scripts/brand.mjs` builds the inline SVGs, favicons, social card and this README's banner (`docs/logo-banner.svg`) from them |
| `public/` | copied as-is: `_headers` (CSP, HSTS), `_redirects` (old `.html` URLs), `admin/` (CMS) |
| `worker/index.js` | the only server code: the `/api/media` upload endpoint for the CMS |
| `templates/` | copy-paste starters for events and releases |

### How it works

- **Images:** served from R2 and resized by Cloudflare Image Transformations (`/cdn-cgi/image/…`, 400/800/1400 px, AVIF/WebP per browser). Images not in `media.json` fall back to the local `@11ty/eleventy-img` pipeline.
- **Languages:** EN and TR live in the same file (`text_en` / `text_tr`). A small script shows one at a time and remembers the choice. Without JavaScript both are shown.
- **Upcoming/past:** computed from `date` at build time. CI rebuilds daily (cron `17 3 * * *`).
- **Privacy/security:** no third-party requests on page load. Fonts are self-hosted, and YouTube, Bandcamp and SoundCloud players load only after a click. A strict CSP is in `public/_headers`. `/admin/*` has its own CSP.
- **Glitch scroll:** while you scroll fast, letters lag behind and catch up (the middle of each line last). `src/assets/js/scroll-fx.js` lays out the text with [Pretext](https://github.com/chenglou/pretext) and redraws it on one canvas; the real text is hidden only while letters move. The warning-sign button next to EN | TR turns it off (remembered; off by default with reduced motion).

### CMS uploads to R2

Uploads from the CMS go straight to R2 under `uploads/` through the site's own endpoint `/api/media` (`worker/index.js`, a minimal S3 API). There are no keys to share:

- `public/admin/media-session.js` hands the editor's Codeberg token to `/api/media/session`.
- The Worker stores the token in an HttpOnly cookie and accepts it only if that Codeberg account can push to this repo (checked against the Codeberg API, cached 5 minutes).
- Only `/api/*` runs Worker code. Everything else is served as static assets.

### Maintainer uploads

Put the maintainer R2 key in your environment. Never commit keys.

```sh
# PowerShell: $env:R2_ACCOUNT_ID="…"; $env:R2_ACCESS_KEY_ID="…"; $env:R2_SECRET_ACCESS_KEY="…"
npm run r2:media -- --dry-run          # preview
npm run r2:media                       # upload src images → uncvl-media, update media.json
npm run r2:media -- --prune            # …and delete local copies that are verified on R2
npm run r2:file -- <file.mp4> events/<bundle>/<file.mp4>   # single file (e.g. promo video)
npm run r2:archive -- ../reference_sources reference_sources   # originals → uncvl-archive (private)
```

Then commit `src/_data/media.json` (and the removed local files).

### Deploy

`.forgejo/workflows/deploy.yml` runs `npm ci`, `npm audit`, build and check, then `wrangler deploy --x-provision=false`. Pull requests only build and check.

Repository secrets:

- `CLOUDFLARE_API_TOKEN`: an Account API token with one policy, scope "Specified Workers" → `uncvl`, role "Individual Workers: Editor". It needs no zone or R2 permissions, because the custom domain is managed in the dashboard and deploys skip resource provisioning.
- `CLOUDFLARE_ACCOUNT_ID`

The repository and its CI logs are public. Wrangler output is filtered so e-mail addresses never reach the log.

Local test of the Worker: `npm run build && npx wrangler dev --local`. To point the login check at a mock, put `CODEBERG_API=…` in `.dev.vars`.

</details>
