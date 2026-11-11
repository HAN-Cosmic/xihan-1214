"use strict";

const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- placeholder content (used until content/content.md is filled) ---------- */
const FALLBACK = {
  letter: [
    "曦酱：",
    "",
    "隔着七千九百公里，很多话打字总说不清，",
    "所以我把这三年，一张一张装进了胶卷里。",
    "",
    "三卷，一年一卷。",
    "还有一卷没拆封，留给我们以后。",
  ].join("\n"),
  sign: "晗冰王尊",
  ticket: { name: "王妍曦", from: "上饶", date: "12.14", note: "别弄丢了" },
};

/* ---------- stage scaling: 16:10 stage, 1 unit = 1% of its width ---------- */
function fit() {
  const u = Math.min(innerWidth / 100, innerHeight / 62.5);
  document.documentElement.style.setProperty("--u", u.toFixed(3) + "px");
}
addEventListener("resize", fit);
fit();

/* ---------- procedural textures ---------- */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function deskTexture() {
  const w = 1600, h = 1000, c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d"), r = rng(7);
  const base = g.createRadialGradient(w * .6, h * .34, 0, w * .55, h * .45, w * .8);
  base.addColorStop(0, "#4e171b"); base.addColorStop(.5, "#331014"); base.addColorStop(1, "#130708");
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  // soft leather mottling
  for (let i = 0; i < 900; i++) {
    const x = r() * w, y = r() * h, rad = 6 + r() * 40, a = .025 + r() * .04;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < .55;
    gr.addColorStop(0, dark ? `rgba(15,4,5,${a})` : `rgba(130,52,52,${a * .7})`); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // fine pores
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - .5) * 14;
    d[i] += n; d[i + 1] += n * .8; d[i + 2] += n * .8;
  }
  g.putImageData(img, 0, 0);
  // faint wear lines
  g.strokeStyle = "rgba(160,90,80,.05)"; g.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = r() * h, len = 60 + r() * 220, ang = (r() - .5) * .5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
  }
  return c.toDataURL("image/jpeg", .9);
}

function paperTexture() {
  const s = 256, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d"), r = rng(3);
  g.fillStyle = "#fff"; g.fillRect(0, 0, s, s);
  const img = g.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = 242 + r() * 13; d[i] = d[i + 1] = d[i + 2] = v; }
  g.putImageData(img, 0, 0);
  g.filter = "blur(.6px)"; g.drawImage(c, 0, 0); g.filter = "none";
  g.strokeStyle = "rgba(120,100,80,.06)";
  for (let i = 0; i < 70; i++) { const x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 24, y + (r() - .5) * 6); g.stroke(); }
  return c.toDataURL("image/png");
}

const DESK = deskTexture();
window.DARKROOM = { desk: DESK };
$("desk").style.backgroundImage = `url(${DESK})`;
const paper = paperTexture();
document.querySelectorAll(".env-back, .env-front, .flap-face, .letter .sheet, .letter .back, .ticket-in").forEach((el) => {
  el.style.backgroundImage = `url(${paper})`;
  el.style.backgroundBlendMode = "multiply";
});

// torn top edge for the darkroom ticket
(function tearTicket() {
  const r = rng(11), pts = [];
  for (let x = 0; x <= 100; x += 2.5) pts.push(`${x}% ${(2 + r() * 5).toFixed(1)}%`);
  $("ticket").querySelector(".ticket-in").style.clipPath = `polygon(${pts.join(",")}, 100% 100%, 0 100%)`;
})();

/* ---------- film grain ---------- */
(function grain() {
  if (REDUCED) return;
  const c = $("grain"), g = c.getContext("2d");
  const S = 384, frames = [];
  for (let k = 0; k < 4; k++) {
    const t = document.createElement("canvas"); t.width = t.height = S;
    const tg = t.getContext("2d"), img = tg.createImageData(S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    tg.putImageData(img, 0, 0); frames.push(tg.createPattern(t, "repeat"));
  }
  function size() { c.width = Math.ceil(innerWidth / 1.5); c.height = Math.ceil(innerHeight / 1.5); }
  size(); addEventListener("resize", size);
  let last = 0, k = 0;
  function frame(t) {
    if (t - last > 85) {
      g.save(); g.translate(-Math.random() * S, -Math.random() * S); g.fillStyle = frames[k = (k + 1) % frames.length];
      g.fillRect(0, 0, c.width + S, c.height + S); g.restore(); last = t;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ---------- content from content/content.md ---------- */
function section(md, title) {
  const i = md.indexOf("## " + title);
  if (i < 0) return "";
  const rest = md.slice(i + 3 + title.length);
  const j = rest.search(/\n## /);
  return j < 0 ? rest : rest.slice(0, j);
}
function codeBlock(text) { const m = text.match(/```\n?([\s\S]*?)```/); return m ? m[1].trim() : ""; }
function tableValue(text, key) { const m = text.match(new RegExp("\\|\\s*" + key + "\\s*\\|\\s*([^|]*)\\|")); return m ? m[1].trim() : ""; }
const unfilled = (s) => !s || /在这里写|（可选/.test(s);

async function loadContent() {
  const c = JSON.parse(JSON.stringify(FALLBACK));
  try {
    const res = await fetch("content/content.md", { cache: "no-store" });
    if (!res.ok) return c;
    const md = await res.text();
    const letter = codeBlock(section(md, "开头的短信"));
    if (!unfilled(letter)) {
      const lines = letter.split("\n");
      const signIdx = lines.findIndex((l) => /^\s*——/.test(l));
      if (signIdx >= 0) { c.sign = lines[signIdx].replace(/^\s*——\s*/, "").trim() || c.sign; lines.splice(signIdx, 1); }
      c.letter = lines.join("\n").trim();
    }
    // background music: every row of the「背景音乐」table with a file name, in order; the files live in content/music/
    c.playlist = [...section(md, "背景音乐").matchAll(/^\|\s*([^|\n]*?)\s*\|\s*([^|\n]*\.(?:mp3|m4a|aac|ogg|wav))\s*\|/gim)]
      .map((r) => ({ title: r[1].replace(/\s*[（(]\s*(.+?)\s*[）)]\s*$/, " · $1"), url: "content/music/" + r[2].trim().replace(/^content\/music\//, "") }));
    const end = codeBlock(section(md, "结尾的长信"));
    if (!unfilled(end)) {
      const lines = end.split("\n"); let sign = c.sign;
      const signIdx = lines.findIndex((l) => /^\s*——/.test(l));
      if (signIdx >= 0) { sign = lines[signIdx].replace(/^\s*——\s*/, "").trim() || sign; lines.splice(signIdx, 1); }
      c.ending = { text: lines.join("\n").trim(), sign };
    }
    const t = section(md, "冲洗单");
    const name = tableValue(t, "收件人"), from = tableValue(t, "寄出地"), date = tableValue(t, "日期"), note = tableValue(t, "备注");
    if (!unfilled(name)) c.ticket.name = name;
    if (!unfilled(from)) c.ticket.from = from;
    if (!unfilled(date)) c.ticket.date = date.replace(/^\d{4}\./, "");
    if (!unfilled(note)) c.ticket.note = note.replace(/^（|）$/g, "");
    c.rolls = ["第一卷：2024", "第二卷：2025", "第三卷：2026"].map((h) => {
      const sec = section(md, h);
      const m = sec.match(/\*\*名字：\*\*[ \t]*([^\n]*)/);
      // photo table rows: | 2024/01.jpg | 日期 | 地点 | 一句话 |
      const frames = [...sec.matchAll(/^\|\s*(20\d\d\/\d+\.\w+)\s*\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|/gm)]
        .map((r) => ({ file: r[1].trim(), date: r[2].trim(), place: r[3].trim(), line: r[4].trim() }));
      return { name: m && m[1].trim() && !m[1].includes("|") ? m[1].trim() : null, photos: frames.length, frames };
    });
    // roll 04: the unknown roll. Name: a **名字：** line if present, else the first 「…」 in the section.
    const s4 = section(md, "第四卷");
    if (s4) {
      const nm = s4.match(/\*\*名字：\*\*[ \t]*([^\n]*)/) || s4.match(/「([^」]+)」/);
      const note = codeBlock(s4);
      c.sealed = { name: nm && nm[1].trim() ? nm[1].trim() : null, note: unfilled(note) ? null : note };
    }
  } catch (e) { /* opened from file:// or offline: keep placeholder */ }
  return c;
}

function renderLetter(c) {
  const html = `
    <div class="l-head"><span>INSIDE · 第 1 页 / 共 1 页</span><span>FOR 曦酱</span></div>
    <div class="l-text"></div>
    <div class="l-sign">${c.sign}<small>上饶 · 2026.12.14</small></div>`;
  for (const id of ["paperTop", "paperBot"]) {
    const el = $(id); el.innerHTML = html;
    el.querySelector(".l-text").textContent = c.letter;
  }
  $("readerCard").innerHTML = html; $("readerCard").querySelector(".l-text").textContent = c.letter;
  $("readerCard").style.backgroundImage = `url(${paper})`;
  $("tName").textContent = c.ticket.name;
  $("tFrom").textContent = c.ticket.from;
  $("tDate").textContent = c.ticket.date;
  $("tNote").textContent = c.ticket.note;
}

/* ---------- opening sequence ---------- */
const stage = $("stage"), env = $("env");
let opened = false;
const wait = (ms) => new Promise((r) => setTimeout(r, REDUCED ? 0 : ms));
const sfx = (name, ...a) => { const s = window.DARKROOM.sfx; if (s && s[name]) s[name](...a); };

async function openEnvelope() {
  if (opened) return; opened = true;
  env.setAttribute("aria-label", "信封已打开");
  stage.classList.add("opened"); sfx("seal");                 // seal breaks, flap lifts
  await wait(750);
  stage.classList.add("slid"); if (!REDUCED) sfx("slide", 1.1);   // the letter comes up out of the envelope
  await wait(1250);
  stage.classList.add("out"); if (!REDUCED) { sfx("paper"); setTimeout(() => sfx("drop"), 650); }   // letter moves aside, the ticket lands
  await wait(1100);
  stage.classList.add("unfold"); if (!REDUCED) sfx("unfold");     // the letter opens out
  await wait(1600);
  $("next").classList.remove("hidden");
  requestAnimationFrame(() => $("next").classList.add("show"));
}
env.addEventListener("click", (e) => {
  if (stage.classList.contains("unfold") && e.target.closest(".letter")) { $("reader").classList.add("on"); sfx("paper"); return; }
  openEnvelope();
});
/* the full-screen reading card, also used for the long letter at the end */
window.DARKROOM.openReader = (text, sign, head = "FOR 曦酱", page = "LAST PAGE") => {
  const card = $("readerCard");
  card.innerHTML = `<div class="l-head"><span>${page}</span><span>${head}</span></div><div class="l-text"></div><div class="l-sign"></div>`;
  card.querySelector(".l-text").textContent = text;
  card.querySelector(".l-sign").innerHTML = `${sign}<small>上饶 · 2026.12.14</small>`;
  card.scrollTop = 0; $("reader").classList.add("on");
};
function closeReader() { if (!$("reader").classList.contains("on")) return; $("reader").classList.remove("on"); sfx("drop"); }
$("reader").addEventListener("click", closeReader);
addEventListener("keydown", (e) => { if (e.key === "Escape") closeReader(); });
env.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEnvelope(); } });

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2400);
}
window.DARKROOM.toast = toast;
window.DARKROOM.hud = (l) => { $("hudL").textContent = l; };
$("next").addEventListener("click", () => {
  stage.classList.add("leave"); sfx("slide", .7);
  setTimeout(() => { window.DARKROOM.wantRolls = true; dispatchEvent(new CustomEvent("darkroom:rolls")); }, REDUCED ? 0 : 900);
});

loadContent().then((c) => { renderLetter(c); window.DARKROOM.content = c; dispatchEvent(new CustomEvent("darkroom:content")); });
setTimeout(() => stage.classList.add("ready"), REDUCED ? 0 : 900);

// debug hook for screenshots: #open jumps to the opened state
if (location.hash === "#open") openEnvelope();
if (location.hash === "#rolls" || /^#(roll\d|sheet|tray|wall)/.test(location.hash)) { stage.classList.add("ready", "opened", "leave"); window.DARKROOM.wantRolls = true; dispatchEvent(new CustomEvent("darkroom:rolls")); }
