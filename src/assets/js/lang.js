// Runs before first paint: pick EN/TR so only one language block is shown (no flash).
// Without JS both languages stay visible.
(function () {
  var lang = "en";
  try {
    var saved = localStorage.getItem("uncvl-lang");
    if (saved === "en" || saved === "tr") lang = saved;
    else if ((navigator.language || "").toLowerCase().indexOf("tr") === 0) lang = "tr";
  } catch (e) {}
  document.documentElement.setAttribute("data-lang", lang);
})();
