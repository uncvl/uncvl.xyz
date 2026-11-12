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

// ---------- join form ----------
const roomFromHash = () => cleanRoom(new URLSearchParams(location.hash.slice(1)).get("room") || "");
joinForm.name.value = store.get("name") || randomName();
joinForm.room.value = roomFromHash();
// a shared link opened on a page that's already here (only the #room changes): follow it
addEventListener("hashchange", () => { if (!room) joinForm.room.value = roomFromHash(); });
joinForm.hidden = false;
about.hidden = false;

let room = null, known = new Map(), myName = "";

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

function enter(roomName, password) {
  joinForm.hidden = true;
  about.hidden = true;
  roomEl.hidden = false;
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
    const before = known.get(userId);
    known.set(userId, name);
    if (!before) system(`${name} joined`, `${name} katıldı`);
    else if (before !== name) system(`${before} is now ${name}`, `${before} artık ${name}`);
    paintPeople();
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
  room.onUserLeave(({ userId }) => gone(userId));

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
    say(myName, text, true);
    if (!known.size) system("nobody else is here yet: this message reached no one", "henüz kimse yok: bu mesaj kimseye ulaşmadı");
    msg.send({ t: text }).catch(() => {});
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
  sendForm.msg.focus();
}

function gone(userId) {
  const name = known.get(userId);
  if (!name) return;
  known.delete(userId);
  system(`${name} left`, `${name} ayrıldı`);
  paintPeople();
}

function paintPeople() {
  people.textContent = "";
  const me = document.createElement("span");
  me.className = "chat-people__me";
  me.append(myName + " ", i18n("(you)", "(sen)"));
  people.append(me);
  for (const name of known.values()) people.append(" · ", name);
  count.textContent = "";
  count.append(i18n(`${known.size + 1} here`, `${known.size + 1} kişi`));
}

function leave(showForm) {
  if (!room) return;
  room.leave().catch(() => {});
  room = null;
  if (!showForm) return;
  roomEl.hidden = true;
  joinForm.hidden = false;
  about.hidden = false;
  joinForm.name.value = myName;
}
