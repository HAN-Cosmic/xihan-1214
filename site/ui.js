/* Things that sit on top of every scene:
   the music player (top left, a film reel that opens into a strip of controls)
   and the index (left edge) that appears once she has seen the whole thing. */
import { sfx, music } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const DR = window.DARKROOM;

/* ---------- music player ---------- */
const player = $("player"), reel = $("plReel");
function renderPlayer() {
  player.classList.toggle("has", music.list.length > 0);
  player.classList.toggle("playing", music.playing);
  player.classList.toggle("off", music.off);
  player.classList.toggle("single", music.list.length < 2);
  $("plTitle").textContent = music.title;
  $("plPlay").setAttribute("aria-label", music.playing ? "暂停" : "播放");
  $("plPrev").disabled = $("plNext").disabled = music.list.length < 2;
}
function openPlayer(on) { player.classList.toggle("open", on); reel.setAttribute("aria-expanded", on ? "true" : "false"); }
reel.addEventListener("click", () => { sfx.ui(); openPlayer(!player.classList.contains("open")); });
for (const [id, fn] of [["plPrev", () => music.prev()], ["plPlay", () => music.toggle()], ["plNext", () => music.next()], ["plOff", () => { music.stop(); openPlayer(false); }]]) {
  $(id).addEventListener("click", () => { sfx.ui(); fn(); });
}
// a tap anywhere else folds the strip away again
addEventListener("pointerdown", (e) => { if (player.classList.contains("open") && !player.contains(e.target)) openPlayer(false); });
addEventListener("darkroom:music", renderPlayer); renderPlayer();

/* ---------- index: every room, once she has been through them all.
   Folded into a small「目录」under the reel so it never covers the photos. ---------- */
const nav = $("nav");
const toggle = document.createElement("button"); toggle.className = "nav-toggle"; toggle.setAttribute("aria-expanded", "false");
toggle.innerHTML = "<span>目录</span><b>＋</b>"; nav.appendChild(toggle);
const list = document.createElement("div"); list.className = "nav-list"; nav.appendChild(list);
function openNav(on) { nav.classList.toggle("open", on); toggle.setAttribute("aria-expanded", on ? "true" : "false"); }
toggle.addEventListener("click", () => { sfx.ui(); openNav(!nav.classList.contains("open")); });
addEventListener("pointerdown", (e) => { if (nav.classList.contains("open") && !nav.contains(e.target)) openNav(false); });
const ROOMS = [
  { key: "desk", name: "桌面", go: () => DR.scene4.goDesk() },
  { key: "sheet", name: "印样", go: () => dispatchEvent(new CustomEvent("darkroom:sheet")) },
  { key: "tray", name: "显影盘", go: () => dispatchEvent(new CustomEvent("darkroom:tray")) },
  { key: "wall", name: "照片墙", go: () => dispatchEvent(new CustomEvent("darkroom:wall")) },
  { key: "letter", name: "那封信", go: () => DR.scene5.readLetter() },
];
ROOMS.forEach((r, i) => {
  const b = document.createElement("button"); b.className = "nav-item"; b.dataset.key = r.key;
  b.innerHTML = `<i>0${i + 1}</i><span></span>`; b.querySelector("span").textContent = r.name;
  b.addEventListener("click", () => {
    const here = DR.scene2.room() || "desk";
    if (r.key === here && !(r.key === "desk" && DR.scene2.picked() >= 0)) return;
    sfx.ui(); openNav(false); r.go();
  });
  list.appendChild(b);
});
function renderNav() {
  const on = DR.unlocked && DR.scene2 && DR.scene2.active();
  nav.classList.toggle("on", !!on); if (!on) { openNav(false); return; }
  const here = DR.scene2.room() || "desk";
  nav.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("here", b.dataset.key === here));
}
addEventListener("darkroom:room", renderNav);
addEventListener("darkroom:unlocked", () => setTimeout(renderNav, 1600));   // let the wall arrive first
renderNav();
