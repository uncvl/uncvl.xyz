// uncvl.xyz Worker
//
// Static pages are served by Cloudflare's asset layer and never reach this code (wrangler.jsonc:
// assets.run_worker_first only routes /api/* here), so the site itself stays free and unlimited.
//
// /api/auth/* signs CMS editors in with GitHub (OAuth app; GitHub has no browser-only sign-in, so the
// client secret has to live on a server). It speaks the same popup handshake as sveltia-cms-auth:
//
//   GET    /api/auth?provider=github&scope=…  → redirect to GitHub's consent page
//   GET    /api/auth/callback?code=…&state=…  → swaps the code for a token, hands it to the CMS window
//
// Needs GITHUB_CLIENT_ID (wrangler.jsonc "vars") and GITHUB_CLIENT_SECRET (secret: `wrangler secret put`).
//
// /api/media/* is a tiny S3-compatible endpoint for the CMS (Sveltia "aws_s3" media library),
// backed by the R2 bucket binding MEDIA. There are no R2 keys anywhere: access is granted to
// whoever is signed in to the CMS with a GitHub account that can PUSH to the site's repository.
//
//   POST   /api/media/session            Authorization: token <github token> → sets session cookie
//   DELETE /api/media/session            clears it
//   GET    /api/media/s3/<bucket>?list-type=2&prefix=…&delimiter=…&continuation-token=…
//   PUT    /api/media/s3/<bucket>/<key>  upload (or copy, with x-amz-copy-source)
//   DELETE /api/media/s3/<bucket>/<key>
//
// Writes and deletes are limited to keys under uploads/, to image/video types, and to MAX_BYTES.

const GITHUB_API = "https://api.github.com";
const GITHUB_WEB = "https://github.com";
const REPO = "uncvl/uncvl.xyz";
// OAuth scopes the CMS may ask for. public_repo is enough for this public repository (config.yml auth_scope).
const ALLOWED_SCOPES = ["public_repo", "repo", "read:user", "user:email"];
const STATE_COOKIE = "uncvl_oauth_state";
const BUCKET = "uncvl-media";
const WRITE_PREFIX = "uploads/";
const MAX_BYTES = 50 * 1024 * 1024;
const COOKIE = "uncvl_cms";
const COOKIE_PATH = "/api/media";
const COOKIE_MAX_AGE = 12 * 60 * 60; // the CMS script refreshes it while the editor works
const AUTH_CACHE_SECONDS = 300; // GitHub permission answers are cached this long
const ALLOWED_TYPES = /^(image\/(jpeg|png|webp|avif|gif|svg\+xml)|video\/(mp4|webm)|application\/x-directory)$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/auth" || url.pathname === "/api/auth/callback") {
      try {
        return await handleAuth(request, env, url);
      } catch (err) {
        console.error("auth endpoint error", err && err.stack ? err.stack : err);
        return authResult(url, { error: "Sign-in failed on the server", errorCode: "SERVER_ERROR" });
      }
    }
    if (!url.pathname.startsWith("/api/media/")) {
      // Only /api/* is routed here; anything else falls back to the static site.
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
    }
    try {
      return await handleMedia(request, env, ctx, url);
    } catch (err) {
      console.error("media endpoint error", err && err.stack ? err.stack : err);
      return s3Error(500, "InternalError", "Internal error");
    }
  },
};

async function handleMedia(request, env, ctx, url) {
  const apiBase = env.GITHUB_API || GITHUB_API; // overridable for local tests only

  // Never answer cross-site requests: no CORS headers are sent, and same-origin is required.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return s3Error(403, "AccessDenied", "Cross-site request");

  if (url.pathname === "/api/media/session") {
    if (request.method === "POST") return createSession(request, ctx, apiBase);
    if (request.method === "DELETE") return new Response(null, { status: 204, headers: { "set-cookie": cookie("", 0) } });
    return new Response("Method not allowed", { status: 405 });
  }

  if (!url.pathname.startsWith("/api/media/s3/")) return s3Error(404, "NoSuchKey", "Not found");

  // ---- S3 subset ----
  const token = readCookie(request.headers.get("cookie"), COOKIE);
  if (!token) return s3Error(403, "AccessDenied", "No CMS session yet: reload the CMS after signing in with GitHub");
  const access = await checkAccess(token, ctx, apiBase);
  if (access.unavailable) return s3Error(503, "SlowDown", `GitHub API unavailable (HTTP ${access.status}), try again in a moment`);
  const who = access.login;
  if (!who) return s3Error(403, "AccessDenied", "This GitHub account can't write to " + REPO);

  const rest = url.pathname.slice("/api/media/s3/".length);
  const slash = rest.indexOf("/");
  const bucket = decodeURIComponent(slash === -1 ? rest : rest.slice(0, slash));
  if (bucket !== BUCKET) return s3Error(404, "NoSuchBucket", "Unknown bucket");
  const key = slash === -1 ? "" : decodeKey(rest.slice(slash + 1));
  if (key === null) return s3Error(400, "InvalidArgument", "Invalid key");

  if (request.method === "GET" && !key && url.searchParams.get("list-type") === "2") {
    return listObjects(env, url.searchParams);
  }
  if (request.method === "PUT" && key) {
    if (!key.startsWith(WRITE_PREFIX)) return s3Error(403, "AccessDenied", "Uploads go to " + WRITE_PREFIX);
    const copySource = request.headers.get("x-amz-copy-source");
    if (copySource) return copyObject(env, copySource, key, who);
    return putObject(request, env, key, who);
  }
  if (request.method === "DELETE" && key) {
    if (!key.startsWith(WRITE_PREFIX)) return s3Error(403, "AccessDenied", "Only files in " + WRITE_PREFIX + " can be deleted");
    await env.MEDIA.delete(key);
    console.log(`delete ${key} by ${who}`);
    return new Response(null, { status: 204 });
  }
  return s3Error(405, "MethodNotAllowed", "Not supported");
}

// ---------------------------------------------------------------- auth
async function createSession(request, ctx, apiBase) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^(token|bearer)\s+/i, "").trim();
  // GitHub tokens are ~40–100 chars; anything up to 4 KB still fits in a cookie.
  if (!token) return json({ ok: false, error: "missing token" }, 400);
  if (token.length > 4000 || !/^[\x21-\x7e]+$/.test(token)) return json({ ok: false, error: "malformed token" }, 400);
  const access = await checkAccess(token, ctx, apiBase);
  if (access.unavailable) {
    // GitHub didn't give a real answer (rate limit, outage): that's not a "no", so keep any existing session.
    return json({ ok: false, error: "github_unavailable", github_status: access.status }, 503, { "retry-after": "30" });
  }
  if (!access.login) return json({ ok: false, error: "no write access to " + REPO, github_status: access.status }, 403, { "set-cookie": cookie("", 0) });
  return json({ ok: true, user: access.login }, 200, { "set-cookie": cookie(token, COOKIE_MAX_AGE) });
}

// Asks GitHub whether the token can push to REPO. Returns { login } (allowed), { login: null } (definitely
// not), or { unavailable: true, status } when GitHub gave no real answer (rate limit, 5xx, network error).
// Only real answers are cached (per token hash), so a GitHub hiccup never locks anyone out.
async function checkAccess(token, ctx, apiBase) {
  const hash = await sha256hex(token);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`https://auth-cache.invalid/${hash}`);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const v = await hit.json();
      return { login: v.login || null, status: "cached" };
    }
  }
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "uncvl.xyz-media",
  };
  // GitHub also answers 403/429 when rate-limited; that is "no answer", not "no access".
  const definite = (res) => [200, 401, 403, 404].includes(res.status) && res.headers.get("x-ratelimit-remaining") !== "0";
  let login = null;
  let repoRes;
  try {
    repoRes = await fetch(`${apiBase}/repos/${REPO}`, { headers });
  } catch (err) {
    console.warn("github access check failed:", String(err));
    return { unavailable: true, status: 0 };
  }
  if (!definite(repoRes)) {
    console.warn(`github answered ${repoRes.status} to the access check`);
    return { unavailable: true, status: repoRes.status };
  }
  if (repoRes.ok) {
    const repo = await repoRes.json();
    if (repo && repo.permissions && (repo.permissions.push || repo.permissions.maintain || repo.permissions.admin)) {
      const userRes = await fetch(`${apiBase}/user`, { headers });
      if (!definite(userRes)) return { unavailable: true, status: userRes.status };
      if (userRes.ok) login = (await userRes.json()).login || "unknown";
    }
  }
  if (cache) {
    const res = new Response(JSON.stringify({ login }), {
      headers: { "content-type": "application/json", "cache-control": `max-age=${login ? AUTH_CACHE_SECONDS : 30}` },
    });
    ctx.waitUntil(cache.put(cacheKey, res));
  }
  return { login, status: repoRes.status };
}

// ---------------------------------------------------------------- GitHub sign-in for the CMS
async function handleAuth(request, env, url) {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return authResult(url, { error: "GitHub sign-in isn't set up on the server yet (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)", errorCode: "MISCONFIGURED_CLIENT" });
  }
  const redirectUri = `${url.origin}/api/auth/callback`;

  if (url.pathname === "/api/auth") {
    const provider = url.searchParams.get("provider");
    if (provider && provider !== "github") return authResult(url, { error: "Only GitHub sign-in is supported", errorCode: "UNSUPPORTED_BACKEND" });
    const asked = (url.searchParams.get("scope") || "").split(/[\s,]+/).filter((x) => ALLOWED_SCOPES.includes(x));
    const scope = asked.length ? [...new Set(asked)].join(",") : "public_repo";
    const state = randomHex(16);
    const target = new URL(`${GITHUB_WEB}/login/oauth/authorize`);
    target.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope, state, allow_signup: "false" });
    return new Response(null, {
      status: 302,
      headers: { location: target.toString(), "set-cookie": stateCookie(state, 600), "cache-control": "no-store" },
    });
  }

  // /api/auth/callback
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = readCookie(request.headers.get("cookie"), STATE_COOKIE);
  if (url.searchParams.get("error")) {
    return authResult(url, { error: url.searchParams.get("error_description") || url.searchParams.get("error"), errorCode: "AUTH_CODE_REQUEST_FAILED" });
  }
  if (!code || !state) return authResult(url, { error: "GitHub didn't return a sign-in code", errorCode: "AUTH_CODE_REQUEST_FAILED" });
  if (!expected || !timingSafeEqual(expected, state)) {
    return authResult(url, { error: "Sign-in expired or came from another window. Please try again.", errorCode: "CSRF_DETECTED" });
  }
  let body;
  try {
    const res = await fetch(`${GITHUB_WEB}/login/oauth/access_token`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "uncvl.xyz-auth" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    });
    body = await res.json();
  } catch (err) {
    console.warn("github token exchange failed:", String(err));
    return authResult(url, { error: "Couldn't reach GitHub. Please try again.", errorCode: "TOKEN_REQUEST_FAILED" });
  }
  if (!body || !body.access_token) {
    return authResult(url, { error: (body && (body.error_description || body.error)) || "GitHub returned no token", errorCode: "TOKEN_REQUEST_FAILED" });
  }
  return authResult(url, { token: body.access_token });
}

// The popup page GitHub sends the editor back to. Same handshake as sveltia-cms-auth: announce
// "authorizing:github" to the CMS window, wait for it to answer, then post the result back to it.
// The result only ever goes to a window on this site's own origin.
function authResult(url, { token, error, errorCode }) {
  const content = token ? { provider: "github", token } : { provider: "github", error, errorCode };
  const message = `authorization:github:${token ? "success" : "error"}:${JSON.stringify(content)}`;
  const nonce = randomHex(16);
  const script =
    `(function(){var m=${JSON.stringify(message).replace(/</g, "\\u003c")};` +
    `window.addEventListener("message",function(e){if(e.data!=="authorizing:github"||e.origin!==location.origin)return;` +
    `window.opener&&window.opener.postMessage(m,e.origin);setTimeout(function(){window.close()},500)});` +
    `window.opener?window.opener.postMessage("authorizing:github",location.origin):document.getElementById("msg").textContent="Open the CMS at /admin/ and sign in from there.";})();`;
  const text = token ? "Signed in. You can close this window." : `Sign-in failed: ${error}`;
  const html =
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>uncvl · sign in</title>` +
    `<body style="background:#111;color:#ddd;font:16px/1.5 monospace;padding:2rem"><p id="msg">${xml(text)}</p>` +
    `<script nonce="${nonce}">${script}</script></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": stateCookie("", 0),
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

function stateCookie(value, maxAge) {
  // SameSite=Lax: the callback is a top-level navigation coming back from github.com.
  return `${STATE_COOKIE}=${value}; Path=/api/auth; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function cookie(value, maxAge) {
  return `${COOKIE}=${encodeURIComponent(value)}; Path=${COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}
function readCookie(header, name) {
  for (const part of (header || "").split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1)) || null;
  }
  return null;
}

// ---------------------------------------------------------------- S3 operations
async function listObjects(env, params) {
  const prefix = params.get("prefix") || "";
  const delimiter = params.get("delimiter") || undefined;
  const cursor = params.get("continuation-token") || undefined;
  const maxKeys = Math.min(Number(params.get("max-keys")) || 1000, 1000);
  const res = await env.MEDIA.list({ prefix, delimiter, cursor, limit: maxKeys });
  const contents = res.objects
    .map(
      (o) =>
        `<Contents><Key>${xml(o.key)}</Key><LastModified>${o.uploaded.toISOString()}</LastModified>` +
        `<ETag>"${xml(o.etag)}"</ETag><Size>${o.size}</Size><StorageClass>STANDARD</StorageClass></Contents>`
    )
    .join("");
  const prefixes = (res.delimitedPrefixes || []).map((p) => `<CommonPrefixes><Prefix>${xml(p)}</Prefix></CommonPrefixes>`).join("");
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">` +
    `<Name>${BUCKET}</Name><Prefix>${xml(prefix)}</Prefix><KeyCount>${res.objects.length}</KeyCount>` +
    `<MaxKeys>${maxKeys}</MaxKeys>${delimiter ? `<Delimiter>${xml(delimiter)}</Delimiter>` : ""}` +
    `<IsTruncated>${res.truncated ? "true" : "false"}</IsTruncated>` +
    (res.truncated ? `<NextContinuationToken>${xml(res.cursor)}</NextContinuationToken>` : "") +
    contents +
    prefixes +
    `</ListBucketResult>`;
  return new Response(body, { headers: { "content-type": "application/xml", "cache-control": "no-store" } });
}

async function putObject(request, env, key, who) {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.test(type)) return s3Error(415, "InvalidArgument", `File type not allowed: ${type || "unknown"}`);
  if (type === "application/x-directory") return new Response(null, { status: 200 }); // R2 has no folders
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BYTES) return s3Error(413, "EntityTooLarge", `Max ${MAX_BYTES / 1048576} MB`);
  const body = await request.arrayBuffer(); // also covers requests without content-length
  if (body.byteLength > MAX_BYTES) return s3Error(413, "EntityTooLarge", `Max ${MAX_BYTES / 1048576} MB`);
  if (body.byteLength === 0) return s3Error(400, "InvalidArgument", "Empty file");
  const obj = await env.MEDIA.put(key, body, {
    httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { uploadedBy: who, uploadedVia: "cms" },
  });
  console.log(`put ${key} (${body.byteLength} B) by ${who}`);
  return new Response(null, { status: 200, headers: { etag: `"${obj.etag}"` } });
}

async function copyObject(env, copySource, key, who) {
  let src = decodeURIComponent(copySource.split("?")[0]).replace(/^\/+/, "");
  if (!src.startsWith(BUCKET + "/")) return s3Error(400, "InvalidArgument", "Copy source must be in " + BUCKET);
  src = src.slice(BUCKET.length + 1);
  if (src.split("/").some((s) => s === ".." || s === ".")) return s3Error(400, "InvalidArgument", "Invalid copy source");
  const from = await env.MEDIA.get(src);
  if (!from) return s3Error(404, "NoSuchKey", "Copy source not found");
  const obj = await env.MEDIA.put(key, from.body, {
    httpMetadata: from.httpMetadata,
    customMetadata: { ...(from.customMetadata || {}), copiedBy: who },
  });
  console.log(`copy ${src} -> ${key} by ${who}`);
  const body =
    `<?xml version="1.0" encoding="UTF-8"?><CopyObjectResult>` +
    `<LastModified>${new Date().toISOString()}</LastModified><ETag>"${xml(obj.etag)}"</ETag></CopyObjectResult>`;
  return new Response(body, { headers: { "content-type": "application/xml" } });
}

// ---------------------------------------------------------------- helpers
function decodeKey(raw) {
  let key;
  try {
    key = raw.split("/").map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
  if (!key || key.length > 512 || key.startsWith("/") || key.split("/").some((s) => s === ".." || s === ".")) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(key)) return null;
  return key;
}
function xml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function s3Error(status, code, message) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${xml(message)}</Message></Error>`,
    { status, headers: { "content-type": "application/xml", "cache-control": "no-store" } }
  );
}
function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
}
async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
