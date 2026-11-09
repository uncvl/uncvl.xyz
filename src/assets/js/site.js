// Progressive enhancements only. The site works without this file.
(function () {
  var root = document.documentElement;

  // ---- EN | TR switch ----
  var sw = document.querySelector(".lang-switch");
  function apply(lang) {
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang);
    if (!sw) return;
    sw.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.setLang === lang));
    });
  }
  if (sw) {
    sw.hidden = false;
    apply(root.getAttribute("data-lang") || "en");
    sw.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-set-lang]");
      if (!b) return;
      apply(b.dataset.setLang);
      try { localStorage.setItem("uncvl-lang", b.dataset.setLang); } catch (e) {}
    });
  }

  // ---- click-to-load video (youtube-nocookie only after an explicit click) ----
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest(".video__facade[data-embed]");
    if (!a) return;
    ev.preventDefault();
    var f = document.createElement("iframe");
    f.src = a.dataset.embed;
    f.title = a.dataset.title || "video";
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    f.referrerPolicy = "strict-origin-when-cross-origin";
    f.loading = "lazy";
    a.replaceWith(f);
  });
})();
