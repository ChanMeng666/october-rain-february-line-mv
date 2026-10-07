// 二月的延長線 — a one-line film (style 02 · 线条动画) for a 5-minute song.
// Her line (rose) and his line (champagne) are drawn separately, meet on the Yuyuan Garden platform when the train doors
// open, and from there run side by side, a constant few pixels apart, through one continuous drawing of the day's walk.
// They never touch. At the ticket gates they part, and both go on as dashed lines: 延長線.
// Canvas2D; every frame is a pure function of t. World units = screen px at zoom 1; the drawing is a long handscroll.
const Q = new URLSearchParams(location.search);
const W = 1920, H = 1080, FPS = 30;
const TM = await (await fetch('./timing.json')).json();
const DUR = 314.5;
window.DEMO = { width: W, height: H, fps: FPS, duration: DUR };

const C = { bg0: '#0A111D', bg1: '#0E1929', her: '#EBA79A', him: '#E9D7A5', ivory: '#F4ECDD', warm: '#F7D9A2' };
const GAP = 9;            // the distance the two lines keep (world px)
const LW = 3;             // line weight, constant in screen px for the whole film

// ---------------------------------------------------------------- utils
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoother = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
function hash(n) { let h = (n * 374761393) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
// monotone cubic through (xs, ys): smooth velocity, no overshoot, flat where two keys share a value (holds)
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const h0 = xs[i] - xs[i - 1], h1 = xs[i + 1] - xs[i], w1 = 2 * h1 + h0, w2 = h1 + 2 * h0; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let k = 0; while (x > xs[k + 1]) k++;
    const h = xs[k + 1] - xs[k], s = (x - xs[k]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[k] + (s3 - 2 * s2 + s) * h * m[k] + (-2 * s3 + 3 * s2) * ys[k + 1] + (s3 - s2) * h * m[k + 1];
  };
}
const keyed = (keys) => monotone(keys.map((k) => k[0]), keys.map((k) => k[1]));

// ---------------------------------------------------------------- pen: builds one continuous polyline from relative moves
class Pen {
  constructor(x, y) { this.v = [[x, y]]; this.mk = {}; this.pts = {}; }
  get x() { return this.v[this.v.length - 1][0]; }
  get y() { return this.v[this.v.length - 1][1]; }
  mark(n) { this.mk[n] = this.v.length - 1; this.pts[n] = [this.x, this.y]; return this; }
  l(dx, dy) { this.v.push([this.x + dx, this.y + dy]); return this; }
  to(x, y) { this.v.push([x, y]); return this; }
  c(ax, ay, bx, by, ex, ey, n = 26) {   // cubic bezier, all relative to the current point
    const x0 = this.x, y0 = this.y;
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      this.v.push([x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * ex, y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * ey]);
    }
    return this;
  }
  S(dx, dy) { return this.c(dx / 2, 0, dx / 2, dy, dx, dy); }                 // level → level
  arc(cx, cy, deg) {   // rotate around a centre given relative to the current point; +deg = clockwise on screen
    const ox = this.x + cx, oy = this.y + cy, r = Math.hypot(cx, cy), a0 = Math.atan2(-cy, -cx);
    const n = Math.max(4, Math.ceil(Math.abs(deg) / 4));
    for (let k = 1; k <= n; k++) { const a = a0 + (deg * Math.PI / 180) * k / n; this.v.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]); }
    return this;
  }
  loopUp(r) { return this.arc(0, -r, -360); }      // a cursive loop above the line while heading right
  loopDn(r) { return this.arc(0, r, 360); }
  sine(len, amp, wl, decay = 0) {                  // level run with a wave that can die away
    const x0 = this.x, y0 = this.y, n = Math.ceil(len / 6);
    for (let k = 1; k <= n; k++) { const x = len * k / n, e = Math.sin(Math.PI * Math.min(1, x / (wl * 0.5)) / 2) * (decay ? Math.pow(1 - x / len, decay) : Math.min(1, (len - x) / (wl * 0.5))); this.v.push([x0 + x, y0 - amp * e * Math.sin(2 * Math.PI * x / wl)]); }
    return this;
  }
  build(step = 2, rad = 3) {
    const v = this.v, cum = [0];
    for (let i = 1; i < v.length; i++) cum.push(cum[i - 1] + Math.hypot(v[i][0] - v[i - 1][0], v[i][1] - v[i - 1][1]));
    const tot = cum[cum.length - 1], n = Math.round(tot / step) + 1;
    let X = new Float64Array(n), Y = new Float64Array(n), j = 1;
    for (let i = 0; i < n; i++) {
      const s = Math.min(tot, i * step);
      while (j < v.length - 1 && cum[j] < s) j++;
      const u = (s - cum[j - 1]) / Math.max(1e-9, cum[j] - cum[j - 1]);
      X[i] = lerp(v[j - 1][0], v[j][0], u); Y[i] = lerp(v[j - 1][1], v[j][1], u);
    }
    for (let pass = 0; pass < 2; pass++) {       // round every corner a little: hand-drawn, and it keeps the parallel offsets clean
      const X2 = new Float64Array(n), Y2 = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const r = Math.min(rad, i, n - 1 - i); let ax = 0, ay = 0;
        for (let k = -r; k <= r; k++) { ax += X[i + k]; ay += Y[i + k]; }
        X2[i] = ax / (2 * r + 1); Y2[i] = ay / (2 * r + 1);
      }
      X = X2; Y = Y2;
    }
    const S = new Float64Array(n), NX = new Float64Array(n), NY = new Float64Array(n);
    for (let i = 1; i < n; i++) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
      let tx = X[b] - X[a], ty = Y[b] - Y[a]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      NX[i] = ty; NY[i] = -tx;     // left of travel = up on screen when heading right
    }
    const M = {};
    for (const k in this.mk) M[k] = S[Math.min(n - 1, Math.round(cum[this.mk[k]] / step))];
    return { X, Y, S, NX, NY, n, M, P: this.pts, total: S[n - 1] };
  }
}
function idxAt(P, s) {
  if (s <= 0) return 0; if (s >= P.total) return P.n - 1;
  let lo = 0, hi = P.n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.S[m] <= s) lo = m; else hi = m; }
  return lo;
}
function posAt(P, s, off = 0) {
  s = clamp(s, 0, P.total);
  const i = idxAt(P, s), j = Math.min(P.n - 1, i + 1), u = P.S[j] > P.S[i] ? (s - P.S[i]) / (P.S[j] - P.S[i]) : 0;
  const o0 = typeof off === 'number' ? off : off[i], o1 = typeof off === 'number' ? off : off[j];
  return [lerp(P.X[i] + P.NX[i] * o0, P.X[j] + P.NX[j] * o1, u), lerp(P.Y[i] + P.NY[i] * o0, P.Y[j] + P.NY[j] * o1, u)];
}

// ================================================================ the drawing
const HY = 300 - GAP / 2, MY = 300 + GAP / 2 - 560, MEETX = 7500;

// ---- her line: Osaka's umbrella, three blank years, a concert alone, a borrowed courage, a message, the tunnel, the door
const pH = new Pen(-2100, HY);
pH.mark('h0').to(-1040, HY).mark('umb0');
pH.arc(0, -28, -90).l(0, -200);                                   // cane handle and shaft
pH.arc(0, 150, -90);                                              // canopy, left half
for (let k = 0; k < 4; k++) pH.c(18, -34, 57, -34, 75, 0);        // scalloped rim
pH.arc(-150, 0, -90);                                             // canopy, right half, back to the tip
pH.c(-30, 0, -30, -50, 0, -50).c(200, 0, 200, 278, 400, 278).mark('umb1');
pH.to(-380, HY).mark('cut');                                      // … and here she stopped answering
pH.to(1000, HY).mark('gap1');                                     // three years, dashed
pH.l(180, 0).l(10, -14).l(10, 14).l(14, 0).l(12, -70).l(14, 96).l(12, -26).l(330, 0).mark('flat1');   // 單向的停擺
{ // 電音狂歡: an equaliser, alone
  const hts = [60, 120, 90, 180, 130, 250, 160, 290, 210, 140, 230, 110, 170, 80, 120, 50];
  for (const h of hts) pH.l(0, -h).l(32, 0).l(0, h).l(24, 0);
  pH.l(60, 0).mark('eq1');
}
pH.S(240, -150).loopUp(46).S(180, -70).l(50, 0).S(280, 220).l(70, 0).mark('hill1');     // 借來的勇敢: up, a hesitation, on
pH.l(60, 0).mark('bub0');
pH.l(60, -70).l(-90, 0).l(0, -170).l(300, 0).l(0, 170).l(-150, 0).l(-30, 70).mark('bub1');   // 一句試探的問候
const BUB = [pH.pts.bub0[0] + 120, HY - 155];
pH.l(330, 0).mark('wait');
pH.to(7290, HY).mark('tun1');                                     // the tunnel
pH.l(0, -160).l(104, 0).l(0, 160).mark('door1');                  // 車門打開
pH.l(18, 0).c(18, -34, 40, -34, 52, 0).to(MEETX, HY).mark('meetH');   // 裙擺
const PH = pH.build();

// ---- his line: a suitcase not yet unpacked, a screen lighting up, a skipped beat, the stairs down to the platform
const pM = new Pen(4380, MY);
pM.mark('m0').l(200, 0).c(50, 0, 70, 10, 70, 40).mark('suit0');
pM.l(-70, 0).l(0, 150).l(50, 0).loopDn(16).l(140, 0).loopDn(16).l(50, 0).l(0, -150).l(-70, 0);   // body, carried by its handle
pM.c(0, -52, -100, -52, -100, 0).l(100, 0).c(14, -18, 30, -40, 80, -40).mark('suit1');
pM.l(300, 0).mark('ph0').l(0, -236).l(132, 0).l(0, 236).mark('ph1');                              // 螢幕亮起
const PHONE = [pM.pts.ph0[0] + 66, MY - 118];
pM.l(120, 0);
const blip = () => pM.l(10, -14).l(10, 14).l(14, 0).l(13, -118).l(15, 156).l(12, -38).l(26, 0);
pM.l(40, 0); blip(); pM.l(96, 0); blip(); pM.l(330, 0); blip(); pM.l(60, 0).mark('ecg1');       // 呼吸慢了一拍
pM.to(MEETX - 400 - 700, MY).mark('st0');
for (let k = 0; k < 14; k++) pM.l(50, 0).l(0, 40);                                                // 地下月台
pM.mark('st1').to(MEETX - 250, 300 + GAP / 2).mark('plat').to(MEETX, 300 + GAP / 2).mark('meetM');
const PM = pM.build();

// ---- together
const pT = new Pen(MEETX, 300);
pT.mark('meet').l(170, 0).mark('stairs0');
for (let k = 0; k < 12; k++) pT.l(0, -40).l(60, 0);
pT.mark('street').l(120, 0).S(180, -46).S(180, 46).l(90, 0).mark('yu0');
{ // 豫園: the pavilion in the lake, two tiers of upturned eaves
  const k = 1.25;
  pT.l(0, -110 * k).c(-10 * k, -10 * k, -50 * k, -20 * k, -75 * k, -48 * k).c(40 * k, 10 * k, 90 * k, -10 * k, 125 * k, -62 * k);
  pT.l(0, -34 * k).c(-8 * k, -8 * k, -34 * k, -14 * k, -52 * k, -36 * k).c(40 * k, 6 * k, 100 * k, -20 * k, 152 * k, -80 * k);
  pT.c(-16 * k, -44 * k, 16 * k, -44 * k, 0, 0);
  pT.c(52 * k, 60 * k, 112 * k, 86 * k, 152 * k, 80 * k).c(-18 * k, 22 * k, -44 * k, 28 * k, -52 * k, 36 * k).l(0, 34 * k);
  pT.c(35 * k, 52 * k, 85 * k, 72 * k, 125 * k, 62 * k).c(-25 * k, 28 * k, -65 * k, 38 * k, -75 * k, 48 * k).l(0, 110 * k);
  pT.mark('yu1').l(70, 0);
  for (let i = 0; i < 4; i++) pT.l(62, -40).l(62, 40);      // 九曲橋
  pT.l(80, 0).mark('zig1');
}
pT.mark('water0');
{ // 外灘: a dome, a clock tower, a pyramid roof
  pT.l(0, -150).l(84, 0).l(0, -24).arc(56, 0, 180).l(0, 24).l(84, 0).l(0, 150).l(34, 0);
  pT.l(0, -176).l(58, 0).l(0, -96).l(12, 0).l(0, -40).l(18, -56).l(18, 56).l(0, 40).l(12, 0).l(0, 96).l(58, 0).l(0, 176).l(34, 0);
  pT.l(0, -196).l(40, 0).l(0, -22).l(56, -132).l(56, 132).l(0, 22).l(40, 0).l(0, 196).l(40, 0);
  pT.l(0, -118).l(150, 0).l(0, 118).l(70, 0);
  pT.c(70, 0, 150, -30, 150, -90).c(0, -50, -70, -50, -70, -6).c(0, 40, 80, 96, 210, 96).mark('bund1');   // 晚風
}
function truss(W0, rise, n) {   // 外白渡橋: top chord, back along the deck, then the web — no stroke is retraced
  const top = (u) => -(34 + rise * 4 * u * (1 - u));
  const x0 = pT.x, y0 = pT.y;
  pT.l(0, top(0));
  for (let k = 1; k <= 24; k++) pT.to(x0 + W0 * k / 24, y0 + top(k / 24));
  pT.to(x0 + W0, y0).to(x0, y0);
  for (let k = 0; k < n; k++) pT.to(x0 + W0 * (k + 0.5) / n, y0 + top((k + 0.5) / n)).to(x0 + W0 * (k + 1) / n, y0);
}
pT.l(60, 0); truss(470, 104, 6); pT.l(46, 0); truss(470, 104, 6); pT.l(110, 0).mark('wb1');
pT.S(200, -140).loopUp(70).S(220, 96).loopDn(54).S(240, -76).loopUp(96).S(220, -90).mark('wander1');   // 漫無目的
{ // 無限地延遲
  const A = 250, B = 140;
  pT.c(80, 0, 120, 28, 172, 58);
  const cx = pT.x, cy = pT.y;
  for (let k = 1; k <= 120; k++) { const u = 2 * Math.PI * k / 120; pT.to(cx + A * Math.sin(u), cy + B * Math.sin(u) * Math.cos(u)); }
  pT.c(40, 23, 90, 152, 250, 152).mark('inf1');
}
{ // 不敢落音的爵士樂章: quavers that climb, and a last note that is held and never set down
  const note = (dx, dy) => {
    pT.arc(-21, 6, -360);                       // head
    pT.l(0, -128).c(34, 20, 52, 54, 30, 96);    // stem, flag
    pT.c(-6, 20, dx - 70, 32 + dy, dx - 30, 32 + dy);
  };
  pT.l(110, 0);
  note(190, -30); note(190, -50); note(200, 30); note(200, -70); note(210, -40);
  pT.arc(-21, 6, -360).l(0, -128).c(0, -40, 60, -70, 150, -70).mark('notes1');
  pT.sine(1050, 16, 150, 1.6).mark('hold1');
}
pT.S(380, 400).mark('river0').sine(520, 9, 170).mark('river1');
{ // 陸家嘴 across the water
  pT.l(80, -150).arc(29, -50, 120).l(15, -12).l(0, -118).arc(14, -30, 130).l(8, -30).l(6, -90).l(6, 90).l(8, 30).arc(-14, 30, 130).l(0, 118).l(15, 12).arc(-29, 50, 120).l(81, 150);
  pT.mark('pearl1').sine(300, 8, 150);
  const tiers = [110, 90, 75, 60, 50, 40];
  for (const h of tiers) pT.l(0, -h).l(8, 0);
  pT.l(0, -18).l(17, -72).l(17, 72).l(0, 18);
  for (const h of tiers.slice().reverse()) pT.l(8, 0).l(0, h);
  pT.l(74, 0);
  pT.l(22, -540).l(8, -62).l(22, 0).l(6, 56).l(30, 0).l(6, -56).l(22, 0).l(8, 62).l(16, 540).l(70, 0);
  pT.c(6, -240, 26, -470, 46, -704).l(44, 38).c(20, 224, 44, 440, 60, 666);
  pT.l(60, 0).sine(560, 9, 170).mark('lj1').mark('water1');
}
pT.S(300, -36).l(120, 0).mark('v2');
{ // 南翔小籠: the basket hangs from the line; three dumplings; steam
  pT.l(0, 74).l(330, 0).l(0, -74).l(-330, 0);
  for (let k = 0; k < 3; k++) pT.c(0, -70, 40, -88, 52, -96).c(-8, -16, 14, -16, 6, 0).c(12, 8, 52, 26, 52, 96);
  pT.c(-30, -60, 40, -110, 0, -170).c(-20, -40, 60, -40, 50, 10).c(-40, 70, 60, 90, 80, 160);
  pT.c(-20, -50, 30, -90, 0, -130).c(-14, -30, 44, -30, 36, 8).c(-30, 50, 44, 70, 60, 122).l(110, 0).mark('steam1');
}
{ // 舉起手機: the frame, and her in it
  pT.l(40, 0).l(30, -44).mark('cam0').l(0, -250).l(156, 0).l(0, 250).l(-156, 0).mark('cam1');
  pT.l(34, -12).c(0, -62, 26, -82, 44, -86).arc(0, -28, -360).c(18, 4, 44, 24, 44, 86).l(12, 56).l(170, 0).mark('cam2');
}
{ // 相冊的最深處: a frame inside a frame inside a frame
  const fr = (w, h) => pT.l(0, -h).l(w, 0).l(0, h).l(-w, 0);
  pT.mark('alb0'); fr(250, 190); pT.l(32, -30).mark('albA'); fr(186, 130); pT.l(30, -28).mark('albB'); fr(126, 74).mark('albC');
  pT.l(60, 58).c(60, 50, 200, 0, 300, 0).mark('alb1');
}
{ // 只屬於我的私密: lane houses
  const hs = [0, 26, 8, 40, 14];
  for (const h of hs) pT.l(0, -74 - h).l(46, -46).l(46, 46).l(0, 74 + h).l(18, 0);
  pT.l(110, 0).mark('lane1');
}
pT.l(60, 0).l(112, 112).l(110, 0).loopUp(16).l(250, 0).loopUp(16).l(110, 0).l(112, -112).l(70, 0).mark('metro1');   // 搭上地鐵
{ // 宜家的迷宮: in along the wall, out along the corridor
  const w = 400, h = 312, p = 26, x0 = pT.x, y0 = pT.y;
  const spiral = (ox, oy, w0, h0) => {
    let l = 0, t = 0, r = w0, b = h0; const v = [[0, 0]];
    for (;;) {
      if (r - l < 2 * p) break; v.push([r, t]); t += 2 * p;
      if (b - t < 0) break; v.push([r, b]); r -= 2 * p;
      if (r - l < 0) break; v.push([l, b]); b -= 2 * p;
      if (b - t < 0) break; v.push([l, t]); l += 2 * p;
    }
    return v.map((q) => [ox + q[0], oy + q[1]]);
  };
  const wall = spiral(x0, y0, w, h), cor = spiral(x0 + p, y0 + p, w - 2 * p, h - 2 * p);
  for (const q of wall.slice(1)) pT.to(q[0], q[1]);
  for (const q of cor.slice(0, wall.length - 1).reverse()) pT.to(q[0], q[1]);
  pT.to(x0 - p, y0 + p).to(x0 - p, y0 + h + p).to(x0 + w + p + 40, y0 + h + p).S(240, -(h + p)).mark('maze1');
}
{ // 暖色的燈光和沙發
  pT.l(150, 0).mark('lamp0').l(0, -270).l(-74, 0).l(32, -96).l(84, 0).l(32, 96).mark('lampBR').l(170, 270).mark('lamp1');
  pT.l(60, 0).l(0, -96).l(44, 0).l(0, -84).l(280, 0).l(0, 84).l(44, 0).l(0, 96).mark('sofa1');
  pT.l(150, 0).mark('home0').l(0, -176).l(156, -116).l(156, 116).l(0, 176).mark('home1');     // 虛擬的家
}
pT.l(420, 0).mark('gate0').l(640, 0).mark('tide0').l(1320, 0).mark('drift0').l(1500, 0).mark('solo0').l(2500, 0).mark('solo1');
pT.l(1000, 0).mark('circle0').arc(0, -250, -320).mark('circle1');           // 停在最痛的完滿
const PT = pT.build();
const CIRC = [PT.P.circle0[0], PT.P.circle0[1] - 250];

// ---- the two lines' offsets along the shared path
const OH = new Float64Array(PT.n), OM = new Float64Array(PT.n);
{
  const m = PT.M;
  for (let i = 0; i < PT.n; i++) {
    const s = PT.S[i]; let g = GAP, wh = 0, wm = 0;
    if (s > m.gate0 && s < m.circle0) {
      g = lerp(GAP, 150, smoother(m.gate0 + 60, m.gate0 + 560, s));
      if (s > m.tide0 && s < m.drift0) {            // 翻湧 … 退潮
        const u = (s - m.tide0) / (m.drift0 - m.tide0), a = 54 * smooth(0, 0.22, u) * (1 - smooth(0.4, 0.97, u));
        wh = wm = a * Math.sin(2 * Math.PI * (s - m.tide0) / 176);
      }
      if (s > m.drift0 && s < m.solo0) {            // 錯位的時空
        const u = (s - m.drift0) / (m.solo0 - m.drift0), a = 42 * smooth(0, 0.2, u) * (1 - smooth(0.8, 1, u)), ph = 2 * Math.PI * (s - m.drift0) / 300;
        wh = a * Math.sin(ph); wm = a * Math.sin(ph - Math.PI / 2);
      }
      if (s > m.solo0) {                            // the unsung line: apart, then slowly back to nine pixels
        const u = (s - m.solo0) / (m.solo1 - m.solo0);
        g = lerp(150, GAP, smoother(0.25, 1, u)) + 34 * Math.sin(2 * Math.PI * u * 2.5) * smooth(0, 0.15, u) * (1 - smooth(0.6, 0.95, u));
      }
    }
    OH[i] = g / 2 + wh; OM[i] = -g / 2 + wm;
  }
}

// ---- the extension lines (dashed): they leave the unclosed circle, pass under it, and go on
const pE = new Pen(PT.X[PT.n - 1], PT.Y[PT.n - 1]);
pE.c(54, 45, 150, 150, 330, 150).l(7000, 0);
const PE = pE.build();
const OEH = new Float64Array(PE.n), OEM = new Float64Array(PE.n);
for (let i = 0; i < PE.n; i++) { const g = lerp(GAP, 190, smoother(300, 3600, PE.S[i])); OEH[i] = g / 2; OEM[i] = -g / 2; }

// ================================================================ time → how much is drawn
const sched = (P, keys) => keyed(keys.map(([t, m, d = 0]) => [t, (typeof m === 'number' ? m : P.M[m]) + d]));
const sH = sched(PH, [[-3.2, 'h0'], [0, 'umb0', -40], [6.6, 'umb1'], [9.6, 'cut'], [12.1, 'cut'], [16.3, 'gap1'], [19.0, 'flat1'], [25.3, 'eq1'], [31.4, 'hill1'],
  [32.0, 'bub0'], [35.4, 'bub1'], [38.0, 'wait'], [58.2, 'wait'], [63.1, 'tun1'], [64.7, 'door1'], [67.6, 'meetH']]);
const sM = sched(PM, [[38.7, 'm0'], [39.5, 'suit0'], [45.3, 'suit1'], [46.0, 'ph0'], [48.6, 'ph1'], [51.9, 'ecg1'], [52.5, 'st0'], [57.2, 'st1'], [58.4, 'plat'],
  [65.0, 'plat'], [67.6, 'meetM']]);
const sT = sched(PT, [[67.6, 'meet'], [69.0, 'stairs0'], [76.8, 'street'], [81.3, 'yu0'], [84.5, 'yu1'], [85.7, 'zig1'], [88.3, 'bund1'], [95.1, 'wb1'], [99.4, 'wander1'],
  [102.7, 'inf1'], [108.2, 'notes1'], [113.5, 'hold1'], [116.5, 'river1'], [120.2, 'pearl1'], [127.6, 'lj1'], [129.9, 'v2'], [135.6, 'steam1'], [138.6, 'cam1'], [141.4, 'cam2'],
  [147.8, 'albC'], [149.4, 'alb1'], [155.8, 'lane1'], [160.4, 'metro1'], [168.5, 'maze1'], [171.4, 'lamp1'], [175.3, 'sofa1'], [181.6, 'home1'], [184.0, 'gate0'],
  [188.8, 'tide0'], [198.5, 'drift0'], [209.7, 'solo0'], [231.7, 'solo1'], [256.4, 'circle0'], [267.6, 'circle1'], [400, 'circle1']]);
const sE = keyed([[271.0, 0], [274, 260], [284.3, 1500], [300, 5200], [316, 7300]]);

// ================================================================ camera
const tipH = (t) => posAt(PH, sH(t)), tipM = (t) => posAt(PM, sM(t)), tipT = (t) => posAt(PT, sT(t));
const msgPos = (u) => { u = clamp(u); const a = BUB, b = PHONE, c = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 420]; return [(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1]]; };
const MSG0 = 36.3, MSG1 = 39.4;
const SRC = [
  [-1e9, tipH],
  [37.3, (t) => msgPos(smooth(MSG0, MSG1, t))],
  [39.9, tipM],
  [58.6, () => [MEETX - 190, 210]],
  [66.6, tipT],
  [259.0, () => [CIRC[0] + 40, CIRC[1] + 30]],
  [273.0, (t) => [CIRC[0] + 420 + 200 * smooth(273, 300, t), CIRC[1] + 70]],
];
const XF = 1.25;
function focus(t) {
  let i = 0; while (i + 1 < SRC.length && SRC[i + 1][0] - XF <= t) i++;
  const a = SRC[i][1](t);
  if (i > 0 && t < SRC[i][0] + XF) { const b = SRC[i - 1][1](t), w = smoother(SRC[i][0] - XF, SRC[i][0] + XF, t); return [lerp(b[0], a[0], w), lerp(b[1], a[1], w)]; }
  return a;
}
const zoomK = keyed([[0, 1.0], [10, 1.0], [14, 0.92], [20, 0.86], [26, 0.9], [34, 0.95], [40, 0.92], [50, 0.9], [54, 0.7], [59, 0.86], [66, 0.9], [70, 0.74], [77, 0.74],
  [82, 0.8], [89.5, 0.7], [95, 0.74], [100, 0.8], [104, 0.82], [112, 0.76], [118, 0.56], [127, 0.56], [131, 0.86], [141, 0.86], [146, 0.84], [156, 0.82], [163, 0.7],
  [169, 0.74], [181, 0.74], [186, 0.9], [199, 0.84], [211, 0.8], [229, 0.74], [256, 0.78], [262, 0.82], [272, 0.74], [300, 0.7], [315, 0.68]]);
const yOff = keyed([[0, -210], [9.5, -210], [13, 0], [116, 0], [120, -120], [127, -120], [130, 0], [320, 0]]);
function camBase(t) {
  let x = 0, y = 0, ws = 0;
  for (let k = 0; k <= 12; k++) {             // a Hann window over the focus: the camera leads a little and never jerks
    const u = k / 12, w = 0.5 - 0.5 * Math.cos(2 * Math.PI * (u * 0.92 + 0.04)), p = focus(t - 1.9 + 3.2 * u);
    x += p[0] * w; y += p[1] * w; ws += w;
  }
  return { x: x / ws, y: y / ws + yOff(t), z: zoomK(t) };
}
// the fly-through of the final chorus: cut to Osaka, then travel the whole scroll to where the lines are now
const FLY0 = 231.68, FLY1 = 256.3, FLYZ = 0.36;
const YPROF = (() => {   // mean height of the drawing per 400 px of scroll, smoothed
  const b = new Map();
  for (const P of [PH, PM, PT]) for (let i = 0; i < P.n; i += 8) { const k = Math.floor(P.X[i] / 400); const e = b.get(k) || [0, 0]; e[0] += P.Y[i]; e[1]++; b.set(k, e); }
  const ks = [...b.keys()].sort((a, c) => a - c), raw = ks.map((k) => b.get(k)[0] / b.get(k)[1]);
  const sm = raw.map((_, i) => { let a = 0, c = 0; for (let j = -7; j <= 7; j++) if (raw[i + j] != null) { const w = 8 - Math.abs(j); a += raw[i + j] * w; c += w; } return a / c; });
  return (x) => { const f = clamp((x / 400 - ks[0]), 0, ks.length - 1.001), i = Math.floor(f); return lerp(sm[i], sm[i + 1], f - i); };
})();
function camera(t) {
  if (Q.get('cam')) { const [x, y, z] = Q.get('cam').split(',').map(Number); return { x, y, z, fly: 0 }; }
  if (t < FLY0 || t >= FLY1) return { ...camBase(t), fly: 0 };
  const end = camBase(FLY1), u = (t - FLY0) / (FLY1 - FLY0);
  const e = lerp(u, smoother(0, 1, u), 0.72);                                   // mostly eased, never quite still
  const x = lerp(-1250, end.x, e), land = smoother(0.84, 1, u);
  return { x, y: lerp(YPROF(x) - 20, end.y, land), z: lerp(lerp(0.44, FLYZ, smooth(0, 0.1, u)), end.z, land), fly: 1 - land };
}

// ================================================================ drawing
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let CAM = { x: 0, y: 0, z: 1 };
const SX = (x) => (x - CAM.x) * CAM.z + W / 2, SY = (y) => (y - CAM.y) * CAM.z + H * 0.46;

function trace(P, s0, s1, off, mirror) {
  if (s1 <= s0) return false;
  const i0 = idxAt(P, s0), i1 = idxAt(P, s1), st = Math.max(1, Math.floor(0.9 / CAM.z)), Mg = 60;
  const isArr = typeof off !== 'number';
  let pen = false, any = false;
  const put = (x, y) => {
    if (mirror != null) { y = 2 * mirror - y; x += 3.2 * Math.sin(y * 0.055 + T * 1.7) + 1.6 * Math.sin(y * 0.13 - T * 2.3); }
    const sx = SX(x), sy = SY(y);
    if (sx < -Mg || sx > W + Mg || sy < -Mg || sy > H + Mg) { pen = false; return; }
    if (pen) ctx.lineTo(sx, sy); else { ctx.moveTo(sx, sy); pen = true; any = true; }
  };
  ctx.beginPath();
  for (let i = i0 === 0 ? 0 : i0 + 1; i <= i1; i += st) { const o = isArr ? off[i] : off; put(P.X[i] + P.NX[i] * o, P.Y[i] + P.NY[i] * o); }
  const e = posAt(P, s1, off); put(e[0], e[1]);
  return any;
}
// a line up to s1: the older part dims, the last stretch before the tip is full strength
function drawLine(P, s0, s1, off, color, o = {}) {
  const { dim = 0.36, fresh = 2600, fly = 0, dash = null, mirror = null, alpha = 1 } = o;
  ctx.strokeStyle = color; ctx.lineWidth = LW; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.setLineDash(dash || []);
  const base = lerp(dim, 0.9, fly) * alpha;
  ctx.globalAlpha = base;
  if (trace(P, s0, s1, off, mirror)) ctx.stroke();
  if (fly < 0.98 && !mirror) {
    const n = 7;
    for (let k = 0; k < n; k++) {
      const a = Math.max(s0, s1 - fresh * (1 - k / n));
      if (a >= s1) continue;
      ctx.globalAlpha = (1 - fly) * alpha * 0.2;
      if (trace(P, a, s1, off, null)) ctx.stroke();
    }
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
}
function fillRange(P, sa, sb, color, alpha) {
  if (alpha <= 0.003) return;
  const i0 = idxAt(P, sa), i1 = idxAt(P, sb);
  ctx.beginPath();
  for (let i = i0; i <= i1; i += 2) { const x = SX(P.X[i]), y = SY(P.Y[i]); if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
}
function glow(x, y, color, r, a) {
  if (a <= 0.003) return;
  const sx = SX(x), sy = SY(y);
  if (sx < -r || sx > W + r || sy < -r || sy > H + r) return;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function tip(p, color, a = 1) {
  if (a <= 0.003) return;
  glow(p[0], p[1], color, 46, 0.34 * a * (0.8 + 0.5 * PULSE)); glow(p[0], p[1], color, 16, 0.7 * a);
  ctx.globalAlpha = a; ctx.fillStyle = '#FFF8EA'; ctx.beginPath(); ctx.arc(SX(p[0]), SY(p[1]), 2.6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}

// ---- small captions on the scroll (constant screen size, like notes on a map)
const m = PT.M, pt = PT.P;
const LABELS = [
  { x: -940, y: HY + 64, zh: '大阪', en: 'OSAKA · 2016.10', t: 2.4 },
  { x: -380, y: HY + 64, zh: '', en: '2016', t: 9.4, tick: 1 }, { x: 80, y: HY + 64, zh: '', en: '2017', t: 13.3, tick: 1 }, { x: 540, y: HY + 64, zh: '', en: '2018', t: 14.6, tick: 1 }, { x: 1000, y: HY + 64, zh: '', en: '2019', t: 16.0, tick: 1 },
  { x: PH.P.eq1[0] + 380, y: HY + 64, zh: '上海', en: 'SHANGHAI · 2019.02', t: 26.4 },
  { x: MEETX - 190, y: 300 + 70, zh: '豫園站', en: 'YUYUAN GARDEN', t: 53.5 },
  { x: pt.yu0[0] + 190, y: pt.yu0[1] + 62, zh: '豫園', en: 'YU GARDEN', t: 82.6 },
  { x: pt.water0[0] + 400, y: pt.water0[1] - 300, zh: '外灘', en: 'THE BUND', t: 86.6, up: 1 },
  { x: pt.bund1[0] + 560, y: pt.bund1[1] - 190, zh: '外白渡橋', en: 'GARDEN BRIDGE', t: 90.2, up: 1 },
  { x: pt.river1[0] + 900, y: pt.river1[1] - 760, zh: '陸家嘴', en: 'LUJIAZUI', t: 121, up: 1 },
  { x: pt.v2[0] + 165, y: pt.v2[1] + 130, zh: '南翔小籠', en: 'NANXIANG', t: 131.6 },
  { x: pt.metro1[0] + 200, y: pt.metro1[1] + 400, zh: '宜家', en: 'A MAZE OF ROOMS', t: 163.6 },
  { x: pt.gate0[0] + 330, y: pt.gate0[1] + 150, zh: '閘機口', en: 'TICKET GATES', t: 185.2 },
];
function drawLabels(t, fly) {
  ctx.textAlign = 'center';
  for (const L of LABELS) {
    const a = smooth(L.t, L.t + 1.2, t) * (fly > 0.01 ? lerp(0.5, 0.78, fly) : 0.5);
    if (a <= 0.003) continue;
    const x = SX(L.x), y = SY(L.y);
    if (x < -200 || x > W + 200 || y < -60 || y > H + 60) continue;
    if (L.tick) { ctx.globalAlpha = a; ctx.strokeStyle = C.her; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, SY(HY) + 12); ctx.lineTo(x, SY(HY) + 26); ctx.stroke(); }
    ctx.globalAlpha = a; ctx.fillStyle = C.ivory;
    if (L.zh) { ctx.font = '300 21px "Noto Serif TC"'; ctx.letterSpacing = '7px'; ctx.fillText(L.zh, x + 3, y); }
    ctx.font = '500 15px "Cormorant Garamond"'; ctx.letterSpacing = '4.5px'; ctx.fillText(L.en, x + 2, y + (L.zh ? 25 : 0));
  }
  ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
}

// ---- lyrics: one line at the foot of the frame, each character arriving as it is sung
const LINES = TM.lines.map((l) => ({ ...l }));
LINES.forEach((l, i) => {
  const nx = LINES[i + 1];
  l.out = nx && nx.t0 - l.t1 < 1.3 ? Math.max(l.ct[l.ct.length - 1] + 0.35, nx.t0 - 0.12) : l.t1 + 0.9;
  l.whisper = (l.sec === 'bridge' && l.who !== 'D') || l.sec === 'outro';
});
function drawLyrics(t) {
  for (const l of LINES) {
    if (t < l.t0 - 0.2 || t > l.out + 0.7) continue;
    const size = l.unsung ? 38 : l.whisper ? 40 : 46, sp = l.unsung ? 16 : l.whisper ? 10 : 7;
    ctx.font = `${l.unsung ? 200 : 300} ${size}px "Noto Serif TC"`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (!l.w) { l.w = [...l.text].map((ch) => (ch === '　' ? size * 0.62 : ctx.measureText(ch).width + sp)); l.tw = l.w.reduce((a, b) => a + b, 0) - sp; }
    const out = smooth(l.out, l.out + 0.55, t), y0 = 978 - out * 22;
    let x = W / 2 - l.tw / 2;
    const col = l.who === 'F' ? C.her : l.who === 'M' ? C.him : C.ivory, la = (1 - out) * (l.unsung ? 0.5 : 1);
    // the twin-dash mark: who is singing
    const ma = la * smooth(l.t0 - 0.2, l.t0 + 0.3, t) * 0.9;
    ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    if (!l.unsung) {
      if (l.who !== 'M') { ctx.globalAlpha = ma; ctx.strokeStyle = C.her; ctx.beginPath(); ctx.moveTo(x - 62, y0 - 19); ctx.lineTo(x - 30, y0 - 19); ctx.stroke(); }
      if (l.who !== 'F') { ctx.globalAlpha = ma; ctx.strokeStyle = C.him; ctx.beginPath(); ctx.moveTo(x - 62, y0 - 11); ctx.lineTo(x - 30, y0 - 11); ctx.stroke(); }
    }
    const chars = [...l.text];
    for (let k = 0; k < chars.length; k++) {
      const a = l.unsung ? smooth(l.ct[k], l.ct[k] + 1.4, t) : smooth(l.ct[k] - 0.1, l.ct[k] + 0.24, t);
      if (a > 0.003 && chars[k] !== '　') {
        ctx.globalAlpha = a * la; ctx.fillStyle = col;
        ctx.fillText(chars[k], x, y0 + (1 - a) * 9);
      }
      x += l.w[k];
    }
  }
  ctx.globalAlpha = 1;
}
function drawTitle(t) {
  const a = Math.max(smooth(0.6, 2.6, t) * (1 - smooth(9.2, 11.4, t)), smooth(289.5, 293.5, t) * (1 - smooth(306.5, 311, t)));
  if (a <= 0.003) return;
  const end = t > 200, y = end ? 400 : 300, TX = end ? 1330 : W / 2;
  ctx.textAlign = 'center'; ctx.fillStyle = C.ivory;
  ctx.globalAlpha = a; ctx.font = '200 88px "Noto Serif TC"'; ctx.letterSpacing = '26px'; ctx.fillText('二月的延長線', TX + 13, y);
  ctx.globalAlpha = a * 0.72; ctx.font = 'italic 400 30px "Cormorant Garamond"'; ctx.letterSpacing = '5px';
  ctx.fillText(end ? 'two lines, extended — and never crossing' : 'February, on an extended line', TX, y + 62);
  // the twin dashes under the title
  const w = 150 * smooth(1.2, 3.6, end ? t - 288.5 : t);
  ctx.globalAlpha = a; ctx.lineWidth = 2; ctx.setLineDash([14, 10]);
  ctx.strokeStyle = C.her; ctx.beginPath(); ctx.moveTo(TX - w, y + 100); ctx.lineTo(TX + w, y + 100); ctx.stroke();
  ctx.strokeStyle = C.him; ctx.beginPath(); ctx.moveTo(TX - w, y + 108); ctx.lineTo(TX + w, y + 108); ctx.stroke();
  ctx.setLineDash([]);
  if (end) { ctx.globalAlpha = a * 0.6; ctx.font = '500 17px "Cormorant Garamond"'; ctx.letterSpacing = '6px'; ctx.fillText('SHANGHAI · FEBRUARY 2019', TX, y + 160); }
  ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
}

// ---- finishing: fine grain (kills banding in the dark gradient) and a vignette
const grain = document.createElement('canvas'); grain.width = grain.height = 512;
{
  const g = grain.getContext('2d'), im = g.createImageData(512, 512);
  for (let i = 0; i < 512 * 512; i++) { const v = 128 + (hash(i * 7 + 13) - 0.5) * 255 * 0.9; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
}
const beats = TM.beats;
let T = 0, PULSE = 0;

function render(t) {
  T = t;
  { let k = 0; while (k + 1 < beats.length && beats[k + 1] <= t) k++; PULSE = beats[k] <= t ? Math.exp(-5 * (t - beats[k])) : 0; }
  CAM = camera(t);
  const fly = CAM.fly || 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, C.bg0); bg.addColorStop(1, C.bg1);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const all = Q.get('all') === '1';
  const hS = all ? PH.total : sH(t), mS = all ? PM.total : sM(t), tS = all ? PT.total : sT(t), eS = all ? PE.total : sE(t);
  const hM = PH.M, mM = PM.M;

  // warm room light and fills (line → plane)
  if (t > 46 || all) fillRange(PM, mM.ph0, mM.ph1, C.him, all ? 0.3 : keyed([[46.5, 0], [46.85, 0.95], [48.2, 0.5], [51, 0.22], [60, 0.16]])(t));
  if (tS > m.cam1) fillRange(PT, m.cam0, m.cam1, C.ivory, all ? 0.15 : keyed([[139.5, 0], [139.62, 0.95], [140.4, 0.3], [142, 0.1], [150, 0.07]])(t));
  if (tS > m.albC) fillRange(PT, m.albB, m.albC, C.her, all ? 0.3 : 0.34 * smooth(147.8, 149.2, t));
  if (tS > m.lampBR - 40) {
    const a = all ? 1 : smooth(170.7, 171.5, t) * lerp(1, 0.55, smooth(182, 190, t));
    const L0 = pt.lamp0, cx = L0[0], ty = L0[1] - 270, by = L0[1];
    ctx.globalAlpha = a; const g = ctx.createLinearGradient(0, SY(ty), 0, SY(by));
    g.addColorStop(0, 'rgba(247,217,162,0.34)'); g.addColorStop(1, 'rgba(247,217,162,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(SX(cx - 74), SY(ty)); ctx.lineTo(SX(cx + 74), SY(ty)); ctx.lineTo(SX(cx + 244), SY(by)); ctx.lineTo(SX(cx - 244), SY(by)); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = C.warm; ctx.beginPath(); ctx.moveTo(SX(cx - 74), SY(ty)); ctx.lineTo(SX(cx - 42), SY(ty - 96)); ctx.lineTo(SX(cx + 42), SY(ty - 96)); ctx.lineTo(SX(cx + 74), SY(ty)); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; glow(cx, ty - 40, C.warm, 330 * CAM.z, 0.2 * a);
  }
  if (tS > m.home0) fillRange(PT, m.home0, m.home1, C.warm, all ? 0.2 : keyed([[178.4, 0], [180.4, 0.3], [182.6, 0.3], [187.5, 0]])(t));

  // reflections on the Huangpu
  if (tS > m.water0) {
    for (const [a0, a1, wy] of [[m.water0, m.inf1, pt.water0[1] + 30], [m.river0, m.water1, pt.river0[1] + 30]]) {
      if (tS <= a0) continue;
      drawLine(PT, a0, Math.min(tS, a1), OH, C.her, { mirror: wy, dim: 0.2, alpha: 0.62, dash: [22, 9], fly });
      drawLine(PT, a0, Math.min(tS, a1), OM, C.him, { mirror: wy, dim: 0.2, alpha: 0.62, dash: [22, 9], fly });
    }
  }

  // her line (with the three dashed years), his line, then both together
  drawLine(PH, 0, Math.min(hS, hM.cut), 0, C.her, { fly });
  if (hS > hM.cut) drawLine(PH, hM.cut, Math.min(hS, hM.gap1), 0, C.her, { dash: [3, 15], dim: 0.6, fly });
  if (hS > hM.gap1) drawLine(PH, hM.gap1, hS, 0, C.her, { fly });
  if (t >= 38.7 || all) drawLine(PM, 0, mS, 0, C.him, { fly });
  if (tS > 0) { drawLine(PT, 0, tS, OH, C.her, { fly }); drawLine(PT, 0, tS, OM, C.him, { fly }); }
  if (eS > 0) { drawLine(PE, 0, eS, OEH, C.her, { dash: [16, 13], dim: 0.9, fresh: 1 }); drawLine(PE, 0, eS, OEM, C.him, { dash: [16, 13], dim: 0.9, fresh: 1 }); }

  // typing dots in her bubble → one dot that crosses the city to his phone and waits there
  if (!all) {
    for (let k = 0; k < 3; k++) {
      const a = smooth(33.0 + k * 0.55, 33.25 + k * 0.55, t) * (1 - smooth(35.9, 36.3, t));
      if (a > 0) { const yy = BUB[1] - 5 * Math.sin((t * 5.2 - k * 0.9)); ctx.globalAlpha = a * 0.9; ctx.fillStyle = C.her; ctx.beginPath(); ctx.arc(SX(BUB[0] + (k - 1) * 46 * (1 - smooth(35.3, 36.2, t))), SY(yy), 5.5 * CAM.z, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (t > MSG0 - 0.1 && t < 47.2) {
      const u = smooth(MSG0, MSG1, t), ta = 1 - smooth(MSG1 + 1.5, MSG1 + 5, t);
      ctx.strokeStyle = C.her; ctx.lineWidth = 1.6; ctx.setLineDash([2, 12]); ctx.lineCap = 'round'; ctx.globalAlpha = 0.55 * ta;
      ctx.beginPath(); for (let k = 0; k <= 60; k++) { const p = msgPos(u * k / 60); if (k) ctx.lineTo(SX(p[0]), SY(p[1])); else ctx.moveTo(SX(p[0]), SY(p[1])); } ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      const p = msgPos(u), wait = 0.6 + 0.4 * Math.sin(t * 4.2), gone = 1 - smooth(46.5, 46.9, t);
      glow(p[0], p[1], C.her, 40, 0.5 * gone * (u < 1 ? 1 : wait)); ctx.globalAlpha = gone; ctx.fillStyle = C.her; ctx.beginPath(); ctx.arc(SX(p[0]), SY(p[1]), 5.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    // 風從隧道吹來
    for (let k = 0; k < 6; k++) {
      const t0 = 54.4 + k * 0.62, u = (t - t0) / 2.6;
      if (u <= 0 || u >= 1) continue;
      const x = MEETX - 1500 + 1500 * u + hash(k) * 300, y = 300 - 60 - hash(k + 9) * 260, len = 90 + 120 * hash(k + 3);
      ctx.globalAlpha = 0.34 * Math.sin(Math.PI * u); ctx.strokeStyle = C.ivory; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(SX(x), SY(y)); ctx.lineTo(SX(x + len), SY(y)); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // pen tips
    if (t < 67.9) tip(posAt(PH, hS), C.her, (t > 38.6 && t < 57.5 ? 0.45 : 1) * (hS > hM.cut && hS < hM.gap1 ? 0.6 : 1));
    if (t >= 38.7 && t < 67.9) tip(posAt(PM, mS), C.him);
    if (t >= 67.6 && eS <= 0) { const hold = t > 268 ? 0.6 + 0.4 * Math.sin(t * 2.6) : 1; tip(posAt(PT, tS, OH), C.her, hold * (1 - fly * 0.5)); tip(posAt(PT, tS, OM), C.him, hold * (1 - fly * 0.5)); }
    if (eS > 0) { tip(posAt(PE, eS, OEH), C.her, 0.9); tip(posAt(PE, eS, OEM), C.him, 0.9); }
    // 同一種體溫: a warmth that travels with the camera along everything they drew
    if (fly > 0) glow(CAM.x + 300, CAM.y, C.warm, 900, 0.07 * fly);
  }

  drawLabels(all ? 999 : t, fly);

  // foot of the frame: a soft shade so the lyric always reads, then the lyric
  const sh = ctx.createLinearGradient(0, H - 250, 0, H); sh.addColorStop(0, 'rgba(10,17,29,0)'); sh.addColorStop(1, 'rgba(10,17,29,0.86)');
  ctx.fillStyle = sh; ctx.fillRect(0, H - 250, W, 250);
  if (!all) { drawLyrics(t); drawTitle(t); }

  // grain + vignette + fades
  const gx = Math.floor(hash(Math.round(t * FPS) * 3 + 1) * 512), gy = Math.floor(hash(Math.round(t * FPS) * 3 + 2) * 512);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.085;
  for (let x = -gx; x < W; x += 512) for (let y = -gy; y < H; y += 512) ctx.drawImage(grain, x, y);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const vg = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.35, W / 2, H * 0.5, H * 1.05); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  const black = Math.max(1 - smooth(-0.4, 0.7, t), smooth(309.5, 313.2, t));
  if (black > 0) { ctx.globalAlpha = black * (t < 5 ? 0.85 : 1); ctx.fillStyle = '#070B12'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

await Promise.all([document.fonts.load('300 46px "Noto Serif TC"', '二月的延長線'), document.fonts.load('200 46px "Noto Serif TC"', '二'), document.fonts.load('500 16px "Cormorant Garamond"', 'A'), document.fonts.load('italic 400 30px "Cormorant Garamond"', 'A')]);
await document.fonts.ready;
window.renderAt = async (t) => render(t);
window.FILM = { PH, PM, PT, PE, sH, sM, sT };
render(0);
window.__ready = true;
