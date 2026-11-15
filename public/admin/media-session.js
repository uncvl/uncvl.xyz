// Connects the CMS's GitHub login to the media upload endpoint (/api/media, see worker/index.js).
//
// Sveltia's S3 media library wants an access key; ours is not a real secret. The endpoint ignores it
// and instead checks the editor's GitHub login, which this script hands over as an HttpOnly cookie.
// Editors never have to paste a key.
(function () {
  var PLACEHOLDER = "codebergLoginIsTheKeyNoSecretIsStoredHere0000"; // matches Sveltia's key format check
  var REFRESH_MS = 6 * 60 * 60 * 1000; // re-confirm a working session every 6 h (cookie lives 12 h)
  var RETRY_MS = 30 * 1000; // after a failure (e.g. GitHub rate-limiting), try again this often

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

  // 2. Keep a media session for whoever is signed in.
  var state = { token: null, ok: false, at: 0, busy: false };
  function sync() {
    var user = read("sveltia-cms.user");
    var token = user && user.token;
    if (!token) {
      if (state.token) fetch("/api/media/session", { method: "DELETE", credentials: "same-origin" });
      state = { token: null, ok: false, at: 0, busy: false };
      return;
    }
    if (state.busy) return;
    var age = Date.now() - state.at;
    var due = token !== state.token || (state.ok ? age > REFRESH_MS : age > RETRY_MS);
    if (!due) return;
    state = { token: token, ok: false, at: Date.now(), busy: true };
    fetch("/api/media/session", { method: "POST", credentials: "same-origin", headers: { Authorization: "token " + token } })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          state.ok = r.ok;
          if (r.ok) console.info("[uncvl] media uploads ready (" + body.user + ")");
          else if (r.status === 503) console.warn("[uncvl] media uploads: GitHub API unavailable (HTTP " + body.github_status + "), retrying in 30 s");
          else if (r.status === 403) console.warn("[uncvl] media uploads unavailable: this GitHub account can't write to the repository");
          else console.warn("[uncvl] media uploads: session failed (HTTP " + r.status + ": " + (body.error || "unknown") + "), retrying in 30 s");
        });
      })
      .catch(function () { state.ok = false; })
      .then(function () { state.busy = false; });
  }

  sync();
  setInterval(sync, 5000); // cheap local check; network only when a (re)try is due
  window.addEventListener("storage", sync);
})();
