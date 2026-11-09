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
- Cover art for *No Boundaries (Jungle Remixes)* (by Da Frogg): add `cover.jpg` to `src/releases/2024-06-01-no-boundaries-jungle-remixes/` and uncomment `cover:`.
- Thursday Breaks #2 (19.09.24) has no poster or text. Both Krayat nights (26–27.09.24) have only posters.
- English text for the Zibidiler / Tampon / Bunu Sen İstedin concert (marked "needs translation").
- The Rejenere poster lists exhibition artists (LVNA, Böcek, Bixbite, Musbucc, Dcntrlzd, Abyssal Area, Hypn) and visuals by Kage Bunshin. They aren't in the old page text, so they're not in the lineup yet.
