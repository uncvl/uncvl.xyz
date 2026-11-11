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
- E-mail addresses were switched from `@uncvl.com` to `@uncvl.xyz` (`src/_data/site.json` and `/calls/compilation/`). Make sure the mailboxes exist.
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
- **Promo videos**: Infuze × Archongrid now uses its PeerTube video. Synth & Punk still plays its promo from R2 (not on PeerTube yet).
- **Infuze × Archongrid**: "infuze archongrid" is used as the codename (from the folder name). The page title lists the bands.
- Texts from Instagram captions were imported without hashtags and @handles where the handle stood in for a name.

## Feedback round 1 (Nov 2026): please review

### Genres split into Activity, Flavor and Music genres
Each event's old "genres" were sorted by best guess. Change anything in the CMS (event → Activity / Event flavor / Music genres).
Choices made: "dj sets" → *dj set*; "live" and "live electronic" → *live set*; "clown show" and "live gameplay" → *performance*; "after" was dropped; "rap" → *Hip Hop*; "hardcore" at punk concerts → *Hardcore Punk*. New genres added to the list: Hardcore Techno, Mental Tekno, Rave, Sextrance.

| Event | Old genres | Activity | Flavor | Music genres |
|---|---|---|---|---|
| 2022-04-02-bass-night-ignishaan | dub, breakbeat, jungle | – | – | Dub, Breakbeat, Jungle |
| 2022-05-03-bass-night-drumazan-speshaal | uk garage, breakbeat, rave, drum'n bass | – | – | UK Garage, Breakbeat, Rave, Drum & Bass |
| 2022-05-14-punk-zibidiler-tampon-bunu-sen-istedin | punk | – | punk | – |
| 2022-05-28-bass-night-genereshaan | jungle, drum'n bass | – | – | Jungle, Drum & Bass |
| 2022-11-17-decyphered-civilization | – | – | – | – |
| 2023-12-16-art-rejenere | breakcore, drum'n bass, live set, mental tekno | live set | – | Breakcore, Drum & Bass, Mental Tekno |
| 2024-09-05-thursday-breaks-break-protocol | bass, breaks, core | – | bass, breaks, core | – |
| 2024-09-19-thursday-breaks-attack-vector | bass, breaks, core | – | bass, breaks, core | – |
| 2024-09-26-punk-krayat-goblin-daycare-potlatch | punk, hardcore | – | punk | Hardcore Punk |
| 2024-09-27-punk-krayat-ruff-crux-moko-hush | punk, hardcore | – | punk | Hardcore Punk |
| 2024-10-03-thursday-breaks-buffer-overload | neurofunk, hardcore techno, sextrance | – | – | Neurofunk, Hardcore Techno, Sextrance |
| 2024-10-10-thursday-breaks-proxy-firewall | chill breakcore, live, neurofunk | live set | – | Chill Breakcore, Neurofunk |
| 2024-10-17-thursday-breaks-signature-strike | noise, flashcore, idm, breakcore, hardcore | – | – | Noise, Flashcore, IDM, Breakcore, Hardcore |
| 2024-11-30-art-rehab-1-mental-orientation | art market, dj sets | art market, dj set | – | – |
| 2024-12-22-art-rehab-2-sanatorium-for-the-sane | art market, dj sets | art market, dj set | – | – |
| 2025-01-12-art-rehab-3-psyche-cure | art market, exhibition, dj sets | art market, exhibition, dj set | – | – |
| 2025-03-14-zero-day-exploit | bass, breaks, core | – | bass, breaks, core | – |
| 2025-06-15-synth-session-1 | live electronic, drone, idm, industrial, breakcore, hardcore techno | live set | – | Drone, IDM, Industrial, Breakcore, Hardcore Techno |
| 2025-07-05-art-copusum | art market, barter market, clown show, live painting, music | art market, barter market, performance, live painting | music | – |
| 2025-11-01-bass-gkc-da-frogg | dub, rap, breakbeat, uk garage, drum & bass, jungle | – | – | Dub, Hip Hop, Breakbeat, UK Garage, Drum & Bass, Jungle |
| 2026-04-24-decentralized-consensus | bass, breaks, core, punk | – | bass, breaks, core, punk | – |
| 2026-05-08-punk-infuze-archongrid | punk, live gameplay, after | performance | punk | – |
| 2026-09-04-synth-and-punk | noise, idm, breakcore, punk | – | punk | Noise, IDM, Breakcore |

### Other changes to check
- **YouTube videos removed** (as decided): Bass Night Ignishaan, Drumazan Speshaal and the Zibidiler/Tampon/Bunu Sen İstedin concert had YouTube playlists; Genereshaan had a YouTube video. Add their PeerTube links once they are uploaded (event → Videos).
- **Zibidiler / Tampon / Bunu Sen İstedin**: the lineup had start times (21:15, 22:15, 23:30). They moved to the event's Schedule, since the lineup field is now Duration.
- **Translations still needed** (an empty Turkish field falls back to English, or shows a "needs translation" note):
  - Home notes (both), and the home box of the compilation call.
  - Compilation call: the whole English version (the page shows the Turkish text with a note for now).
  - About page: Turkish title.
- **CIVIL or EXTINCTION?** The home box says EXTINCTION X; the call page and the three releases still say CIVIL X-Y-Z.
- **About page**: the description used for search engines still has the old "(trans)media project" text. The note above the genre list mentions a "Sound page", which doesn't exist yet.

## Sound section (Nov 2026): please review

Imported from reference_sources (Music Genre, Supergenre, Music Descriptors). Change anything in the CMS under **Sound: Genres** / **Sound: Supergenres**.

- **Names kept as decided:** Sigilkore (note was "Sigilcore"), Trap (note was "Trap Hip Hop"), Hi-Tech (separate from Hi-Tech Psytrance), Hardcore and Hardcore Techno (separate genres).
- **Genres without a description:** Experimental Bass, Hi-Tech, Hardcore Techno, Mental Tekno, Rave. The "Wave" supergenre has no definition yet.
- **"Footwork"** appears twice in the Sorted List; it is listed once, at its first position.
- **Event flavor** is free text again (the original words were restored, e.g. "bass ⤬ breaks ⤬ core", Çöpüşüm "music", CIVIL Z "punk"). Supergenres are not picked on events or releases; a supergenre page lists what has one of its genres.
- **Releases:**

| Release | Old genres | Music genres | Flavor | Dropped |
|---|---|---|---|---|
| 2024-06-01-no-boundaries-jungle-remixes | jungle, drum & bass, remix | Jungle, Drum & Bass | – | remix |
| civil-x | dnb, dark ambient | Drum & Bass, Dark Ambient | – | – |
| civil-y | breakcore, hardcore | Breakcore, Hardcore | – | – |
| civil-z | punk | – | Punk | – |

### Supergenres per genre (best guess)
| Genre | Supergenres |
|---|---|
| Not Defined | – |
| Dub | Dub |
| Dubstyle | Bass, Dub |
| Dubstep | Bass, Dub |
| Drumstep | Bass, Dub |
| Drum & Bass | Bass, Break |
| Neurofunk | Bass |
| Techstep | Bass, Techno |
| Crossbreed | Bass, Core |
| Darkstep | Bass, Break |
| Darkcore | Break, Core |
| Breakstep | Bass, Break |
| Hardstep | Bass |
| Skullstep | Bass, Core |
| Rawstyle | Core, Techno |
| Psystyle | Psy, Bass |
| Glitch Hop | Glitch, Hop |
| Neurohop | Bass, Hop |
| Drumfunk | Bass, Break |
| Autonomic | Bass |
| Microfunk | Bass |
| Minimal Drum and Bass | Bass |
| Atmospheric Drum and Bass | Bass, Ambient |
| Footwork | Hop, Bass |
| UK Garage | Garage |
| Future Garage | Garage, Ambient |
| Deconstructed Club | Glitch, Industrial |
| Experimental Bass | Bass | no description
| IDM | Glitch, Break |
| Drill and Bass | Break, Glitch |
| Breakbeat | Break |
| Breakbeat Hardcore | Break, Core |
| Rave | Break, Techno | no description
| Hardcore Breaks | Break, Core |
| Jungle | Bass, Break |
| Footwork Jungle | Bass, Break |
| Ragga Jungle | Bass, Break, Dub |
| Raggacore | Break, Core |
| Gabber | Core, Techno |
| Hardstyle | Core, Techno |
| Jumpstyle | Techno |
| Trancestep | Bass, Psy |
| Freeform Hardcore | Core |
| Sextrance | Psy |
| HexD | Hop, Glitch |
| Dark Psytrance | Psy |
| Hi-Tech Psytrance | Psy |
| Hi-Tech | Psy | no description
| Psycore | Psy, Core |
| Breakcore | Break, Core |
| Deep Breakcore | Break, Core, Ambient |
| Chill Breakcore | Break, Ambient |
| Dreambreak | Break, Ambient |
| Glitchbreak | Break, Glitch |
| Chipbreak | Break, Chip |
| Flashcore | Core |
| Speedcore | Core |
| Splittercore | Core |
| Extratone | Core, Noise |
| Hardcore | Core, Techno |
| Hardcore Techno | Core, Techno | no description
| Mental Tekno | Techno, Core | no description
| Doomcore | Core, Techno |
| Terrorcore | Core |
| Digital Hardcore | Core, Punk, Industrial |
| Industrial Hardcore | Core, Industrial |
| Industrial | Industrial |
| Power Electronics | Industrial, Noise |
| Death Industrial | Industrial, Ambient |
| Industrial Metal | Industrial, Metal |
| Cyber Metal | Metal, Industrial |
| Metal | Metal |
| Black Metal | Metal |
| Atmospheric Black Metal | Metal, Ambient |
| Doom Metal | Metal |
| Sludge Metal | Metal, Punk |
| Grindcore | Metal, Punk, Core |
| Cybergrind | Metal, Core, Industrial |
| Metalcore | Metal, Core, Punk |
| Blackened Crust | Metal, Punk |
| Crust Punk | Punk, Core |
| Neocrust | Punk, Metal |
| Mathcore | Metal, Core, Punk |
| Mincecore | Punk, Core |
| Nintendocore | Punk, Chip, Core |
| Synth Punk | Punk, Synth |
| Acoustic Punk | Punk |
| Punk Rock | Punk |
| Anarcho-Punk | Punk |
| D-Beat | Punk, Core |
| Hardcore Punk | Punk, Core |
| Crack Rock Steady | Punk, Ska, Core |
| Skacore | Ska, Punk, Core |
| Ska Punk | Ska, Punk |
| Screamo | Emo, Punk |
| Emoviolence | Emo, Punk, Core |
| Powerviolence | Punk, Core |
| Noise Pop | Noise |
| Shoegaze | Noise, Ambient |
| Blackgaze | Metal, Noise |
| Noise | Noise |
| Black Noise | Noise |
| Gorenoise | Noise, Metal |
| Power Noise | Noise, Industrial |
| Harsh Noise | Noise |
| Harsh Noise Wall | Noise |
| Ambient Noise Wall | Noise, Ambient |
| Ambient | Ambient |
| Dark Ambient | Ambient |
| Black Ambient | Ambient, Metal |
| Drone | Ambient |
| Drone Metal | Ambient, Metal |
| Vaporwave | Vapor |
| Eccojams | Vapor |
| Post-Internet | Vapor, Glitch |
| Dreampunk | Vapor, Ambient |
| Hardvapour | Vapor, Core |
| Vapornoise | Vapor, Noise |
| Synthwave | Synth |
| Darksynth | Synth |
| Cybersynth | Synth, Industrial |
| Witch House | Wave, Ambient |
| Wave | Wave |
| Trip hop | Hop, Ambient |
| Hip Hop | Hop |
| Lo-Fi Hip Hop | Hop |
| Spoken Word | Hop |
| Abstract Hip Hop | Hop |
| Experimental Hip Hop | Hop |
| Industrial Hip Hop | Hop, Industrial |
| Hardcore Hip Hop | Hop, Core |
| Punk Rap | Hop, Punk |
| Memphis Rap | Hop |
| Cloud Rap | Hop, Ambient |
| Rare Phonk | Hop |
| Drift Phonk | Hop |
| Wonky | Hop, Glitch |
| Trap | Trap |
| Plugg | Trap |
| Drill | Trap |
| Tread | Trap |
| Rage | Trap |
| Emo Rap | Trap, Emo |
| Sigilkore | Trap, Glitch |
| Trap Metal | Trap, Metal |
| Digicore | Trap, Glitch |
| Glitchcore | Glitch, Trap |
| Nightcore | Glitch |
| Hyperpop | Glitch |
| Glitch | Glitch |
| Chiptune | Chip |
| Depressive Breakcore | Break, Core, Emo |
| Neo-Grime | Bass, Garage |
| Weightless | Bass, Ambient |

### Artist genres (filled in from their bios and lineup notes)
Only genres the artist's own bio or lineup note names were added. Event genres were not copied, because they describe the whole night. Change them in the CMS (Artists → Music genres).

| Artist | Music genres |
|---|---|
| Random Input | Breakcore, Chiptune, Glitch, Hardcore, Glitchbreak, Drum & Bass, Chill Breakcore, Freeform Hardcore |
| Balgum | Breakcore, Hardcore, Noise, Drum & Bass, Neurofunk |
| Dyln | Breakbeat, Dub, Dubstep, Drum & Bass, UK Garage |
| Dubstract | Breakbeat, Jungle, Techstep, Drum & Bass |
| Tech Tabanjah | Dub, Jungle, Breakbeat, Drum & Bass |
| Hörspiel | IDM, Noise, Breakcore |
| Jung | Breakbeat, UK Garage, Trap |
| Lunar Funktion | Jungle, Trip hop, Drum & Bass |
| Ox | Breakcore, Psycore, Mental Tekno |
| ZS ZS | Flashcore, IDM, Noise |
| H0P3 | Black Metal, Psycore |
| Boneless | Hardcore Punk, Skacore |
| Consul | Jungle, Drum & Bass |
| Corpocore | Hardcore Techno, Sextrance |
| Fosil | Breakbeat |
| Krayat | Hardcore Punk |
| Lizrith | Hardcore |
| Mad Honey | Hardstyle |
| Oqlius | Neurofunk |
| Rasenv1rus | Breakcore |
| ur0123456789 | Noise |
| Übena | Noise |
| Bunu Sen İstedin | Acoustic Punk |

Still empty: 500001K, Aziz Deliorman, Codex, GKC, Gouachi, ja11hhcc7216, Koi Failure, Loremipsum, Mondual, nxnblu, Tampon, Tetrax, VCO2, Zibidiler (Tampon and Zibidiler are described only as "punk", which is a supergenre).

### Sound page (notes 2)
- The "Genre types" text was added as sent. One spot looks garbled: "used interchangeablynot through with microgenre" (Niche genres). Fix it in the CMS: Site texts → Sound page → Genre types (EN).
- The text about the Uncivilization sound is not written yet; the top of /sound/ stays empty until it is (Site texts → Sound page → About the Uncivilization sound).
- There is no "Concept & Themes" page yet to link to the Sound page from.

### Event dropdown lists (Event content, Event category, Act type)
- **Event content** (the field was "Activity") and **Act type** now use the lists the team sent. The Turkish labels are suggestions, please check them in Site texts → Lists: Müzik, Performans Sanatı, Sergi, Sanat Pazarı, Takas Pazarı, Pazar, Atölye, Toplantı, Buluşma, Forum; DJ Seti, Canlı Set, Konser, Performans Sanatı, Canlı resim, Görsel, Sergi, Atölye, Sunum, Söyleşi.
- **Event category**: Bass, Breaks, Punk, Synth, Art, in that order on the events page. The field keeps the label "Event type" from the first round of notes; say if it should be called "Event category" instead. Breaks is stored as "break", so old /events/#break links keep working.
- No lineup had an act type yet, so nothing was moved there.
- Existing event content was moved over (dj set and live set → Music, barter market → Swap Market, performance and live painting → Performance Art). Music events with nothing set got "Music":

| Event | Before | Event content now |
|---|---|---|
| 2022-04-02-bass-night-ignishaan | – | Music (added: music event) |
| 2022-05-03-bass-night-drumazan-speshaal | – | Music (added: music event) |
| 2022-05-14-punk-zibidiler-tampon-bunu-sen-istedin | – | Music (added: music event) |
| 2022-05-28-bass-night-genereshaan | – | Music (added: music event) |
| 2022-11-17-decyphered-civilization | – | Music (added: music event) |
| 2023-12-16-art-rejenere | live set | Music |
| 2024-09-05-thursday-breaks-break-protocol | – | Music (added: music event) |
| 2024-09-19-thursday-breaks-attack-vector | – | Music (added: music event) |
| 2024-09-26-punk-krayat-goblin-daycare-potlatch | – | Music (added: music event) |
| 2024-09-27-punk-krayat-ruff-crux-moko-hush | – | Music (added: music event) |
| 2024-10-03-thursday-breaks-buffer-overload | – | Music (added: music event) |
| 2024-10-10-thursday-breaks-proxy-firewall | live set | Music |
| 2024-10-17-thursday-breaks-signature-strike | – | Music (added: music event) |
| 2024-11-30-art-rehab-1-mental-orientation | art market, dj set | Art Market, Music |
| 2024-12-22-art-rehab-2-sanatorium-for-the-sane | art market, dj set | Art Market, Music |
| 2025-01-12-art-rehab-3-psyche-cure | art market, exhibition, dj set | Art Market, Exhibition, Music |
| 2025-03-14-zero-day-exploit | – | Music (added: music event) |
| 2025-06-15-synth-session-1 | live set | Music |
| 2025-07-05-art-copusum | art market, barter market, performance, live painting | Art Market, Swap Market, Performance Art, Music (old tags had "music") |
| 2025-11-01-bass-gkc-da-frogg | – | Music (added: music event) |
| 2026-04-24-decentralized-consensus | – | Music (added: music event) |
| 2026-05-08-punk-infuze-archongrid | performance | Music (added: concert), Performance Art |
| 2026-09-04-synth-and-punk | – | Music (added: music event) |
- **Event type, Event content and Act type are all multi-select.** Synth Sessions & Punk Concert now has both Synth and Punk, so it shows under both on the events page.
