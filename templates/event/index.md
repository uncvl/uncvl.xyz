---
# Copy this folder to src/events/YYYY-MM-DD-short-name/ and put the poster image next to this file.
# Everything after a "#" is a comment and can be deleted. Leave a field empty (or delete it) if unknown.
title: "Thursday Breaks #3"          # shown as the page title
codename: zero day exploit           # optional: shown big as ZERO_DAY_EXPLOIT
category: break                      # event type: bass | break | punk | art | synth
series: Thursday Breaks              # optional
activities: [dj set, live set]       # from Site texts → Lists (dj set, live set, concert, art market…)
flavor: [bass, breaks, core]         # shown as bass ⤬ breaks ⤬ core
music_genres: [Breakcore, Jungle]    # from the genre list (Site texts → Lists)
date: 2026-12-04                     # YYYY-MM-DD: decides "upcoming" vs "past" automatically
doors: "21:00"
stage: "22:00"
venue:
  name: Dinozor Bar
  city: İzmir
price: 150TL
poster: poster.jpg                   # file name of the image in this folder
poster_alt: uncivilization thursday breaks 3 poster
poster_credit: "Artwork: …, Poster design: …"   # shown under the poster
# cover: cover-square.jpg            # optional square version for grids
text_en: |
  English event text. Blank line = new paragraph. *word* = highlighted.
text_tr: |
  Türkçe etkinlik metni.
tickets_en: |
  Tickets at door: 150TL
tickets_tr: |
  Biletler kapıda 150TL
lineup:
  - name: Random Input               # as written on the poster
    artist: random-input             # optional: file name in src/artists/ (links to the artist page)
    duration: 60 min                 # optional
    act_type: DJ set                 # from Site texts → Lists (DJ set, Live, Performance…)
    note_en: breakcore
  - name: New Artist
    act_type: Live
# schedule:                          # start times go here
#   - { time: "22:00", en: Random Input }
# videos:                            # PeerTube links (v.basspistol.org)
#   - url: https://v.basspistol.org/w/VIDEO_ID
#     title: Event promo
# recordings:                        # SoundCloud playlist/track of the night → SOUND RECORDINGS
#   - url: https://soundcloud.com/uncvl/sets/…
---
