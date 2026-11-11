// LAB (local experiment, branch lab/scroll-momentum): letters that lag behind fast scrolling.
//
// How it works
//  - Pretext lays out each text block into lines (no DOM measuring per frame), so we know where
//    every letter sits. One fixed canvas redraws the visible letters while the page scrolls fast.
//  - Each letter is a small spring. When the page jumps by dy, the letter is left behind by dy and
//    springs back. Letters in the middle of a line have a softer spring, so they arrive later
//    than the ones at the edges.
//  - While letters are moving, the real text is made transparent (still there for selection and
//    screen readers); once everything has settled, the canvas clears and the real text is back.
import { prepareWithSegments, layoutWithLines } from "/assets/js/vendor/pretext/layout.js";

const TARGETS = [
  "main h1", "main h2", "main h3", "main .glitch", "main .kline", "main .prose p", "main .prose li",
  "main .tile__title", "main .log__row a", "main .peer__name", "main .facts dd", "main .facts dt",
  "main .notes p", "main .sorted-genres a", "main .names a", "main .call__head",
].join(", ");

// Effect presets. k = spring stiffness (edges → middle), d = damping, max = largest offset (px),
// threshold = scroll speed (px/frame) below which nothing happens.
const MODES = {
  off: null,
  elastic: { kEdge: 0.16, kMid: 0.035, d: 0.24, max: 140, threshold: 14 },
  glitch: { kEdge: 0.2, kMid: 0.05, d: 0.3, max: 120, threshold: 12, step: 4, rgb: true, jitter: 0.06 },
  wave: { kEdge: 0.12, kMid: 0.03, d: 0.18, max: 160, threshold: 12, wave: 0.35, tilt: 0.004 },
  smear: { kEdge: 0.14, kMid: 0.03, d: 0.22, max: 140, threshold: 12, trail: 5 },
  shatter: { kEdge: 0.09, kMid: 0.09, d: 0.2, max: 120, threshold: 10, random: 0.85, rgb: true },
};
const LABELS = { off: "off", elastic: "elastic", glitch: "glitch", wave: "wave", smear: "smear", shatter: "shatter" };

const store = {
  get(k, d) { try { return localStorage.getItem("uncvl-fx-" + k) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("uncvl-fx-" + k, v); } catch (e) {} },
};
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let mode = store.get("mode", "elastic");
let strength = Number(store.get("strength", "1"));
let variation = Number(store.get("variation", "0.7")); // 0 = every line the same, 1 = every line its own shape

// ---------- canvas ----------
const canvas = document.createElement("canvas");
canvas.className = "fx-canvas";
canvas.setAttribute("aria-hidden", "true");
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d");
let dpr = 1;
function sizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
}

// ---------- layout of every text block (only on load / resize / language switch) ----------
let blocks = [];
const widthCache = new Map();
function charWidth(font, ch) {
  const key = font + "\u0000" + ch;
  let w = widthCache.get(key);
  if (w === undefined) { ctx.font = font; w = ctx.measureText(ch).width; widthCache.set(key, w); }
  return w;
}
const px = (v) => parseFloat(v) || 0;

function measureBlocks() {
  const els = [...document.querySelectorAll(TARGETS)].filter((el) => !el.closest(".fx-ui") && el.offsetParent);
  // read everything first (one layout pass), then build
  const reads = els.map((el) => {
    const cs = getComputedStyle(el);
    return { el, cs, rect: el.getBoundingClientRect(), text: el.innerText };
  });
  blocks = [];
  for (const { el, cs, rect, text } of reads) {
    if (!text || !text.trim() || rect.width < 4) continue;
    const size = px(cs.fontSize);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const lineHeight = cs.lineHeight === "normal" ? size * 1.2 : px(cs.lineHeight);
    const letterSpacing = cs.letterSpacing === "normal" ? 0 : px(cs.letterSpacing);
    const left = rect.left + scrollX + px(cs.borderLeftWidth) + px(cs.paddingLeft);
    const top = rect.top + scrollY + px(cs.borderTopWidth) + px(cs.paddingTop);
    const width = rect.width - px(cs.borderLeftWidth) - px(cs.borderRightWidth) - px(cs.paddingLeft) - px(cs.paddingRight);
    ctx.font = font;
    const m = ctx.measureText("Hg");
    const asc = m.fontBoundingBoxAscent ?? size * 0.8, desc = m.fontBoundingBoxDescent ?? size * 0.2;
    const baseline = (lineHeight - (asc + desc)) / 2 + asc; // where CSS puts the baseline in a line box
    const chars = [];
    let y = 0;
    // innerText keeps <br> as "\n": lay out each hard line on its own
    for (const hard of text.split("\n")) {
      if (!hard.trim()) { y += lineHeight; continue; }
      let lines;
      try { lines = layoutWithLines(prepareWithSegments(hard, font, letterSpacing ? { letterSpacing } : undefined), Math.max(1, width + 0.5), lineHeight).lines; }
      catch (e) { lines = [{ text: hard, width }]; }
      for (const line of lines) {
        const lw = line.width;
        // every line gets its own random character: where its "middle" is, how sharp the dip is,
        // how stiff and how far it lags, and how many frames late it starts
        const L = { peak: Math.random(), sharp: Math.random(), k: Math.random(), gain: Math.random(), delay: Math.random() };
        const dx = cs.textAlign === "center" ? (width - lw) / 2 : cs.textAlign === "right" || cs.textAlign === "end" ? width - lw : 0;
        let x = 0;
        for (const ch of line.text) {
          const w = charWidth(font, ch) + letterSpacing;
          if (ch.trim()) {
            const mid = lw > 0 ? (x + w / 2) / lw : 0.5; // 0 = start of the line, 1 = end
            chars.push({ ch, x: dx + x, y: y + baseline, m: mid, L, n: Math.random(), r: Math.random(), off: 0, vel: 0, trail: [] });
          }
          x += w;
        }
        y += lineHeight;
      }
    }
    if (chars.length) blocks.push({ el, font, color: cs.color, left, top, height: Math.max(y, rect.height), chars });
    el.classList.add("fx-t");
  }
}

// ---------- animation ----------
let lastY = scrollY, moving = false, raf = 0, time = 0;
const injects = [];
const accent = { a: "#ff3d7f", b: "#33e0ff" };

function frame() {
  raf = 0;
  const p = MODES[mode];
  if (!p || reduced.matches) return settle();
  time++;
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
      const k = p.random
        ? p.kEdge * (0.35 + c.r * 1.3)
        : (p.kEdge + (p.kMid - p.kEdge) * shape) * (1 + (L.k - 0.5) * 0.4 * v) * (1 + (c.n - 0.5) * 0.1 * v);
      const push = injects[Math.round(L.delay * 2 * v)] || 0;
      if (push) c.off += push * (p.random ? 0.4 + c.r * p.random : (0.55 + 0.45 * shape) * (1 + (L.gain - 0.5) * 0.35 * v));
      c.vel += -k * c.off - p.d * c.vel;
      c.off += c.vel;
      if (c.off > p.max) { c.off = p.max; c.vel = 0; } else if (c.off < -p.max) { c.off = -p.max; c.vel = 0; }
      if (Math.abs(c.off) > 0.25 || Math.abs(c.vel) > 0.05) { energy++; b.hot = true; }
      if (p.trail) { c.trail.push(c.off); if (c.trail.length > p.trail) c.trail.shift(); }
    }
  }
  if (!energy && !injects.some(Boolean)) return settle();
  if (!moving) { moving = true; document.documentElement.classList.add("fx-moving"); }
  draw(p);
  raf = requestAnimationFrame(frame);
}

function draw(p) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.textBaseline = "alphabetic";
  const viewTop = scrollY - 200, viewBottom = scrollY + innerHeight + 200;
  for (const b of blocks) {
    if (b.top + b.height < viewTop || b.top > viewBottom) continue;
    ctx.font = b.font;
    const ox = b.left - scrollX, oy = b.top - scrollY;
    for (const c of b.chars) {
      let off = c.off, x = ox + c.x;
      if (p.step) off = Math.round(off / p.step) * p.step;
      if (p.jitter && Math.abs(c.off) > 6) x += (Math.random() - 0.5) * Math.abs(c.off) * p.jitter;
      if (p.wave) off += Math.sin(time * 0.25 + c.x * 0.045) * Math.abs(c.off) * p.wave;
      const y = oy + c.y + off;
      if (p.trail && c.trail.length) {
        ctx.fillStyle = b.color;
        c.trail.forEach((t, i) => { ctx.globalAlpha = 0.07 + (i / c.trail.length) * 0.18; ctx.fillText(c.ch, x, oy + c.y + t); });
        ctx.globalAlpha = 1;
      }
      if (p.rgb && Math.abs(off) > 2) {
        const s = Math.min(5, Math.abs(off) * 0.12);
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = accent.a; ctx.fillText(c.ch, x - s, y);
        ctx.fillStyle = accent.b; ctx.fillText(c.ch, x + s, y);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = b.color;
      if (p.tilt && Math.abs(off) > 1) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(off * p.tilt); ctx.fillText(c.ch, 0, 0); ctx.restore();
      } else ctx.fillText(c.ch, x, y);
    }
  }
}

function reset(b) { for (const c of b.chars) { c.off = 0; c.vel = 0; c.trail.length = 0; } b.hot = false; }
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
  measureTimer = setTimeout(() => { settle(); sizeCanvas(); measureBlocks(); lastY = scrollY; }, 120);
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
  `<label class="fx-ui__k">variation <input type="range" data-k="variation" min="0" max="1" step="0.05" value="${variation}"></label>`;
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
  if (k === "variation") variation = Number(e.target.value);
  if (k) store.set(k, e.target.value);
});
paintUi();
