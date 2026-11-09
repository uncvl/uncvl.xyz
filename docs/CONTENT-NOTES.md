# Content notes from the migration

The old texts were moved **verbatim**. These are things we noticed but did **not** change. The team decides.

## Typos in body text (kept as-is)
- Home / compilation: "3 compilation is planned", "collabrating", "knewledge", "distrubuted".
- Genereshaan (EN): "host four DJs", "Lunar Function" (artist is *Lunar Funktion*); TR: "sahne aldı'" (stray apostrophe).
- Ignishaan (EN): "techstep breakbeat" (missing comma). Random Input bio: "itterating" (also on Rejenere).
- Rejenere: "Openning". TR bios: "Yaratacılığını", "Eudomania"/"Eudomonia", "Oxomoxo"/"Oxomo".
- Compilation call (TR): "arzusUndayız", "zamndan", "astonomi", "yinede".

## Fixed (metadata only)
- Thursday Breaks #1 had og:title "Bass Night Genereshaan at Blind". Titles now come from the event itself.
- Decyphered Civilization and the punk concert page had `<title>` "Bass Night - Ignishaan/Genereshaan".
- Drumazan meta description started with "TThe".

## Outdated content (kept, please review)
- The compilation call says the website runs on **Drupal** on a Linux server at uncvl.com, with invites and user roles.
- E-mail addresses were switched from `@uncvl.com` to `@uncvl.xyz` (`src/_data/site.json` and `/compilation/`). Make sure the mailboxes exist.
- Twitter link: `twitter.com/uncivilizationr`.

## Missing
- Thursday Breaks #2 (19.09.24) has no poster or text. Both Krayat nights (26–27.09.24) have only posters.
- English text for the Zibidiler / Tampon / Bunu Sen İstedin concert (marked "needs translation").
- The Rejenere poster lists exhibition artists (LVNA, Böcek, Bixbite, Musbucc, Dcntrlzd, Abyssal Area, Hypn) and visuals by Kage Bunshin. They aren't in the old page text, so they're not in the lineup yet.

## Batch 2 (reference_sources, Nov 2026): open questions
- **Freakout (17.09.2025, private party)**: not imported, because the repo and site are public. Publish it or keep it out?
- **Releases**: `reference_sources/releases/` holds only UNCVL001 (No Boundaries). Its cover and 6 extra store links were added.
- **Decentralized Consensus SoundCloud links**: `justajoooke`, `aycan-t` and `vvv3l` (+ `vvv3l.bandcamp.com`) weren't matched to an artist. Only Mad Honey and Random Input were linked.
- **Genereshaan artist card "MC 3Pillie / Farabi Gramafonia"** and **Drumazan card "Miss Baas"**: shown in the gallery, not added to the lineups. Did they perform?
- **Synth & Punk**: there's an Ox card (`260904-synthandpunk_sc-ox.png`), but Ox isn't on the poster or in the text. Shown in the gallery only.
- **Krayat TR text** sits in the İstanbul folder but describes the İzmir show (27.09). It's used on the İzmir event.
- **Zero-Day Exploit**: the text says "14'03'2024", but the folder (250314) and the weekday (Friday) say 2025. 2025 is used.
- **Promo videos** (Infuze × Archongrid 33 MB, Synth & Punk 17 MB): not imported. Pages can't serve files over 25 MB, so they're for R2.
- **Infuze × Archongrid**: "infuze archongrid" is used as the codename (from the folder name). The page title lists the bands.
- Texts from Instagram captions were imported without hashtags and @handles where the handle stood in for a name.
