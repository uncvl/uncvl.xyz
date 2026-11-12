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
// Address discovery (STUN) only, no relaying of messages. Not Google's or Cloudflare's: servers run by
// open-source projects, checked to answer (Nov 2026). Keep it to four: browsers get slower with more, and a
// dead server delays every connection (the browser waits for it before the handshake can go out).
const ICE = [
  { urls: "stun:stun.framasoft.org:3478" },
  { urls: "stun:stun.nextcloud.com:443" },
  { urls: "stun:stun.linphone.org:3478" },
  { urls: "stun:stun.freeswitch.org:3478" },
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
// A poll lives in its creator's own (signed) user state, so people who join later still get it while
// the creator is here; each vote lives in the voter's own user state. One vote per person, which they
// can move or take back. When the creator leaves, the poll closes; nothing is kept afterwards.
const MAX_Q = 140, MAX_OPT = 60, MAX_OPTS = 6, MAX_POLLS = 5, BAR = 10;
const pollEls = new Map(); // "ownerId:pollId" → { poll, ownerId, li, buttons, meta, closed }
const pollForm = $("chat-pollnew"), pollOpts = $("chat-pollnew-opts"), pollToggle = $("chat-poll-toggle");
const lang = () => (document.documentElement.dataset.lang === "tr" ? "tr" : "en");
const validPoll = (p) => p && typeof p.id === "string" && p.id.length <= 12 && typeof p.q === "string" && p.q.length <= MAX_Q &&
  Array.isArray(p.o) && p.o.length >= 2 && p.o.length <= MAX_OPTS && p.o.every((o) => typeof o === "string" && o.length <= MAX_OPT);

function setupPolls() {
  selfId = "";
  room.getSelf().then((s) => { selfId = s.userId; tallyAll(); }).catch(() => {});
  polls = room.makeUserState("polls", [], {
    validate: (next) => Array.isArray(next) && next.length <= MAX_POLLS && next.every(validPoll),
  });
  votes = room.makeUserState("votes", {}, {
    validate: (next) => next && typeof next === "object" && !Array.isArray(next) && Object.keys(next).length <= 50 &&
      Object.entries(next).every(([k, v]) => k.length <= 80 && Number.isInteger(v) && v >= 0 && v < MAX_OPTS),
  });
  polls.onChange((list, ctx) => {
    if (ctx.removed) { closePolls(ctx.userId); return; }
    for (const p of Array.isArray(list) ? list : []) if (validPoll(p)) showPoll(ctx.userId, p, ctx.self);
  });
  votes.onChange(() => tallyAll());
}

function createPoll(q, opts) {
  q = clean(q, MAX_Q);
  opts = (opts || []).map((o) => clean(o, MAX_OPT)).filter(Boolean).slice(0, MAX_OPTS);
  if (!polls || !q || opts.length < 2) return false;
  const poll = { id: Math.random().toString(36).slice(2, 10), q, o: opts };
  polls.set((prev) => [...(Array.isArray(prev) ? prev : []).slice(-(MAX_POLLS - 1)), poll]).catch(() => {});
  if (!known.size && !warnedAlone) {
    warnedAlone = true;
    system("nobody else is here yet: the poll will show up for people who join while you're here", "henüz kimse yok: anket, sen buradayken katılanlara görünecek");
  }
  return true;
}

function showPoll(ownerId, poll, self) {
  const key = ownerId + ":" + poll.id;
  if (pollEls.has(key)) return;
  const who = document.createElement("span");
  who.className = "chat-line__name";
  who.textContent = "<" + (self ? myName : known.get(ownerId) || "anon-" + ownerId.slice(0, 4)) + ">";
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
  pollEls.set(key, { poll, ownerId, li, buttons, meta, closed: false });
  tally(key);
}

function vote(key, i) {
  const el = pollEls.get(key);
  if (!votes || !el || el.closed) return;
  votes.set((prev) => {
    const next = {};
    // keep only votes for polls that are still open here (at most 50)
    for (const [k, v] of Object.entries(prev && typeof prev === "object" ? prev : {})) if (pollEls.has(k) && !pollEls.get(k).closed) next[k] = v;
    if (next[key] === i) delete next[key]; // tapping your vote again takes it back
    else next[key] = i;
    return next;
  }).catch(() => {});
}

function tally(key) {
  const el = pollEls.get(key);
  if (!el || !votes) return;
  // an open poll counts the votes of the people in the room now; a closed one keeps its last result
  if (!el.closed || !el.last) {
    const all = votes.getAll(), here = room ? room.getUsers() : {};
    const counts = el.poll.o.map(() => 0);
    let total = 0, mine = -1;
    for (const [userId, v] of Object.entries(all)) {
      if (userId !== selfId && !here[userId]) continue;
      const i = v && typeof v === "object" ? v[key] : undefined;
      if (!Number.isInteger(i) || i < 0 || i >= counts.length) continue;
      counts[i]++; total++;
      if (userId === selfId) mine = i;
    }
    el.last = { counts, total, mine };
  }
  const { counts, total, mine } = el.last;
  el.buttons.forEach((b, i) => {
    const fill = total ? Math.round((counts[i] / total) * BAR) : 0;
    b.querySelector(".chat-poll__box").textContent = i === mine ? "[x]" : "[ ]";
    b.querySelector(".chat-poll__bar").textContent = "█".repeat(fill) + "░".repeat(BAR - fill);
    b.querySelector(".chat-poll__n").textContent = String(counts[i]);
    b.setAttribute("aria-pressed", String(i === mine));
    b.classList.toggle("is-mine", i === mine);
    b.disabled = el.closed;
  });
  el.meta.textContent = "";
  const votesEn = total === 1 ? "1 vote" : total + " votes";
  if (el.closed) el.meta.append(i18n(votesEn + " · closed: its creator left", total + " oy · kapandı: anketi açan ayrıldı"));
  else el.meta.append(i18n(votesEn + " · tap an option to vote, tap again to take it back", total + " oy · oy vermek için bir seçeneğe dokun, geri almak için tekrar dokun"));
}
function tallyAll() { for (const key of pollEls.keys()) tally(key); }
function closePolls(ownerId) {
  for (const [key, el] of pollEls) if (el.ownerId === ownerId && !el.closed) { el.closed = true; tally(key); }
}

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
  pollToggle.setAttribute("aria-expanded", String(open));
  pollToggle.classList.toggle("is-open", open);
  if (!open) return;
  pollForm.reset();
  pollOpts.textContent = "";
  addOptionInput(); addOptionInput();
  pollForm.q.placeholder = lang() === "tr" ? "soru" : "question";
  pollForm.q.focus();
  fitViewport();
}
pollToggle.addEventListener("click", () => togglePollForm(pollForm.hidden));
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
const roomFromHash = () => cleanRoom(new URLSearchParams(location.hash.slice(1)).get("room") || "");
joinForm.name.value = store.get("name") || randomName();
joinForm.room.value = roomFromHash();
// a shared link opened on a page that's already here (only the #room changes): follow it
addEventListener("hashchange", () => { if (!room) joinForm.room.value = roomFromHash(); });
joinForm.hidden = false;
about.hidden = false;

let room = null, known = new Map(), myName = "", netTimer = 0, warnedAlone = false;
let polls = null, votes = null, selfId = "";

joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  myName = clean(joinForm.name.value, MAX_NAME) || randomName();
  const roomName = cleanRoom(joinForm.room.value) || DEFAULT_ROOM;
  const password = joinForm.password.value;
  joinForm.password.value = ""; // not kept in the page after joining
  store.set("name", myName);
  // the room (never the password) goes in the address, so it can be shared as a link
  history.replaceState(null, "", roomName === DEFAULT_ROOM ? location.pathname : "#room=" + encodeURIComponent(roomName));
  enter(roomName, password);
});

$("chat-leave").addEventListener("click", () => leave(true));
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
  const profile = room.makeUserState("profile", { name: "" }, {
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
  room.onUserLeave(({ userId }) => { gone(userId); closePolls(userId); tallyAll(); });
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
  polls = votes = null;
  pollEls.clear();
  togglePollForm(false);
  if (!showForm) return;
  document.documentElement.classList.remove("chat-active");
  roomEl.hidden = true;
  joinForm.hidden = false;
  about.hidden = false;
  joinForm.name.value = myName;
}
