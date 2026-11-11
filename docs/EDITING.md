# Editing uncvl.xyz · uncvl.xyz'yi düzenlemek

## EN

### The easy way: the web editor
1. Open **https://uncvl.xyz/admin/** and choose **Sign in with Codeberg**. You need write access to `Uncivilization/uncvl.xyz`.
2. Pick **Events**, **Releases**, **Artists** or **Posts**, then **New**. Fill in the form and upload the poster or cover.
3. **Save**. Your change becomes a draft (a pull request). When it's ready, set it to **Ready** and **Publish**.
4. About a minute later the site is rebuilt and live. Events move from *upcoming* to *past* automatically after their date.

### Without the web editor (Codeberg website)
1. Copy `templates/event/index.md` into a new folder `src/events/YYYY-MM-DD-short-name/` (on Codeberg: *Add file → New file*, type the path).
2. Upload the poster into the same folder (*Add file → Upload file*).
3. Fill in the fields. Comments after `#` explain each one. Commit to a new branch and open a pull request.

### Tips
- Write each language in its own field (`text_en`, `text_tr`). If one is empty, the page shows the other language with a "needs translation" note.
- `*word*` highlights a word, and a blank line starts a new paragraph.
- Upload the **largest** version of an image. The site makes the small versions itself.
- Images and videos you upload in the editor go straight to our media storage (Cloudflare R2). There is no key to enter: your Codeberg login is checked. They are shrunk to WebP automatically.
- `codename` is the computer-science name of the night (e.g. *break protocol*, *zero day exploit*).

### Event fields
- **Event type**: groups the event on the events page (art, break, bass, punk, synth).
- **Activity**: what happens (dj set, live set, concert, art market, exhibition, lecture…). Pick from the list.
- **Event flavor**: pick supergenres (Bass, Break, Core, Punk…), shown as *bass ⤬ break ⤬ core* above the title.
- **Music genres**: type a few letters and pick one or more genres. Each one links to its page on the Sound page.
- **Credit**: shown under the poster, e.g. *Artwork: …, Poster design: …*.
- **Lineup**: for each artist, **Duration** (e.g. *75 min*), **Act type** (DJ set, Live, Performance…) and an optional note. They show in the artist's box. Start times go in the **Schedule**.
- **Videos**: paste the link of the video on our PeerTube channel (https://v.basspistol.org/c/uncivilization_channel/videos). YouTube is no longer used.
- **Sound recordings**: a SoundCloud playlist or track recorded at the event. Shown under SOUND RECORDINGS.

### Lists
**Site texts → Lists / Listeler** holds the choices for Activity and Act type. Add a new one there and it becomes available in every event.

### Sound (genres)
- **Sound: Genres** has one entry per music genre: name, supergenres, description (EN/TR) and "see also" links. Each genre gets a page under /sound/genres/ that lists the events, artists and releases tagged with it. A new genre added here can be picked on events, artists and releases right away.
- **Sound: Supergenres** holds the umbrella terms (Bass, Break, Core…), with a letter code and a definition. Event and release **Flavor** picks from these.
- **Artists** and **Releases** have a **Music genres** field too.
- **Site texts → Sound page** has the intro of /sound/, and **Site texts → Descriptors** the word list shown at the bottom of it.
- Renaming a genre: events keep the old name, so change it there too (the site check lists any genre name that doesn't exist).

### Calls
**Calls / Çağrılar** holds open calls (like the compilation call). An open call shows as the orange box on the home page (fill in the *Home box* fields) and has its own page under /calls/. Set the status to **closed** when it's over: the box disappears from the home page and the page stays in the archive.

## TR

### Kolay yol: web editörü
1. **https://uncvl.xyz/admin/** adresine git ve **Sign in with Codeberg** ile giriş yap. `Uncivilization/uncvl.xyz` deposunda yazma yetkin olmalı.
2. **Events / Releases / Artists / Posts** → **New**. Formu doldur, afişi/kapağı yükle.
3. **Save** → değişiklik taslak olur (pull request). Hazır olunca **Ready** → **Publish**.
4. Yaklaşık bir dakika sonra site yeniden oluşturulur. Etkinlikler tarihleri geçince otomatik olarak *geçmiş* listesine taşınır.

### Web editörü olmadan (Codeberg sitesi)
1. `templates/event/index.md` dosyasını `src/events/YYYY-AA-GG-kisa-ad/` klasörüne kopyala.
2. Afişi aynı klasöre yükle.
3. Alanları doldur (`#` sonrasındaki açıklamalar yardımcı olur), yeni bir dala commit'le ve pull request aç.

### İpuçları
- Her dili kendi alanına yaz (`text_en`, `text_tr`). Biri boşsa sayfa diğerini "çeviri gerekiyor" notuyla gösterir.
- `*kelime*` vurgular, boş satır yeni paragraf başlatır.
- Görselin **en büyük** halini yükle. Küçük boyutları site kendisi üretir.
- Editörden yüklediğin görseller ve videolar doğrudan medya depomuza (Cloudflare R2) gider. Anahtar girmen gerekmez, Codeberg girişin kontrol edilir. Görseller otomatik olarak WebP'ye küçültülür.

### Etkinlik alanları
- **Event type / Etkinlik türü**: etkinliği etkinlikler sayfasında gruplar (art, break, bass, punk, synth).
- **Activity / Etkinlik**: ne yapılıyor (dj set, live set, konser, sanat pazarı, sergi, söyleşi…). Listeden seç.
- **Event flavor**: üst türlerden seç (Bass, Break, Core, Punk…), başlığın üstünde *bass ⤬ break ⤬ core* şeklinde görünür.
- **Music genres / Müzik türleri**: birkaç harf yaz ve bir ya da daha fazla tür seç. Her tür, Ses sayfasındaki kendi sayfasına bağlanır.
- **Credit / Emeği geçenler**: afişin altında görünür, örn. *Artwork: …, Poster design: …*.
- **Lineup / Kadro**: her sanatçı için **Duration / Süre** (örn. *75 min*), **Act type / Performans türü** (DJ set, Live, Performance…) ve isteğe bağlı not. Sanatçı kutusunda görünür. Başlangıç saatleri **Schedule / Akış** kısmına yazılır.
- **Videos**: PeerTube kanalımızdaki videonun linkini yapıştır (https://v.basspistol.org/c/uncivilization_channel/videos). YouTube artık kullanılmıyor.
- **Sound recordings / Ses kayıtları**: etkinlikte kaydedilen SoundCloud listesi veya parçası. SES KAYITLARI başlığı altında görünür.

### Listeler
**Site texts → Lists / Listeler**, Activity ve Act type seçeneklerini tutar. Oraya yeni bir seçenek eklersen tüm etkinliklerde seçilebilir olur.

### Ses (türler)
- **Sound: Genres / Ses: Türler** her müzik türü için bir kayıt tutar: ad, üst türler, açıklama (EN/TR) ve "ayrıca bak" linkleri. Her türün /sound/genres/ altında, o türle etiketlenmiş etkinlikleri, sanatçıları ve yayınları listeleyen bir sayfası olur. Buraya eklenen yeni bir tür etkinliklerde, sanatçılarda ve yayınlarda hemen seçilebilir.
- **Sound: Supergenres / Ses: Üst türler** çatı terimleri (Bass, Break, Core…) harf kodu ve tanımıyla tutar. Etkinlik ve yayınlardaki **Flavor** bunlardan seçilir.
- **Artists** ve **Releases** kayıtlarında da **Music genres** alanı var.
- **Site texts → Sound page** /sound/ sayfasının girişini, **Site texts → Descriptors** sayfanın altındaki kelime listesini tutar.
- Bir türün adını değiştirirsen etkinliklerde eski ad kalır, oralarda da değiştir (site kontrolü olmayan tür adlarını listeler).

### Çağrılar
**Calls / Çağrılar** açık çağrıları tutar (derleme çağrısı gibi). Açık bir çağrı anasayfada turuncu kutu olarak görünür (*Home box / Anasayfa kutusu* alanlarını doldur) ve /calls/ altında kendi sayfası olur. Bitince durumu **closed** yap: kutu anasayfadan kalkar, sayfa arşivde kalır.
