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
// true when a parent with overflow clipping hides the box completely (e.g. the hover-only small
// print under the home notes: max-height 0 + overflow hidden)
const clipCache = new Map(); // element → its rect if it clips its content, else null (per measurement)
function clippedAway(el, r) {
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    let ar = clipCache.get(a);
    if (ar === undefined) {
      const cs = getComputedStyle(a);
      ar = cs.overflowX === "visible" && cs.overflowY === "visible" ? null : a.getBoundingClientRect();
      clipCache.set(a, ar);
    }
    if (!ar) continue;
    if (r.bottom <= ar.top + 1 || r.top >= ar.bottom - 1 || r.right <= ar.left + 1 || r.left >= ar.right - 1) return true;
  }
  return false;
}

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
const stats = { measureMs: 0, measures: 0, frames: 0, updateMs: 0, drawMs: 0, worstMs: 0, drawn: 0 };
// Measuring every text block at once takes 50-80 ms (Pretext's first pass over the text, styles,
// Range boxes). It's done in slices instead: find the blocks (cheap), then measure them a few at a
// time while the browser is idle, the ones nearest the screen first. Blocks not measured yet just
// keep their real text.
const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 16));
let queue = [], pumping = false, sliceMs = 0, longestSlice = 0;
function measureBlocks() {
  const t0 = performance.now();
  blocks = [];
  queue = findBlocks();
  const mid = scrollY + viewH / 2;
  queue.sort((a, b) => Math.abs(a.top - mid) - Math.abs(b.top - mid));
  lastSig = layoutSig(); // remember the layout this measurement belongs to
  sliceMs = performance.now() - t0; longestSlice = sliceMs;
  stats.measures++;
  if (!pumping) { pumping = true; idle(pump); }
}
function pump(deadline) {
  const t0 = performance.now();
  while (queue.length && deadline.timeRemaining() > 2) measureOne(queue.shift().el);
  const dt = performance.now() - t0;
  sliceMs += dt; longestSlice = Math.max(longestSlice, dt);
  if (queue.length) return idle(pump);
  pumping = false;
  stats.measureMs = +sliceMs.toFixed(1); stats.longestSliceMs = +longestSlice.toFixed(1);
}
let fragSeq = 0;
const label = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ").filter((c) => c !== "fx-t")[0] : "") + ": " + el.textContent.trim().slice(0, 40);
function findBlocks() {
  clipCache.clear();
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
  const out = [];
  for (const el of containers) {
    const r = el.getBoundingClientRect();
    // skips collapsed / clipped text
    if (r.width >= 2 && r.height >= 2 && disp(el) !== "none" && !clippedAway(el, r)) out.push({ el, top: r.top + scrollY });
  }
  return out;
}

// Where letters go. "dom": every styled run is pinned to the browser's own boxes (Range rects),
// exact. "pretext": one box per block from the DOM, everything inside placed by Pretext's layout
// (lines, line height, alignment, advances) without asking the DOM.
let PLACE = store.get("place", "dom") === "pretext" ? "pretext" : "dom";
function measureOne(el) {
  const chars = layoutBlock(el, PLACE);
  if (!chars || !chars.length) return;
  const top = Math.min(...chars.map((c) => c.y)) - 60, bottom = Math.max(...chars.map((c) => c.y)) + 20;
  blocks.push({ el, top, height: bottom - top, chars });
  el.classList.add("fx-t");
}
function layoutBlock(el, place) {
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const width = rect.width - px(cs.borderLeftWidth) - px(cs.borderRightWidth) - px(cs.paddingLeft) - px(cs.paddingRight);
  if (width < 4) return null;
  // block metrics, used by the "pretext" placement
  const left = rect.left + scrollX + px(cs.borderLeftWidth) + px(cs.paddingLeft);
  const top = rect.top + scrollY + px(cs.borderTopWidth) + px(cs.paddingTop);
  const blockFont = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const lh = cs.lineHeight === "normal" ? px(cs.fontSize) * 1.2 : px(cs.lineHeight);
  const baseline = (lh - (ascent(blockFont) + descent(blockFont))) / 2 + ascent(blockFont);
  const align = cs.textAlign;
  let lineIndex = 0;
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
      const lineY = top + lineIndex * lh + baseline;
      let cx = align === "center" ? (width - line.width) / 2 : align === "right" || align === "end" ? width - line.width : 0;
      for (const frag of line.fragments) {
        const fragId = ++fragSeq;
        const run = runs[frag.itemIndex];
        if (!run || !frag.text) continue;
        const glyphs = [...frag.text];
        const adv = [0];
        glyphs.forEach((ch) => adv.push(adv[adv.length - 1] + charWidth(run.st.font, ch) + run.st.letterSpacing));
        if (place === "pretext") {
          cx += frag.gapBefore;
          glyphs.forEach((ch, i) => {
            lineChars.push({ ch, x: left + cx + adv[i], y: lineY, st: run.st, frag: fragId, i, w: adv[i + 1] - adv[i], exact: true });
          });
          cx += adv[glyphs.length];
          continue;
        }
        // "dom": pin the fragment to where the browser drew it; if the browser wrapped it
        // differently (first and last letter on different rows), pin every letter instead
        const src = sourceIndices(run.text, frag.sourceStart, frag.text);
        const first = charBox(run.node, src[0]);
        const last = charBox(run.node, src[glyphs.length - 1]);
        const perLetter = Math.abs(first.top - last.top) > 1;
        const n = glyphs.length - 1;
        const scale = !perLetter && n > 0 && adv[n] > 0 ? (last.left - first.left) / adv[n] : 1;
        glyphs.forEach((ch, i) => {
          const box = perLetter ? charBox(run.node, src[i]) : null;
          const gx = box ? box.left : first.left + adv[i] * scale;
          const gtop = box ? box.top : first.top;
          // spaces are kept too: they join words into one draw call (and carry underlines)
          lineChars.push({ ch, x: gx, y: gtop + ascent(run.st.font), st: run.st, frag: fragId, i, w: adv[i + 1] - adv[i], exact: !perLetter });
        });
      }
      lineIndex++;
      if (!lineChars.length) continue;
      const x0 = Math.min(...lineChars.map((c) => c.x));
      const x1 = Math.max(...lineChars.map((c) => c.x + c.w));
      const lw = Math.max(1, x1 - x0);
      for (const c of lineChars) {
        c.m = (c.x + c.w / 2 - x0) / lw; // 0 = start of the line, 1 = end
        c.L = L; c.n = Math.random(); c.r = Math.random(); c.off = 0; c.vel = 0;
        chars.push(c);
      }
    }
  }
  return chars;
}

const descentCache = new Map();
function descent(font) {
  let d = descentCache.get(font);
  if (d === undefined) { ctx.font = font; const m = ctx.measureText("Hg"); d = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent; descentCache.set(font, d); }
  return d;
}

// ---------- animation ----------
let lastY = scrollY, moving = false, raf = 0;
const injects = [];
const accent = { a: "#ff3d7f", b: "#33e0ff" };

function frame() {
  raf = 0;
  const tStart = performance.now();
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
  const tDraw = performance.now();
  draw(p);
  const tEnd = performance.now();
  stats.frames++; stats.updateMs += tDraw - tStart; stats.drawMs += tEnd - tDraw;
  stats.worstMs = Math.max(stats.worstMs, tEnd - tStart);
  raf = requestAnimationFrame(frame);
}

function draw(p) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.textBaseline = "alphabetic";
  const viewTop = scrollY - 200, viewBottom = scrollY + viewH + 200;
  // Letters next to each other (same text run, same height after the pixel steps, same RGB split)
  // are drawn with one fillText call: whole words at rest, chunks of words while moving. That cuts
  // the number of canvas calls, which is what the time goes into.
  let font = "", g = null;
  const flush = () => {
    if (!g) return;
    const { text, x, y, st, split, w } = g;
    g = null;
    if (y < -80 || y > viewH + 80) return; // off-screen (the canvas would clip it anyway)
    if (text.trim()) {
      if (st.font !== font) { ctx.font = font = st.font; }
      if (split) {
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = accent.a; ctx.fillText(text, x - split, y);
        ctx.fillStyle = accent.b; ctx.fillText(text, x + split, y);
        ctx.globalAlpha = 1;
      }
      for (const sh of st.shadows) { ctx.fillStyle = sh.color; ctx.fillText(text, x + sh.x, y + sh.y); }
      ctx.fillStyle = st.color;
      ctx.fillText(text, x, y);
      stats.drawn++;
    }
    if (st.underline) {
      ctx.fillStyle = st.color;
      ctx.fillRect(x, y + Math.max(1, st.size * 0.12), w, Math.max(1, Math.round(st.size / 16)));
    }
  };
  for (const b of blocks) {
    if (b.top + b.height < viewTop || b.top > viewBottom) continue;
    for (const c of b.chars) {
      let off = c.off;
      if (p.step) off = Math.round(off / p.step) * p.step; // hard pixel steps
      const split = Math.abs(off) > 2 ? Math.min(4.5, Math.round(Math.abs(off) * 0.12 / 1.5) * 1.5) : 0;
      const y = c.y - scrollY + off;
      // continue the current group if this is the next letter of the same run at the same height
      if (g && c.frag === g.frag && c.i === g.next && y === g.y && split === g.split && c.exact) {
        g.text += c.ch; g.next++; g.w += c.w;
        continue;
      }
      flush();
      // shake: one random sideways nudge per group while far behind
      const shake = p.jitter && Math.abs(c.off) > 6 ? (Math.random() - 0.5) * Math.abs(c.off) * p.jitter : 0;
      g = { frag: c.frag, next: c.i + 1, text: c.ch, x: c.x - scrollX + shake, y, st: c.st, split, w: c.w };
      if (!c.exact) flush(); // letters placed one by one (browser wrapped differently): no grouping
    }
    flush();
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
// what the layout depends on: skip re-measuring when none of it changed (the load, font and
// resize events often fire for the same, unchanged layout)
let lastSig = "";
const layoutSig = () => [document.documentElement.clientWidth, document.documentElement.scrollHeight,
  document.fonts ? document.fonts.status : "", document.documentElement.dataset.lang || "", devicePixelRatio].join("|");
function remeasure() {
  clearTimeout(measureTimer);
  measureTimer = setTimeout(() => {
    if (moving) return remeasure(); // never measure while the real text is hidden
    const sig = layoutSig();
    if (sig === lastSig && blocks.length) return;
    lastSig = sig;
    widthCache.clear(); ascentCache.clear(); descentCache.clear(); // fonts may have finished loading since
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
// measure when the browser is idle; the resize/load/font events below re-measure (debounced)
idle(() => { if (!blocks.length && !pumping) measureBlocks(); });

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
  else if (e.detail === "clear") settle();
  document.documentElement.dataset.fxLetters = blocks.reduce((n, b) => n + b.chars.length, 0);
  if (e.detail === "stats") {
    const n = Math.max(1, stats.frames);
    document.documentElement.dataset.fxStats = JSON.stringify({
      letters: blocks.reduce((m, b) => m + b.chars.length, 0), blocks: blocks.length,
      measureMs: stats.measureMs, longestSliceMs: stats.longestSliceMs, measures: stats.measures, frames: stats.frames,
      updateMsAvg: +(stats.updateMs / n).toFixed(2), drawMsAvg: +(stats.drawMs / n).toFixed(2),
      worstFrameMs: +stats.worstMs.toFixed(1), drawCallsPerFrame: Math.round(stats.drawn / n),
    });
  }
  if (e.detail && e.detail.place) {
    PLACE = e.detail.place; store.set("place", PLACE);
    settle(); blocks = []; for (const q of findBlocks()) measureOne(q.el); // synchronous, for testing
  }
  if (e.detail === "compare") {
    const els = blocks.map((b) => b.el);
    const time = (place) => { const t0 = performance.now(); const out = els.map((el) => layoutBlock(el, place)); return { ms: performance.now() - t0, out }; };
    time("dom"); time("pretext"); // warm both (caches, fonts)
    const D = time("dom"), P = time("pretext");
    const errs = [], worst = [];
    let mismatched = 0;
    els.forEach((el, k) => {
      const a = D.out[k] || [], b = P.out[k] || [];
      if (a.length !== b.length) { mismatched++; worst.push({ where: label(el), err: "different line breaks / letter count" }); return; }
      let blockMax = 0;
      a.forEach((c, i) => {
        if (!c.ch.trim()) return;
        const d = Math.hypot(c.x - b[i].x, c.y - b[i].y);
        errs.push(d); blockMax = Math.max(blockMax, d);
      });
      if (blockMax > 1) worst.push({ where: label(el), err: +blockMax.toFixed(1) });
    });
    errs.sort((x, y) => x - y);
    const pct = (lim) => +(100 * errs.filter((d) => d <= lim).length / Math.max(1, errs.length)).toFixed(1);
    document.documentElement.dataset.fxCompare = JSON.stringify({
      blocks: els.length, letters: errs.length, blocksWithDifferentBreaks: mismatched,
      within05px: pct(0.5), within1px: pct(1), within2px: pct(2),
      medianPx: +(errs[Math.floor(errs.length / 2)] || 0).toFixed(2), p95Px: +(errs[Math.floor(errs.length * 0.95)] || 0).toFixed(2), maxPx: +(errs[errs.length - 1] || 0).toFixed(1),
      layoutMsDom: +D.ms.toFixed(1), layoutMsPretext: +P.ms.toFixed(1),
      worst: worst.sort((x, y) => (typeof y.err === "number" ? y.err : 999) - (typeof x.err === "number" ? x.err : 999)).slice(0, 8),
    });
  }
  if (e.detail === "reset-stats") Object.assign(stats, { frames: 0, updateMs: 0, drawMs: 0, worstMs: 0, drawn: 0 });
});
