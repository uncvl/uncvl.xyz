// Connects the CMS's Codeberg login to the media upload endpoint (/api/media, see worker/index.js).
//
// Sveltia's S3 media library wants an access key; ours is not a real secret. The endpoint ignores it
// and instead checks the editor's Codeberg login, which this script hands over as an HttpOnly cookie.
// Editors never have to paste a key.
(function () {
  var PLACEHOLDER = "codebergLoginIsTheKeyNoSecretIsStoredHere0000"; // matches Sveltia's key format check
  var REFRESH_MS = 6 * 60 * 60 * 1000; // re-confirm the session every 6 h (cookie lives 12 h)

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }

  // 1. Pre-fill the S3 "secret access key" so Sveltia never asks for one.
  try {
    var prefs = read("sveltia-cms.prefs") || {};
    prefs.apiKeys = prefs.apiKeys || {};
    if (prefs.apiKeys.aws_s3 !== PLACEHOLDER) {
      prefs.apiKeys.aws_s3 = PLACEHOLDER;
      localStorage.setItem("sveltia-cms.prefs", JSON.stringify(prefs));
    }
  } catch (e) {}

  // 2. Whenever the signed-in Codeberg token is new (or the session is getting old), register it.
  var lastToken = null;
  var lastSync = 0;
  function sync() {
    var user = read("sveltia-cms.user");
    var token = user && user.token;
    if (!token) {
      if (lastToken) fetch("/api/media/session", { method: "DELETE", credentials: "same-origin" });
      lastToken = null;
      return;
    }
    if (token === lastToken && Date.now() - lastSync < REFRESH_MS) return;
    lastToken = token;
    lastSync = Date.now();
    fetch("/api/media/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { Authorization: "token " + token },
    })
      .then(function (r) {
        if (!r.ok) console.warn("[uncvl] media uploads unavailable: this Codeberg account can't write to the repository");
      })
      .catch(function () { lastToken = null; });
  }

  sync();
  setInterval(sync, 5000); // picks up sign-in, sign-out and Sveltia's token refreshes
  window.addEventListener("storage", sync);
})();
