/* Interaction sounds, synthesised live with Web Audio (no audio files),
   plus the background music from content/music/ (see content.md「背景音乐」).
   Effects run through a soft low-pass and sit well under the music. */
let ctx = null, noise = null, master = null;
const SFX_LEVEL = .5, MUSIC_LEVEL = .42;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = SFX_LEVEL;
    const soft = ctx.createBiquadFilter(); soft.type = "lowpass"; soft.frequency.value = 6200; soft.Q.value = .5;   // takes the edge off the clicks
    master.connect(soft).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * .6, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
// browsers only allow audio after a user gesture: the first tap (usually on the envelope) also starts the music
function unlock() { ac(); music.play(); }
for (const ev of ["pointerdown", "keydown", "touchstart"]) addEventListener(ev, unlock, { passive: true });

/* background music: fades in, loops, pauses while the tab is hidden */
const music = {
  el: null, gain: null, playing: false,
  load(url) {
    if (this.el || !url) return;
    // nothing is downloaded until the first tap starts playback (7 MB on mobile data otherwise)
    const el = new Audio(); el.preload = "none"; el.loop = true; el.src = url;
    el.addEventListener("error", () => { this.el = null; this.playing = false; });
    this.el = el;
  },
  play() {
    const c = ac(); if (!c || !this.el || this.playing) return;
    if (!this.gain) {   // volume through Web Audio so the fade also works on iPhone
      this.gain = c.createGain(); this.gain.gain.value = 0;
      c.createMediaElementSource(this.el).connect(this.gain).connect(c.destination);
    }
    this.playing = true;
    this.el.play().then(() => this.gain.gain.setTargetAtTime(MUSIC_LEVEL, c.currentTime, 1.4)).catch(() => { this.playing = false; });
  },
};
const loadMusic = () => { const c = window.DARKROOM && window.DARKROOM.content; if (c && c.music) music.load(c.music); };
addEventListener("darkroom:content", loadMusic); loadMusic();
document.addEventListener("visibilitychange", () => {
  if (!music.el || !music.playing) return;
  if (document.hidden) music.el.pause(); else music.el.play().catch(() => {});
});

function burst({ f = 4200, q = 1.2, dur = .012, gain = .3, type = "bandpass", at = 0, sweep = 0 }) {
  const c = ac(); if (!c) return; const t = c.currentTime + at;
  const src = c.createBufferSource(); src.buffer = noise; src.playbackRate.value = .9 + Math.random() * .2;
  const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(60, f * sweep), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .0015);
  g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  src.connect(fl).connect(g).connect(master); src.start(t, Math.random() * .4); src.stop(t + dur + .02);
}
function thump({ f0 = 160, f1 = 60, dur = .07, gain = .3, at = 0 }) {
  const c = ac(); if (!c) return; const t = c.currentTime + at;
  const o = c.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .003); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
}

/* a sustained swish of noise: rises, then falls away (paper moving against paper) */
function swish({ f = 1800, q = .4, dur = .8, gain = .06, sweep = .6, at = 0, type = "bandpass" }) {
  const c = ac(); if (!c) return; const t = c.currentTime + at;
  const src = c.createBufferSource(); src.buffer = noise; src.loop = true; src.playbackRate.value = .8 + Math.random() * .2;
  const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(f * sweep, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * .3); g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(fl).connect(g).connect(master); src.start(t, Math.random() * .3); src.stop(t + dur + .05);
}
let lastTick = 0;
export const sfx = {
  /* one frame passing the gate: a dry ~5 ms click around 4 kHz */
  tick(v = 1) {
    const now = performance.now(); if (now - lastTick < 28) return; lastTick = now;
    burst({ f: 3200 + Math.random() * 500, q: 1.2, dur: .014, gain: .26 * v });
    burst({ f: 1300, q: .9, dur: .012, gain: .1 * v });
  },
  /* lever of the viewer: heavier click down, lighter click back up */
  lever() {
    burst({ f: 2300, q: .8, dur: .035, gain: .4 }); thump({ f0: 150, f1: 55, dur: .08, gain: .3 });
    burst({ f: 3600, q: 1.4, dur: .015, gain: .2, at: .16 }); thump({ f0: 220, f1: 120, dur: .04, gain: .1, at: .16 });
  },
  /* picking a canister up off the desk */
  pick() { burst({ f: 2300, q: .7, dur: .085, gain: .26 }); thump({ f0: 210, f1: 110, dur: .09, gain: .22 }); },
  /* a frame slid out of / back into the strip */
  lift() { burst({ f: 1800, q: .5, dur: .26, gain: .07, type: "lowpass", sweep: .35 }); },
  drop() { burst({ f: 900, q: .5, dur: .16, gain: .07, type: "lowpass", sweep: .5 }); burst({ f: 3600, q: 1.2, dur: .012, gain: .12, at: .14 }); },
  /* the wax seal giving way as the flap lifts */
  seal() {
    burst({ f: 1700, q: .8, dur: .05, gain: .3 }); burst({ f: 3400, q: 2, dur: .02, gain: .16, at: .025 });
    thump({ f0: 130, f1: 70, dur: .08, gain: .18 }); swish({ f: 2200, q: .5, dur: .55, gain: .035, sweep: .5, at: .08 });
  },
  /* a letter drawn out of its envelope */
  slide(d = 1) { swish({ f: 1500, q: .35, dur: d, gain: .055, sweep: 1.6 }); },
  /* a folded sheet opening out: a soft swish with a few crackles */
  unfold() {
    swish({ f: 2600, q: .5, dur: .5, gain: .045, sweep: .55 });
    for (let i = 0; i < 4; i++) burst({ f: 3800 + Math.random() * 1500, q: 1.5, dur: .012, gain: .07, at: .05 + Math.random() * .35, type: "highpass" });
  },
  /* a sheet of paper sliding / landing */
  paper() { burst({ f: 2400, q: .4, dur: .32, gain: .08, type: "bandpass", sweep: .5 }); },
  /* paper going into the tray, or lifted out of it */
  splash(v = 1) {
    burst({ f: 700, q: .6, dur: .45, gain: .16 * v, type: "lowpass", sweep: .4 });
    for (let i = 0; i < 4; i++) burst({ f: 1600 + Math.random() * 1400, q: 6, dur: .04, gain: .05 * v, at: .1 + Math.random() * .35 });
  },
  /* a wooden clothes-peg snapping shut */
  clip() { burst({ f: 2600, q: 1, dur: .02, gain: .32 }); thump({ f0: 260, f1: 140, dur: .05, gain: .16 }); },
  /* turning a print over */
  flip() { burst({ f: 3200, q: .5, dur: .2, gain: .07, type: "highpass", sweep: .4 }); },
  /* a pin pressed into the wall */
  pin() { burst({ f: 3000, q: 1.2, dur: .015, gain: .2 }); thump({ f0: 300, f1: 160, dur: .03, gain: .1 }); },
  /* marker on paper: call scribble(speed) while drawing, scribbleStop() when the pen lifts */
  scribble(speed) {
    const c = ac(); if (!c) return;
    if (!scrib) {
      const src = c.createBufferSource(); src.buffer = noise; src.loop = true;
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = .7;
      const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(bp).connect(hp).connect(g).connect(master); src.start();
      scrib = { src, g, bp };
    }
    const v = Math.min(1, speed / 900);   // px per second → loudness
    scrib.g.gain.setTargetAtTime(.02 + v * .16, c.currentTime, .03);
    scrib.bp.frequency.setTargetAtTime(2000 + v * 1800, c.currentTime, .05);
  },
  scribbleStop() { if (scrib && ctx) scrib.g.gain.setTargetAtTime(0, ctx.currentTime, .04); },
};
let scrib = null;
window.DARKROOM = window.DARKROOM || {}; window.DARKROOM.sfx = sfx; window.DARKROOM.music = music;
