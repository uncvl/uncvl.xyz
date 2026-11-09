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
- `codename` is the computer-science name of the night (e.g. *break protocol*, *zero day exploit*).

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
