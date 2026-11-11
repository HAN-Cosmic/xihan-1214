/* Scene 05 — the wall: every frame of the three rolls pinned up and strung together by roll,
   the prints she chose circled in red, and the long letter in the middle. */
import { sfx } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DR = window.DARKROOM;
const S = DR.scene2.three, { THREE, scene, camera, canvas } = S;
const ease = (t) => { t = Math.min(1, Math.max(0, t)); return 1 - Math.pow(1 - t, 3); };
const pad = (n) => String(n).padStart(2, "0");
const X0 = 80, WALL_Z = -2;
const VIEW = { pos: new THREE.Vector3(X0, 3.75, 10.4), look: new THREE.Vector3(X0, 3.55, WALL_Z) };
const FOCUS = new THREE.Vector3(X0, 3.6, 5.6), ZOOM = 2.0;   // where a picked photo is held, and how big
const wall = { group: null, items: [], letter: null, zoom: null, built: false, t: 0 };

function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function loadImg(src) { return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function wallTexture() {
  const W = 2048, H = 1152, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"), r = rnd(5);
  g.fillStyle = "#4a3326"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26000; i++) { const v = r(); g.fillStyle = v < .5 ? `rgba(30,18,12,${r() * .35})` : `rgba(140,100,70,${r() * .18})`; const s = 1 + r() * 4; g.fillRect(r() * W, r() * H, s, s); }
  const vg = g.createRadialGradient(W * .5, H * .45, H * .2, W * .5, H * .5, W * .7); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(10,5,3,.6)");
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  return canvasTex(c);
}
function printCanvas(im, land) {
  const W = land ? 330 : 256, H = land ? 256 : 330, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  g.fillStyle = "#f2ece0"; g.fillRect(0, 0, W, H);
  const m = 14, iw = W - m * 2, ih = H - m * 2 - 18;
  if (im) { const a = im.width / im.height, t = iw / ih; let sw = im.width, sh = im.height, sx = 0, sy = 0; if (a > t) { sw = im.height * t; sx = (im.width - sw) / 2; } else { sh = im.width / t; sy = (im.height - sh) / 2; } g.drawImage(im, sx, sy, sw, sh, m, m, iw, ih); }
  return c;
}
function ringCanvas() {   // a hand-drawn red marker circle, like the ones on the contact sheet
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), r = rnd(9);
  g.strokeStyle = "rgba(179,36,47,.9)"; g.lineWidth = 7; g.lineCap = "round"; g.beginPath();
  for (let a = -.3; a <= Math.PI * 2 + .35; a += .1) { const rr = 112 + Math.sin(a * 3) * 4 + (r() - .5) * 2; const x = 128 + Math.cos(a) * rr * .92, y = 128 + Math.sin(a) * rr; a < -.2 ? g.moveTo(x, y) : g.lineTo(x, y); }
  g.stroke(); return canvasTex(c);
}
function cardCanvas(lines) {
  const c = document.createElement("canvas"); c.width = 420; c.height = 240; const g = c.getContext("2d");
  g.fillStyle = "#efe6d6"; g.fillRect(0, 0, 420, 240);
  g.fillStyle = "rgba(42,34,28,.5)"; g.font = '500 20px "Darkroom Mono", "IBM Plex Mono", monospace'; g.fillText(lines[0], 26, 48);
  g.fillStyle = "#b3242f"; g.font = '64px "Darkroom Hand", "Long Cang", "Kaiti SC", cursive'; g.fillText(lines[1], 26, 150);
  if (lines[2]) { g.fillStyle = "rgba(42,34,28,.5)"; g.font = '500 18px "Darkroom Mono", "IBM Plex Mono", monospace'; g.fillText(lines[2], 26, 205); }
  return canvasTex(c);
}
const pinMat = new THREE.MeshStandardMaterial({ color: "#b3242f", roughness: .35, metalness: .1 });
function pin(x, y) { const p = new THREE.Mesh(new THREE.SphereGeometry(.045, 16, 12), pinMat); p.position.set(x, y, .05); p.castShadow = true; return p; }

async function build() {
  if (wall.built) return; wall.built = true;
  const g = new THREE.Group(); wall.group = g; scene.add(g);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), new THREE.MeshStandardMaterial({ map: DR.scene2.deskTex, roughness: .8, color: "#9a7a70" }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(X0, 0, 2); floor.receiveShadow = true; g.add(floor);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: .95 }));
  board.position.set(X0, 4.2, WALL_Z); board.receiveShadow = true; g.add(board);
  const lamp = new THREE.SpotLight("#ffc68a", 340, 0, .7, .7, 2);
  lamp.position.set(X0 + 1.5, 9.5, 5.5); lamp.target.position.set(X0, 3.4, WALL_Z);
  lamp.castShadow = true; lamp.shadow.mapSize.set(matchMedia("(pointer: coarse)").matches ? 512 : 1024, matchMedia("(pointer: coarse)").matches ? 512 : 1024); lamp.shadow.radius = 5; lamp.shadow.bias = -.0005;
  g.add(lamp, lamp.target);
  wall.light = (v) => { lamp.intensity = 340 * v; };
  DR.scene2.motes(g, new THREE.Vector3(X0, 3.6, 4), new THREE.Vector3(12, 6, 8));

  const rolls = DR.content.rolls, names = DR.scene2.rolls;
  const imgs = await Promise.all(rolls.map((r) => Promise.all(r.frames.map((f) => loadImg("assets/photos/thumbs/" + f.file)))));
  try { await document.fonts.load('64px "Darkroom Hand"'); } catch (e) { /* fallback */ }
  const ring = ringCanvas(), rr = rnd(42);
  const CX = [-3.45, 0, 3.45], COLS = 4, DX = .8, DY = 1.0, TOP = 5.65;
  rolls.forEach((r, ri) => {
    const pins = [];
    r.frames.forEach((f, k) => {
      const im = imgs[ri][k], land = im && im.width > im.height;
      const w = land ? .74 : .58, h = land ? .58 : .74;
      const col = k % COLS, row = Math.floor(k / COLS);
      const x = X0 + CX[ri] + (col - (COLS - 1) / 2) * DX + (rr() - .5) * .1, y = TOP - row * DY + (rr() - .5) * .1;
      const it = new THREE.Group(); it.position.set(x, y, WALL_Z + .01 + k * .002);
      const ptex = canvasTex(printCanvas(im, land));
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: ptex, roughness: .6, emissive: 0xffffff, emissiveMap: ptex, emissiveIntensity: 0 }));
      photo.castShadow = true; photo.position.y = -h / 2 + .06; it.add(photo);
      it.rotation.z = (rr() - .5) * .12;
      const pn = pin(0, 0); it.add(pn);
      // red marker ring, shown on the frames she circled on the contact sheet (see markChosen)
      const rg = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.45, h * 1.3), new THREE.MeshBasicMaterial({ map: ring, transparent: true, depthWrite: false }));
      rg.position.set(0, photo.position.y, .03); rg.visible = false; it.add(rg);
      it.userData = { roll: ri, k, home: it.position.clone(), homeR: it.rotation.z, delay: (ri * 12 + k) * .045, photo, pin: pn, ring: rg, cy: photo.position.y };
      it.scale.setScalar(REDUCED ? 1 : .001);
      g.add(it); wall.items.push(it); pins.push(new THREE.Vector3(x, y, WALL_Z + .06));
    });
    // red string through the roll in date order, sagging a little between pins
    for (let i = 0; i < pins.length - 1; i++) {
      const a = pins[i], b = pins[i + 1], mid = a.clone().lerp(b, .5); mid.y -= .12; mid.z += .02;
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 16, .007, 6), new THREE.MeshStandardMaterial({ color: "#a1222c", roughness: .6 }));
      tube.userData.delay = (ri * 12 + i) * .045 + .3; tube.visible = REDUCED; g.add(tube); wall.items.push(tube);
    }
    const card = new THREE.Mesh(new THREE.PlaneGeometry(.84, .48), new THREE.MeshStandardMaterial({ map: cardCanvas([`ROLL 0${ri + 1} · ${names[ri].year}`, names[ri].name, `${r.frames.length} FRAMES`]), roughness: .9 }));
    card.position.set(X0 + CX[ri] - 1.0, TOP + .62, WALL_Z + .02); card.rotation.z = (rr() - .5) * .08; card.castShadow = true; g.add(card);
  });
  // the letter
  const letter = new THREE.Group(); letter.position.set(X0, 1.55, WALL_Z + .03); letter.rotation.z = -.03;
  const lc = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .9), new THREE.MeshStandardMaterial({ map: cardCanvas(["FOR 曦酱 · 2026.12.14", "给你的信", "点开来读"]), roughness: .9 }));
  lc.castShadow = true; letter.add(lc); letter.add(pin(-.62, .38)); letter.add(pin(.62, .38));
  letter.userData.letter = true; lc.userData.letter = true; g.add(letter); wall.letter = letter;
  // a dark veil between the wall and a photo held up close
  wall.veil = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshBasicMaterial({ color: 0x050302, transparent: true, opacity: 0, depthWrite: false }));
  wall.veil.position.set(X0, 4, 3.2); wall.veil.visible = false; g.add(wall.veil);
}

function markChosen() {
  const chosen = DR.prints || [];
  for (const it of wall.items) if (it.userData.ring) it.userData.ring.visible = chosen.some((c) => c.roll === it.userData.roll && c.k === it.userData.k);
}
/* leaving for another room: put a held photo straight back, hide the wall */
function hide() {
  if (!wall.group) return;
  const it = wall.zoom;
  if (it) { const u = it.userData; it.position.copy(u.home); it.scale.setScalar(1); it.rotation.z = u.homeR; u.photo.material.emissiveIntensity = 0; u.pin.visible = true; wall.veil.visible = false; wall.veil.material.opacity = 0; wall.zoom = null; anim = null; }
  wall.group.visible = false;
}

/* ---------- entrance, zoom, letter ---------- */
let anim = null;
function run(d, fn, done) { anim = { t: 0, d: REDUCED ? .001 : d, fn, done }; }
DR.scene2.hooks.push((dt) => {
  if (DR.scene2.room() !== "wall") return;
  wall.t += dt;
  for (const it of wall.items) {   // pin everything up one by one
    const d = it.userData.delay; if (d === undefined || it.userData.up) continue;
    if (REDUCED || wall.t > d) {
      if (it.isGroup) {
        const x = Math.min(1, (wall.t - d) / .42), e = ease(x), o = REDUCED ? 1 : 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);   // lands with a small overshoot
        it.scale.setScalar(REDUCED ? 1 : Math.max(.001, o)); it.position.z = it.userData.home.z + (REDUCED ? 0 : (1 - e) * .5); if (e >= 1 || REDUCED) { it.userData.up = true; it.position.z = it.userData.home.z; if (!REDUCED && it.userData.k % 2 === 0) sfx.pin(); }
      }
      else { it.visible = true; it.userData.up = true; }
    }
  }
  if (anim) { anim.t += dt; anim.fn(ease(anim.t / anim.d)); if (anim.t >= anim.d) { const a = anim; anim = null; a.done && a.done(); } }
  updateClocks();
});
const cap = $("cap"), capMeta = $("capMeta"), capLine = $("capLine");
function zoomIn(it) {
  if (anim || wall.zoom) return;
  wall.zoom = it; const from = it.position.clone(), r0 = it.rotation.z, u = it.userData; sfx.lift();
  const to = FOCUS.clone().sub(new THREE.Vector3(0, u.cy * ZOOM, 0));   // centre the photo, not the pin
  u.pin.visible = false; wall.veil.visible = true; it.renderOrder = 3;
  const f = DR.content.rolls[it.userData.roll].frames[it.userData.k];
  capMeta.textContent = `${f.date}　·　${f.place}　·　ROLL 0${it.userData.roll + 1} FRAME ${pad(it.userData.k + 1)}`; capLine.textContent = f.line; cap.classList.add("show");
  run(.55, (e) => { it.position.lerpVectors(from, to, e); it.scale.setScalar(1 + e * (ZOOM - 1)); it.rotation.z = r0 * (1 - e); u.photo.material.emissiveIntensity = e * .7; wall.veil.material.opacity = e * .72; });
  DR.room.hint("再点一下，放回墙上");
}
function zoomOut() {
  const it = wall.zoom; if (!it || anim) return;
  const from = it.position.clone(); sfx.pin(); cap.classList.remove("show");
  const u = it.userData;
  run(.5, (e) => { it.position.lerpVectors(from, u.home, e); it.scale.setScalar(ZOOM - e * (ZOOM - 1)); it.rotation.z = u.homeR * e; u.photo.material.emissiveIntensity = .7 * (1 - e); wall.veil.material.opacity = .72 * (1 - e); },
    () => { wall.zoom = null; u.pin.visible = true; wall.veil.visible = false; });
  DR.room.hint(wall.read ? "三周年快乐" : "点一张照片看看。最后，读那封信");
}
function readLetter() {
  const e = DR.content.ending; if (!e) { DR.toast && DR.toast("信还没写好"); return; }
  sfx.paper(); DR.openReader(e.text, e.sign); wall.read = true; if (DR.scene2.room() === "wall") DR.room.hint("三周年快乐");
}
function hitItem(e) {
  const h = S.ray(e).intersectObjects([...wall.items.filter((i) => i.isGroup), wall.letter], true)[0]; if (!h) return null;
  let o = h.object; while (o && !o.userData.letter && o.userData.roll === undefined) o = o.parent; return o;
}
canvas.addEventListener("click", (e) => {
  if (DR.scene2.room() !== "wall") return;
  if (wall.zoom) { zoomOut(); return; }
  const o = hitItem(e); if (!o) return;
  if (o.userData.letter) readLetter(); else zoomIn(o);
});
let wallHover = null;
canvas.addEventListener("pointermove", (e) => {
  if (DR.scene2.room() !== "wall") return;
  const o = wall.zoom ? null : hitItem(e); canvas.style.cursor = wall.zoom || o ? "pointer" : "default";
  if (o !== wallHover) { wallHover = o; if (o) sfx.hover(); }
});
addEventListener("keydown", (e) => { if (DR.scene2.room() === "wall" && e.key === "Escape" && wall.zoom && !$("reader").classList.contains("on")) zoomOut(); });

/* Shangrao and Melbourne, side by side */
let lastClock = 0;
function updateClocks() {
  const now = Date.now(); if (now - lastClock < 15000) return; lastClock = now;
  const f = (tz) => new Intl.DateTimeFormat("zh-CN", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  $("rmClocks").textContent = `上饶 ${f("Asia/Shanghai")}　　墨尔本 ${f("Australia/Melbourne")}`;
}

/* start over from the envelope: fade to black, then load the page fresh */
function replay() {
  sfx.paper(); $("fader").classList.add("on");
  setTimeout(() => { if (location.hash) location.replace(location.pathname + location.search); else location.reload(); }, REDUCED ? 0 : 600);
}
async function openWall() {
  DR.scene4 && DR.scene4.ensurePrints();
  DR.scene2.fade(async () => {
    await build();
    DR.scene4 && DR.scene4.leaveAll();
    wall.group.visible = true; markChosen();
    DR.scene2.enterRoom("wall", VIEW, { instant: true }); DR.scene2.lightUp(wall.light);
    if (!wall.seen) { wall.seen = true; wall.t = -1.2; }   // the first time: wait for the lamp, then pin them up
    const R = DR.room; R.show(true);
    $("room").classList.add("wall"); lastClock = 0; updateClocks();
    R.hint(wall.read ? "三周年快乐" : "点一张照片看看。最后，读那封信");
    R.next("重新看一遍 ↺", replay);
    DR.hud && DR.hud("SCENE 05 — 照片墙");
    // she has seen it all once: from now on every room is open (ui.js shows the index)
    if (!DR.unlocked) { DR.unlocked = true; DR.store && DR.store.set("dr-unlocked", "1"); dispatchEvent(new CustomEvent("darkroom:unlocked")); }
  });
}
addEventListener("darkroom:wall", openWall);
// debug hook for screenshots: #wall
if (location.hash === "#wall") {
  const go = () => setTimeout(() => { DR.prints = [{ roll: 0, k: 0 }, { roll: 1, k: 3 }, { roll: 2, k: 7 }]; openWall(); }, 400);
  if (DR.content) go(); else addEventListener("darkroom:content", go, { once: true });
}
DR.scene5 = { zoom: (i) => zoomIn(wall.items.filter((x) => x.isGroup)[i]), zoomOut, readLetter, hide };
