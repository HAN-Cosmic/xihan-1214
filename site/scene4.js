/* Scene 04 — the darkroom.
   Part 1, the contact sheet: all three rolls printed small on one sheet; circle the ones to print.
   Part 2, the tray: paper into the developer, wait for it, lift it out with the tongs,
   peg it on the line, tap a print to turn it over and read the back. */
import { sfx } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DR = window.DARKROOM;
const S = DR.scene2.three, { THREE, scene, camera, canvas } = S;
const ease = (t) => { t = Math.min(1, Math.max(0, t)); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const dur = (s) => (REDUCED ? .001 : s);
const pad = (n) => String(n).padStart(2, "0");
const MAX_PRINTS = 4;

/* ---------- room overlay (shared with scene5.js) ---------- */
const roomEl = $("room"), hintEl = $("rmHint"), altEl = $("rmAlt"), backEl = $("rmBack"), nextEl = $("rmNext"), annEl = $("rmAnn");
const UI = {
  show(on) { roomEl.classList.toggle("on", on); roomEl.setAttribute("aria-hidden", on ? "false" : "true"); },
  hint(t) { hintEl.classList.remove("show"); clearTimeout(hintEl._h); hintEl._h = setTimeout(() => { hintEl.textContent = t; hintEl.classList.toggle("show", !!t); }, REDUCED ? 0 : 200); },
  alt(t, fn) { altEl.textContent = t || ""; altEl.classList.toggle("show", !!t); altEl.onclick = fn || null; },
  back(t, fn) { backEl.textContent = t || ""; backEl.classList.toggle("show", !!t); backEl.onclick = fn || null; },
  next(t, fn) { nextEl.textContent = t || ""; nextEl.classList.toggle("show", !!t); nextEl.onclick = fn || null; },
  ann(t, world) { annEl.classList.toggle("show", !!t); if (t) { $("rmAnnText").textContent = t; UI.annAt = world; } else UI.annAt = null; },
  annAt: null,
};
DR.room = UI;
DR.scene2.hooks.push(() => {
  if (!UI.annAt) return;
  const p = UI.annAt.clone().project(camera);
  annEl.style.left = ((p.x + 1) / 2 * canvas.clientWidth) + "px"; annEl.style.top = ((1 - p.y) / 2 * canvas.clientHeight) + "px";
});
DR.prints = [];   // [{ roll, k }] in the order they were circled
const savePrints = () => DR.store && DR.store.set("dr-prints", JSON.stringify(DR.prints));
/* coming straight to the tray or the wall (index, or a later visit): use what she circled last time, else a default pick */
function ensurePrints() {
  if (DR.prints.length) return;
  const rolls = rollsData(), ok = (p) => p && rolls[p.roll] && rolls[p.roll].frames[p.k];
  let list = []; try { list = JSON.parse((DR.store && DR.store.get("dr-prints")) || "[]"); } catch (e) { list = []; }
  list = Array.isArray(list) ? list.filter(ok).slice(0, MAX_PRINTS) : [];
  DR.prints = list.length ? list : [{ roll: 0, k: 0 }, { roll: 1, k: 3 }, { roll: 2, k: 7 }].filter(ok);
}
/* every room is hidden before the next one shows itself */
function leaveAll() {
  if (sheet.mesh) sheet.mesh.visible = false;
  if (sheet.stroke) { sheet.stroke = null; sfx.scribbleStop(); }
  if (tray.group) {
    tray.group.visible = false; tray.prints.forEach((p) => (p.grp.visible = false));
    if (!["ready", "all", "developing", "await-lift"].includes(tray.state)) tray.key = null;   // left mid-move: start that room over next time
  }
  DR.scene5 && DR.scene5.hide();
  roomEl.classList.remove("wall"); $("cap").classList.remove("show");
  UI.back(""); UI.next(""); UI.alt(""); UI.ann(""); UI.hint("");
}
function goDesk() {
  if (!DR.scene2.room()) { DR.scene2.unpick(); return; }
  DR.scene2.fade(() => { leaveAll(); UI.show(false); DR.scene2.enterRoom(null, null, { instant: true }); DR.hud && DR.hud("SCENE 02 — 胶卷"); });
}

function rollsData() { return (DR.content && DR.content.rolls) || []; }
function loadImg(src) { return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
function drawCover(g, im, x, y, w, h) {
  if (!im) { g.fillStyle = "#2a1a14"; g.fillRect(x, y, w, h); return; }
  const a = im.width / im.height, t = w / h; let sw = im.width, sh = im.height, sx = 0, sy = 0;
  if (a > t) { sw = im.height * t; sx = (im.width - sw) / 2; } else { sh = im.width / t; sy = (im.height - sh) / 2; }
  g.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}

/* =====================================================================
   Part 1 — contact sheet
   ===================================================================== */
const SW = 2048, SH = 1344, SHEET_W = 6.6, SHEET_H = SHEET_W * SH / SW;
const SHEET_POS = new THREE.Vector3(-.45, .016, .35);
const VIEW_SHEET = { pos: new THREE.Vector3(-.45, 8.4, 4.6), look: new THREE.Vector3(-.45, 0, .25) };
const sheet = { mesh: null, base: null, ink: null, comp: null, tex: null, cells: [], stroke: null, dirty: false };

async function buildSheet() {
  if (sheet.mesh) return;
  const base = document.createElement("canvas"); base.width = SW; base.height = SH;
  const g = base.getContext("2d");
  g.fillStyle = "#efe6d6"; g.fillRect(0, 0, SW, SH);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(120,90,60,${Math.random() * .035})`; g.fillRect(Math.random() * SW, Math.random() * SH, 2, 2); }
  g.fillStyle = "rgba(42,34,28,.55)"; g.font = '500 30px "Darkroom Mono", "IBM Plex Mono", monospace';
  g.fillText("DARKROOM No.1214   ·   CONTACT SHEET   ·   3 ROLLS", 150, 112);
  g.textAlign = "right"; g.fillText("上饶 ⇄ 墨尔本", SW - 70, 112); g.textAlign = "left";
  const rolls = rollsData(), names = DR.scene2.rolls;
  const FW = 141, FH = 188, GAP = 12, BAND = 40, X0 = 150, ROW = FH + BAND * 2, Y0 = 170, RG = 74;
  const imgs = await Promise.all(rolls.flatMap((r) => r.frames.map((f) => loadImg("assets/photos/thumbs/" + f.file))));
  let n = 0; sheet.cells = [];
  rolls.forEach((r, ri) => {
    const y = Y0 + ri * (ROW + RG), len = r.frames.length * (FW + GAP) + GAP;
    g.fillStyle = "#14100e"; g.fillRect(X0, y, len, ROW);
    g.fillStyle = "rgba(239,230,214,.82)";
    for (let x = X0 + 10; x < X0 + len - 20; x += 36) { g.fillRect(x, y + 12, 16, 16); g.fillRect(x, y + ROW - 28, 16, 16); }
    g.save(); g.translate(X0 - 34, y + ROW / 2); g.rotate(-Math.PI / 2); g.textAlign = "center";
    g.fillStyle = "rgba(42,34,28,.6)"; g.font = '500 24px "Darkroom Mono", "IBM Plex Mono", monospace'; g.fillText(`ROLL 0${ri + 1} · ${names[ri].name}`, 0, 0); g.restore();
    r.frames.forEach((f, k) => {
      const x = X0 + GAP + k * (FW + GAP), fy = y + BAND;
      drawCover(g, imgs[n++], x, fy, FW, FH);
      g.fillStyle = "rgba(239,230,214,.7)"; g.font = '500 15px "Darkroom Mono", "IBM Plex Mono", monospace'; g.fillText(`${k + 1}A`, x + 2, y + ROW - 4);
      sheet.cells.push({ roll: ri, k, x, y: fy, w: FW, h: FH });
    });
  });
  const ink = document.createElement("canvas"); ink.width = SW; ink.height = SH;
  const comp = document.createElement("canvas"); comp.width = SW; comp.height = SH;
  Object.assign(sheet, { base, ink, comp });
  composite();
  sheet.tex = new THREE.CanvasTexture(comp); sheet.tex.colorSpace = THREE.SRGBColorSpace; sheet.tex.anisotropy = 8;
  sheet.mesh = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H), new THREE.MeshStandardMaterial({ map: sheet.tex, roughness: .92 }));
  sheet.mesh.rotation.x = -Math.PI / 2; sheet.mesh.position.copy(SHEET_POS); sheet.mesh.receiveShadow = true;
  sheet.mesh.visible = false; scene.add(sheet.mesh);
}
function inkCircle(c) {   // a marker circle around one frame, drawn as if by hand
  const pts = []; for (let a = -.2; a <= 6.6; a += .25) pts.push({ x: c.x + c.w / 2 + Math.cos(a) * c.w * .72 * (1 + .05 * Math.sin(a * 3)), y: c.y + c.h / 2 + Math.sin(a) * c.h * .66 });
  for (let i = 2; i < pts.length; i++) inkSegment(pts[i - 2], pts[i - 1], pts[i]);
  return pts;
}
/* the sheet always shows what is in DR.prints: redraw the ink when the selection came from somewhere else */
function syncSheetInk() {
  const key = JSON.stringify(DR.prints); if (sheet.inked === key) return;
  sheet.ink.getContext("2d").clearRect(0, 0, SW, SH);
  for (const p of DR.prints) { const c = sheet.cells.find((x) => x.roll === p.roll && x.k === p.k); if (c) inkCircle(c); }
  sheet.inked = key; sheet.dirty = true;
}
function clearSheet() {
  DR.prints = []; savePrints(); sheet.ink.getContext("2d").clearRect(0, 0, SW, SH); sheet.inked = "[]"; sheet.dirty = true; sfx.paper(); sheetCount();
}
function composite() { const g = sheet.comp.getContext("2d"); g.drawImage(sheet.base, 0, 0); g.drawImage(sheet.ink, 0, 0); if (sheet.tex) sheet.tex.needsUpdate = true; }
DR.scene2.hooks.push(() => { if (sheet.dirty) { sheet.dirty = false; composite(); } });

function sheetPoint(e) {
  const h = S.ray(e).intersectObject(sheet.mesh)[0]; if (!h || !h.uv) return null;
  return { x: h.uv.x * SW, y: (1 - h.uv.y) * SH };
}
function inkSegment(a, b, c) {   // marker stroke from the midpoint of a-b to the midpoint of b-c
  const g = sheet.ink.getContext("2d");
  g.lineCap = g.lineJoin = "round"; g.strokeStyle = "rgba(179,36,47,.86)"; g.lineWidth = 9 + Math.random() * 1.5;
  g.beginPath(); g.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2); g.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2); g.stroke();
  g.strokeStyle = "rgba(140,20,30,.25)"; g.lineWidth = 3; g.stroke();
  sheet.dirty = true;
}
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
function circled(pts) {   // which frame (if any) did this stroke go around?
  if (pts.length < 10) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, cx = 0, cy = 0;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  let best = null, bd = 1e9;
  for (const c of sheet.cells) {
    const mx = c.x + c.w / 2, my = c.y + c.h / 2;
    if (x1 - x0 < c.w * .5 || y1 - y0 < c.h * .5 || x1 - x0 > c.w * 4.2 || y1 - y0 > c.h * 3.4) continue;
    if (!inside({ x: mx, y: my }, pts)) continue;
    const d = Math.hypot(mx - cx, my - cy); if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function sheetCount() {
  UI.next(DR.prints.length ? "去冲洗 →" : "", () => openTray());
  UI.alt(DR.prints.length ? "擦掉重圈" : "", clearSheet);
}
function sheetDown(e) {
  const p = sheetPoint(e); if (!p) return;
  sheet.stroke = { pts: [p], t: performance.now() }; canvas.setPointerCapture(e.pointerId);
}
function sheetMove(e) {
  const st = sheet.stroke; if (!st) { canvas.style.cursor = sheetPoint(e) ? "crosshair" : "default"; return; }
  const p = sheetPoint(e); if (!p) return;
  const last = st.pts[st.pts.length - 1], d = Math.hypot(p.x - last.x, p.y - last.y); if (d < 4) return;
  st.pts.push(p);
  const n = st.pts.length; if (n >= 3) inkSegment(st.pts[n - 3], st.pts[n - 2], st.pts[n - 1]); else inkSegment(last, last, p);
  const now = performance.now(), sp = d / Math.max(1, now - st.t) * 1000 * (canvas.clientWidth / SW); st.t = now;
  sfx.scribble(sp);
}
function sheetUp() {
  const st = sheet.stroke; if (!st) return; sheet.stroke = null; sfx.scribbleStop();
  const c = circled(st.pts); if (!c) return;   // anything else (a heart, a word) is just ink
  if (DR.prints.some((p) => p.roll === c.roll && p.k === c.k)) return;
  if (DR.prints.length >= MAX_PRINTS) { DR.toast && DR.toast(`最多冲洗 ${MAX_PRINTS} 张`); return; }
  DR.prints.push({ roll: c.roll, k: c.k }); sheet.inked = JSON.stringify(DR.prints); savePrints();
  sfx.tick(.7); setTimeout(() => sfx.tick(.4), 90); sheetCount();
}

function openSheet() {
  DR.scene2.fade(async () => {
    await buildSheet(); leaveAll(); syncSheetInk();
    sheet.mesh.visible = true;
    DR.scene2.enterRoom("sheet", VIEW_SHEET, { instant: true });
    UI.show(true); DR.hud && DR.hud("SCENE 04 — 印样");
    UI.hint("圈出想冲洗的照片，最多 4 张。画个爱心，就是你最喜欢它"); sheetCount();
    UI.back("← 回到胶卷", goDesk);
  });
}
addEventListener("darkroom:sheet", openSheet);

/* =====================================================================
   Part 2 — the tray
   ===================================================================== */
const X0 = 40;
const VIEW_TRAY = { pos: new THREE.Vector3(X0, 3.9, 10.6), look: new THREE.Vector3(X0, 1.55, -.6) };
const TRAY_C = new THREE.Vector3(X0, 0, .45), LIQ_Y = .2, LINE_Y = 3.3, LINE_Z = -1.7;
const PAPER_POS = new THREE.Vector3(X0 - 3.35, 0, 1.0), TONGS_HOME = new THREE.Vector3(X0 + 2.25, .1, 1.35);
const FRONT = new THREE.Vector3(X0, 2.3, 5.4);
const tray = { group: null, liquid: null, ripples: [], paper: null, paperLabel: null, tongs: null, prints: [], state: "idle", cur: -1, anim: null, level: 0, drops: [], key: null };
const EMPTY_Y = .05;

function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function buildTray() {
  if (tray.group) return;
  const g = new THREE.Group(); tray.group = g; scene.add(g);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), new THREE.MeshStandardMaterial({ map: DR.scene2.deskTex, roughness: .8, color: "#caa59b" }));
  desk.rotation.x = -Math.PI / 2; desk.position.set(X0, 0, 0); desk.receiveShadow = true; g.add(desk);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshStandardMaterial({ color: "#2a0d0b", roughness: 1 }));
  wall.position.set(X0, 6, -3.4); wall.receiveShadow = true; g.add(wall);
  // red safelight
  const safe = new THREE.SpotLight("#ff4532", 420, 0, .78, .65, 2);
  safe.position.set(X0 + 1.2, 8.5, 4.2); safe.target.position.set(X0, .6, -.6);
  safe.castShadow = true; safe.shadow.mapSize.set(matchMedia("(pointer: coarse)").matches ? 512 : 1024, matchMedia("(pointer: coarse)").matches ? 512 : 1024); safe.shadow.radius = 5; safe.shadow.bias = -.0005;
  g.add(safe, safe.target);
  const fill = new THREE.PointLight("#ff6a4a", 6, 12, 2); fill.position.set(X0 - 3, 3, 4); g.add(fill);
  tray.light = (v) => { safe.intensity = 420 * v; fill.intensity = 6 * v; };
  DR.scene2.motes(g, new THREE.Vector3(X0, 2.6, 1.5), new THREE.Vector3(9, 4.6, 6), "#ff8a66");
  // tray
  const metal = new THREE.MeshStandardMaterial({ color: "#a39c95", metalness: .85, roughness: .32 });
  const tw = 3.4, td = 2.4, th = .3, wt = .06;
  const base = new THREE.Mesh(new THREE.BoxGeometry(tw, .04, td), metal); base.position.set(TRAY_C.x, .02, TRAY_C.z); base.receiveShadow = true; g.add(base);
  for (const [w, d, x, z] of [[tw, wt, 0, -td / 2], [tw, wt, 0, td / 2], [wt, td, -tw / 2, 0], [wt, td, tw / 2, 0]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), metal); m.position.set(TRAY_C.x + x, th / 2, TRAY_C.z + z); m.castShadow = m.receiveShadow = true; g.add(m);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w + (d === wt ? .06 : .1), .03, d + (w === wt ? .06 : .1)), metal); lip.position.set(TRAY_C.x + x, th, TRAY_C.z + z); g.add(lip);
  }
  const lg = new THREE.PlaneGeometry(tw - .12, td - .12, 56, 40); lg.rotateX(-Math.PI / 2);
  tray.liquid = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: "#4a1a12", transparent: true, opacity: .58, roughness: .05, metalness: .4, depthWrite: false }));
  tray.liquid.position.set(TRAY_C.x, LIQ_Y, TRAY_C.z); tray.liquid.renderOrder = 2; g.add(tray.liquid);
  setLevel(REDUCED ? 1 : 0);
  tray.liquidBase = Float32Array.from(lg.attributes.position.array);
  // paper stack with a hand-written count
  tray.paper = new THREE.Mesh(new THREE.BoxGeometry(1.15, .1, 1.45), new THREE.MeshStandardMaterial({ color: "#eee4d2", roughness: .9 }));
  tray.paper.position.set(PAPER_POS.x, .05, PAPER_POS.z); tray.paper.rotation.y = .08; tray.paper.castShadow = tray.paper.receiveShadow = true; g.add(tray.paper);
  const lc = document.createElement("canvas"); lc.width = 256; lc.height = 320; tray.paperLabelCanvas = lc;
  tray.paperLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.43), new THREE.MeshStandardMaterial({ map: canvasTex(lc), transparent: true, roughness: .9 }));
  tray.paperLabel.rotation.x = -Math.PI / 2; tray.paperLabel.position.set(0, .051, 0); tray.paper.add(tray.paperLabel);
  // tongs
  const bamboo = new THREE.MeshStandardMaterial({ color: "#c99a5a", roughness: .6 });
  const rub = new THREE.MeshStandardMaterial({ color: "#b3242f", roughness: .5 });
  tray.tongs = new THREE.Group();
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.07, .035, 1.5), bamboo); arm.position.set(s * .05, 0, 0); arm.rotation.y = s * .035; arm.castShadow = true; tray.tongs.add(arm);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(.08, .045, .22), rub); tip.position.set(s * .075, 0, -.68); tray.tongs.add(tip);
  }
  tray.tongs.position.copy(TONGS_HOME); tray.tongs.rotation.y = .7; g.add(tray.tongs);
  // chemistry bottles
  const glass = new THREE.MeshStandardMaterial({ color: "#1c1210", metalness: .3, roughness: .35 });
  const brass = new THREE.MeshStandardMaterial({ color: "#b49a6a", metalness: .9, roughness: .3 });
  for (const [x, z, h] of [[3.5, -.9, 1.05], [4.25, -.55, .85], [3.75, .05, .75]]) {
    const bottle = new THREE.Group(); bottle.position.set(X0 + x, 0, z); g.add(bottle);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.33, .33, h, 32), glass); b.position.y = h / 2; b.castShadow = true; bottle.add(b);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.17, .2, .1, 24), glass); neck.position.y = h + .05; bottle.add(neck);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.2, .22, .14, 24), brass); c.position.set(X0 + x, h + .12, z); c.castShadow = true; g.add(c);
    if (h === .75) tray.pourer = { bottle, cap: c, h: h + .1, home: bottle.position.clone(), capHome: c.position.clone() };   // the one in front does the pouring
  }
  // the stream of developer and the drops that fall off a wet print
  // where the stream lands: a pool that spreads out first, and a ring of froth
  tray.pool = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: "#4a1a12", transparent: true, opacity: .62, roughness: .05, metalness: .4, depthWrite: false }));
  tray.pool.rotation.x = -Math.PI / 2; tray.pool.visible = false; tray.pool.renderOrder = 2; g.add(tray.pool);
  tray.froth = new THREE.Mesh(new THREE.RingGeometry(.05, .13, 28), new THREE.MeshBasicMaterial({ color: "#ffb39a", transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }));
  tray.froth.rotation.x = -Math.PI / 2; tray.froth.visible = false; tray.froth.renderOrder = 3; g.add(tray.froth);
  tray.stream = new THREE.Mesh(new THREE.CylinderGeometry(.04, .03, 1, 12), new THREE.MeshStandardMaterial({ color: "#7a2418", emissive: "#3a0d08", roughness: .1, metalness: .3, transparent: true, opacity: .8 }));
  tray.stream.visible = false; g.add(tray.stream);
  tray.dropGeo = new THREE.SphereGeometry(.022, 8, 6); tray.dropMat = new THREE.MeshStandardMaterial({ color: "#8a2a1c", emissive: "#3a0d08", roughness: .1, metalness: .3 });
  // drying line
  const line = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 12, 8), new THREE.MeshStandardMaterial({ color: "#d8cfc0", roughness: .7 }));
  line.rotation.z = Math.PI / 2; line.position.set(X0, LINE_Y, LINE_Z); g.add(line);
  g.visible = false;
}
function paperLabel() {
  const c = tray.paperLabelCanvas, g = c.getContext("2d"), left = DR.prints.length - tray.prints.length;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "rgba(42,34,28,.45)"; g.font = '500 18px "Darkroom Mono", "IBM Plex Mono", monospace'; g.fillText("PHOTO PAPER", 22, 40);
  g.fillStyle = "#b3242f"; g.font = '64px "Darkroom Hand", "Long Cang", "Kaiti SC", cursive'; g.fillText(`相纸 · ${left}`, 22, 130);
  tray.paperLabel.material.map.needsUpdate = true;
}

/* developer in the tray: 0 = empty, 1 = full */
function setLevel(v) {
  tray.level = v; tray.liquid.position.y = EMPTY_Y + (LIQ_Y - EMPTY_Y) * v;
  tray.liquid.material.opacity = .58 * Math.min(1, Math.max(0, v - .12) * 3.5); tray.liquid.visible = v > .12;
}
/* the tray starts empty: the front bottle is uncapped, carried over and poured in, then put back */
function pourIn(done) {
  const P = tray.pourer, b = P.bottle, TILT = 1.95;
  const mouth = v3(TRAY_C.x + .85, 1.25, TRAY_C.z + .15), sx = mouth.x - .03;
  const at = (a) => v3(mouth.x + Math.sin(a) * P.h, mouth.y - Math.cos(a) * P.h, mouth.z);   // bottle base for a given tilt, mouth held still
  const up = at(0), capSide = P.capHome.clone().add(v3(.55, 0, .45)).setY(.07);
  tray.state = "pouring"; UI.hint("先倒上显影液……");
  const c0 = P.capHome.clone(); sfx.tick(.5);
  run(.35, (e) => { P.cap.position.lerpVectors(c0, capSide, e); P.cap.position.y += Math.sin(e * Math.PI) * .35; }, () => {
    run(.7, (e) => { b.position.lerpVectors(P.home, up, e); b.position.y += Math.sin(e * Math.PI) * .2; }, () => {
      run(.45, (e) => { b.rotation.z = TILT * e; b.position.copy(at(TILT * e)); }, () => {
        sfx.pour(2.4); tray.stream.visible = true; let rip = 0;
        run(2.4, (e, x) => {
          setLevel(Math.min(1, x)); const top = mouth.y - .04, bot = tray.liquid.position.y, t = performance.now() / 1000;
          // the first splash spreads into a pool around the stream, then the whole tray fills
          const pr = Math.min(1, x / .35); tray.pool.visible = true; tray.pool.position.set(sx - .25 * pr, bot + .002, mouth.z);
          tray.pool.scale.setScalar(.08 + 1.1 * (1 - Math.pow(1 - pr, 2))); tray.pool.material.opacity = .62 * (x < .5 ? 1 : 1 - (x - .5) * 2);
          tray.froth.visible = true; tray.froth.position.set(sx, bot + .006, mouth.z); tray.froth.scale.setScalar(1 + Math.sin(t * 23) * .15); tray.froth.material.opacity = .35 + Math.sin(t * 17) * .12;
          tray.stream.position.set(sx, (top + bot) / 2, mouth.z); tray.stream.scale.set(1 + Math.sin(t * 38) * .18, top - bot, 1 + Math.cos(t * 31) * .18);
          if (x > rip) { rip += .09; ripple(sx + (Math.random() - .5) * .1, mouth.z + (Math.random() - .5) * .1, .02); }
          b.rotation.z = TILT + Math.sin(t * 3) * .02 + x * .12; b.position.copy(at(b.rotation.z));
        }, () => {
          tray.stream.visible = tray.pool.visible = tray.froth.visible = false; setLevel(1); for (let i = 0; i < 3; i++) setTimeout(() => { drop(v3(sx, mouth.y - .06, mouth.z)); }, 120 + i * 260);
          const r0 = b.rotation.z;
          run(.4, (e) => { b.rotation.z = r0 * (1 - e); b.position.copy(at(b.rotation.z)); }, () => {
            run(.65, (e) => { b.position.lerpVectors(up, P.home, e); b.position.y += Math.sin(e * Math.PI) * .2; }, () => {
              const c1 = P.cap.position.clone();
              run(.3, (e) => { P.cap.position.lerpVectors(c1, P.capHome, e); P.cap.position.y += Math.sin(e * Math.PI) * .3; }, () => { sfx.tick(.5); done(); });
            });
          });
        });
      });
    });
  });
}
function drop(from) {
  if (REDUCED) return; const m = new THREE.Mesh(tray.dropGeo, tray.dropMat); m.position.copy(from); tray.group.add(m); tray.drops.push({ m, vy: 0 });
}
function updateDrops(dt) {
  for (let i = tray.drops.length - 1; i >= 0; i--) {
    const d = tray.drops[i]; d.vy -= 9 * dt; d.m.position.y += d.vy * dt; d.m.scale.y = 1 + Math.min(1.2, -d.vy * .25);
    const p = d.m.position, inTray = Math.abs(p.x - TRAY_C.x) < 1.6 && Math.abs(p.z - TRAY_C.z) < 1.1;
    if (p.y < (inTray ? tray.liquid.position.y : .02)) { if (inTray) { ripple(p.x, p.z, .012); sfx.drip(); } tray.group.remove(d.m); tray.drops.splice(i, 1); }
  }
}

/* print = front (develops from white) + back (hand-written note) */
function printMaterial(tex) {
  // emissive lets a print "come into the light" when it is held up close
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: .55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
  const u = { uDev: { value: 0 } }; m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDev = u.uDev;
    sh.fragmentShader = "uniform float uDev;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      vec3 pc = diffuseColor.rgb;
      float l = dot(pc, vec3(.3, .59, .11));
      vec3 toned = mix(pc, vec3(l) * vec3(1.08, .96, .8), .3);
      // the image comes up from white: shadows first, then the mid-tones
      float t = clamp(uDev * 1.25 - (1.0 - l) * .25, 0.0, 1.0);
      diffuseColor.rgb = mix(vec3(.9, .88, .84), toned, smoothstep(0.0, 1.0, t));`);
  };
  return m;
}
async function makePrint(p, idx) {
  const rolls = rollsData(), f = rolls[p.roll].frames[p.k], name = DR.scene2.rolls[p.roll].name;
  const im = await loadImg("assets/photos/" + f.file);
  const land = im && im.width > im.height;
  const PW = land ? 1.36 : 1.08, PH = land ? 1.08 : 1.36, CW = land ? 860 : 680, CH = land ? 680 : 860;
  const fc = document.createElement("canvas"); fc.width = CW; fc.height = CH; const g = fc.getContext("2d");
  g.fillStyle = "#f2ece0"; g.fillRect(0, 0, CW, CH);
  const m = 46; drawCover(g, im, m, m, CW - m * 2, CH - m * 2.6);
  g.fillStyle = "rgba(42,34,28,.5)"; g.font = '500 20px "Darkroom Mono", "IBM Plex Mono", monospace'; g.fillText(`${name} · ${pad(p.k + 1)}`, m, CH - 30);
  const bc = document.createElement("canvas"); bc.width = CW; bc.height = CH; const b = bc.getContext("2d");
  b.fillStyle = "#f1eadc"; b.fillRect(0, 0, CW, CH);
  for (let i = 0; i < 2500; i++) { b.fillStyle = `rgba(120,90,60,${Math.random() * .04})`; b.fillRect(Math.random() * CW, Math.random() * CH, 2, 2); }
  b.fillStyle = "rgba(42,34,28,.5)"; b.font = '500 20px "Darkroom Mono", "IBM Plex Mono", monospace'; b.fillText(`ROLL 0${p.roll + 1} · ${name} · FRAME ${pad(p.k + 1)}`, 50, 70);
  b.fillStyle = "#2a221c"; b.font = '64px "Darkroom Hand", "Long Cang", "Kaiti SC", cursive'; b.fillText(f.date, 50, 170);
  b.font = '46px "Darkroom Hand", "Long Cang", "Kaiti SC", cursive'; b.fillStyle = "#3a2a22";
  let line = "", y = 260; const maxW = CW - 100;
  for (const ch of f.line) { if (b.measureText(line + ch).width > maxW) { b.fillText(line, 50, y); line = ch; y += 66; } else line += ch; }
  if (line) b.fillText(line, 50, y);
  b.fillStyle = "rgba(42,34,28,.45)"; b.font = '500 22px "Darkroom Mono", "IBM Plex Mono", monospace'; b.fillText(f.place, 50, CH - 50);
  const grp = new THREE.Group();
  const mat = printMaterial(canvasTex(fc));
  const front = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat); front.castShadow = true;
  const btex = canvasTex(bc);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: btex, roughness: .9, emissive: 0xffffff, emissiveMap: btex, emissiveIntensity: 0 }));
  back.rotation.y = Math.PI; back.position.z = -.002; back.castShadow = true;
  grp.add(front, back); grp.userData.print = idx;
  front.userData.print = back.userData.print = idx;
  const peg = new THREE.Mesh(new THREE.BoxGeometry(.09, .3, .1), new THREE.MeshStandardMaterial({ color: "#a8743c", roughness: .7 }));
  peg.position.set(0, PH / 2 + .02, .02); peg.visible = false; grp.add(peg);
  scene.add(grp);
  const glow = (v) => { mat.emissiveIntensity = v; back.material.emissiveIntensity = v; };
  return { grp, front, mat, peg, PW, PH, slot: idx, state: "new", sway: Math.random() * 6, swing: 0, wet: 0, glow };
}
function slotPos(i, pr) { const n = DR.prints.length, gap = Math.min(1.9, 8 / Math.max(1, n)); return new THREE.Vector3(X0 + (i - (n - 1) / 2) * gap, LINE_Y - pr.PH / 2 - .03, LINE_Z + .05); }

/* simple keyframe runner: anim = { t, d, fn(e), done() } */
function run(d, fn, done) { tray.anim = { t: 0, d: dur(d), fn, done }; }
DR.scene2.hooks.push((dt, k, t) => {
  if (DR.scene2.room() !== "tray") return;
  if (tray.anim) { const a = tray.anim; a.t += dt; a.fn(ease(a.t / a.d), a.t / a.d); if (a.t >= a.d) { tray.anim = null; a.done && a.done(); } }
  // developing
  const cur = tray.prints[tray.cur];
  if (tray.state === "developing" && cur) {
    const u = cur.mat.userData.u.uDev; u.value = Math.min(1, u.value + dt / 4);
    if (u.value >= 1) { tray.state = "await-lift"; UI.hint("用夹子把它夹起来"); UI.ann("夹子", TONGS_HOME.clone().add(new THREE.Vector3(.2, .2, 0))); }
  }
  // hung prints sway a little; a freshly pegged one swings and drips for a moment
  tray.prints.forEach((p) => {
    if (p.state !== "hung") return;
    p.swing = Math.max(0, p.swing - dt * .55);
    p.grp.rotation.z = REDUCED ? 0 : Math.sin(t * 1.1 + p.sway) * .025 + Math.sin(t * 5.2) * .11 * p.swing * p.swing;
    if (p.wet > 0 && (p.wet -= dt) < p.nextDrip) { p.nextDrip = p.wet - .5 - Math.random() * .7; drop(p.grp.position.clone().add(v3((Math.random() - .5) * p.PW * .7, -p.PH / 2, 0))); }
  });
  updateDrops(dt);
  // ripples on the developer
  updateLiquid(dt);
});
function ripple(x, z, amp = .03) { if (!REDUCED) tray.ripples.push({ x, z, age: 0, amp }); }
function updateLiquid(dt) {
  const geo = tray.liquid.geometry, pos = geo.attributes.position, b = tray.liquidBase;
  tray.ripples = tray.ripples.filter((r) => (r.age += dt) < 3.5);
  if (!tray.ripples.length && !tray.liquidMoving) return;
  tray.liquidMoving = tray.ripples.length > 0;
  for (let i = 0; i < pos.count; i++) {
    const x = b[i * 3], z = b[i * 3 + 2]; let y = 0;
    for (const r of tray.ripples) {
      const d = Math.hypot(x - (r.x - TRAY_C.x), z - (r.z - TRAY_C.z)), front = r.age * 1.1;
      y += r.amp * Math.exp(-r.age * 1.1) * Math.sin(d * 13 - r.age * 12) * Math.exp(-Math.abs(d - front) * 2.2);
    }
    pos.array[i * 3 + 1] = y;
  }
  pos.needsUpdate = true; geo.computeVertexNormals();
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
async function feedPaper() {
  if (tray.state !== "ready") return;
  const idx = tray.prints.length; if (idx >= DR.prints.length) return;
  tray.state = "busy"; UI.ann("");
  const pr = await makePrint(DR.prints[idx], idx); tray.prints.push(pr); tray.cur = idx; paperLabel();
  const from = v3(PAPER_POS.x, .14, PAPER_POS.z), to = v3(TRAY_C.x, LIQ_Y - .07, TRAY_C.z);
  pr.grp.rotation.set(-Math.PI / 2, 0, .06); pr.grp.position.copy(from); sfx.paper();
  run(.9, (e) => { pr.grp.position.lerpVectors(from, to, e); pr.grp.position.y += Math.sin(e * Math.PI) * .9; pr.grp.rotation.z = .06 - e * .1; },
    () => { sfx.splash(); ripple(to.x, to.z, .035); tray.state = "developing"; UI.hint("等一等……"); });
}
function liftPrint() {
  if (tray.state !== "await-lift") return;
  const pr = tray.prints[tray.cur]; tray.state = "busy"; UI.ann(""); UI.hint("");
  const tg = tray.tongs, homeR = tg.rotation.clone(), above = v3(TRAY_C.x + .1, 1.55, TRAY_C.z + pr.PH / 2 - .05), dip = above.clone().setY(.95);
  const t0 = tg.position.clone();
  // 1) tongs swing over the tray and stand up
  run(.6, (e) => { tg.position.lerpVectors(t0, above, e); tg.rotation.set(-e * Math.PI / 2, homeR.y * (1 - e), 0); }, () => {
    // 2) down into the developer
    run(.35, (e) => tg.position.lerpVectors(above, dip, e), () => {
      sfx.splash(.6); ripple(dip.x, dip.z, .03);
      const p0 = pr.grp.position.clone(), lifted = v3(TRAY_C.x, 2.05, TRAY_C.z + .3);
      // 3) up again with the print, which swings from flat to hanging
      run(.9, (e) => {
        tg.position.lerpVectors(dip, lifted.clone().add(v3(.1, pr.PH / 2 + .55, 0)), e);
        pr.grp.position.lerpVectors(p0, lifted, e); pr.grp.rotation.set(-Math.PI / 2 * (1 - e), 0, .04 * (1 - e));
      }, () => {
        ripple(TRAY_C.x, TRAY_C.z, .02);
        for (let i = 0; i < 4; i++) setTimeout(() => { if (pr.state !== "hung") drop(pr.grp.position.clone().add(v3((Math.random() - .5) * pr.PW * .6, -pr.PH / 2, 0))); }, i * 190);
        const s = slotPos(pr.slot, pr), l0 = pr.grp.position.clone(), tl = tg.position.clone();
        // 4) over to the line; the tongs go home
        run(.85, (e) => {
          pr.grp.position.lerpVectors(l0, s, e); pr.grp.position.y += Math.sin(e * Math.PI) * .25;
          tg.position.lerpVectors(tl, TONGS_HOME, e); tg.rotation.set(-Math.PI / 2 * (1 - e), homeR.y * e, 0);
        }, () => {
          tg.rotation.copy(homeR); pr.peg.visible = true; pr.state = "hung"; pr.swing = 1; pr.wet = 3.2; pr.nextDrip = 2.9; sfx.clip();
          hungOne(pr);
        });
      });
    });
  });
}
function hungOne(pr) {
  const done = tray.prints.length;
  if (done === 1) UI.ann("翻过来看看", pr.grp.position.clone().add(v3(pr.PW / 2, .1, 0)));
  if (done < DR.prints.length) { tray.state = "ready"; UI.hint("点相纸，冲下一张"); }
  else { tray.state = "all"; UI.hint("都晾好了。点一张，看看背面"); UI.next("去照片墙 →", () => dispatchEvent(new CustomEvent("darkroom:wall"))); }
}
/* tap a hanging print: bring it close, turn it over; tap again to hang it back */
function viewPrint(pr) {
  if (!(tray.state === "ready" || tray.state === "all" || tray.state === "developing")) return;
  const prev = tray.state; tray.state = "viewing"; tray.viewing = { pr, prev }; UI.ann(""); pr.state = "viewing";
  const from = pr.grp.position.clone(); sfx.lift();
  run(.55, (e) => { pr.grp.position.lerpVectors(from, FRONT, e); pr.grp.scale.setScalar(1 + e * .3); pr.grp.rotation.z = 0; pr.glow(e * .72); }, () => {
    sfx.flip(); run(.65, (e) => { pr.grp.rotation.y = Math.PI * e; }, () => { tray.state = "viewing-back"; UI.hint("再点一下，挂回去"); });
  });
}
function hangBack() {
  if (tray.state !== "viewing-back") return;
  const { pr, prev } = tray.viewing; tray.state = "busy"; const s = slotPos(pr.slot, pr), from = pr.grp.position.clone(); sfx.drop();
  run(.6, (e) => { pr.grp.position.lerpVectors(from, s, e); pr.grp.scale.setScalar(1.3 - e * .3); pr.grp.rotation.y = Math.PI * (1 - e); pr.glow(.72 * (1 - e)); }, () => {
    pr.state = "hung"; pr.grp.rotation.y = 0; tray.state = prev === "developing" ? "developing" : prev; sfx.clip();
    UI.hint(tray.state === "all" ? "都晾好了。点一张，看看背面" : tray.state === "ready" ? "点相纸，冲下一张" : "等一等……");
  });
}
function trayHit(e) {
  const objs = [tray.paper, tray.tongs, ...tray.prints.map((p) => p.grp)];
  const h = S.ray(e).intersectObjects(objs, true)[0]; if (!h) return null;
  let o = h.object; while (o && o.userData.print === undefined && o !== tray.paper && o !== tray.tongs) o = o.parent;
  return o;
}
function trayTap(e) {
  if (tray.state === "viewing-back") { hangBack(); return; }
  const o = trayHit(e); if (!o) return;
  if (o === tray.paper) feedPaper();
  else if (o === tray.tongs) liftPrint();
  else { const pr = tray.prints[o.userData.print]; if (!pr) return; if (pr.state === "hung") viewPrint(pr); else if (pr === tray.prints[tray.cur] && tray.state === "await-lift") liftPrint(); }
}
function trayCursor(e) {
  const o = trayHit(e); if (!o) return tray.state === "viewing-back" ? "pointer" : "default";
  if (o === tray.paper) return tray.state === "ready" ? "pointer" : "default";
  if (o === tray.tongs) return tray.state === "await-lift" ? "pointer" : "default";
  return "pointer";
}

const HINT_BY_STATE = { ready: "点相纸，冲下一张", all: "都晾好了。点一张，看看背面", developing: "等一等……", "await-lift": "用夹子把它夹起来" };
async function openTray() {
  ensurePrints(); if (!DR.prints.length) return;
  DR.scene2.fade(async () => {
    buildTray(); leaveAll();
    tray.group.visible = true;
    const key = JSON.stringify(DR.prints), same = tray.key === key && tray.level >= 1;
    if (!same) {   // start fresh if the selection changed
      tray.prints.forEach((p) => scene.remove(p.grp)); tray.prints = []; tray.cur = -1; tray.anim = null; tray.key = key;
      tray.tongs.position.copy(TONGS_HOME); tray.tongs.rotation.set(0, .7, 0);
      const P = tray.pourer; P.bottle.position.copy(P.home); P.bottle.rotation.z = 0; P.cap.position.copy(P.capHome); tray.stream.visible = tray.pool.visible = tray.froth.visible = false;
      tray.drops.forEach((d) => tray.group.remove(d.m)); tray.drops = []; if (tray.level < 1) setLevel(REDUCED ? 1 : 0);
    } else tray.prints.forEach((p) => (p.grp.visible = true));
    DR.scene2.enterRoom("tray", VIEW_TRAY, { instant: true }); DR.scene2.lightUp(tray.light);
    UI.show(true); DR.hud && DR.hud("SCENE 04 — 暗房");
    try { await document.fonts.load('64px "Darkroom Hand"'); } catch (e) { /* fallback font */ }
    paperLabel();
    if (same) {
      UI.hint(HINT_BY_STATE[tray.state] || "");
      if (tray.state === "all") UI.next("去照片墙 →", () => dispatchEvent(new CustomEvent("darkroom:wall")));
      if (tray.state === "await-lift") UI.ann("夹子", TONGS_HOME.clone().add(v3(.2, .2, 0)));
      return;
    }
    const ready = () => { tray.state = "ready"; UI.hint("点相纸开始"); UI.ann("相纸", PAPER_POS.clone().add(v3(.45, .15, -.4))); };
    if (tray.level >= 1) ready();
    else { tray.state = "pouring"; UI.hint(""); setTimeout(() => { if (DR.scene2.room() === "tray" && tray.state === "pouring") pourIn(ready); }, 1900); }
  });
}
addEventListener("darkroom:tray", openTray);

/* ---------- pointer routing ---------- */
canvas.addEventListener("pointerdown", (e) => { const r = DR.scene2.room(); if (r === "sheet") sheetDown(e); });
canvas.addEventListener("pointermove", (e) => {
  const r = DR.scene2.room();
  if (r === "sheet") sheetMove(e); else if (r === "tray") { canvas.style.cursor = trayCursor(e); const o = trayHit(e); if (o !== tray.hover) { tray.hover = o; if (o && canvas.style.cursor === "pointer") sfx.hover(); } }
});
canvas.addEventListener("pointerup", (e) => { const r = DR.scene2.room(); if (r === "sheet") sheetUp(e); });
canvas.addEventListener("pointercancel", () => { if (DR.scene2.room() === "sheet") sheetUp(); });
canvas.addEventListener("click", (e) => { if (DR.scene2.room() === "tray") trayTap(e); });
addEventListener("keydown", (e) => {
  if (DR.scene2.room() !== "tray") return;
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    if (tray.state === "ready") feedPaper(); else if (tray.state === "await-lift") liftPrint(); else if (tray.state === "viewing-back") hangBack();
  }
});

DR.scene4 = {
  tray, sheet, feedPaper, liftPrint, goDesk, leaveAll, ensurePrints, fill: () => { tray.anim = null; tray.stream.visible = tray.pool.visible = tray.froth.visible = false; tray.state = "ready"; setLevel(1); }, viewPrint: (i) => tray.prints[i] && viewPrint(tray.prints[i]), hangBack,
  select(list) { DR.prints = list.slice(0, MAX_PRINTS); sheet.mesh && sheetCount(); },
  circle(roll, k) {   // debug: circle a frame as if by hand
    const c = sheet.cells.find((x) => x.roll === roll && x.k === k); if (!c) return;
    sheet.stroke = { pts: inkCircle(c), t: performance.now() }; sheetUp();
  },
};

// debug hooks for screenshots: #sheet, #tray (four frames preselected)
const hashRun = (fn) => { const go = () => setTimeout(fn, 400); if (DR.content) go(); else addEventListener("darkroom:content", go, { once: true }); };
if (location.hash === "#sheet") hashRun(openSheet);
if (location.hash === "#tray") hashRun(() => { DR.prints = [{ roll: 0, k: 0 }, { roll: 1, k: 3 }, { roll: 1, k: 11 }, { roll: 2, k: 7 }]; openTray(); });
