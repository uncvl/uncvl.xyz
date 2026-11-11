// LAB (local experiment, branch lab/scroll-momentum): letters that lag behind fast scrolling.
//
// How it works
//  - Each text block is split into styled runs (one per text node: its own font, colour, letter
//    spacing, text-shadow) and laid out with Pretext's rich-inline layout, so we know every
//    letter's line and its x inside the line without asking the DOM per frame.
//  - Every run is then pinned to where the browser really drew it (one Range rect per run), so the
//    canvas letters sit exactly on top of the real ones: no jump when the effect starts or stops.
//  - Each letter is a small spring. When the page jumps by dy, the letter is left behind by dy and
//    springs back. "glitch shatter": the middle of each line lags most (glitch) mixed with a random
//    spring per letter (shatter); offsets move in hard pixel steps with an RGB split and jitter.
//    The "shatter" slider sets the mix: 0 = clean middle-lag, 1 = every letter on its own.
//  - While letters are moving, the real text is made transparent (still there for selection and
//    screen readers); once everything has settled, the canvas clears and the real text is back.
import { prepareRichInline, walkRichInlineLineRanges, materializeRichInlineLineRange } from "/assets/js/vendor/pretext/rich-inline.js";

// Every visible text on the page takes part, except what doesn't scroll with the page (the sticky
// header, the switcher) or isn't really shown (screen-reader-only text, the skip link, form fields).
const SKIP = ".site-header, .fx-ui, .sr-only, .skip, script, style, noscript, template, textarea, input, select, svg, canvas, iframe, video";
// a text belongs to its nearest ancestor that isn't an inline element: that box is one "block"
const isInline = (d) => d === "inline" || d === "contents";

// k = spring stiffness (line edges → middle; kRand for the random per-letter springs), d = damping,
// max = largest offset (px), threshold = scroll speed (px/frame) below which nothing happens,
// step = offsets snap to this many px, jitter = sideways shake, random = spread of the random lag.
const MODES = {
  off: null,
  glitch: { kEdge: 0.2, kMid: 0.05, kRand: 0.09, d: 0.26, max: 130, threshold: 11, step: 4, jitter: 0.06, random: 0.85 },
};
const LABELS = { off: "off", glitch: "glitch shatter" };

const store = {
  get(k, d) { try { return localStorage.getItem("uncvl-fx-" + k) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("uncvl-fx-" + k, v); } catch (e) {} },
};
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let mode = store.get("mode", "glitch");
if (!(mode in MODES)) mode = "glitch";
let strength = Number(store.get("strength", "1"));
let shatter = Number(store.get("shatter", "0.5")); // 0 = clean middle-lag (glitch), 1 = random per letter (shatter)
const variation = 0.7; // small per-line differences in the middle-lag

// ---------- canvas ----------
const canvas = document.createElement("canvas");
canvas.className = "fx-canvas";
canvas.setAttribute("aria-hidden", "true");
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d");
let dpr = 1, viewW = 0, viewH = 0;
// The canvas covers the visible area without the scrollbar. Its drawing size must equal its shown
// size exactly, or the letters get squeezed and drift away from the real text.
function sizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = document.documentElement.clientWidth;
  viewH = document.documentElement.clientHeight;
  canvas.style.width = viewW + "px";
  canvas.style.height = viewH + "px";
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
}

// ---------- measuring helpers ----------
const px = (v) => parseFloat(v) || 0;
const widthCache = new Map();
function charWidth(font, ch) {
  const key = font + "\u0000" + ch;
  let w = widthCache.get(key);
  if (w === undefined) { ctx.font = font; w = ctx.measureText(ch).width; widthCache.set(key, w); }
  return w;
}
const ascentCache = new Map();
function ascent(font) {
  let a = ascentCache.get(font);
  if (a === undefined) { ctx.font = font; const m = ctx.measureText("Hg"); a = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent; ascentCache.set(font, a); }
  return a;
}
// "rgb(255, 61, 127) 2px 0px 0px, rgb(51, 224, 255) -2px 0px 0px" → [{color, x, y}]
function parseShadows(s) {
  if (!s || s === "none") return [];
  return s.split(/,(?![^(]*\))/).map((part) => {
    const color = (part.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8}|[a-z]+)/i) || ["transparent"])[0];
    const nums = (part.replace(color, "").match(/-?[\d.]+px/g) || []).map(px);
    return { color, x: nums[0] || 0, y: nums[1] || 0 };
  });
}
// box of one character in the page (document coordinates)
function charBox(node, i) {
  const r = document.createRange();
  r.setStart(node, i);
  r.setEnd(node, Math.min(i + 1, node.length));
  const rect = r.getClientRects()[0] || r.getBoundingClientRect();
  return { left: rect.left + scrollX, top: rect.top + scrollY, h: rect.height };
}

// Visible text of an element as styled runs, split into paragraphs at <br>.
// text-decoration isn't inherited but is drawn on the text of descendants: look up to the block
function underlined(from, block, cs) {
  for (let e = from; e; e = e.parentElement) {
    const line = (e === from ? cs : getComputedStyle(e)).textDecorationLine;
    if (line && line.includes("underline")) return true;
    if (e === block) break;
  }
  return false;
}

function runsOf(el) {
  const paras = [[]];
  const styleOf = new Map();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n.nodeType === 1) {
        if (n.tagName === "BR") return NodeFilter.FILTER_ACCEPT;
        if (n.matches(SKIP)) return NodeFilter.FILTER_REJECT;
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden") return NodeFilter.FILTER_REJECT;
        return isInline(cs.display) ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_REJECT; // own block
      }
      return n.data.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 1) { paras.push([]); continue; }
    const parent = n.parentElement;
    let st = styleOf.get(parent);
    if (!st) {
      const cs = getComputedStyle(parent);
      st = {
        font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
        color: cs.color,
        letterSpacing: cs.letterSpacing === "normal" ? 0 : px(cs.letterSpacing),
        shadows: parseShadows(cs.textShadow),
        transform: cs.textTransform,
        underline: underlined(parent, el, cs),
        size: px(cs.fontSize),
      };
      styleOf.set(parent, st);
    }
    let text = n.data;
    if (st.transform === "uppercase") text = text.toUpperCase();
    else if (st.transform === "lowercase") text = text.toLowerCase();
    paras[paras.length - 1].push({ node: n, text, st });
  }
  return paras.filter((p) => p.some((r) => r.text.trim()));
}

// source index in a run for each character of a fragment (collapsed whitespace = one space)
function sourceIndices(text, from, fragText) {
  const out = [];
  let s = from;
  for (const ch of fragText) {
    if (/\s/.test(ch)) { out.push(s); while (s < text.length && /\s/.test(text[s])) s++; }
    else { while (s < text.length && /\s/.test(text[s])) s++; out.push(s); s += ch.length; }
  }
  return out;
}

// ---------- layout of every text block (only on load / resize / language switch) ----------
let blocks = [];
function measureBlocks() {
  const containers = new Set();
  const display = new Map();
  const disp = (el) => { let d = display.get(el); if (d === undefined) { d = getComputedStyle(el).display; display.set(el, d); } return d; };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    if (!t.data.trim() || !t.parentElement || t.parentElement.closest(SKIP)) continue;
    let box = t.parentElement;
    while (box && box !== document.body && isInline(disp(box))) box = box.parentElement;
    if (box) containers.add(box);
  }
  const els = [...containers].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2 && disp(el) !== "none"; // skips collapsed boxes (e.g. hidden small print)
  });
  blocks = [];
  for (const el of els) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const width = rect.width - px(cs.borderLeftWidth) - px(cs.borderRightWidth) - px(cs.paddingLeft) - px(cs.paddingRight);
    if (width < 4) continue;
    const chars = [];
    for (const runs of runsOf(el)) {
      let prepared;
      try { prepared = prepareRichInline(runs.map((r) => ({ text: r.text, font: r.st.font, letterSpacing: r.st.letterSpacing || undefined }))); }
      catch (e) { continue; }
      const lines = [];
      walkRichInlineLineRanges(prepared, Math.max(1, width + 0.5), (range) => lines.push(materializeRichInlineLineRange(prepared, range)));
      for (const line of lines) {
        // every line gets its own small random character (see the spring below)
        const L = { peak: Math.random(), sharp: Math.random(), k: Math.random(), gain: Math.random(), delay: Math.random() };
        const lineChars = [];
        for (const frag of line.fragments) {
          const run = runs[frag.itemIndex];
          if (!run || !frag.text) continue;
          const src = sourceIndices(run.text, frag.sourceStart, frag.text);
          const glyphs = [...frag.text];
          // pin the fragment to where the browser drew it; if the browser wrapped it differently
          // (first and last letter on different rows), pin every letter instead
          const first = charBox(run.node, src[0]);
          const last = charBox(run.node, src[glyphs.length - 1]);
          const perLetter = Math.abs(first.top - last.top) > 1;
          // advances from Pretext-style measuring, stretched so the first and last letter land
          // exactly where the browser put them (no drift along long lines)
          const adv = [0];
          glyphs.forEach((ch) => adv.push(adv[adv.length - 1] + charWidth(run.st.font, ch) + run.st.letterSpacing));
          const n = glyphs.length - 1;
          const scale = !perLetter && n > 0 && adv[n] > 0 ? (last.left - first.left) / adv[n] : 1;
          glyphs.forEach((ch, i) => {
            const box = perLetter ? charBox(run.node, src[i]) : null;
            const gx = box ? box.left : first.left + adv[i] * scale;
            const top = box ? box.top : first.top;
            // spaces only matter for underlines (the line runs under them too)
            if (ch.trim() || run.st.underline) lineChars.push({ ch, x: gx, y: top + ascent(run.st.font), st: run.st });
          });
        }
        if (!lineChars.length) continue;
        const x0 = Math.min(...lineChars.map((c) => c.x));
        const x1 = Math.max(...lineChars.map((c) => c.x + charWidth(c.st.font, c.ch)));
        const lw = Math.max(1, x1 - x0);
        for (const c of lineChars) {
          c.m = (c.x + charWidth(c.st.font, c.ch) / 2 - x0) / lw; // 0 = start of the line, 1 = end
          c.L = L; c.n = Math.random(); c.r = Math.random(); c.off = 0; c.vel = 0;
          chars.push(c);
        }
      }
    }
    if (!chars.length) continue;
    const top = Math.min(...chars.map((c) => c.y)) - 60, bottom = Math.max(...chars.map((c) => c.y)) + 20;
    blocks.push({ el, top, height: bottom - top, chars });
    el.classList.add("fx-t");
  }
}

// ---------- animation ----------
let lastY = scrollY, moving = false, raf = 0;
const injects = [];
const accent = { a: "#ff3d7f", b: "#33e0ff" };

function frame() {
  raf = 0;
  const p = MODES[mode];
  if (!p || reduced.matches) return settle();
  const dy = scrollY - lastY;
  lastY = scrollY;
  const inject = Math.sign(dy) * Math.max(0, Math.abs(dy) - p.threshold) * strength;
  injects.unshift(inject); if (injects.length > 8) injects.pop(); // recent pushes, for lines that start late
  const v = variation;
  const viewTop = scrollY - 200, viewBottom = scrollY + innerHeight + 200;
  let energy = 0;
  for (const b of blocks) {
    if (b.top + b.height < viewTop || b.top > viewBottom) { if (b.hot) reset(b); continue; }
    for (const c of b.chars) {
      // spring per letter: softer in the middle of the line, so the middle arrives last. Each line
      // only nudges that a little (variation slider): the dip moves at most ~12% off-centre and the
      // depth, stiffness and start (0-2 frames late) change slightly.
      const L = c.L;
      const peak = 0.5 + (L.peak - 0.5) * 0.25 * v;
      const centre = Math.max(0, 1 - Math.abs(c.m - peak) / Math.max(peak, 1 - peak));
      const shape = Math.pow(centre, 2 + (L.sharp - 0.5) * 0.8 * v);
      const kGlitch = (p.kEdge + (p.kMid - p.kEdge) * shape) * (1 + (L.k - 0.5) * 0.4 * v) * (1 + (c.n - 0.5) * 0.1 * v);
      const kShatter = p.kRand * (0.35 + c.r * 1.3);
      const k = kGlitch + (kShatter - kGlitch) * shatter;
      const push = injects[Math.round(L.delay * 2 * v)] || 0;
      if (push) {
        const gGlitch = (0.55 + 0.45 * shape) * (1 + (L.gain - 0.5) * 0.35 * v);
        const gShatter = 0.4 + c.r * p.random;
        c.off += push * (gGlitch + (gShatter - gGlitch) * shatter);
      }
      c.vel += -k * c.off - p.d * c.vel;
      c.off += c.vel;
      if (c.off > p.max) { c.off = p.max; c.vel = 0; } else if (c.off < -p.max) { c.off = -p.max; c.vel = 0; }
      if (Math.abs(c.off) > 0.25 || Math.abs(c.vel) > 0.05) { energy++; b.hot = true; }
    }
  }
  if (!energy && !injects.some(Boolean)) return settle();
  if (!moving) { moving = true; document.documentElement.classList.add("fx-moving"); }
  draw(p);
  raf = requestAnimationFrame(frame);
}

function draw(p) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.textBaseline = "alphabetic";
  const viewTop = scrollY - 200, viewBottom = scrollY + viewH + 200;
  let font = "";
  for (const b of blocks) {
    if (b.top + b.height < viewTop || b.top > viewBottom) continue;
    for (const c of b.chars) {
      const st = c.st;
      if (st.font !== font) { ctx.font = font = st.font; }
      let off = c.off, x = c.x - scrollX;
      if (p.step) off = Math.round(off / p.step) * p.step; // hard pixel steps
      if (p.jitter && Math.abs(c.off) > 6) x += (Math.random() - 0.5) * Math.abs(c.off) * p.jitter;
      const y = c.y - scrollY + off;
      const blank = !c.ch.trim();
      if (!blank && Math.abs(off) > 2) { // RGB split, wider the further the letter is behind
        const s = Math.min(5, Math.abs(off) * 0.12);
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = accent.a; ctx.fillText(c.ch, x - s, y);
        ctx.fillStyle = accent.b; ctx.fillText(c.ch, x + s, y);
        ctx.globalAlpha = 1;
      }
      // the element's own text-shadow (e.g. the RGB-split codename titles), then the letter
      if (!blank) for (const sh of st.shadows) { ctx.fillStyle = sh.color; ctx.fillText(c.ch, x + sh.x, y + sh.y); }
      ctx.fillStyle = st.color;
      if (!blank) ctx.fillText(c.ch, x, y);
      if (st.underline) { // same place as the browser's: just under the baseline
        const t = Math.max(1, Math.round(st.size / 16));
        ctx.fillRect(x, y + Math.max(1, st.size * 0.12), charWidth(st.font, c.ch) + st.letterSpacing, t);
      }
    }
  }
}

function reset(b) { for (const c of b.chars) { c.off = 0; c.vel = 0; } b.hot = false; }
function settle() {
  for (const b of blocks) if (b.hot) reset(b);
  injects.length = 0;
  if (moving) { moving = false; document.documentElement.classList.remove("fx-moving"); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
function kick() { if (!raf) raf = requestAnimationFrame(frame); }

// ---------- (re)measure when the layout can have changed ----------
let measureTimer = 0;
function remeasure() {
  clearTimeout(measureTimer);
  measureTimer = setTimeout(() => {
    if (moving) return remeasure(); // never measure while the real text is hidden
    widthCache.clear(); ascentCache.clear(); // fonts may have finished loading since
    sizeCanvas(); measureBlocks(); lastY = scrollY;
  }, 150);
}
addEventListener("scroll", kick, { passive: true });
addEventListener("resize", remeasure);
addEventListener("load", remeasure);
document.fonts && document.fonts.ready.then(remeasure);
new ResizeObserver(remeasure).observe(document.body);
new MutationObserver(remeasure).observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
sizeCanvas();
measureBlocks();

// ---------- little switcher (bottom left) ----------
const ui = document.createElement("div");
ui.className = "fx-ui";
ui.setAttribute("role", "group");
ui.setAttribute("aria-label", "Scroll effect (lab)");
ui.innerHTML =
  `<span class="fx-ui__k">fx</span>` +
  Object.keys(MODES).map((m) => `<button type="button" data-fx="${m}">${LABELS[m]}</button>`).join("") +
  `<label class="fx-ui__k">power <input type="range" data-k="strength" min="0.4" max="2.5" step="0.1" value="${strength}"></label>` +
  `<label class="fx-ui__k">shatter <input type="range" data-k="shatter" min="0" max="1" step="0.05" value="${shatter}"></label>`;
document.body.appendChild(ui);
function paintUi() { ui.querySelectorAll("[data-fx]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fx === mode))); }
ui.addEventListener("click", (e) => {
  const b = e.target.closest("[data-fx]");
  if (!b) return;
  mode = b.dataset.fx; store.set("mode", mode); settle(); paintUi();
});
ui.addEventListener("input", (e) => {
  const k = e.target.dataset.k;
  if (k === "strength") strength = Number(e.target.value);
  if (k === "shatter") shatter = Number(e.target.value);
  if (k) store.set(k, e.target.value);
});
paintUi();

// debug: document.dispatchEvent(new CustomEvent("fx-debug", { detail: "still" | "clear" })) draws the
// canvas letters at rest over the hidden real text (or clears them), to compare the two
document.addEventListener("fx-debug", (e) => {
  if (e.detail === "still") {
    cancelAnimationFrame(raf); raf = 0; settle(); lastY = scrollY;
    document.documentElement.classList.add("fx-moving");
    draw({}); // all letters at rest
  }
  else if (e.detail && e.detail.report) {
    // compare stored letter positions with fresh DOM boxes for the first block matching a selector
    const b = blocks.find((x) => x.el.matches(e.detail.report));
    const out = [];
    if (b) {
      const tw = document.createTreeWalker(b.el, NodeFilter.SHOW_TEXT);
      let node = tw.nextNode(); while (node && !node.data.trim()) node = tw.nextNode();
      const i0 = node.data.search(/S/);
      for (let i = 0; i < 4; i++) {
        const box = charBox(node, i0 + i);
        const c = b.chars[i];
        ctx.font = c.st.font;
        out.push({ ch: c.ch, stored: +(c.x).toFixed(2), dom: +box.left.toFixed(2), font: c.st.font.slice(0, 40), lb: +ctx.measureText(c.ch).actualBoundingBoxLeft.toFixed(2) });
      }
    }
    document.documentElement.dataset.fxReport = JSON.stringify(out);
  }
  else settle();
  document.documentElement.dataset.fxLetters = blocks.reduce((n, b) => n + b.chars.length, 0);
});
