import * as THREE from "./vendor/three.module.js";
import "./sfx.js";

const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DR = (window.DARKROOM = window.DARKROOM || {});
// once she has reached the photo wall, every room stays open (see ui.js for the index)
DR.unlocked = !!(DR.store && DR.store.get("dr-unlocked") === "1");

/* ---------- roll definitions ---------- */
const ROLLS = [
  { year: "2024", name: "开始", label: "#e8dcc3", ink: "#6b1d2a", band: "#6b1d2a", iso: "200" },
  { year: "2025", name: "七千九百公里", label: "#c2552f", ink: "#f1e3c9", band: "#7d2a17", iso: "400" },
  { year: "2026", name: "还是我们", label: "#1f2a24", ink: "#d6b56f", band: "#0f1512", iso: "800" },
  { year: "????", name: "未知卷", label: "#16120f", ink: "#c9a65c", band: "#a1222c", iso: "—", sealed: true },
];
let SEALED_NOTE = "这一卷，等我到墨尔本，我们一起冲洗。"; // placeholder; real text comes from content.md「## 第四卷」

/* ---------- renderer ---------- */
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
// phones: render at most 1.5× and use smaller shadow maps — keeps older iPhones cool, hardly visible
const TOUCH = matchMedia("(pointer: coarse)").matches;
renderer.setPixelRatio(Math.min(TOUCH ? 1.5 : 2, devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0d0605");
scene.fog = new THREE.Fog("#0d0605", 14, 26);
const camera = new THREE.PerspectiveCamera(30, 1, .1, 60);
const CAM_HOME = { pos: new THREE.Vector3(0, 8.6, 7.6), look: new THREE.Vector3(0, 0, -.95) };
camera.position.copy(CAM_HOME.pos); camera.lookAt(CAM_HOME.look);

/* environment for metal reflections: a warm softbox overhead, dark everywhere else */
(function env() {
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  es.background = new THREE.Color("#120806");
  const box = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 2.2), side: THREE.DoubleSide }));
  box.position.set(2, 6, 2); box.lookAt(0, 0, 0); es.add(box);
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(.9, .35, .3), side: THREE.DoubleSide }));
  rim.position.set(-5, 1.5, -3); rim.lookAt(0, 0, 0); es.add(rim);
  scene.environment = pm.fromScene(es, .04).texture;
  scene.environmentIntensity = .55;
})();

/* lights: one tungsten spot, a whisper of fill */
const spot = new THREE.SpotLight("#ffc68a", 260, 0, .62, .75, 2);
spot.position.set(1.8, 10, 3.2); spot.target.position.set(.2, 0, -.4);
spot.castShadow = true; spot.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048); spot.shadow.bias = -.0004; spot.shadow.radius = 6;
spot.shadow.camera.near = 4; spot.shadow.camera.far = 20;
scene.add(spot, spot.target);
scene.add(new THREE.HemisphereLight("#5a2a22", "#0a0303", .35));

/* ---------- desk ---------- */
const deskTex = new THREE.TextureLoader().load(DR.desk || "");
deskTex.colorSpace = THREE.SRGBColorSpace; deskTex.anisotropy = 8;
const desk = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), new THREE.MeshStandardMaterial({ map: deskTex, roughness: .78, metalness: 0, color: "#d8b4ab" }));
desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);

/* ---------- textures ---------- */
function labelTexture(r) {
  const W = 1024, H = 512, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = r.label; g.fillRect(0, 0, W, H);
  // paper tooth
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 12; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  // stripes near both ends (canvas y = along the roll)
  g.fillStyle = r.band; g.fillRect(0, 18, W, 14); g.fillRect(0, H - 32, W, 14);
  // text on the face that looks at the camera (u ≈ .5), running along the roll
  g.save(); g.translate(W * .5, H * .5); g.rotate(Math.PI / 2);
  g.fillStyle = r.ink; g.textAlign = "center"; g.textBaseline = "middle";
  if (r.sealed) {
    g.font = '500 60px "Darkroom Serif", "Noto Serif SC", "Songti SC", serif'; g.fillText(r.name, -40, -30);
  } else {
    g.font = 'italic 500 96px "Darkroom Italic", "Cormorant Garamond", "Times New Roman", serif'; g.fillText(r.year, 0, -58);
    g.font = '400 46px "Darkroom Serif", "Noto Serif SC", "Songti SC", serif';
    const nm = r.name.length > 6 ? r.name.slice(0, 6) : r.name; g.fillText(nm, 0, 22);
  }
  g.font = '500 22px "Darkroom Mono", "IBM Plex Mono", monospace'; g.globalAlpha = .75;
  g.fillText(r.sealed ? "ROLL 04 · 待冲洗" : `ROLL 0${ROLLS.indexOf(r) + 1} · ${r.iso} · 36 EXP`, r.sealed ? -40 : 0, r.sealed ? 40 : 86);
  g.restore();
  // small vertical text on the back side
  g.save(); g.translate(W * .08, H * .5); g.rotate(Math.PI / 2); g.fillStyle = r.ink; g.globalAlpha = .45;
  g.font = '500 20px "Darkroom Mono", "IBM Plex Mono", monospace'; g.textAlign = "center"; g.fillText("DARKROOM No.1214 · SHANGRAO ⇄ MELBOURNE", 0, 0); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { tex: t, canvas: c };
}
function stickerOnto(label, img) {
  const g = label.canvas.getContext("2d"), W = label.canvas.width, H = label.canvas.height;
  const s = 190, k = s / Math.max(img.width, img.height), w = img.width * k, h = img.height * k;
  // white die-cut border: stamp the silhouette in white around the sticker
  const off = document.createElement("canvas"); off.width = w + 24; off.height = h + 24;
  const og = off.getContext("2d");
  for (let a = 0; a < 16; a++) og.drawImage(img, 12 + Math.cos(a / 16 * 6.283) * 8, 12 + Math.sin(a / 16 * 6.283) * 8, w, h);
  og.globalCompositeOperation = "source-in"; og.fillStyle = "#f3eadb"; og.fillRect(0, 0, off.width, off.height);
  og.globalCompositeOperation = "source-over"; og.drawImage(img, 12, 12, w, h);
  g.save(); g.translate(W * .5, H * .5 + 150); g.rotate(Math.PI / 2 - .1); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 8; g.shadowOffsetY = 4;
  g.drawImage(off, -off.width / 2, -off.height / 2); g.restore();
  label.tex.needsUpdate = true;
}

/* ---------- canisters ---------- */
const R = .55, LEN = 1.55;
const brass = new THREE.MeshStandardMaterial({ color: "#b49a6a", metalness: .92, roughness: .32 });
const darkMetal = new THREE.MeshStandardMaterial({ color: "#2a2522", metalness: .85, roughness: .4 });
function canister(r) {
  const grp = new THREE.Group(), body = new THREE.Group(); grp.add(body);
  const label = labelTexture(r); r.labelTex = label;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, LEN * .84, 96, 1, true), new THREE.MeshStandardMaterial({ map: label.tex, roughness: .62, metalness: 0 }));
  tube.castShadow = tube.receiveShadow = true; body.add(tube);
  const capMat = r.sealed ? darkMetal : brass;
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.05, LEN * .09, 96), capMat);
    cap.position.y = s * LEN * .465; cap.castShadow = true; body.add(cap);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R * 1.03, .022, 12, 96), capMat);
    lip.rotation.x = Math.PI / 2; lip.position.y = s * LEN * .51; body.add(lip);
  }
  const nub = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .26, 32), capMat);
  nub.position.y = LEN * .6; nub.castShadow = true; body.add(nub);
  const nub2 = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .12, 24), darkMetal);
  nub2.position.y = -LEN * .55; body.add(nub2);
  if (!r.sealed) { // film tongue sticking out of the slit
    const lead = new THREE.Mesh(new THREE.BoxGeometry(.012, LEN * .62, .42), new THREE.MeshStandardMaterial({ color: "#3a1f12", roughness: .35, metalness: .1 }));
    lead.position.set(R * .98, 0, -.1); lead.rotation.y = .5; lead.castShadow = true; body.add(lead);
  } else { // red seal tape around the middle
    const tape = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.008, R * 1.008, .13, 96, 1, true), new THREE.MeshStandardMaterial({ color: "#9d1f2a", roughness: .55 }));
    tape.position.y = LEN * .37; tape.castShadow = true; body.add(tape);
  }
  body.rotation.y = Math.PI + .85; // turn the label face (u = .5) up toward the camera
  return grp;
}

const LAYOUT = [
  { p: [-2.75, R, -.55], ry: .32 },
  { p: [-.35, R, .95], ry: -.22 },
  { p: [2.35, R, -.45], ry: .14 },
  { p: [.75, R, -1.85], ry: -.1 },
];
const rolls = ROLLS.map((r, i) => {
  const g = canister(r), L = LAYOUT[i];
  g.position.set(...L.p); g.rotation.set(0, L.ry, Math.PI / 2);
  g.userData = { i, home: { p: new THREE.Vector3(...L.p), r: new THREE.Euler(0, L.ry, Math.PI / 2) }, lift: 0, wiggle: 0 };
  g.traverse((o) => { if (o.isMesh) o.userData.roll = i; });
  scene.add(g); return g;
});

/* props: pencil + red marker */
const PENS = [];
(function props() {
  const pencil = new THREE.Group();
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.2, 6), new THREE.MeshStandardMaterial({ color: "#c99a3c", roughness: .6 }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.06, .22, 6), new THREE.MeshStandardMaterial({ color: "#e2c49a", roughness: .8 }));
  tip.position.y = -1.21; tip.rotation.x = Math.PI;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(.02, .07, 8), new THREE.MeshStandardMaterial({ color: "#222" }));
  lead.position.y = -1.31; lead.rotation.x = Math.PI;
  pencil.add(wood, tip, lead); pencil.traverse((o) => { o.castShadow = true; });
  scene.add(pencil);
  const marker = new THREE.Group();
  const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.6, 24), new THREE.MeshStandardMaterial({ color: "#151212", roughness: .4 }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .5, 24), new THREE.MeshStandardMaterial({ color: "#b01f2a", roughness: .35 }));
  cap.position.y = -.95; marker.add(bodyM, cap); marker.traverse((o) => { o.castShadow = true; });
  scene.add(marker);
  // lying on the desk at first; they stand up once the rolls are on the table (see frame())
  PENS.push(
    { g: pencil, lie: { p: [4.1, .06, .9], r: [Math.PI / 2, 0, .9] }, stand: { p: [3.75, 1.11, -.35], r: [Math.PI, 0, .1] }, delay: .5, ph: 0 },
    { g: marker, lie: { p: [3.6, .1, 1.7], r: [Math.PI / 2, 0, -1.2] }, stand: { p: [4.15, 1.2, -.05], r: [0, 0, -.09] }, delay: .75, ph: 2 },
  );
  for (const p of PENS) { p.g.position.set(...p.lie.p); p.g.rotation.set(...p.lie.r); p.qLie = new THREE.Quaternion().setFromEuler(p.g.rotation); p.qStand = new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.stand.r)); p.t = 0; p.wob = 0; p.g.traverse((o) => { if (o.isMesh) o.userData.pen = p; }); }
})();

/* sticker for the sealed roll */
const stickerImg = new Image();
stickerImg.onload = () => stickerOnto(ROLLS[3].labelTex, stickerImg);
stickerImg.src = "assets/sticker.png";

/* ---------- content ---------- */
function applyContent() {
  const c = DR.content; if (!c || !c.rolls) return;
  c.rolls.forEach((cr, i) => { if (cr.name) { ROLLS[i].name = cr.name; const L = labelTexture(ROLLS[i]); rolls[i].traverse((o) => { if (o.isMesh && o.material.map === ROLLS[i].labelTex.tex) o.material.map = L.tex; }); ROLLS[i].labelTex = L; } ROLLS[i].photos = cr.photos; });
  if (c.sealed) {
    if (c.sealed.note) SEALED_NOTE = c.sealed.note;
    if (c.sealed.name && c.sealed.name !== ROLLS[3].name) {
      ROLLS[3].name = c.sealed.name; const old = ROLLS[3].labelTex, L = labelTexture(ROLLS[3]);
      rolls[3].traverse((o) => { if (o.isMesh && o.material.map === old.tex) o.material.map = L.tex; });
      ROLLS[3].labelTex = L; if (stickerImg.complete && stickerImg.naturalWidth) stickerOnto(L, stickerImg);
    }
  }
}
addEventListener("darkroom:content", applyContent);
// canister labels are painted into textures; repaint them once the self-hosted serif has arrived
document.fonts && Promise.all([
  document.fonts.load('46px "Darkroom Serif"', "冬日初见雪与海赤道的风未知卷"),
  document.fonts.load('italic 500 96px "Darkroom Italic"', "2024"), document.fonts.load('500 22px "Darkroom Mono"', "ROLL"),
]).then(() => {
  ROLLS.forEach((r, i) => {
    const old = r.labelTex, L = labelTexture(r);
    rolls[i].traverse((o) => { if (o.isMesh && o.material.map === old.tex) o.material.map = L.tex; });
    r.labelTex = L; if (r.sealed && stickerImg.complete && stickerImg.naturalWidth) stickerOnto(L, stickerImg);
  });
}).catch(() => {});

/* ---------- sizing ---------- */
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < 1.5 ? 36 : 30; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

/* ---------- interaction ---------- */
const s2 = $("s2"), ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let active = false, hovered = -1, picked = -1, room = null;   // room: a later scene (sheet / tray / wall) owns the view
const camTarget = { pos: CAM_HOME.pos.clone(), look: CAM_HOME.look.clone() }, camLook = CAM_HOME.look.clone();
// table-level view used once a roll is picked: the roll stands on the desk at the left
const CAM_TABLE = { pos: new THREE.Vector3(.6, 2.05, 9.8), look: new THREE.Vector3(.6, .82, 0) };
const STAND = new THREE.Vector3(-2.2, LEN * .51 + .01, .15), STAND_RY = -.85;

function setPtr(e) {
  const r = canvas.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera); return ray;
}
function hit(e) { const h = setPtr(e).intersectObjects(rolls, true)[0]; return h ? h.object.userData.roll : -1; }
let penHover = null;
canvas.addEventListener("pointermove", (e) => {
  if (!active) return;
  const ph = setPtr(e).intersectObjects(PENS.map((p) => p.g), true)[0], pen = ph ? ph.object.userData.pen : null;
  if (pen !== penHover) { penHover = pen; if (pen && pen.t > .95) { pen.wob = 1; DR.sfx && DR.sfx.tick(.35); } }
  if (picked >= 0 || room) return;   // a picked roll is driven by scene3.js
  const i = hit(e); if (i === hovered) return;
  hovered = i; canvas.style.cursor = i >= 0 ? "pointer" : "default"; if (i >= 0 && DR.sfx) DR.sfx.hover();
  const el = $("s2Hover");
  if (i >= 0) { const r = ROLLS[i]; el.textContent = r.sealed ? r.name : `${r.year}　${r.name}`; el.classList.add("show"); } else el.classList.remove("show");
});
canvas.addEventListener("click", (e) => {
  if (!active || picked >= 0 || room) return;
  const i = hit(e); if (i < 0) return;
  if (ROLLS[i].sealed) { sealedNote(i); return; }
  pick(i);
});
function sealedNote(i) {
  rolls[i].userData.wiggle = 1; DR.sfx && DR.sfx.tick(.6);
  const n = $("s2Note"); n.textContent = SEALED_NOTE; n.classList.add("show");
  clearTimeout(n._h); n._h = setTimeout(() => n.classList.remove("show"), 3600);
}
function pick(i) {
  if (picked === i) return;
  picked = i; hovered = -1; canvas.style.cursor = "default"; $("s2Hover").classList.remove("show");
  camTarget.pos.copy(CAM_TABLE.pos); camTarget.look.copy(CAM_TABLE.look);
  s2.classList.add("picked"); DR.sfx && DR.sfx.pick();
  const r = ROLLS[i];
  DR.hud && DR.hud(`SCENE 03 — ${r.name}`);
  s2.classList.add("viewed");   // after the first roll, the way to the darkroom shows up
  dispatchEvent(new CustomEvent("darkroom:roll-open", { detail: { i, year: r.year, name: r.name, iso: r.iso } }));
}
function unpick() {
  if (picked < 0) return;
  dispatchEvent(new CustomEvent("darkroom:roll-close", { detail: { i: picked } }));
  picked = -1; s2.classList.remove("picked"); DR.sfx && (DR.sfx.drop(), REDUCED || DR.sfx.rewind());
  camTarget.pos.copy(CAM_HOME.pos); camTarget.look.copy(CAM_HOME.look);
  DR.hud && DR.hud("SCENE 02 — 胶卷");
}
$("s2Back").addEventListener("click", unpick);
addEventListener("keydown", (e) => { if (e.key === "Escape" && active && picked >= 0 && !room && !(DR.scene3 && DR.scene3.busyEscape())) unpick(); });
$("s2Dark").addEventListener("click", () => dispatchEvent(new CustomEvent("darkroom:sheet")));

/* later scenes take over the camera; the rolls slide away and the desk overlay hides */
const fader = $("fader");
let fading = false;
function fade(fn) {
  if (REDUCED) { fn(); return; }
  if (fading) return; fading = true; DR.sfx && DR.sfx.whoosh();
  fader.classList.add("on");
  setTimeout(() => { new Promise((res) => res(fn())).catch((e) => console.error(e)).then(() => setTimeout(() => { fader.classList.remove("on"); fading = false; }, 160)); }, 480);
}
function enterRoom(name, view, { instant = false } = {}) {
  if (picked >= 0) unpick();
  room = name; hovered = -1; $("s2Hover").classList.remove("show"); canvas.style.cursor = "default";
  s2.classList.toggle("room", !!name);
  camTarget.pos.copy(view ? view.pos : CAM_HOME.pos); camTarget.look.copy(view ? view.look : CAM_HOME.look);
  if (instant) {   // arrive a step back and a little high, then settle in: a short push-in instead of a hard cut
    camera.position.copy(camTarget.pos); camLook.copy(camTarget.look);
    if (!REDUCED) camera.position.add(tmpV.copy(camTarget.pos).sub(camTarget.look).normalize().multiplyScalar(1.1)).y += .25;
  }
  if (!name) lightUp((v) => { deskLight = v; });
  dispatchEvent(new CustomEvent("darkroom:room", { detail: { room: name } }));
}

/* a lamp being switched on: click, a flicker, then it warms up to full. set(v) gets 0…1 */
const lamps = [];
let deskLight = 1;
function lightUp(set, { delay = .55, d = 1.1 } = {}) {
  if (REDUCED) { set(1); return; }
  set(0); lamps.push({ set, t: -delay, d, on: false });
}
function runLamps(dt) {
  for (let i = lamps.length - 1; i >= 0; i--) {
    const L = lamps[i]; L.t += dt; if (L.t < 0) continue;
    if (!L.on) { L.on = true; DR.sfx && DR.sfx.lamp(); }
    const x = L.t / L.d;
    L.set(x >= 1 ? 1 : x < .07 ? .55 : x < .13 ? .12 : x < .2 ? .7 : x < .26 ? .35 : .35 + .65 * (1 - Math.pow(1 - (x - .26) / .74, 3)));
    if (x >= 1) lamps.splice(i, 1);
  }
}

/* dust drifting through the lamp light */
const moteSets = [];
function motes(parent, center, size, color = "#ffd9a8", n = TOUCH ? 50 : 110) {
  if (REDUCED) return null;
  const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d");
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.4, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) { seed[i] = Math.random(); pos[i] = (seed[i] - .5) * size.getComponent(i % 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), color, size: .045, transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  pts.position.copy(center); pts.frustumCulled = false; parent.add(pts);
  moteSets.push({ pts, seed, size, n }); return pts;
}
function runMotes(t) {
  for (const m of moteSets) {
    if (!m.pts.visible || (m.pts.parent && !m.pts.parent.visible)) continue;
    const a = m.pts.geometry.attributes.position.array, s = m.seed;
    for (let i = 0; i < m.n; i++) {
      const j = i * 3, ph = s[j] * 40;
      a[j] = (s[j] - .5) * m.size.x + Math.sin(t * .13 + ph) * .35;
      a[j + 1] = ((s[j + 1] + t * (.006 + s[j + 2] * .012)) % 1 - .5) * m.size.y;
      a[j + 2] = (s[j + 2] - .5) * m.size.z + Math.cos(t * .1 + ph) * .3;
    }
    m.pts.geometry.attributes.position.needsUpdate = true;
  }
}
motes(scene, new THREE.Vector3(.4, 2.4, 1), new THREE.Vector3(9, 4.6, 7));

/* ---------- animation ---------- */
const par = { x: 0, y: 0 }, parT = { x: 0, y: 0 }, parV = new THREE.Vector3();
addEventListener("pointermove", (e) => { parT.x = (e.clientX / innerWidth - .5) * 2; parT.y = -(e.clientY / innerHeight - .5) * 2; }, { passive: true });
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3();
const hooks = [];   // per-frame callbacks from scene3.js: fn(dt, k, t)
let last = performance.now(), t0 = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; t0 += dt;
  const k = REDUCED ? 1 : 1 - Math.pow(.0015, dt);
  rolls.forEach((g, i) => {
    const u = g.userData;
    u.lift += ((i === hovered ? 1 : 0) - u.lift) * k;
    u.wiggle = Math.max(0, u.wiggle - dt * .9);
    let pos, rot;
    if (i === picked) {
      pos = STAND.clone(); tmpE.set(0, STAND_RY, 0); rot = tmpE.clone();
    } else {
      pos = u.home.p.clone(); pos.y += u.lift * .22;
      if (picked >= 0 || room) { pos.z -= 11; pos.x = pos.x * 2 + 1; }   // the others roll away into the dark
      const w = Math.sin(u.wiggle * 30) * u.wiggle * .12;
      rot = new THREE.Euler(u.home.r.x + w, u.home.r.y + u.lift * .08, u.home.r.z + u.lift * .1);
    }
    g.position.lerp(pos, k);
    tmpQ.setFromEuler(rot); g.quaternion.slerp(tmpQ, k);
  });
  for (const p of PENS) {   // stand up (with a little overshoot), then sway as if just balanced
    if (t0 > p.delay) p.t = Math.min(1, p.t + dt / (REDUCED ? .001 : 1.1));
    const x = p.t, e = x === 1 ? 1 : 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
    p.g.position.set(...p.lie.p).lerp(tmpV.set(...p.stand.p), Math.min(1, e)); p.g.position.y += Math.sin(Math.PI * x) * .35;
    p.g.quaternion.copy(p.qLie).slerp(p.qStand, Math.min(1.08, e));
    p.wob = Math.max(0, p.wob - dt * 1.4);
    if (!REDUCED && p.t >= 1) { tmpE.set(Math.sin(t0 * 1.7 + p.ph) * (.012 + p.wob * .09), 0, Math.sin(t0 * 1.1 + p.ph) * (.014 + p.wob * .12)); tmpQ.setFromEuler(tmpE); p.g.quaternion.multiply(tmpQ); }
  }
  // a little parallax with the pointer, as if leaning in over the desk (not while drawing on the contact sheet)
  const pk = REDUCED || TOUCH || room === "sheet" ? 0 : 1;
  par.x += (parT.x * pk - par.x) * Math.min(1, dt * 2.5); par.y += (parT.y * pk - par.y) * Math.min(1, dt * 2.5);
  camera.position.sub(parV);
  camera.position.lerp(camTarget.pos, k * .6); camLook.lerp(camTarget.look, k * .6);
  parV.set(par.x * .22, par.y * .12, 0).applyQuaternion(camera.quaternion); camera.position.add(parV);
  camera.lookAt(camLook);
  runLamps(dt); runMotes(t0);
  spot.intensity = (picked >= 0 ? 230 : 260) * deskLight * (REDUCED ? 1 : 1 + Math.sin(t0 * .9) * .012);
  for (const f of hooks) f(dt, k, t0);
  renderer.render(scene, camera);
  if (active) requestAnimationFrame(frame);
}

function start() {
  if (active) return; active = true; applyContent();
  canvas.classList.add("on"); s2.classList.add("on"); s2.setAttribute("aria-hidden", "false");
  if (DR.unlocked) s2.classList.add("viewed");
  lightUp((v) => { deskLight = v; }, { delay: .7 });
  dispatchEvent(new CustomEvent("darkroom:room", { detail: { room: null } }));
  DR.hud && DR.hud("SCENE 02 — 胶卷");
  // camera eases down from a higher angle on entry
  camera.position.set(0, 12, 4.5); camLook.copy(CAM_HOME.look); camera.lookAt(camLook);
  last = performance.now(); requestAnimationFrame(frame);
}
addEventListener("darkroom:rolls", start);
if (DR.wantRolls) start();
renderer.localClippingEnabled = true;
DR.scene2 = {
  pick, unpick, sealedNote, rolls: ROLLS, enterRoom, fade, lightUp, motes, room: () => room, active: () => active, deskTex,
  three: { THREE, scene, camera, canvas, renderer, spot, rollMeshes: rolls, R, LEN, STAND, ray: setPtr },
  hooks, picked: () => picked,
};
