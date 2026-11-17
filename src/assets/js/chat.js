// Peer-to-peer chat on /chat/ (Trystero, bundled by scripts/vendor.mjs).
// Browsers find each other through a few public Nostr relays, then talk directly over WebRTC
// (encrypted). Nothing is stored: only people in the room at the same time see the messages.
// No TURN relay for now, so people on networks that block direct connections can't join.
import { joinRoom } from "/assets/js/vendor/trystero.js";

const APP_ID = "uncvl.xyz/chat";
const DEFAULT_ROOM = "uncvl";
// Signalling relays: only used to introduce browsers to each other (the handshake is encrypted).
// Keep this list in sync with connect-src for /chat/* in public/_headers.
const RELAYS = [
  "wss://relay.nostr.net",
  "wss://relay.snort.social",
  "wss://relay.primal.net",
  "wss://nostr.data.haus",
];
// Address discovery (STUN) only, no relaying of messages. Not Google's or Cloudflare's, and four different
// operators, so one going down doesn't stop anyone. Picked from ~270 public servers by reply time from
// İstanbul (Nov 2026): netgsm ~25 ms, the others ~55-70 ms. Keep it to four: browsers get slower with more,
// and a dead server delays every connection (the browser waits for it before the handshake can go out).
const ICE = [
  { urls: "stun:stun.netgsm.com.tr:3478" }, // Netgsm, a Turkish operator: closest to most people here
  { urls: "stun:stun.nextcloud.com:443" }, // port 443 gets through networks that block the usual 3478
  { urls: "stun:stun.framasoft.org:3478" },
  { urls: "stun:stun.linphone.org:3478" },
];
const MAX_NAME = 24, MAX_MSG = 1000, MAX_LOG = 500;

const $ = (id) => document.getElementById(id);
const joinForm = $("chat-join"), about = $("chat-about"), roomEl = $("chat-room");
const log = $("chat-log"), people = $("chat-people"), count = $("chat-count");
const sendForm = $("chat-send");
const store = {
  get(k) { try { return localStorage.getItem("uncvl-chat-" + k) || ""; } catch (e) { return ""; } },
  set(k, v) { try { localStorage.setItem("uncvl-chat-" + k, v); } catch (e) {} },
};

// ---------- small helpers ----------
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const cleanRoom = (s) => clean(s, 40).toLowerCase().replace(/\s+/g, "-");
const randomName = () => "anon-" + Math.random().toString(36).slice(2, 6);
const hhmm = (d = new Date()) => d.toTimeString().slice(0, 5);
// bilingual text that follows the EN | TR switch (same classes as the rest of the site)
function i18n(en, tr) {
  const wrap = document.createElement("span");
  wrap.className = "i18n";
  for (const [lang, text] of [["en", en], ["tr", tr]]) {
    const s = document.createElement("span");
    s.lang = lang; s.className = "l-" + lang; s.textContent = text;
    wrap.append(s);
  }
  return wrap;
}

// ---------- log ----------
function addLine(kind, parts) {
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  const li = document.createElement("li");
  li.className = "chat-line chat-line--" + kind;
  const time = document.createElement("time");
  time.className = "chat-line__time";
  time.textContent = hhmm();
  li.append(time, " ", ...parts);
  log.append(li);
  while (log.children.length > MAX_LOG) log.firstChild.remove();
  if (atBottom || kind === "self") log.scrollTop = log.scrollHeight;
  return li;
}
function say(name, text, self) {
  const who = document.createElement("span");
  who.className = "chat-line__name";
  who.textContent = "<" + name + ">";
  const body = document.createElement("span");
  body.className = "chat-line__text";
  body.textContent = text; // text only: never parsed as HTML
  addLine(self ? "self" : "msg", [who, " ", body]);
}
const system = (en, tr) => addLine("sys", [i18n("-- " + en, "-- " + tr)]);

// ---------- polls ----------
// Polls stay as long as someone in the room still has them. Everyone keeps a copy of the polls and the
// votes they've seen in their own (signed) user state and passes it on, so people who join later get
// them from whoever is here, even after the creator left. One vote per person, which they can move or
// take back. Every vote carries the time it was cast; the newest one counts. While a voter is in the
// room, only their own state can say what their vote is; copies only stand in for people who left.
// Nothing is kept once the last person who has a poll leaves.
const MAX_Q = 140, MAX_OPT = 60, MAX_OPTS = 6, MAX_POLLS = 10, MAX_VOTERS = 100, BAR = 10;
const pollEls = new Map(); // "creatorId:pollId" → { poll, li, buttons, meta }
const knownPolls = new Map(); // same key → poll, every poll seen in this room
const pollForm = $("chat-pollnew"), pollOpts = $("chat-pollnew-opts");
const lang = () => (document.documentElement.dataset.lang === "tr" ? "tr" : "en");
const isId = (s) => typeof s === "string" && s.length > 0 && s.length <= 64;
const validPoll = (p) => p && isId(p.id) && p.id.length <= 12 && isId(p.by) && typeof p.n === "string" && p.n.length <= MAX_NAME &&
  typeof p.q === "string" && p.q.length <= MAX_Q && Number.isFinite(p.t) &&
  Array.isArray(p.o) && p.o.length >= 2 && p.o.length <= MAX_OPTS && p.o.every((o) => typeof o === "string" && o.length <= MAX_OPT);
const pollKey = (p) => p.by + ":" + p.id;
// a vote: [option index or null (taken back), time]
const validVote = (v) => Array.isArray(v) && v.length === 2 && (v[0] === null || (Number.isInteger(v[0]) && v[0] >= 0 && v[0] < MAX_OPTS)) && Number.isFinite(v[1]);
const validLedger = (l) => l && typeof l === "object" && !Array.isArray(l) && Object.keys(l).length <= MAX_POLLS &&
  Object.entries(l).every(([k, voters]) => k.length <= 80 && voters && typeof voters === "object" && !Array.isArray(voters) &&
    Object.keys(voters).length <= MAX_VOTERS && Object.entries(voters).every(([id, v]) => isId(id) && validVote(v)));

function setupPolls() {
  selfId = "";
  knownPolls.clear();
  room.getSelf().then((s) => { selfId = s.userId; tallyAll(); }).catch(() => {});
  polls = room.makeUserState("polls", [], {
    validate: (next) => Array.isArray(next) && next.length <= MAX_POLLS && next.every(validPoll),
  });
  votes = room.makeUserState("votes", {}, { validate: (next) => validLedger(next) });
  polls.onChange((list) => {
    let added = false;
    for (const p of Array.isArray(list) ? list : []) {
      if (!validPoll(p) || knownPolls.has(pollKey(p))) continue;
      knownPolls.set(pollKey(p), p);
      showPoll(p);
      added = true;
    }
    if (added) passOn();
  });
  votes.onChange(() => { tallyAll(); passOn(); });
}

// everyone's votes, merged: the newest vote per person and poll
function mergedVotes() {
  const out = {};
  if (!votes) return out;
  const here = new Set(room ? Object.keys(room.getUsers()) : []);
  if (selfId) here.add(selfId);
  for (const [holder, ledger] of Object.entries(votes.getAll())) {
    if (!validLedger(ledger)) continue;
    for (const [key, voters] of Object.entries(ledger)) {
      for (const [voter, v] of Object.entries(voters)) {
        if (voter !== holder && here.has(voter)) continue; // they're here: only their own word counts
        const slot = (out[key] ||= {});
        if (!slot[voter] || v[1] > slot[voter][1]) slot[voter] = v;
      }
    }
  }
  return out;
}

// keep my copy up to date (newest polls, and the votes for them), so I can pass them on
let passTimer = 0;
function passOn() {
  clearTimeout(passTimer);
  passTimer = setTimeout(() => {
    if (!polls || !votes) return;
    const keep = [...knownPolls.values()].sort((a, b) => a.t - b.t).slice(-MAX_POLLS);
    const keys = new Set(keep.map(pollKey));
    const merged = mergedVotes(), ledger = {};
    for (const key of keys) if (merged[key]) ledger[key] = Object.fromEntries(Object.entries(merged[key]).slice(-MAX_VOTERS));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (!same(polls.get(), keep)) polls.set(keep).catch(() => {});
    if (!same(votes.get(), ledger)) votes.set(ledger).catch(() => {});
  }, 400);
}

function createPoll(q, opts) {
  q = clean(q, MAX_Q);
  opts = (opts || []).map((o) => clean(o, MAX_OPT)).filter(Boolean).slice(0, MAX_OPTS);
  if (!polls || !selfId || !q || opts.length < 2) return false;
  const poll = { id: Math.random().toString(36).slice(2, 10), by: selfId, n: myName, q, o: opts, t: Date.now() };
  knownPolls.set(pollKey(poll), poll);
  showPoll(poll);
  passOn();
  if (!known.size && !warnedAlone) {
    warnedAlone = true;
    system("nobody else is here yet: the poll will show up for people who join while you're here", "henüz kimse yok: anket, sen buradayken katılanlara görünecek");
  }
  return true;
}

function showPoll(poll) {
  const key = pollKey(poll);
  if (pollEls.has(key)) return;
  const self = poll.by === selfId;
  const who = document.createElement("span");
  who.className = "chat-line__name";
  who.textContent = "<" + (clean(poll.n, MAX_NAME) || "anon-" + poll.by.slice(0, 4)) + ">";
  const tag = document.createElement("span");
  tag.className = "chat-poll__tag";
  tag.textContent = "[:POLL:]";
  const q = document.createElement("span");
  q.className = "chat-line__text chat-poll__q";
  q.textContent = poll.q;
  const list = document.createElement("ol");
  list.className = "chat-poll__opts";
  const buttons = poll.o.map((label, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chat-poll__opt";
    for (const part of ["box", "label", "bar", "n"]) {
      const s = document.createElement("span");
      s.className = "chat-poll__" + part;
      if (part === "label") s.textContent = label; // text only
      if (part === "bar") s.setAttribute("aria-hidden", "true");
      b.append(s);
    }
    b.addEventListener("mousedown", (e) => e.preventDefault()); // don't steal the focus from the message box
    b.addEventListener("click", () => vote(key, i));
    li.append(b);
    list.append(li);
    return b;
  });
  const meta = document.createElement("p");
  meta.className = "chat-poll__meta";
  const li = addLine(self ? "poll chat-line--self" : "poll", [who, " ", tag, " ", q, list, meta]);
  pollEls.set(key, { poll, li, buttons, meta });
  tally(key);
}

function vote(key, i) {
  if (!votes || !selfId || !pollEls.has(key)) return;
  const mine = mergedVotes()[key]?.[selfId];
  const choice = mine && mine[0] === i ? null : i; // tapping your vote again takes it back
  votes.set((prev) => {
    const next = validLedger(prev) ? JSON.parse(JSON.stringify(prev)) : {};
    (next[key] ||= {})[selfId] = [choice, Date.now()];
    return next;
  }).catch(() => {});
}

function tally(key) {
  const el = pollEls.get(key);
  if (!el) return;
  const voters = mergedVotes()[key] || {};
  const counts = el.poll.o.map(() => 0);
  let total = 0, mine = -1;
  for (const [voter, [i]] of Object.entries(voters)) {
    if (i === null || i >= counts.length) continue;
    counts[i]++; total++;
    if (voter === selfId) mine = i;
  }
  el.buttons.forEach((b, i) => {
    const fill = total ? Math.round((counts[i] / total) * BAR) : 0;
    b.querySelector(".chat-poll__box").textContent = i === mine ? "[x]" : "[ ]";
    b.querySelector(".chat-poll__bar").textContent = "█".repeat(fill) + "░".repeat(BAR - fill);
    b.querySelector(".chat-poll__n").textContent = String(counts[i]);
    b.setAttribute("aria-pressed", String(i === mine));
    b.classList.toggle("is-mine", i === mine);
  });
  el.meta.textContent = "";
  const votesEn = total === 1 ? "1 vote" : total + " votes";
  el.meta.append(i18n(votesEn + " · tap an option to vote, tap again to take it back", total + " oy · oy vermek için bir seçeneğe dokun, geri almak için tekrar dokun"));
}
function tallyAll() { for (const key of pollEls.keys()) tally(key); }

// the poll form: a question and 2-6 options
function addOptionInput(value = "") {
  if (pollOpts.children.length >= MAX_OPTS) return null;
  const input = document.createElement("input");
  input.name = "opt";
  input.maxLength = MAX_OPT;
  input.value = value;
  input.placeholder = (lang() === "tr" ? "seçenek " : "option ") + (pollOpts.children.length + 1);
  input.setAttribute("aria-label", input.placeholder);
  pollOpts.append(input);
  $("chat-pollnew-add").hidden = pollOpts.children.length >= MAX_OPTS;
  return input;
}
function togglePollForm(open) {
  pollForm.hidden = !open;
  if (!open) return;
  toggleCmds(false);
  pollForm.reset();
  pollOpts.textContent = "";
  addOptionInput(); addOptionInput();
  pollForm.q.placeholder = lang() === "tr" ? "soru" : "question";
  pollForm.q.focus();
  fitViewport();
}

// ---------- the "/" menu: commands (/nick, /poll) ----------
// Opens from the "/" button, or by typing "/" at the start of an empty message box; while typing
// it shows only the commands that match. A command typed out with its arguments (/poll q | a | b)
// still runs straight away when sent.
const cmdMenu = $("chat-cmds"), cmdToggle = $("chat-cmd-toggle");
const COMMANDS = {
  poll: () => togglePollForm(true),
  nick: () => { sendForm.msg.value = "/nick "; sendForm.msg.focus(); },
};
function toggleCmds(open, filter = "") {
  cmdMenu.hidden = !open;
  cmdToggle.setAttribute("aria-expanded", String(open));
  cmdToggle.classList.toggle("is-open", open);
  if (!open) return;
  let shown = 0;
  for (const b of cmdMenu.querySelectorAll("button")) {
    const match = !filter || b.dataset.cmd.startsWith(filter);
    b.parentElement.hidden = !match;
    shown += match;
  }
  if (!shown) { toggleCmds(false); return; }
  fitViewport();
}
function runCmd(name) {
  toggleCmds(false);
  if (sendForm.msg.value.startsWith("/")) sendForm.msg.value = "";
  COMMANDS[name]?.();
}
cmdToggle.addEventListener("mousedown", (e) => e.preventDefault()); // keep the keyboard where it is
cmdToggle.addEventListener("click", () => toggleCmds(cmdMenu.hidden));
for (const b of cmdMenu.querySelectorAll("button")) {
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.addEventListener("click", () => runCmd(b.dataset.cmd));
}
// typing "/" at the start opens the list and narrows it down; a space (arguments) closes it
sendForm.msg.addEventListener("input", () => {
  const m = /^\/(\w*)$/.exec(sendForm.msg.value);
  if (m) toggleCmds(true, m[1].toLowerCase());
  else if (!cmdMenu.hidden) toggleCmds(false);
});
sendForm.msg.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !cmdMenu.hidden) { toggleCmds(false); return; }
  // Enter on a bare command name ("/poll") runs it, like picking it from the list
  const m = /^\/(\w+)$/.exec(sendForm.msg.value.trim());
  if (e.key === "Enter" && m && COMMANDS[m[1].toLowerCase()]) { e.preventDefault(); runCmd(m[1].toLowerCase()); }
});
document.addEventListener("click", (e) => { if (!cmdMenu.hidden && !cmdMenu.contains(e.target) && e.target !== cmdToggle) toggleCmds(false); });
$("chat-pollnew-cancel").addEventListener("click", () => { togglePollForm(false); sendForm.msg.focus(); });
$("chat-pollnew-add").addEventListener("click", () => { const input = addOptionInput(); if (input) input.focus(); });
pollForm.addEventListener("keydown", (e) => { if (e.key === "Escape") { togglePollForm(false); sendForm.msg.focus(); } });
pollForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const opts = [...pollOpts.querySelectorAll("input")].map((i) => i.value);
  if (!createPoll(pollForm.q.value, opts)) {
    system("a poll needs a question and at least 2 options", "anket için bir soru ve en az 2 seçenek gerekiyor");
    return;
  }
  togglePollForm(false);
  sendForm.msg.focus();
});

// ---------- join form ----------
// the room is in the #room=… part of the address: browsers never send that part to the server, so
// room names don't end up in request logs. (?room=… links are still understood.)
const roomFromUrl = () => cleanRoom(new URLSearchParams(location.hash.slice(1)).get("room") || new URLSearchParams(location.search).get("room") || "");
const linkFor = (roomName) => location.origin + location.pathname + "#room=" + encodeURIComponent(roomName);
joinForm.name.value = store.get("name") || randomName();
joinForm.room.value = roomFromUrl();
// a room link opened on a page that's already here (only the #room part changes): follow it
addEventListener("hashchange", () => { if (!room) joinForm.room.value = roomFromUrl(); });
joinForm.hidden = false;
about.hidden = false;

let room = null, known = new Map(), myName = "", netTimer = 0, warnedAlone = false;
let polls = null, votes = null, selfId = "", profile = null;

joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  myName = clean(joinForm.name.value, MAX_NAME) || randomName();
  const roomName = cleanRoom(joinForm.room.value) || DEFAULT_ROOM;
  const password = joinForm.password.value;
  joinForm.password.value = ""; // not kept in the page after joining
  store.set("name", myName);
  // the room (never the password) goes in the address, so it can be shared as a link
  history.replaceState(null, "", linkFor(roomName));
  enter(roomName, password);
});

$("chat-leave").addEventListener("click", () => leave(true));

// share: the room's link (never the password). Phones get their own share sheet; elsewhere the
// link is copied. With a password, people are reminded to send it some other way.
let roomLink = "", roomLocked = false;
$("chat-share").addEventListener("click", async () => {
  const btn = $("chat-share");
  const note = roomLocked ? ["the password isn't in the link: send it to them some other way", "şifre linkte yok: ayrıca ilet"] : null;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: "Uncivilization chat", url: roomLink });
      if (note) system(...note);
      return;
    }
    await navigator.clipboard.writeText(roomLink);
    system("link copied: " + roomLink + (note ? " · " + note[0] : ""), "link kopyalandı: " + roomLink + (note ? " · " + note[1] : ""));
    btn.classList.add("is-open");
    setTimeout(() => btn.classList.remove("is-open"), 1200);
  } catch (e) {
    if (e && e.name === "AbortError") return; // share sheet closed
    system("the room link: " + roomLink, "oda linki: " + roomLink); // couldn't copy: show it to copy by hand
  }
});
addEventListener("pagehide", () => leave(false));

// ---------- phones: the room fills the screen above the keyboard ----------
// While in a room, the page gets .chat-active; on small/touch screens the CSS then pins the room to
// the visible area (--vv-top / --vv-height, kept up to date here as the keyboard opens and closes),
// so nothing behind it scrolls and the message box stays right above the keyboard.
const vv = window.visualViewport;
function fitViewport() {
  const h = vv ? vv.height : innerHeight, top = vv ? vv.offsetTop : 0;
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  roomEl.style.setProperty("--vv-height", h + "px");
  roomEl.style.setProperty("--vv-top", top + "px");
  if (atBottom) log.scrollTop = log.scrollHeight; // keyboard opened: keep the latest messages in view
}
if (vv) { vv.addEventListener("resize", fitViewport); vv.addEventListener("scroll", fitViewport); }
addEventListener("resize", fitViewport);
// tapping "send" shouldn't take the focus away from the message box (that would close the keyboard)
sendForm.querySelector("button").addEventListener("mousedown", (e) => e.preventDefault());

function enter(roomName, password) {
  joinForm.hidden = true;
  about.hidden = true;
  roomEl.hidden = false;
  document.documentElement.classList.add("chat-active");
  fitViewport();
  log.textContent = "";
  known = new Map();
  $("chat-room-name").textContent = roomName;
  $("chat-lock").hidden = !password;
  roomLink = linkFor(roomName); // always with the room, also the default one
  roomLocked = Boolean(password);

  room = joinRoom({
    appId: APP_ID,
    password: password || undefined,
    identity: "none", // a fresh id every visit: nothing saved in the browser
    relayConfig: { urls: RELAYS, redundancy: RELAYS.length },
    rtcConfig: { iceServers: ICE },
    maxReceiveBytes: 16 * 1024,
  }, roomName);

  system(`you joined #${roomName} as ${myName}. waiting for others…`, `#${roomName} odasına ${myName} olarak katıldın. diğerleri bekleniyor…`);

  // who's here: each person's name is their own (signed) user state. The second argument is only
  // a default; set() is what publishes your name to the room.
  profile = room.makeUserState("profile", { name: "" }, {
    validate: (next) => next && typeof next.name === "string" && next.name.length <= MAX_NAME,
  });
  profile.set({ name: myName }).catch(() => {});
  const arrived = (userId, name) => {
    warnedAlone = false;
    const before = known.get(userId);
    known.set(userId, name);
    if (!before) system(`${name} joined`, `${name} katıldı`);
    else if (before !== name) system(`${before} is now ${name}`, `${before} artık ${name}`);
    paintPeople();
    setTimeout(refreshNetworks, 1500); // their connection is up by now: check its network
  };
  profile.onChange((value, ctx) => {
    if (ctx.self) return;
    if (ctx.removed) { gone(ctx.userId); return; }
    const name = clean(value?.name, MAX_NAME);
    if (name) arrived(ctx.userId, name);
  });
  // someone connected: their name normally follows within a moment; if it doesn't, show them anyway
  room.onUserJoin(({ userId }) => {
    setTimeout(() => {
      if (!room || known.has(userId)) return;
      if (!room.getUsers()[userId]) return; // already gone again
      arrived(userId, clean(profile.get(userId)?.name, MAX_NAME) || "anon-" + userId.slice(0, 4));
    }, 4000);
  });
  room.onUserLeave(({ userId }) => { gone(userId); tallyAll(); });
  setupPolls();

  // messages: plain text, a little flood protection per person
  const msg = room.makeAction("msg");
  const recent = new Map();
  msg.onMessage((data, { userId }) => {
    const text = clean(data?.t, MAX_MSG);
    if (!text) return;
    const now = Date.now(), times = (recent.get(userId) || []).filter((t) => now - t < 5000);
    times.push(now); recent.set(userId, times);
    if (times.length > 8) return; // more than 8 messages in 5 s: dropped
    say(known.get(userId) || "anon-" + userId.slice(0, 4), text, false);
  });
  sendForm.onsubmit = (e) => {
    e.preventDefault();
    const text = clean(sendForm.msg.value, MAX_MSG);
    if (!text) return;
    sendForm.msg.value = "";
    // "/nick newname": your new name goes to everyone through your profile (they see "old is now new")
    if (/^\/nick(\s|$)/i.test(text)) {
      const name = clean(text.slice(5), MAX_NAME);
      if (!name) system("type a name after /nick, e.g. /nick balgum", "/nick'ten sonra bir ad yaz, örn. /nick balgum");
      else if (name !== myName) {
        const before = myName;
        myName = name;
        store.set("name", myName);
        if (profile) profile.set({ name: myName }).catch(() => {});
        system(`you are now ${myName} (was ${before})`, `artık ${myName} adını kullanıyorsun (önceden ${before})`);
        paintPeople();
      }
      sendForm.msg.focus();
      return;
    }
    // "/poll question | option | option": a poll without opening the poll form
    if (/^\/poll\s/i.test(text)) {
      const [q, ...opts] = text.slice(6).split("|").map((x) => x.trim()).filter(Boolean);
      if (!createPoll(q, opts)) system("a poll needs a question and 2-6 options: /poll question | option | option", "anket için bir soru ve 2-6 seçenek gerekiyor: /poll soru | seçenek | seçenek");
      sendForm.msg.focus();
      return;
    }
    say(myName, text, true);
    if (!known.size && !warnedAlone) { // said once, until someone shows up
      warnedAlone = true;
      system("nobody else is here yet: messages reach no one until someone joins", "henüz kimse yok: biri katılana kadar mesajlar kimseye ulaşmıyor");
    }
    msg.send({ t: text }).catch(() => {});
    sendForm.msg.focus(); // keep the keyboard open for the next message
  };

  // problems worth telling about, each kind once
  const told = new Set();
  room.onError((err) => {
    if (told.has(err.code)) return;
    told.add(err.code);
    if (err.code === "relay-failed") system("can't reach the relays that introduce browsers to each other. check your connection.", "tarayıcıları tanıştıran sunuculara ulaşılamıyor. bağlantını kontrol et.");
    else if (err.code === "decrypt-failed") system("someone in this room is using a different password", "bu odada başka bir şifre kullanan biri var");
    else if (err.code === "peer-connect-failed") system("trouble connecting to someone, still trying… (if it never works, one of the networks blocks direct connections)", "biriyle bağlanmakta zorlanıyor, denemeye devam… (hiç olmazsa ağlardan biri doğrudan bağlantıyı engelliyordur)");
  });

  paintPeople();
  clearInterval(netTimer);
  netTimer = setInterval(refreshNetworks, 4000);
  if (!matchMedia("(pointer: coarse)").matches) sendForm.msg.focus();
}

function gone(userId) {
  const name = known.get(userId);
  if (!name) return;
  known.delete(userId);
  system(`${name} left`, `${name} ayrıldı`);
  paintPeople();
}

// ---------- who's here, with people on the same network in [brackets] ----------
// Each person's connection goes to an address; people connecting from the same one (same home, same
// phone in two tabs…) are bracketed together. Addresses are only compared, never shown. Someone on
// your own local network connects straight over the LAN, so they're bracketed with you.
let netOf = new Map(); // userId → network key ("me" = your network)
async function networkKey(pc) {
  const stats = await pc.getStats();
  let pair = null;
  stats.forEach((st) => { if (st.type === "transport" && st.selectedCandidatePairId) pair = stats.get(st.selectedCandidatePairId); });
  if (!pair) stats.forEach((st) => { if (st.type === "candidate-pair" && (st.selected || (st.nominated && st.state === "succeeded"))) pair = st; });
  if (!pair) return null;
  const remote = stats.get(pair.remoteCandidateId), local = stats.get(pair.localCandidateId);
  if (!remote) return null;
  if (remote.candidateType === "host") return "me"; // over the local network
  const addr = remote.address || remote.ip;
  // my own public address, as the STUN servers saw it
  const mine = new Set();
  stats.forEach((st) => { if (st.type === "local-candidate" && st.candidateType === "srflx") mine.add(st.address || st.ip); });
  if (local && local.candidateType === "srflx") mine.add(local.address || local.ip);
  return addr ? (mine.has(addr) ? "me" : addr) : null;
}
async function refreshNetworks() {
  if (!room) return;
  const peers = room.getPeers(), next = new Map();
  await Promise.all(Object.values(peers).map(async (p) => {
    if (!p.connection || next.has(p.userId)) return;
    try { const key = await networkKey(p.connection); if (key) next.set(p.userId, key); } catch (e) {}
  }));
  const sig = (m) => [...m].sort().join("|");
  if (sig(next) !== sig(netOf)) { netOf = next; paintPeople(); }
}

function paintPeople() {
  people.textContent = "";
  // group names by network: yours first, then everyone else in the order they arrived
  const groups = new Map([["me", [null]]]); // null = you
  for (const [userId, name] of known) {
    const key = netOf.get(userId) || "user:" + userId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(name);
  }
  let first = true;
  for (const names of groups.values()) {
    if (!first) people.append(" · ");
    first = false;
    const box = names.length > 1 ? document.createElement("span") : people;
    if (names.length > 1) {
      box.className = "chat-people__net";
      box.title = "same network / aynı ağ";
      box.append("[");
    }
    names.forEach((name, i) => {
      if (i) box.append(" · ");
      if (name === null) {
        const me = document.createElement("span");
        me.className = "chat-people__me";
        me.append(myName + " ", i18n("(you)", "(sen)"));
        box.append(me);
      } else box.append(name);
    });
    if (names.length > 1) { box.append("]"); people.append(box); }
  }
  count.textContent = "";
  count.append(i18n(`${known.size + 1} here`, `${known.size + 1} kişi`));
}

function leave(showForm) {
  if (!room) return;
  clearInterval(netTimer);
  netOf = new Map();
  room.leave().catch(() => {});
  room = null;
  polls = votes = profile = null;
  clearTimeout(passTimer);
  pollEls.clear();
  knownPolls.clear();
  togglePollForm(false);
  toggleCmds(false);
  if (!showForm) return;
  document.documentElement.classList.remove("chat-active");
  roomEl.hidden = true;
  joinForm.hidden = false;
  about.hidden = false;
  joinForm.name.value = myName;
}
