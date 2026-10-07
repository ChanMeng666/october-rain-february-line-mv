// 十月的微雨 — a hand-inked cel film (style 05 · 逐帧手绘 / 线条沸腾) for a 5-minute song.
// Animated on 2s at 24 fps: every drawing is re-inked with a new boil seed (4 variants cycling), fills sit slightly off
// register, paper tooth is multiplied over each cel. One rule comes from the lyric — 把臉龐留在鏡頭之外 — so no face is
// ever drawn: the two are seen from behind, cropped, or as featureless silhouettes.
// Canvas2D on the mg-styles-15 cel engine; every frame is a pure function of t.
import { hs, clamp, lerp, sstep, E, K, spline, circlePts, inkStroke, inkLoop, fillShape, prefix, xf } from '/lib/cel-engine.js';

const Q = new URLSearchParams(location.search);
const W = 1920, H = 1080, FPS = 24, DUR = 324.8;
const TM = await (await fetch('./timing.json')).json();
window.DEMO = { width: W, height: H, fps: FPS, duration: DUR };
const INK = '#2a2320', RED = '#c9432e', YEL = '#e3a530', BLU = '#7089a0', NIGHT = '#2b3650', HI = '#fbf3e0', PENCIL = '#d9654f', WASH = '#cfc6b2', MOSS = '#8c9a6a';
const FONT = '"LXGW WenKai TC"';
const mod = (a, n) => ((a % n) + n) % n;

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let BS = 0, D = 0;    // boil seed of the current drawing, drawing index

// ---------------------------------------------------------------- hand tools
const blob = (c, P, fill, o = {}) => {
  const dense = o.dense ? P : spline(P, true, 6), seed = BS + (o.seed || 0);
  if (fill) fillShape(c, dense, fill, { seed, amp: o.amp ?? 2, dx: o.dx ?? 3, dy: o.dy ?? 2 });
  if (o.ink !== false) inkLoop(c, dense, { seed, w: o.w ?? 5, amp: o.amp ?? 2, color: o.color || INK });
};
const stroke = (c, P, o = {}) => inkStroke(c, P, { w: 5, amp: 2, color: INK, ...o, seed: BS + (o.seed || 0) });
const drawOn = (c, P, frac, o = {}) => { if (frac > 0.01) stroke(c, prefix(spline(P, false, 5), frac), { ...o, dense: true }); };
const at = (P, x, y, s = 1, r = 0, sx = 1) => xf(P, { x, y, sx: s * sx, sy: s, r });
const pop = (q, t0, n = 0.25) => (q < t0 ? 0 : E.outBack(clamp((q - t0) / n)));       // overshoot pop-in on the drawing grid

function figure(c, x, y, s, o) {     // seen from behind; origin at the hem
  const sd = o.seed || 0, ph = o.step || 0, k = Math.sqrt(s);
  const yb = y - (o.walk ? Math.abs(Math.sin(ph)) * 7 * s : 0);
  const X = (P) => at(P, x, yb, s, o.lean || 0);
  const sw = o.walk ? Math.sin(ph) * 17 : 0;
  stroke(c, at([[-18, -12], [-18 + sw, 54]], x, y, s), { w: 9 * k, seed: sd + 1, taper: false });
  stroke(c, at([[18, -12], [18 - sw, 54]], x, y, s), { w: 9 * k, seed: sd + 2, taper: false });
  blob(c, X([[-50, -6], [-58, -120], [-50, -196], [-22, -222], [22, -222], [50, -196], [58, -120], [50, -6], [0, 0]]), o.coat, { seed: sd + 3, w: 5 * k });
  if (o.hand) blob(c, X(circlePts(o.hand * 58, -62, 13, 8)), HI, { seed: sd + 8, w: 4 * k });
  blob(c, X([[-36, -224], [0, -240], [36, -224], [38, -198], [0, -186], [-38, -198]]), o.scarf, { seed: sd + 4, w: 4 * k });
  blob(c, X([[6, -196], [30, -198], [36, -130], [14, -126]]), o.scarf, { seed: sd + 5, w: 4 * k });
  if (o.hair === 'bob') blob(c, X([[-37, -262], [-31, -297], [0, -311], [31, -297], [37, -262], [35, -226], [0, -233], [-35, -226]]), INK, { seed: sd + 6, ink: false });
  else blob(c, X(circlePts(0, -268, 30, 10)), INK, { seed: sd + 6, ink: false });
}
const HER = { coat: HI, scarf: RED, hair: 'bob', seed: 100 }, HIM = { coat: BLU, scarf: YEL, hair: 'short', seed: 200 };

function umbrella(c, x, y, R, open, o = {}) {      // (x, y) = where the shaft meets the canopy rim line
  const sx = lerp(0.1, 1, open), sy = lerp(1.25, 1, open);
  stroke(c, [[x, y - R * 0.6 * sy], [x, y + R * 0.95]], { w: 5, seed: 31, taper: false });
  stroke(c, [[x, y + R * 0.95], [x + 4, y + R * 1.06], [x + 20, y + R * 1.04]], { w: 5, seed: 32 });
  const P = [[-R, 0, 1], [-R * 0.82, -R * 0.4], [-R * 0.42, -R * 0.6], [0, -R * 0.66], [R * 0.42, -R * 0.6], [R * 0.82, -R * 0.4], [R, 0, 1], [R * 0.66, -R * 0.1], [R * 0.33, 0, 1], [0, -R * 0.1], [-R * 0.33, 0, 1], [-R * 0.66, -R * 0.1]];
  blob(c, at(P.map((p) => [p[0] * sx, p[1] * sy, p[2]]), x, y, 1, o.r || 0), o.color || RED, { seed: 33, w: 6 });
  if (open > 0.7) for (const k of [-0.33, 0.33]) stroke(c, [[x, y - R * 0.64], [x + k * R * 0.6, y - R * 0.4], [x + k * R, y - 2]], { w: 2.6, seed: 36 + k, amp: 1.2 });
  stroke(c, [[x, y - R * 0.66 * sy], [x, y - R * 0.66 * sy - 22]], { w: 5, seed: 39 });
}
// the two of them, she on the left; (x, y) = the midpoint between their hems
function duo(c, x, y, s, o = {}) {
  const gap = (o.gap ?? 150) * s, ph = o.step || 0;
  if (o.ghost) {    // 牽起你的手: the version that never happened, in red pencil
    const a = [x - gap / 2 + 58 * s, y - 62 * s], b = [x + gap / 2 - 58 * s, y - 62 * s];
    drawOn(c, [a, [(a[0] + b[0]) / 2, a[1] + 16 * s], b], o.ghost, { color: PENCIL, w: 4.5, seed: 61 });
    if (o.ghost > 0.9) blob(c, circlePts((a[0] + b[0]) / 2, a[1] + 12 * s, 15 * s, 9), null, { color: PENCIL, w: 3.5, seed: 62 });
  }
  figure(c, x - gap / 2, y, s, { ...HER, walk: o.walk, step: ph, hand: o.hands ? 1 : 0 });
  figure(c, x + gap / 2, y, s, { ...HIM, walk: o.walk, step: ph + 2.2, hand: o.hands ? -1 : 0 });
  if (o.open != null) umbrella(c, x + gap * 0.16, y - 330 * s, 190 * s * lerp(0.6, 1, o.open), o.open, { r: o.tilt || 0 });
}
function bubble(c, x, y, w, h, side, fill, seed, tail = true) {
  const r = Math.min(w, h) * 0.3, P = [[-w / 2 + r, -h / 2], [w / 2 - r, -h / 2], [w / 2, -h / 2 + r], [w / 2, h / 2 - r], [w / 2 - r, h / 2]];
  if (tail) P.push([side * w * 0.3, h / 2, 1], [side * w * 0.42, h / 2 + 30, 1], [side * w * 0.12, h / 2, 1]);
  P.push([-w / 2 + r, h / 2], [-w / 2, h / 2 - r], [-w / 2, -h / 2 + r]);
  blob(c, at(P, x, y), fill, { seed, w: 4.5 });
}
const scribble = (c, x, y, w, seed, color = INK) => stroke(c, [[x, y], [x + w * 0.3, y - 5], [x + w * 0.62, y + 5], [x + w, y - 1]], { w: 3.4, seed, color, amp: 1.5 });
function panel(c, fill = NIGHT, seed = 5) {    // a painted night: gouache on the paper, the border stays paper
  blob(c, [[90, 70, 1], [960, 58], [1830, 74, 1], [1842, 470], [1826, 868, 1], [960, 880], [96, 866, 1], [80, 470]], fill, { seed, ink: false, amp: 4, dx: 0, dy: 0 });
}
function leaf(c, x, y, r, s, kind, seed) {
  if (kind) blob(c, at([[0, 0], [-10, -18], [-30, -34], [-20, -48], [0, -42], [20, -48], [30, -34], [10, -18]], x, y, s, r), YEL, { seed, ink: false, amp: 1 });
  else { const P = []; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? 15 : 36; P.push([Math.cos(a) * rr, Math.sin(a) * rr - 20, 1]); } blob(c, at(P, x, y, s, r), RED, { seed, ink: false, amp: 1 }); }
  stroke(c, at([[0, 0], [3, 20]], x, y, s, r), { w: 2.4, seed: seed + 1, amp: 0.6 });
}
function leaves(c, q, n, o = {}) {
  for (let k = 0; k < n; k++) {
    const v = (50 + 70 * hs(k, 3)) * (o.speed ?? 1), x = mod(hs(k, 1) * 2300 + (o.wind || 0) * q * (0.5 + hs(k, 7)) + 50 * Math.sin(q * (0.6 + hs(k, 5)) + k), 2300) - 190;
    const y = mod(hs(k, 2) * 1260 + q * v * (o.dir || 1), 1260) - 90;
    if (o.above && y > o.above) continue;
    leaf(c, x, y, q * (0.5 + hs(k, 4)) + k, 0.7 + 0.6 * hs(k, 6), hs(k, 8) > (o.red ?? 0.45), 300 + k * 3);
  }
}
function rain(c, n, o = {}) {    // cel FX: re-drawn every drawing, falling (or rising) on a fixed track
  const dir = o.dir || 1; c.save(); c.strokeStyle = BLU; c.lineCap = 'round'; c.globalAlpha = o.alpha ?? 0.9;
  for (let k = 0; k < n; k++) {
    const len = 44 + 34 * hs(k, 14), x = hs(k, 11) * 2300 - 190 + 3 * (hs(k, D) - 0.5), y = mod(hs(k, 12) * 1300 + D * 150 * dir * (0.8 + 0.4 * hs(k, 13)), 1300) - 110;
    if (o.above && y > o.above) continue;
    c.lineWidth = 2.4 + 1.6 * hs(k, 15); c.beginPath(); c.moveTo(x, y); c.lineTo(x - len * 0.2, y + len); c.stroke();
  }
  c.restore();
}
function ripples(c, n, gy, gh, alpha = 1) {
  c.save(); c.strokeStyle = BLU; c.lineWidth = 2.6;
  for (let k = 0; k < n; k++) {
    const ph = (D + k * 3) % 9, gen = Math.floor((D + k * 3) / 9);
    if (ph > 4) continue;
    const x = 80 + hs(k, gen, 1) * 1760, y = gy + hs(k, gen, 2) * gh, rx = 10 + ph * 11;
    c.globalAlpha = alpha * (1 - ph / 5); c.beginPath(); c.ellipse(x, y, rx, rx * 0.3, 0, 0, 7); c.stroke();
  }
  c.restore();
}
const ground = (c, y, seed = 70, x0 = 60, x1 = 1860) => stroke(c, [[x0, y], [x0 + (x1 - x0) * 0.3, y + 3], [x0 + (x1 - x0) * 0.7, y - 3], [x1, y + 1]], { w: 4.5, seed });
function tree(c, x, y, s, seed, crown = YEL) {
  blob(c, at([[-26, 0], [-18, -200], [-30, -420], [0, -440], [26, -420], [20, -200], [30, 0]], x, y, s), '#6b5a4b', { seed, w: 5 });
  for (const [dx, dy, r] of [[-120, -470, 130], [90, -520, 150], [-10, -640, 140]]) blob(c, at(circlePts(dx, dy, r, 9), x, y, s), crown, { seed: seed + dx, w: 5, amp: 4 });
}
function polaroid(c, x, y, r, s, kind, seed, k) {
  if (k <= 0) return;
  c.save(); c.translate(x, y); c.rotate(r); c.scale(s * k, s * k);
  blob(c, [[-190, -235, 1], [190, -235, 1], [190, 235, 1], [-190, 235, 1]], HI, { seed, w: 5 });
  const tint = { lamp: '#e9d6a8', balcony: '#e8b98f', nohead: '#d5dbd6', finger: '#e6dcc6', blur: '#d5dbd6', noface: '#e6dcc6' }[kind];
  blob(c, [[-160, -205, 1], [160, -205, 1], [160, 125, 1], [-160, 125, 1]], tint, { seed: seed + 1, w: 3.5, dx: 2, dy: 2 });
  if (kind === 'lamp') {       // 書桌的檯燈
    blob(c, [[-70, -40, 1], [-40, -130, 1], [40, -130, 1], [70, -40, 1]], YEL, { seed: seed + 2 });
    stroke(c, [[0, -40], [0, 70]], { seed: seed + 3 }); stroke(c, [[-50, 72], [50, 72]], { seed: seed + 4, w: 7 });
    stroke(c, [[-120, 100], [130, 100]], { seed: seed + 5, w: 4 });
    blob(c, [[70, 100, 1], [72, 60, 1], [130, 56, 1], [132, 100, 1]], HI, { seed: seed + 6, w: 3.5 });
  } else if (kind === 'balcony') {   // 陽台的傍晚
    blob(c, circlePts(30, -60, 62, 12), RED, { seed: seed + 2, ink: false });
    for (let i = -3; i <= 3; i++) stroke(c, [[i * 44, 20], [i * 44, 122]], { seed: seed + 5 + i, w: 4, taper: false });
    stroke(c, [[-158, 20], [158, 20]], { seed: seed + 3, w: 6, taper: false });
  } else if (kind === 'nohead' || kind === 'blur') {
    const n = kind === 'blur' ? 3 : 1;     // 沒對焦: the same figure, three times, never sharp
    for (let i = 0; i < n; i++) {
      c.save(); c.globalAlpha = kind === 'blur' ? 0.4 : 1; c.beginPath(); c.rect(-158, -203, 316, 326); c.clip();
      if (kind === 'nohead') { blob(c, [[-120, 130], [-110, -40], [-50, -110], [50, -110], [110, -40], [120, 130]], HI, { seed: seed + 2 }); blob(c, [[-52, -108], [0, -128], [52, -108], [50, -70], [0, -56], [-50, -70]], RED, { seed: seed + 3, w: 4 }); blob(c, [[-34, -120, 1], [-30, -230, 1], [30, -230, 1], [34, -120, 1]], HI, { seed: seed + 4, w: 4 }); }
      else { const dx = (i - 1) * 16 + 4 * Math.sin(BS + i); blob(c, [[dx - 46, 120], [dx - 52, -20], [dx - 30, -90], [dx + 30, -90], [dx + 52, -20], [dx + 46, 120]], BLU, { seed: seed + 2 + i, w: 3 }); blob(c, circlePts(dx, -128, 30, 9), HI, { seed: seed + 6 + i, w: 3 }); }
      c.restore();
    }
  } else if (kind === 'finger') {    // 指尖的弧線
    blob(c, [[-150, 120, 1], [-150, 40], [-40, 10], [60, -20], [96, -50], [112, -32], [80, 10], [-20, 60], [-60, 120, 1]], HI, { seed: seed + 2 });
    stroke(c, [[84, -46], [98, -30]], { seed: seed + 3, w: 3 });
    blob(c, [[20, 40, 1], [150, 10, 1], [156, 110, 1], [30, 122, 1]], '#f4ead2', { seed: seed + 4, w: 3.5 });
    for (let i = 0; i < 3; i++) scribble(c, 52, 60 + i * 18, 80, seed + 6 + i);
  } else if (kind === 'noface') {    // 完整的臉 都不曾浮現
    blob(c, [[-70, -40], [-60, -130], [0, -160], [60, -130], [70, -40], [40, 40], [0, 60], [-40, 40]], HI, { seed: seed + 2, w: 4 });
    c.fillStyle = INK; c.font = `400 110px ${FONT}`; c.textAlign = 'center'; c.fillText('?', 2 + Math.sin(BS) * 1.5, -6);
  }
  c.restore();
}
function profile(c, x, y, s, flip, o) {     // a silhouette, never a face
  const P = [[-70, -150], [-20, -196], [30, -186], [50, -140], [58, -84], [84, -52], [62, -40], [66, -22], [60, -8], [64, 6], [48, 34], [10, 44], [0, 110], [-80, 130], [-96, 60], [-104, -60]];
  const X = (Q0) => xf(Q0, { x, y, sx: s * flip, sy: s });
  blob(c, X(P), o.skin, { seed: o.seed, w: 5.5 });
  blob(c, X(o.long ? [[-70, -150], [-20, -200], [34, -190], [52, -150], [10, -150], [-20, -110], [-24, -30], [-40, 60], [-100, 80], [-112, -60]] : [[-70, -150], [-20, -200], [34, -190], [54, -146], [10, -150], [-20, -116], [-34, -60], [-70, -40], [-106, -70]]), INK, { seed: o.seed + 2, ink: false });
  blob(c, X([[-90, 70], [-20, 52], [30, 60], [34, 104], [-20, 118], [-96, 130]]), o.scarf, { seed: o.seed + 3, w: 4.5 });
}
function dim(c, x0, x1, y, label, frac) {   // a red-pencil dimension line
  if (frac <= 0) return;
  const xm = (x0 + x1) / 2, a = lerp(xm, x0, frac), b = lerp(xm, x1, frac);
  stroke(c, [[a, y], [b, y]], { color: PENCIL, w: 3.2, seed: 81, amp: 1.2 });
  if (frac > 0.9) {
    stroke(c, [[x0, y - 22], [x0, y + 22]], { color: PENCIL, w: 3.2, seed: 82 }); stroke(c, [[x1, y - 22], [x1, y + 22]], { color: PENCIL, w: 3.2, seed: 83 });
    c.fillStyle = PENCIL; c.font = `400 44px ${FONT}`; c.textAlign = 'center'; c.fillText(label, xm + Math.sin(BS * 2) * 1.2, y - 22);
  }
}
function wedding(c, x, y, s) {      // 那一抹純白色的婚禮
  const X = (P) => at(P, x, y, s);
  stroke(c, X([[60, -250], [60, -40]]), { w: 4, seed: 91, taper: false });
  blob(c, X([[-60, -250, 1], [0, -300], [120, -300], [180, -250, 1], [60, -262]]), RED, { seed: 92, w: 4.5 });
  blob(c, X([[100, 0], [96, -90], [112, -118], [128, -90], [124, 0]]), WASH, { seed: 93, w: 3.5 }); blob(c, X(circlePts(112, -132, 13, 8)), INK, { seed: 94, ink: false });
  blob(c, X([[-26, 0], [-30, -76], [-18, -110], [0, -118], [18, -110], [30, -76], [26, 0]]), HI, { seed: 95, w: 4.5 });
  blob(c, X(circlePts(0, -128, 22, 9)), HI, { seed: 96, w: 4.5 });
  blob(c, X([[36, 0], [34, -84], [48, -112], [62, -84], [60, 0]]), INK, { seed: 97, ink: false }); blob(c, X(circlePts(48, -126, 13, 8)), INK, { seed: 98, ink: false });
}
function bridge(c, x, y, s) {       // 住吉大社的反橋
  const X = (P) => at(P, x, y, s);
  blob(c, X([[-260, 0, 1], [-150, -150], [0, -206], [150, -150], [260, 0, 1], [200, 0, 1], [110, -110], [0, -150], [-110, -110], [-200, 0, 1]]), RED, { seed: 111, w: 5 });
  for (let i = -3; i <= 3; i++) { const u = i / 3.4, yy = -206 * (1 - u * u) + 8; stroke(c, X([[u * 240, yy], [u * 240, yy - 44]]), { w: 4, seed: 114 + i, taper: false }); }
  stroke(c, X([[-250, -40], [-150, -192], [0, -250], [150, -192], [250, -40]]), { w: 4.5, seed: 120 });
}

// ---------------------------------------------------------------- scenes  (q = time on the drawing grid)
const beats = TM.beats;
const S = {
  intro(c, q) {
    ground(c, 800);
    { const u = (q - 3.2) / 8.5; if (u > 0 && u < 1) { const x = lerp(2000, -520, u); for (let i = 0; i < 4; i++) blob(c, at([[0, 0, 1], [0, -44, 1], [108, -44, 1], [108, 0, 1]], x + i * 118, 797), i ? HI : RED, { seed: 130 + i, w: 3.5 }); } }   // a distant train
    leaves(c, q, 9, { wind: 40 });
    const title = [...'十月的微雨'];
    c.textAlign = 'center'; c.fillStyle = INK;
    title.forEach((ch, i) => {
      const t0 = beats[2 + i * 2] ?? 2 + i, k = pop(q, t0, 0.3) * (1 - sstep(13.6, 15.4, q));
      if (k <= 0) return;
      c.save(); c.translate(960 + (i - 2) * 190 + (hs(D, i) - 0.5) * 3, 470 + (hs(D, i, 2) - 0.5) * 3 + (i % 2 ? 14 : -10)); c.scale(k, k); c.rotate((hs(i, 77) - 0.5) * 0.08);
      c.font = `400 168px ${FONT}`; c.fillText(ch, 0, 0); c.restore();
    });
    const a = sstep(7.5, 9, q) * (1 - sstep(13.6, 15.2, q));
    if (a > 0) { c.globalAlpha = a; c.font = 'italic 500 40px "Cormorant Garamond"'; c.letterSpacing = '6px'; c.fillStyle = INK; c.fillText('a drizzle in October  ·  Osaka', 960, 590); c.letterSpacing = '0px'; c.globalAlpha = 1; drawOn(c, [[760, 628], [900, 634], [1040, 626], [1160, 632]], sstep(8, 10, q), { color: RED, w: 5, seed: 140 }); }
    if (q > 12.4) for (let i = 0; i < 3; i++) { const k = pop(q, 12.5 + i * 0.5, 0.2) * (1 - sstep(15.4, 16, q)); if (k > 0) blob(c, circlePts(900 + i * 60, 720 - 8 * Math.abs(Math.sin(q * 5 - i)), 11 * k, 8), INK, { seed: 150 + i, ink: false }); }   // typing…
  },
  chat(c, q, t0, t1) {       // 凌晨兩點半的對話框
    panel(c);
    blob(c, circlePts(1640, 210, 62, 12), YEL, { seed: 160, ink: false }); blob(c, circlePts(1672, 190, 56, 12), NIGHT, { seed: 161, ink: false });
    c.fillStyle = HI; c.textAlign = 'left'; c.font = `400 76px ${FONT}`; c.fillText('02:3' + Math.min(9, Math.floor((q - t0) / 3)), 170 + (hs(D) - 0.5) * 2, 200);
    const bs = beats.filter((b, i) => b >= t0 - 0.2 && b < t1 - 0.5 && i % 2 === 0);
    const n = bs.filter((b) => b <= q).length;
    for (let i = Math.max(0, n - 5); i < n; i++) {
      const age = n - 1 - i, k = i === n - 1 ? pop(q, bs[i], 0.22) : 1, her = i % 2 === 0, w = 300 + 190 * hs(i, 5), h = 96 + (hs(i, 6) > 0.6 ? 46 : 0);
      const x = her ? 1500 - w / 2 : 430 + w / 2, y = 760 - age * 150 - (i === n - 1 ? 0 : 0);
      c.save(); c.translate(x, y); c.scale(k, k);
      bubble(c, 0, 0, w, h, her ? 1 : -1, her ? RED : YEL, 170 + i * 5);
      scribble(c, -w / 2 + 44, -h / 2 + 46, w - 96, 172 + i * 5, her ? HI : INK); if (h > 100) scribble(c, -w / 2 + 44, -h / 2 + 88, (w - 96) * 0.6, 173 + i * 5, her ? HI : INK);
      c.restore();
    }
    const nx = bs[n]; if (nx && nx - q < 1.2) { const her = n % 2 === 0; for (let i = 0; i < 3; i++) blob(c, circlePts((her ? 1500 : 500) + i * 36 - 36, 835 - 7 * Math.abs(Math.sin(q * 6 - i)), 8, 7), HI, { seed: 190 + i, ink: false }); }
  },
  photosF(c, q, t0) {        // 檯燈 · 陽台的傍晚 · 把臉龐留在鏡頭之外
    panel(c);
    polaroid(c, 440, 470, -0.07, 1.1, 'lamp', 400, pop(q, t0 + 0.2));
    polaroid(c, 960, 500, 0.04, 1.1, 'balcony', 420, pop(q, 32.0));
    polaroid(c, 1480, 460, -0.03, 1.1, 'nohead', 440, pop(q, 36.2));
  },
  photosM(c, q, t0) {        // 指尖的弧線 · 沒對焦的全身照片 · 完整的臉都不曾浮現
    panel(c, '#39506a', 7);
    polaroid(c, 440, 480, 0.05, 1.1, 'finger', 460, pop(q, t0 + 0.3));
    polaroid(c, 960, 460, -0.05, 1.1, 'blur', 480, pop(q, 46.9));
    polaroid(c, 1480, 490, 0.03, 1.1, 'noface', 500, pop(q, 51.0));
  },
  souls(c, q, t0) {          // 靈魂早已相見: two bubbles lean in until they share a border
    panel(c);
    const u = E.io3(sstep(t0, t0 + 4.2, q)), dx = lerp(520, 196, u);
    bubble(c, 960 - dx, 470, 380, 240, -1, YEL, 520); bubble(c, 960 + dx, 470, 380, 240, 1, RED, 530);
    for (let i = 0; i < 3; i++) { scribble(c, 960 - dx - 130, 420 + i * 44, 240 - i * 50, 540 + i, INK); scribble(c, 960 + dx - 130, 420 + i * 44, 260 - i * 40, 550 + i, HI); }
    if (u > 0.95) for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, r = 150 + 40 * ((D + i) % 3); stroke(c, [[960 + Math.cos(a) * r, 300 - Math.abs(Math.sin(a)) * r * 0.6], [960 + Math.cos(a) * (r + 34), 300 - Math.abs(Math.sin(a)) * (r + 34) * 0.6]], { color: HI, w: 4, seed: 560 + i }); }
  },
  station(c, q, t0) {        // 十月底的大阪 · 車站的人海
    ground(c, 850);
    for (let i = 0; i < 4; i++) stroke(c, [[150 + i * 520, 110], [150 + i * 520, 840]], { w: 7, seed: 600 + i, color: WASH, taper: false });
    stroke(c, [[60, 112], [1860, 106]], { w: 9, seed: 606, color: WASH, taper: false });
    for (let i = 0; i < 11; i++) { const x = mod(120 + i * 173 + (hs(i, 3) - 0.5) * 60 + (q - t0) * (hs(i, 4) - 0.5) * 60, 1900), s = 0.72 + 0.2 * hs(i, 5); figure(c, x, 800 + 30 * hs(i, 6), s, { coat: WASH, scarf: WASH, hair: hs(i, 7) > 0.5 ? 'bob' : 'short', seed: 620 + i * 9, walk: true, step: q * 4 + i }); }
    figure(c, 330, 830, 0.95, { ...HER });
    figure(c, 1560, 812, 0.8, { ...HIM, lean: 0.03 * Math.sin(q * 1.4) });
    leaves(c, q, 10, { wind: 70, speed: 0.4 });
  },
  meet(c, q, t0) {           // 鋪墊了這場深秋的相遇 · 看清你模樣的那一秒
    ground(c, 850);
    const u = E.io2(sstep(t0, 84, q)), fade = 1 - sstep(t0 + 1, 82, q), hold = q > 84.5;
    if (fade > 0) { c.save(); c.globalAlpha = fade; for (let i = 0; i < 7; i++) figure(c, 200 + i * 250 + (q - t0) * (i % 2 ? 26 : -26), 810, 0.74, { coat: WASH, scarf: WASH, hair: i % 2 ? 'bob' : 'short', seed: 620 + i * 9, walk: true, step: q * 4 + i }); c.restore(); }
    figure(c, lerp(330, 720, u), 830, 0.95, { ...HER, walk: u < 1, step: q * 5 });
    figure(c, lerp(1560, 1180, u), lerp(812, 830, u), lerp(0.8, 0.95, u), { ...HIM, walk: u < 1, step: q * 5 + 1 });
    if (hold) {              // everything stops for one second; one leaf hangs between them
      leaf(c, 950, 430 + sstep(88, 97, q) * 180, 0.4 + 0.1 * Math.sin(q), 1.5, 1, 700);
      for (const [sx, x0] of [[1, 770], [-1, 1130]]) for (let i = 0; i < 3; i++) { const a = mod((q - 90.6) * 0.5 + i * 0.33, 1); if (q > 90.6) blob(c, circlePts(x0 + sx * (30 + a * 90), 520 - a * 70, 10 + a * 22, 8), null, { color: BLU, w: 3, seed: 710 + i + sx }); }   // 落實成了呼吸
    } else leaves(c, q, 7, { wind: 50, speed: 0.4 });
  },
  rainWalk(c, q, t0) {       // 那是一場十月的微雨
    ground(c, 880); tree(c, 240, 880, 1, 800); tree(c, 1700, 880, 0.9, 820, RED);
    const n = Math.round(lerp(4, 70, sstep(t0, t0 + 9, q)));
    rain(c, n); ripples(c, Math.round(n / 5), 890, 90);
    duo(c, 960, 850, 0.9, { walk: true, step: q * 4, gap: lerp(210, 170, sstep(t0, t0 + 12, q)) });
  },
  umbrellaOpen(c, q, t0) {   // 你撐開傘 我們肩並著肩
    ground(c, 880); tree(c, 240, 880, 1, 800); tree(c, 1700, 880, 0.9, 820, RED);
    const tp = t0 + 0.75, f = Math.round((q - tp) * 12);       // the pop: anticipation, one smear drawing, overshoot, settle
    const open = f < -2 ? 0 : f < 0 ? -0.06 : f === 0 ? 0.55 : f === 1 ? 1.16 : f === 2 ? 0.95 : 1;
    rain(c, 80, open >= 1 ? { above: 2000 } : {}); ripples(c, 16, 890, 90);
    const gap = lerp(170, 124, E.out3(sstep(tp, tp + 1.6, q)));
    duo(c, 960, 850, 0.9, { walk: q > tp + 2, step: q * 3.4, gap, open: Math.max(0.02, open) });
    if (f === 0) for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.08 + i * 0.105); stroke(c, [[990 + Math.cos(a) * 190, 560 + Math.sin(a) * 150], [990 + Math.cos(a) * 330, 560 + Math.sin(a) * 270]], { w: 7, seed: 830 + i, color: INK }); }
    if (f >= 1 && f <= 4) for (let i = 0; i < 8; i++) { const a = -Math.PI * (0.1 + i * 0.115), r = 200 + f * 40; blob(c, circlePts(990 + Math.cos(a) * r, 560 + Math.sin(a) * r * 0.8, 12 - f * 2, 7), BLU, { seed: 840 + i, ink: false }); }
  },
  profiles(c, q, t0) {       // 第一次看清彼此 真實的側臉
    rain(c, 60);
    blob(c, [[200, 200, 1], [560, 80], [960, 40], [1360, 80], [1720, 200, 1], [1500, 170], [1230, 210, 1], [960, 160], [690, 210, 1], [420, 170]], RED, { seed: 850, w: 7 });
    stroke(c, [[960, 160], [960, 1000]], { w: 9, seed: 852, taper: false });
    const k = E.out3(sstep(t0, t0 + 1.2, q));
    profile(c, lerp(520, 600, k), 600, 2.1, 1, { skin: HI, scarf: RED, long: true, seed: 860 });
    profile(c, lerp(1400, 1320, k), 580, 2.1, -1, { skin: '#eadcc0', scarf: YEL, seed: 870 });
  },
  shoulders(c, q, t0) {      // 最熟悉的陌生人 · 最靠近的遙遠
    rain(c, 46, { above: 330 });
    blob(c, [[120, 330, 1], [500, 150], [960, 96], [1420, 150], [1800, 330, 1], [1560, 290], [1260, 330, 1], [960, 280], [660, 330, 1], [360, 290]], RED, { seed: 850, w: 7 });
    duo(c, 960, 1250, 2.5, { gap: 150, step: 0 });
    dim(c, 908, 1012, 800, '', sstep(130.8, 132.4, q));
  },
  words(c, q, t0) {          // 一萬句心動 → 最含蓄的寒暄
    ground(c, 900); rain(c, 70, { above: 2000 }); ripples(c, 12, 910, 80);
    duo(c, 960, 870, 0.95, { gap: 124, open: 1, walk: true, step: q * 2.6 });
    const u = sstep(142.5, 150, q);
    for (let i = 0; i < 26; i++) {
      const born = t0 + i * 0.2, a = (q - born) / 5; if (a < 0) continue;
      const x = 960 + (hs(i, 1) - 0.5) * 1500, y = 470 - a * 90 * (0.5 + hs(i, 2)) - hs(i, 3) * 330, k = pop(q, born, 0.2) * (1 - sstep(142.5 + hs(i, 4) * 5, 144 + hs(i, 4) * 5, q));
      if (k > 0.05) { c.save(); c.translate(x, y); c.scale(k * (0.4 + 0.3 * hs(i, 5)), k * (0.4 + 0.3 * hs(i, 5))); bubble(c, 0, 0, 220, 110, hs(i, 6) > 0.5 ? 1 : -1, hs(i, 7) > 0.5 ? RED : YEL, 900 + i * 4); scribble(c, -70, 0, 140, 902 + i * 4, hs(i, 7) > 0.5 ? HI : INK); c.restore(); }
    }
    if (u > 0.5) { const k = pop(q, 146.6, 0.25); c.save(); c.translate(1010, 430); c.scale(k, k); bubble(c, 0, 0, 170, 90, -1, HI, 990); for (let i = 0; i < 3; i++) blob(c, circlePts(-36 + i * 36, 0, 7, 7), INK, { seed: 992 + i, ink: false }); c.restore(); }
  },
  shrine(c, q, t0) {         // 雨很快就停了 · 那一抹純白色的婚禮
    ground(c, 860); tree(c, 200, 860, 1.15, 1000, MOSS); tree(c, 1640, 860, 1.05, 1020, MOSS); tree(c, 640, 860, 0.7, 1040, YEL);
    bridge(c, 1250, 858, 1.0);
    const n = Math.round(lerp(40, 0, sstep(t0, t0 + 4.5, q))); if (n) rain(c, n, { alpha: 0.8 });
    if (q > 158.6) wedding(c, lerp(2050, 880, sstep(158.6, 166, q)), 850 - 4 * Math.abs(Math.sin(q * 3)), 1.15);
    leaves(c, q, 6, { speed: 0.5, wind: 20 });
  },
  onlookers(c, q) {          // 像兩個看客 · 正臨摹著你的輪廓
    ground(c, 760, 70, 60, 1860); tree(c, 1660, 760, 0.8, 1020, MOSS); bridge(c, 1330, 758, 0.62);
    wedding(c, 1000 - (q - 165.7) * 9, 752, 0.72);
    duo(c, 520, 990, 1.5, { gap: 150 });
    const u = sstep(173.2, 178.6, q);        // red pencil, tracing her outline
    drawOn(c, [[330, 990], [316, 800], [336, 688], [352, 610], [344, 548], [392, 516], [444, 548], [436, 612], [452, 690], [474, 800], [462, 990]], u, { color: PENCIL, w: 4, seed: 1060, amp: 3 });
    leaves(c, q, 5, { speed: 0.5 });
  },
  nightFlash(c, q, t0) {     // 那麼多個失眠的凌晨
    panel(c);
    blob(c, circlePts(1640, 210, 62, 12), YEL, { seed: 160, ink: false }); blob(c, circlePts(1672, 190, 56, 12), NIGHT, { seed: 161, ink: false });
    c.fillStyle = HI; c.textAlign = 'left'; c.font = `400 76px ${FONT}`; c.fillText('03:0' + Math.floor((q - t0) * 1.4), 170, 200);
    for (let i = 0; i < 4; i++) { const k = pop(q, t0 + 0.2 + i * 1.3, 0.22), her = i % 2 === 0; if (k > 0) { c.save(); c.translate(her ? 1300 : 640, 330 + i * 140); c.scale(k, k); bubble(c, 0, 0, 420, 100, her ? 1 : -1, her ? RED : YEL, 170 + i * 5); scribble(c, -160, 0, 300, 172 + i * 5, her ? HI : INK); c.restore(); } }
  },
  bench(c, q, t0) {          // 最該浪漫的午後 守著分寸
    blob(c, circlePts(1500, 250, 120, 14), YEL, { seed: 1100, ink: false, amp: 3 });
    ground(c, 880); tree(c, 260, 880, 1.1, 800);
    stroke(c, [[520, 760], [1400, 760]], { w: 10, seed: 1110, taper: false }); stroke(c, [[600, 760], [600, 880]], { w: 8, seed: 1111, taper: false }); stroke(c, [[1320, 760], [1320, 880]], { w: 8, seed: 1112, taper: false });
    duo(c, 960, 770, 1.0, { gap: 330 });
    dim(c, 960 - 104, 960 + 104, 640, '分寸', sstep(190.4, 191.6, q));
    leaves(c, q, 6, { speed: 0.4 });
  },
  circling(c, q, t0) {       // 那句想說的話 在嘴邊繞了幾圈
    duo(c, 960, 1250, 2.0, { gap: 190 });
    const P = []; for (let i = 0; i <= 90; i++) { const a = i / 90 * Math.PI * 6.4 - 1.2, r = 120 - i * 0.8; P.push([930 + Math.cos(a) * r * 1.5, 440 + Math.sin(a) * r * 0.62]); }
    drawOn(c, P, sstep(t0 + 0.3, 199.4, q), { color: PENCIL, w: 4.5, seed: 1130, amp: 2.4 });
  },
  kansai(c, q, t0) {         // 「秋天的關西，真的很美。」
    duo(c, 960, 1250, 2.0, { gap: 190 });
    const k = pop(q, t0 + 0.2, 0.3);
    if (k > 0) { c.save(); c.translate(760, 300); c.scale(k, k); bubble(c, 0, 0, 900, 190, -1, HI, 1150); c.restore(); }
    const L = LINES.find((l) => l.text.includes('關西')), txt = '秋天的關西，真的很美。', i0 = L.text.indexOf('秋');
    c.fillStyle = INK; c.textAlign = 'left'; c.font = `400 70px ${FONT}`;
    [...txt].forEach((ch, i) => { if (q >= L.ct[i0 + i] - 0.05) c.fillText(ch, 380 + i * 70 + (hs(D, i) - 0.5) * 2, 325 + (hs(D, i, 3) - 0.5) * 2); });
    leaves(c, q, 14, { speed: 0.7, wind: 30, red: 0.75 });
  },
  boundary(c, q, t0) {       // 沒有說破的邊界
    ground(c, 850);
    const u = E.io2(sstep(221, 232, q)), gap = lerp(1080, 240, u);
    for (let i = 0; i < 12; i++) if (q > t0 + 0.6 + i * 0.5) stroke(c, [[960, 250 + i * 50], [960, 250 + i * 50 + 26]], { color: PENCIL, w: 4, seed: 1200 + i });
    duo(c, 960, 830, 0.8, { gap: gap / 0.8, walk: u > 0 && u < 1, step: q * 3 });
    leaves(c, q, 5, { speed: 0.3 });
    if (q > 214) rain(c, Math.round(8 * (1 - sstep(219, 222, q))), { alpha: 0.6 });
  },
  rainReturn(c, q, t0) {     // 那是一場十月的微雨 (again, far away)
    ground(c, 900); tree(c, 300, 900, 1.25, 800); tree(c, 1560, 900, 1.3, 820, RED); tree(c, 1060, 900, 0.8, 1040, YEL);
    rain(c, Math.round(lerp(10, 80, sstep(t0, t0 + 8, q)))); ripples(c, 14, 905, 90);
    duo(c, lerp(700, 900, sstep(t0, 254.7, q)), 880, 0.62, { gap: 124, open: 1, walk: true, step: q * 2.6 });
  },
  threeCm(c, q) {            // 保持著那三釐米的含蓄
    rain(c, 50, { above: 150 });
    duo(c, 960, 1040, 3.2, { gap: 150, hands: true });
    dim(c, 948, 972, 760, '3 cm', sstep(262.4, 263.8, q));
  },
  reverse(c, q, t0) {        // 如果時間能倒流回那場微雨: the rain goes up
    ground(c, 900); tree(c, 300, 900, 1.25, 800); tree(c, 1560, 900, 1.3, 820, RED);
    rain(c, 80, { dir: -1 }); leaves(c, q, 8, { dir: -1, speed: 0.8 });
    duo(c, 960, 880, 1.0, { gap: 150, open: 1, hands: true, ghost: sstep(276.4, 280, q) * (1 - sstep(281.2, 282, q)) });
  },
  solo(c, q, t0) {           // 最體面也最遺憾的獨奏
    ground(c, 900); tree(c, 300, 900, 1.25, 800); tree(c, 1560, 900, 1.3, 820, RED);
    const u = sstep(t0, t0 + 13, q);
    rain(c, Math.round(lerp(60, 0, sstep(t0, t0 + 9, q)))); if (u < 0.7) ripples(c, 10, 905, 90);
    figure(c, lerp(885, 380, u), 880, lerp(1, 0.8, u), { ...HER, walk: true, step: q * 2.6 });
    figure(c, lerp(1035, 1560, u), 880, lerp(1, 0.8, u), { ...HIM, walk: true, step: q * 2.6 + 2 });
    umbrella(c, lerp(984, 960, u), lerp(550, 720, u), 190 * lerp(1, 0.75, u), lerp(1, 0.02, sstep(t0 + 5, t0 + 6, q)), { r: 0 });
    leaves(c, q, 6, { speed: 0.5 });
  },
  outro(c, q, t0) {          // 那些凌晨三點的陪伴…… 我都記得。
    const out = sstep(314, 320, q);
    panel(c);
    blob(c, circlePts(1640, 210, 62, 12), YEL, { seed: 160, ink: false }); blob(c, circlePts(1672, 190, 56, 12), NIGHT, { seed: 161, ink: false });
    c.fillStyle = HI; c.textAlign = 'left'; c.font = `400 76px ${FONT}`; c.fillText('03:00', 170, 200);
    const say = (L, x, y, w, side, fill, col, seed) => {
      const k = pop(q, L.t0 - 0.15, 0.3); if (k <= 0) return;
      c.save(); c.translate(x, y); c.scale(k, k); bubble(c, 0, 0, w, 150, side, fill, seed); c.restore();
      c.fillStyle = col; c.font = `400 62px ${FONT}`; c.textAlign = 'left';
      [...L.text].forEach((ch, i) => { if (q >= L.ct[i] - 0.05) c.fillText(ch, x - w / 2 + 56 + i * 64 + (hs(D, i) - 0.5) * 2, y + 22 + (hs(D, i, 3) - 0.5) * 2); });
    };
    say(LINES[LINES.length - 2], 1180, 420, 800, 1, RED, HI, 1300);
    say(LINES[LINES.length - 1], 600, 660, 440, -1, YEL, INK, 1310);
    if (q > 307.5) { c.globalAlpha = sstep(307.5, 310, q) * (1 - out); c.fillStyle = INK; c.textAlign = 'center'; c.font = `400 54px ${FONT}`; c.fillText('十月的微雨', 960, 985); c.globalAlpha = 1; }
    leaves(c, q, 4, { speed: 0.35 });
  },
};
const CUTS = [[0, 'intro'], [16.0, 'chat'], [28.7, 'photosF'], [42.8, 'photosM'], [56.0, 'souls'], [63.0, 'station'], [73.4, 'meet'], [97.0, 'rainWalk'], [110.2, 'umbrellaOpen'],
  [117.6, 'profiles'], [124.0, 'shoulders'], [137.2, 'words'], [152.6, 'shrine'], [165.7, 'onlookers'], [180.0, 'nightFlash'], [186.3, 'bench'], [192.6, 'circling'],
  [200.1, 'kansai'], [207.4, 'boundary'], [240.0, 'rainReturn'], [254.7, 'threeCm'], [268.4, 'reverse'], [282.1, 'solo'], [296.5, 'outro'], [DUR + 1, null]];
const NOLYRIC = new Set(['outro']), STRIP = new Set(['shoulders', 'threeCm', 'circling', 'kansai', 'onlookers', 'profiles']);

// ---------------------------------------------------------------- lyrics: brush-pen lettering along the foot of the sheet
const LINES = TM.lines.map((l) => ({ ...l }));
LINES.forEach((l, i) => { const nx = LINES[i + 1]; l.out = nx && nx.t0 - l.t1 < 1.4 ? Math.max(l.ct[l.ct.length - 1] + 0.3, nx.t0 - 0.1) : l.t1 + 0.9; });
function drawLyrics(c, q, scene) {
  if (NOLYRIC.has(scene)) return;
  for (const l of LINES) {
    if (q < l.t0 - 0.1 || q >= l.out) continue;
    const whisper = l.sec === 'bridge' && l.who !== 'D', size = whisper ? 48 : 54;
    c.font = `${whisper ? 300 : 400} ${size}px ${FONT}`; c.textAlign = 'left';
    if (!l.w) { l.w = [...l.text].map((ch) => (ch === '　' ? size * 0.6 : c.measureText(ch).width + 5)); l.tw = l.w.reduce((a, b) => a + b, 0); }
    let x = 960 - l.tw / 2; const y = 990;
    if (l.who !== 'M') blob(c, circlePts(x - (l.who === 'D' ? 66 : 40), y - 18, 9, 7), RED, { seed: 1400, ink: false, amp: 1 });
    if (l.who !== 'F') blob(c, circlePts(x - 40, y - 18, 9, 7), YEL, { seed: 1401, ink: false, amp: 1 });
    [...l.text].forEach((ch, k) => {
      const age = Math.round((q - l.ct[k] + 0.06) * 12);      // in drawings
      if (age >= 0 && ch !== '　') {
        const s = age === 0 ? 1.22 : age === 1 ? 0.96 : 1;
        c.save(); c.translate(x + l.w[k] / 2 + (hs(D, k, l.i) - 0.5) * 1.6, y + (hs(D, k, l.i, 2) - 0.5) * 1.6); c.scale(s, s);
        c.fillStyle = INK; c.textAlign = 'center'; c.fillText(ch, 0, 0); c.restore();
      }
      x += l.w[k];
    });
  }
}

// ---------------------------------------------------------------- paper
const IMG = {};
const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
IMG.paper = await load('/assets/textures/paper_base.jpg'); IMG.tooth = await load('/assets/textures/paper_tooth.png');
IMG.dust = []; for (let k = 1; k <= 4; k++) IMG.dust.push(await load(`/assets/textures/dust_ink_0${k}.png`));

function render(t) {
  const f = Math.round(t * FPS); D = Math.floor(f / 2); BS = (D % 4) * 7.13 + 1;
  const q = D * 2 / FPS;
  let i = 0; while (CUTS[i + 1][0] <= q) i++;
  const scene = Q.get('scene') || CUTS[i][1], t0 = CUTS[i][0], t1 = CUTS[i + 1][0];
  const c = ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.drawImage(IMG.paper, 0, 0, W, H);
  c.save(); S[scene](c, q, t0, t1); c.restore();
  // a cut is a new sheet slapped down: one drawing of bare pencil-red frame
  if (q - t0 < 1 / 12 - 1e-6 && i > 0) { c.globalAlpha = 0.5; c.drawImage(IMG.paper, 0, 0, W, H); c.globalAlpha = 1; }
  if (STRIP.has(scene)) {      // close-ups: the caption gets its own strip of paper, like a storyboard card
    c.drawImage(IMG.paper, 0, 922, W, H - 922, 0, 922, W, H - 922);
    stroke(c, [[70, 924], [640, 921], [1280, 926], [1850, 922]], { w: 4, seed: 1500, taper: false });
  }
  c.save(); drawLyrics(c, q, scene); c.restore();
  c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.5;
  c.drawImage(IMG.tooth, Math.floor(hs(D, 51) * 470), Math.floor(hs(D, 52) * 310), W, H, 0, 0, W, H);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.2;
  c.save(); c.translate(W / 2, H / 2); c.scale(D % 2 ? -1 : 1, D % 3 ? 1 : -1); c.drawImage(IMG.dust[D % 4], -W / 2, -H / 2, W, H); c.restore();
  const black = Math.max(1 - sstep(-0.3, 0.6, t), sstep(318.5, 323.5, t));
  c.globalAlpha = black; c.fillStyle = '#1b1613'; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
}

await Promise.all([document.fonts.load(`400 54px ${FONT}`, '十月的微雨'), document.fonts.load(`300 54px ${FONT}`, '十'), document.fonts.load('italic 500 40px "Cormorant Garamond"', 'a')]);
await document.fonts.ready;
window.renderAt = async (t) => render(t);
render(0);
window.__ready = true;
