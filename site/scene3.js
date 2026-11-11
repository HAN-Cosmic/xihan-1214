/* Scene 03 — each roll has its own way of looking at the photos.
   2024: drag the negative out, tap a frame to develop it.
   2025: pull one frame out and hold it up to the light.
   2026: a lever viewer, one frame per press.
   Captions come from the photo tables in content/content.md (parsed in app.js). */
import { sfx } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DR = window.DARKROOM;
const S = DR.scene2.three, { THREE, scene, camera, canvas, R, STAND } = S;
const pad = (n) => String(n).padStart(2, "0");
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const damp = (rate, dt) => (REDUCED ? 1 : 1 - Math.exp(-rate * dt));

/* ---------- film geometry ---------- */
const CELL_W = .74, FILM_H = 1.06, PH_W = .6, PH_H = .8, LEAD = .34;
const AX = STAND.x + R * 1.02;                       // where the film leaves the canister
const loader = new THREE.TextureLoader();
const HINTS = ["按住胶片往外拉，点一格显影", "点胶卷随机抽一张，举到灯下看", "按拉杆，一次一格"];
const FILM_COLORS = ["#c2582a", "#b9502a", "#a9492a"];

function cover(tex, w, h) {   // crop a texture to fill a w×h plane
  const img = tex.image; if (!img) return; const a = img.width / img.height, t = w / h;
  if (a > t) { tex.repeat.set(t / a, 1); tex.offset.set((1 - t / a) / 2, 0); } else { tex.repeat.set(1, a / t); tex.offset.set(0, (1 - a / t) / 2); }
}
function photoTex(file, full, onload) {
  const t = loader.load((full ? "assets/photos/" : "assets/photos/thumbs/") + file, (tx) => onload && onload(tx));
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* photo material that can be a colour negative (uDev 0) or a print (uDev 1) */
function devMaterial(tex, clip) {
  const m = new THREE.MeshBasicMaterial({ map: tex, clippingPlanes: clip || null });
  const u = { uDev: { value: 0 }, uLit: { value: .82 } }; m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDev = u.uDev; sh.uniforms.uLit = u.uLit;
    sh.fragmentShader = "uniform float uDev;\nuniform float uLit;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      vec3 pos = diffuseColor.rgb;
      // colour negative: shadows show the orange film base, highlights go dense and dark
      // (inverted in perceptual space, so mid-tones land on a deep orange like real film)
      vec3 inv = pow(vec3(1.0) - pow(max(pos, vec3(0.0)), vec3(1.0 / 2.2)), vec3(2.2));
      vec3 neg = inv * vec3(.85, .34, .12) + vec3(.03, .011, .004);
      diffuseColor.rgb = mix(neg, pos, smoothstep(0.0, 1.0, uDev)) * uLit;`);
  };
  return m;
}
function cellCanvas(color, label) {
  const W = 256, H = Math.round(W * FILM_H / CELL_W), c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, color); gr.addColorStop(.5, "#d46a34"); gr.addColorStop(1, color);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(40,14,6,.85)";
  const hole = (x, y) => { g.beginPath(); g.roundRect(x, y, 22, 30, 5); g.fill(); };
  for (let k = 0; k < 4; k++) { hole(18 + k * 62, 12); hole(18 + k * 62, H - 42); }
  g.fillStyle = "rgba(255,226,190,.55)"; g.font = '500 15px "Darkroom Mono", "IBM Plex Mono", monospace'; g.fillText(label, 14, H - 50);
  g.fillStyle = "rgba(30,10,4,.55)"; g.fillRect((W - W * PH_W / CELL_W) / 2 - 4, (H - H * PH_H / FILM_H) / 2 - 2, W * PH_W / CELL_W + 8, H * PH_H / FILM_H + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function leaderCanvas(color) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 184; const g = c.getContext("2d");
  g.fillStyle = color; g.beginPath(); g.moveTo(0, 8); g.lineTo(128, 8); g.lineTo(128, 176); g.lineTo(0, 176);
  g.quadraticCurveTo(70, 120, 46, 60); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- a strip of film coming out of the canister ---------- */
class Strip {
  constructor(roll, frames, { z = STAND.z, curl = .05 } = {}) {
    this.frames = frames; this.z = z; this.curl = curl; this.n = frames.length;
    this.clip = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -AX)];
    this.group = new THREE.Group(); scene.add(this.group);
    const color = FILM_COLORS[roll.i] || FILM_COLORS[0];
    this.leader = new THREE.Mesh(new THREE.PlaneGeometry(LEAD, FILM_H), new THREE.MeshStandardMaterial({ map: leaderCanvas(color), transparent: true, roughness: .5, clippingPlanes: this.clip, side: THREE.DoubleSide }));
    this.leader.castShadow = true; this.group.add(this.leader);
    this.cells = frames.map((f, k) => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W, FILM_H), new THREE.MeshStandardMaterial({ map: cellCanvas(color, `${roll.iso} · ${k + 1}A`), roughness: .5, clippingPlanes: this.clip, side: THREE.DoubleSide }));
      base.castShadow = true;
      const tex = photoTex(f.file, false, (tx) => { cover(tx, PH_W, PH_H); tx.needsUpdate = true; });
      const mat = devMaterial(tex, this.clip);
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(PH_W, PH_H), mat); photo.position.z = .004;
      base.userData.cell = photo.userData.cell = k;
      g.add(base, photo); this.group.add(g);
      return { g, base, photo, mat, dev: 0, devTarget: 0 };
    });
    this.L = 0; this.Lt = 0; this.count = 0; this.silent = false; this.rate = 14;
  }
  get max() { return LEAD + this.n * CELL_W + .05; }
  place(mesh, xRight, w) {      // put something whose right edge is at xRight (strip-local)
    const x = AX + xRight - w / 2;
    const z = this.z + Math.sin((x - AX) * 2.2 + .6) * this.curl;
    mesh.position.set(x, FILM_H / 2 + .03, z);
    mesh.rotation.y = -Math.cos((x - AX) * 2.2 + .6) * this.curl * 2.2;
  }
  update(dt) {
    this.L += (this.Lt - this.L) * damp(this.rate, dt);
    this.place(this.leader, this.L, LEAD);
    this.cells.forEach((c, k) => {
      this.place(c.g, this.L - LEAD - k * CELL_W, CELL_W);
      const out = this.L - LEAD - k * CELL_W > 0; c.g.visible = out;
      // wound back into the canister: it's an undeveloped negative again
      if (!out && c.devTarget > 0) { c.devTarget = c.dev = 0; c.mat.userData.u.uDev.value = 0; }
      if (c.dev !== c.devTarget) { c.dev += (c.devTarget - c.dev) * damp(3.2, dt); if (Math.abs(c.devTarget - c.dev) < .002) c.dev = c.devTarget; c.mat.userData.u.uDev.value = c.dev; }
    });
    const count = Math.floor((this.L - LEAD) / CELL_W + .02);
    if (count !== this.count) { if (!this.silent) sfx.tick(); this.count = count; }
  }
  cellWorld(k) { const v = new THREE.Vector3(); this.cells[k].photo.getWorldPosition(v); return v; }
  dispose() { scene.remove(this.group); this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.map && o.material.map.dispose(); o.material.dispose(); } }); }
}

/* ---------- DOM: caption, hint, hand-written note ---------- */
const cap = $("cap"), capMeta = $("capMeta"), capLine = $("capLine"), hint = $("s2Hint"), ann = $("s2Ann");
function caption(meta, line) {
  cap.classList.remove("show");
  clearTimeout(cap._h);
  cap._h = setTimeout(() => { capMeta.textContent = meta; capLine.textContent = line || ""; cap.classList.add("show"); }, REDUCED ? 0 : 180);
}
function frameCaption(roll, k) { const f = roll.frames[k]; caption(`${f.date}　·　${f.place}　·　FRAME ${pad(k + 1)}`, f.line); }

/* ---------- shared pointer handling ---------- */
let mode = null;   // { kind, roll, strip, ... }
const drag = { on: false, x0: 0, y0: 0, L0: 0, t0: 0, moved: false, v: 0, lx: 0, lt: 0 };
function pxPerWorld() {
  const d = camera.position.distanceTo(new THREE.Vector3(AX + 1.5, .6, STAND.z));
  return canvas.clientHeight / (2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
function snap(L) { return LEAD + Math.round((L - LEAD) / CELL_W) * CELL_W; }
function clampL(L) { return Math.max(LEAD, Math.min(mode.strip.max, L)); }

canvas.addEventListener("pointerdown", (e) => {
  if (!mode) return;
  Object.assign(drag, { on: true, x0: e.clientX, y0: e.clientY, L0: mode.strip.Lt, t0: performance.now(), moved: false, v: 0, lx: e.clientX, lt: performance.now() });
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!mode) return;
  if (!drag.on) { canvas.style.cursor = hoverCursor(e); return; }
  const dx = e.clientX - drag.x0;
  if (Math.abs(dx) > 6 || Math.abs(e.clientY - drag.y0) > 6) drag.moved = true;
  if (!drag.moved || !mode.draggable || mode.held) return;
  canvas.style.cursor = "grabbing";
  const raw = clampL(drag.L0 + dx / pxPerWorld());
  mode.strip.Lt = raw + (snap(raw) - raw) * .25;          // a gentle detent at every frame
  const now = performance.now(), dtm = Math.max(1, now - drag.lt);
  drag.v = drag.v * .6 + ((e.clientX - drag.lx) / pxPerWorld() / dtm * 1000) * .4; drag.lx = e.clientX; drag.lt = now;
});
function endDrag(e) {
  if (!mode || !drag.on) return; drag.on = false;
  if (!drag.moved) { tap(e); return; }
  if (mode.draggable && !mode.held) mode.strip.Lt = clampL(snap(mode.strip.Lt + drag.v * .12));   // a little inertia, then settle on a frame
  canvas.style.cursor = hoverCursor(e);
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", (e) => { drag.moved = true; endDrag(e); });

function pick(e, objs) { const h = S.ray(e).intersectObjects(objs, true)[0]; return h ? h.object : null; }
// only frames that are actually out of the canister (three.js raycasts hidden objects too)
function cellAt(e) { const o = pick(e, mode.strip.cells.filter((c) => c.g.visible).map((c) => c.g)); return o ? o.userData.cell : -1; }
function hoverCursor(e) {
  if (!mode) return "default";
  if (mode.kind === 2) return pick(e, [mode.lever, mode.body]) ? "pointer" : "default";
  if (mode.held) return "pointer";
  if (cellAt(e) >= 0 || (mode.kind === 1 && onCanister(e))) return "pointer";
  return mode.draggable ? "grab" : "default";
}
function tap(e) {
  if (mode.kind === 2) { if (pick(e, [mode.lever, mode.body])) press(); return; }
  if (mode.held) { putBack(); return; }
  const k = cellAt(e);
  if (k < 0) { if (mode.kind === 1 && onCanister(e)) holdUp(randomFrame()); return; }
  if (mode.kind === 0) develop(k); else holdUp(k);
}
function onCanister(e) { return !!pick(e, [S.rollMeshes[mode.roll.i]]); }
function randomFrame() {   // any frame but the one we just looked at
  const n = mode.roll.frames.length; let k = Math.floor(Math.random() * n);
  if (n > 1 && k === mode.lastHeld) k = (k + 1 + Math.floor(Math.random() * (n - 1))) % n;
  return k;
}

/* ---------- 2024: develop in place ---------- */
function develop(k) {
  const c = mode.strip.cells[k];
  if (c.devTarget < 1) { c.devTarget = 1; sfx.lift(); }
  frameCaption(mode.roll, k);
}

/* ---------- 2025: hold it up to the light ---------- */
const HOLD = new THREE.Vector3(.75, 1.12, 2.7), HOLD_H = 1.5;
function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,236,206,.95)"); gr.addColorStop(.35, "rgba(255,214,160,.45)"); gr.addColorStop(1, "rgba(255,200,140,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function holdUp(k) {
  const roll = mode.roll, f = roll.frames[k], cell = mode.strip.cells[k];
  const card = new THREE.Group();
  const border = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cellCanvas(FILM_COLORS[1], `${roll.iso} · ${k + 1}A`) }));
  const mat = devMaterial(cell.mat.map); mat.userData.u.uDev.value = cell.dev; mat.userData.u.uLit.value = .9;
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); photo.position.z = .003;
  card.add(border, photo); scene.add(card);
  const size = (a) => { const h = HOLD_H, w = h * a; photo.scale.set(w, h, 1); border.scale.set(w + .16, h + .34, 1); };
  size(.75);
  photoTex(f.file, true, (tx) => { mat.map = tx; mat.needsUpdate = true; size(tx.image.width / tx.image.height); });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.set(HOLD.x + .1, HOLD.y + .15, HOLD.z - 1.2); scene.add(glow);
  cell.photo.visible = false;
  mode.held = { k, card, mat, glow, t: 0, dir: 1, from: mode.strip.cellWorld(k) }; mode.lastHeld = k;
  sfx.lift(); frameCaption(roll, k);
}
function putBack() { const h = mode.held; if (!h || h.dir < 0) return; h.dir = -1; h.t = 1; sfx.drop(); }
function updateHeld(dt) {
  const h = mode.held; if (!h) return;
  h.t = Math.max(0, Math.min(1, h.t + h.dir * dt / (REDUCED ? .001 : .55)));
  const e = ease(h.t), cellScale = PH_H / HOLD_H;
  h.from = mode.strip.cellWorld(h.k);
  h.card.position.lerpVectors(h.from, HOLD, e);
  h.card.scale.setScalar(cellScale + (1 - cellScale) * e);
  h.card.rotation.set(0, (1 - e) * -.1, (1 - e) * .02 - .025 * e);
  h.glow.material.opacity = e * .9;
  const u = h.mat.userData.u.uDev;                         // develops only while it's under the light
  if (h.dir > 0 && h.t > .6) u.value = Math.min(1, u.value + dt / (REDUCED ? .001 : 1.1));
  if (h.dir < 0 && h.t === 0) {
    const c = mode.strip.cells[h.k]; c.dev = c.devTarget = u.value; c.mat.userData.u.uDev.value = u.value; c.photo.visible = true;
    scene.remove(h.card, h.glow); h.glow.material.map.dispose(); mode.held = null;
  }
}

/* ---------- 2026: the lever viewer ---------- */
const MX = .55, MZ = STAND.z + .05, WIN_W = .86, WIN_H = 1.1;
function buildViewer() {
  const g = new THREE.Group(); g.position.set(MX, 0, MZ);
  const green = new THREE.MeshStandardMaterial({ color: "#2c4034", metalness: .45, roughness: .4 });
  const brass = new THREE.MeshStandardMaterial({ color: "#b49a6a", metalness: .9, roughness: .3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.56, .72), green); body.position.y = .86; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, 1.42, 32, 1, false, 0, Math.PI), green);
  top.rotation.z = Math.PI / 2; top.scale.set(1, 1, .9); top.position.set(0, 1.64, 0); top.castShadow = true; g.add(top);
  const fz = .362;
  const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .04), brass); m.position.set(x, y, fz); g.add(m); };
  bar(WIN_W + .12, .06, 0, .98 + WIN_H / 2 + .03); bar(WIN_W + .12, .06, 0, .98 - WIN_H / 2 - .03);
  bar(.06, WIN_H + .12, -WIN_W / 2 - .03, .98); bar(.06, WIN_H + .12, WIN_W / 2 + .03, .98);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.42, .09, .03), brass); plate.position.set(0, .26, fz); g.add(plate);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), new THREE.MeshBasicMaterial({ color: new THREE.Color("#8a6a48") }));
  back.position.set(0, .98, fz + .004); g.add(back);
  const shot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  shot.position.set(0, .98, fz + .009); shot.visible = false; g.add(shot);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const ft = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .08, 16), brass); ft.position.set(sx * .6, .04, sz * .26); g.add(ft); }
  // lever on the right side: brass arm, red ball
  const pivot = new THREE.Group(); pivot.position.set(.74, .92, .12); g.add(pivot);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .08, 20), brass); hub.rotation.z = Math.PI / 2; pivot.add(hub);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .5, 12), brass); arm.position.set(.06, .25, 0); arm.rotation.z = -.22; pivot.add(arm);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.085, 24, 16), new THREE.MeshStandardMaterial({ color: "#b3242f", roughness: .3, metalness: .1 }));
  ball.position.set(.115, .5, 0); ball.castShadow = true; pivot.add(ball);
  pivot.rotation.x = 0; scene.add(g);
  return { g, body, lever: pivot, ball, shot, back };
}
function showShot(k, instant) {
  const v = mode.viewer, f = mode.roll.frames[k];
  v.fade = 0; v.target = k;
  const apply = (tx) => {
    if (v.target !== k || !mode || mode.kind !== 2) return;
    const a = tx.image.width / tx.image.height; let w = WIN_W, h = WIN_W / a; if (h > WIN_H) { h = WIN_H; w = WIN_H * a; }
    v.shot.material.dispose(); v.shot.material = new THREE.MeshBasicMaterial({ map: tx, color: new THREE.Color(0, 0, 0) });
    v.shot.scale.set(w, h, 1); v.shot.visible = true; v.fadeIn = true;
  };
  v.fadeIn = false;
  setTimeout(() => photoTex(f.file, true, apply), instant || REDUCED ? 0 : 90);
}
function press() {
  const v = mode.viewer; if (v.leverT > 0 && v.leverT < .35) return;
  v.leverT = .0001; sfx.lever(); ann.classList.remove("show");
  const n = mode.roll.frames.length;
  if (v.c >= n - 1) {   // end of the roll: wind it back
    v.c = -1; mode.strip.silent = false; mode.strip.rate = 5; mode.strip.Lt = MX - AX + LEAD - CELL_W * .5;
    v.shot.visible = false; hint.textContent = "倒卷回去了，再按一次从头看"; caption(`ROLL 0${mode.roll.i + 1}　·　${mode.roll.year}　·　${mode.roll.name}`, "");
    return;
  }
  v.c += 1; mode.strip.silent = true; mode.strip.rate = 10;
  mode.strip.Lt = MX - AX + LEAD + (v.c + .5) * CELL_W;
  showShot(v.c); frameCaption(mode.roll, v.c); hint.textContent = HINTS[2];
}
function updateViewer(dt) {
  const v = mode.viewer; if (!v) return;
  if (v.leverT > 0) {   // snaps down in 0.1 s, springs back over 0.3 s
    v.leverT += dt; const t = REDUCED ? 1 : v.leverT;
    const a = t < .1 ? ease(t / .1) : Math.max(0, 1 - ease((t - .1) / .3));
    v.lever.rotation.z = -.9 * a; if (t > .45) { v.leverT = 0; v.lever.rotation.z = 0; }
  }
  if (v.shot.visible && v.fadeIn) { v.fade = Math.min(1, v.fade + dt / (REDUCED ? .001 : .45)); v.shot.material.color.setScalar(.92 * ease(v.fade)); }
  // the hand-written "press me" follows the ball on screen
  if (ann.classList.contains("show")) {
    const p = new THREE.Vector3(); v.ball.getWorldPosition(p); p.project(camera);
    ann.style.left = ((p.x + 1) / 2 * canvas.clientWidth) + "px"; ann.style.top = ((1 - p.y) / 2 * canvas.clientHeight) + "px";
  }
}

/* ---------- open / close ---------- */
function open(d) {
  close(true);
  const cr = DR.content && DR.content.rolls && DR.content.rolls[d.i];
  if (!cr || !cr.frames || !cr.frames.length) { DR.toast && DR.toast("这一卷还没冲洗好"); return; }
  const roll = { ...d, frames: cr.frames };
  const kind = Math.min(2, d.i);
  const strip = new Strip(roll, cr.frames, kind === 2 ? { z: MZ - .5, curl: .02 } : {});
  mode = { kind, roll, strip, draggable: kind !== 2, held: null };
  if (kind === 0) strip.Lt = LEAD;                                   // just the leader sticks out
  if (kind === 1) strip.Lt = LEAD + CELL_W * 3;                      // a few frames already out
  if (kind === 2) {
    mode.viewer = Object.assign(buildViewer(), { c: -1, leverT: 0, fade: 0 });
    mode.lever = mode.viewer.lever; mode.body = mode.viewer.body;
    strip.silent = true; strip.Lt = MX - AX + LEAD - CELL_W * .5;
    setTimeout(() => { if (mode && mode.kind === 2) ann.classList.add("show"); }, REDUCED ? 0 : 900);
  }
  hint.textContent = HINTS[kind];
  caption(`ROLL 0${d.i + 1}　·　${d.year}　·　${d.name}`, "");
}
function close(now) {
  if (!mode) return; const m = mode; mode = null; drag.on = false;
  cap.classList.remove("show"); ann.classList.remove("show"); hint.textContent = "挑一卷"; canvas.style.cursor = "default";
  if (m.held) { scene.remove(m.held.card, m.held.glow); }
  m.strip.silent = false; m.strip.rate = 9; m.strip.Lt = 0;           // the film winds back in
  const done = () => { m.strip.dispose(); if (m.viewer) scene.remove(m.viewer.g); };
  if (now || REDUCED) done(); else { closing.push(m); setTimeout(() => { closing.splice(closing.indexOf(m), 1); done(); }, 700); }
}
const closing = [];
addEventListener("darkroom:roll-open", (e) => open(e.detail));
addEventListener("darkroom:roll-close", () => close());

DR.scene2.hooks.push((dt) => {
  for (const m of closing) m.strip.update(dt);
  if (!mode) return;
  mode.strip.update(dt);
  if (mode.kind === 1) updateHeld(dt);
  if (mode.kind === 2) updateViewer(dt);
});

/* keyboard: ←/→ move the film or the viewer, Enter/Space acts on the newest frame */
addEventListener("keydown", (e) => {
  if (!mode) return;
  if (mode.kind === 2) { if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); press(); } return; }
  if (mode.held) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); putBack(); } return; }
  if (e.key === "ArrowRight") mode.strip.Lt = clampL(snap(mode.strip.Lt) + CELL_W);
  else if (e.key === "ArrowLeft") mode.strip.Lt = clampL(snap(mode.strip.Lt) - CELL_W);
  else if (e.key === " " || e.key === "Enter") {
    e.preventDefault(); const k = Math.max(0, Math.round((mode.strip.Lt - LEAD) / CELL_W) - 1);
    if (Math.round((mode.strip.Lt - LEAD) / CELL_W) < 1) return;
    if (mode.kind === 0) develop(k); else holdUp(k);
  }
});
DR.scene3 = {
  busyEscape() { if (mode && mode.held) { putBack(); return true; } return false; },
  state() { return mode ? { kind: mode.kind, held: mode.held ? mode.held.k : null, dir: mode.held ? mode.held.dir : 0, last: mode.lastHeld } : null; },
  // debug / screenshots
  pull(n) { if (mode) mode.strip.Lt = clampL(LEAD + n * CELL_W); },
  develop(k) { if (mode && mode.kind === 0) develop(k); },
  hold(k) { if (mode && mode.kind === 1) holdUp(k); },
  press() { if (mode && mode.kind === 2) press(); },
};

// debug hook for screenshots: #roll2 opens roll 2
const m = location.hash.match(/^#roll(\d)$/);
if (m) {
  const run = () => setTimeout(() => DR.scene2.pick(+m[1] - 1), 300);
  if (DR.content) run(); else addEventListener("darkroom:content", run, { once: true });
}
