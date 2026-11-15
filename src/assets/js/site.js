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

  // ---- click-to-load embeds: nothing loads from PeerTube / SoundCloud / Bandcamp before a click ----
  document.addEventListener("click", function (ev) {
    // .embed-facade covers PeerTube videos and SoundCloud / Bandcamp players
    var a = ev.target.closest(".embed-facade[data-embed]");
    if (!a) return;
    ev.preventDefault();
    var f = document.createElement("iframe");
    f.src = a.dataset.embed;
    f.title = a.dataset.title || "player";
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    f.referrerPolicy = "strict-origin-when-cross-origin";
    if (a.dataset.height) f.height = a.dataset.height; // attribute, not inline style (CSP)
    if (a.dataset.sandbox) f.setAttribute("sandbox", a.dataset.sandbox); // PeerTube: as in its own embed code
    f.className = "embed-frame";
    a.replaceWith(f);
  });
})();

// Logo puppet: the guy in the logomark (src/_includes/logo-puppet.njk) is a marionette. His body (torso
// and arms) swings around his chest while the strings stay put, so his hands slide along them; the head
// and legs flop on their own springs, lagging behind the body like a ragdoll.
// Moving the pointer across him pushes the part under it the way the pointer moves. Nothing runs until
// he is touched, and the loop stops once he is still. Off for people who ask for reduced motion.
(function () {
  if (!window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // joints, in the logo's own coordinates (viewBox 0 0 762 931)
  var J = { body: [381, 420], head: [381, 380], legL: [326, 635], legR: [436, 635] };
  // legs swing by skewing from the crotch line (y = J.legL[1]): that line stays put, so no gap opens at the hips
  // springs: stiffness, damping (per 60 fps frame), limit (degrees), how hard the body's swing throws it
  var S = {
    body: { k: 0.012, d: 0.045, max: 7, throw: 0 },
    head: { k: 0.035, d: 0.09, max: 10, throw: 1.2 },
    legL: { k: 0.022, d: 0.05, max: 12, throw: 2.0 },
    legR: { k: 0.019, d: 0.045, max: 12, throw: 2.4 },
  };
  var NAMES = { body: "body", head: "head", legL: "leg-l", legR: "leg-r" };
  document.querySelectorAll(".logo--puppet").forEach(function (svg) {
    var el = {}, st = {};
    Object.keys(NAMES).forEach(function (n) {
      el[n] = svg.querySelector('[data-part="' + NAMES[n] + '"]');
      st[n] = { a: 0, v: 0 };
    });
    if (!el.body) return;
    var raf = 0, lastT = 0, lastX = null;

    function spring(n, k, extra) {
      var p = st[n], s = S[n];
      p.v += (-s.k * p.a + extra) * k;
      p.v *= Math.pow(1 - s.d, k);
      p.a = Math.max(-s.max, Math.min(s.max, p.a + p.v * k));
      return Math.abs(p.a) > 0.02 || Math.abs(p.v) > 0.004;
    }
    function frame(t) {
      var k = Math.min((t - (lastT || t)) / 16.667 || 1, 3); // frames since the last tick, so 120 Hz isn't faster
      lastT = t;
      // body first; its angular acceleration throws the head and legs the other way (they lag behind)
      var before = st.body.v;
      var moving = spring("body", k, 0);
      var accel = st.body.v - before;
      ["head", "legL", "legR"].forEach(function (n) {
        if (spring(n, k, -accel * S[n].throw)) moving = true;
      });
      Object.keys(NAMES).forEach(function (n) {
        if (!el[n]) return;
        var a = moving ? st[n].a : 0;
        if (Math.abs(a) < 0.01) el[n].removeAttribute("transform");
        else if (n === "legL" || n === "legR") el[n].setAttribute("transform", "translate(0 " + J[n][1] + ") skewX(" + (-a).toFixed(3) + ") translate(0 " + -J[n][1] + ")");
        else el[n].setAttribute("transform", "rotate(" + a.toFixed(3) + " " + J[n][0] + " " + J[n][1] + ")");
      });
      if (!moving) {
        Object.keys(st).forEach(function (n) { st[n].a = st[n].v = 0; });
        raf = 0;
        lastT = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    // where the pointer is, in logo coordinates, decides which part gets pushed
    function push(e, dx) {
      var r = svg.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width) * 762, y = ((e.clientY - r.top) / r.height) * 931.333;
      var v = -dx; // a pointer moving right drags the body below the joint right: a negative angle
      if (y < J.head[1]) st.head.v += v * 0.8;
      else if (y > J.legL[1]) st[x < 381 ? "legL" : "legR"].v += v * 1.2;
      st.body.v = Math.max(-1, Math.min(1, st.body.v + v * (y > J.legL[1] ? 0.2 : 0.4)));
      if (!raf) raf = requestAnimationFrame(frame);
    }
    svg.addEventListener("pointerenter", function (e) {
      lastX = e.clientX;
      push(e, e.movementX ? Math.sign(e.movementX) * 0.5 : (Math.random() < 0.5 ? -0.5 : 0.5));
    });
    svg.addEventListener("pointermove", function (e) {
      if (lastX !== null) push(e, Math.max(-0.25, Math.min(0.25, (e.clientX - lastX) * 0.02)));
      lastX = e.clientX;
    });
    svg.addEventListener("pointerleave", function () { lastX = null; });
  });
})();
