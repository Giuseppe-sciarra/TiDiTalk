// Bowler hat — forma e proporzioni dal modello CC-BY di Elvaerwyn, MaciekG, Mindfront, culturalibre, punkduck
// (MakeHuman community asset repository, bowler_hat.glb: vedi CREDITS.md).
// 1.8.9: ridisegnata qui (procedurale) invece di caricare il modello: il file aveva poche facce e le normali piatte
// (sfaccettature ben visibili su cupola e tesa, effetto "solido da computer") e la cupola, larga 15,4 × 20,4 cm, non
// poteva scendere sulla testa senza restare sollevata ai lati; la tesa veniva tagliata dalla testa da un lato.
// Ora: superfici lisce (96 spicchi, normali calcolate sulla forma), feltro con trama, fascia di gros-grain col fiocco,
// tesa arrotolata ai lati e orlata; la fascia ha la sezione della testa vera (ovale, 3,4 cm sopra le sopracciglia
// davanti) e la tocca tutto intorno. Fodera scura, tappo invisibile sull'apertura e riempitivi: hatFit in _glbhead.js.
import { hatFit } from './_glbhead.js';
import { felt, cloth } from '../models/_kit_acc.js';
export const meta = {"label": "Bombetta", "labelEn": "Bowler hat", "category": "accessori", "icon": "🎩"};

// sezione della testa vera (calotta del cranio del motore + fronte) nel piano della fascia (32 raggi in cm, angolo da
// dietro, verso +x, davanti, -x), fuori di 1,2 mm
const BAND = [9.13, 9.02, 8.83, 8.59, 8.34, 8.11, 7.92, 7.79, 7.72, 7.73, 7.85, 8.14, 8.52, 8.84, 9.08, 9.14, 9.14, 9.08, 8.84, 8.52, 8.14, 7.85, 7.73, 7.72, 7.79, 7.92, 8.11, 8.34, 8.59, 8.83, 9.02, 9.13];
const FRAME = { p: [0, 6.5, -4.59], tilt: -12.79 };   // centro e inclinazione della fascia (davanti 8,5 cm, dietro 4,5 cm)
const H = 11.0, WALL = 0.25;                           // altezza della cupola, spessore del feltro

const TAU = Math.PI * 2;
function bandR(t) {                       // raggio della fascia all'angolo t (Catmull-Rom periodica sui 32 campioni)
  const n = BAND.length, f = ((t + Math.PI) / TAU) * n - 0.5, i = Math.floor(f), u = f - i;
  const g = (k) => BAND[((k % n) + n) % n], p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
  return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}
// superficie parametrica chiusa in u (giro): normali dalle derivate della forma (niente cucitura né sfaccettature)
function surf(THREE, nu, nv, fn, vLen = 1) {
  const pos = [], nrm = [], uv = [], idx = [];
  const P = (u, v) => fn(u, v), e = 1e-3;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv, p = P(u, v);
    const du = P(u + e, v).map((x, k) => x - P(u - e, v)[k]);
    const v0 = Math.max(0, v - e), v1 = Math.min(1, v + e), dv = P(u, v1).map((x, k) => x - P(u, v0)[k]);
    let n = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
    const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    pos.push(...p); nrm.push(...n); uv.push(u, v * vLen);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// profilo della cupola: fianchi quasi dritti, poi cupola tonda (superellisse)
function crownS(y) {
  const y0 = 3.2, taper = 1 - 0.006 * Math.min(y, y0);
  if (y <= y0) return taper;
  const q = Math.min(1, (y - y0) / (H - y0));
  return taper * Math.pow(Math.max(0, 1 - Math.pow(q, 2.4)), 1 / 2.4);
}

export default async function build(THREE, h) {
  const g = new THREE.Group(); g.name = 'bowler_hat';
  const hat = new THREE.Group();
  hat.position.set(...FRAME.p); hat.rotation.x = FRAME.tilt * Math.PI / 180;
  g.add(hat);
  const feltM = felt(THREE, 0x2b2a30, [12, 5], { side: THREE.DoubleSide });
  const ribbon = cloth(THREE, 0x15151a, [70, 2], { roughness: 0.5, sheen: 0.8, sheenRoughness: 0.35, sheenColor: new THREE.Color(0x4a4a58), bumpScale: 0.5 });
  const dir = (t) => [Math.sin(t), Math.cos(t)];
  // cupola (da poco sotto la fascia fino in cima)
  const crown = surf(THREE, 96, 40, (u, v) => {
    const t = -Math.PI + u * TAU, y = -0.3 + v * (H + 0.3), r = (bandR(t) + WALL) * crownS(Math.max(0, y)), [sx, cz] = dir(t);
    return [sx * r, y, cz * r];
  }, 3);
  hat.add(new THREE.Mesh(crown, feltM));
  // tesa: sotto (dall'attacco al bordo), bordo arrotolato, sopra (dal bordo all'attacco); arrotolata ai lati, giù davanti e dietro
  const W = (t) => 3.7 + 0.8 * Math.cos(t) ** 2, curl = (t) => Math.sin(t) ** 2;
  const brimY = (t, d) => { const w = d / W(t), c = curl(t); return 0.05 + c * 2.1 * Math.pow(w, 2.3) - (1 - c) * 1.0 * Math.pow(w, 1.7); };
  const TH = 0.26, RE = 0.3;
  const brim = surf(THREE, 96, 36, (u, v) => {
    const t = -Math.PI + u * TAU, [sx, cz] = dir(t), r0 = bandR(t) + WALL, w = W(t);
    let d, y;
    if (v < 0.4) { d = (v / 0.4) * w; y = brimY(t, d) - TH; }                          // sotto
    else if (v < 0.6) {                                                                   // orlo arrotolato (mezzo giro verso fuori)
      const a = -Math.PI / 2 + (v - 0.4) / 0.2 * Math.PI, yc = brimY(t, w) - TH / 2 + 0.04;
      d = w + Math.cos(a) * RE * 0.85; y = yc + Math.sin(a) * (TH / 2 + 0.1);
    } else { d = (1 - (v - 0.6) / 0.4) * w; y = brimY(t, d); }                           // sopra
    return [sx * (r0 + d), y, cz * (r0 + d)];
  }, 2);
  hat.add(new THREE.Mesh(brim, feltM));
  // orlo della tesa: nastro sottile sul bordo
  const edge = surf(THREE, 96, 10, (u, v) => {
    const t = -Math.PI + u * TAU, [sx, cz] = dir(t), r0 = bandR(t) + WALL, w = W(t), yc = brimY(t, w) - TH / 2 + 0.04;
    const a = -Math.PI * 0.75 + v * Math.PI * 1.5, d = w + Math.cos(a) * (RE * 0.85 + 0.05);
    return [sx * (r0 + d), yc + Math.sin(a) * (TH / 2 + 0.15), cz * (r0 + d)];
  }, 1);
  hat.add(new THREE.Mesh(edge, ribbon));
  // fascia di gros-grain (3 cm) con il bordo di sopra arrotondato
  const BH = 3.0, BT = 0.13;
  const band = surf(THREE, 96, 14, (u, v) => {
    const t = -Math.PI + u * TAU, [sx, cz] = dir(t);
    let y, out;
    if (v < 0.8) { y = 0.08 + (v / 0.8) * (BH - 0.1); out = BT; }
    else { const a = (v - 0.8) / 0.2 * Math.PI / 2; y = BH - 0.02 + Math.sin(a) * 0.04; out = BT * Math.cos(a); }
    const r = (bandR(t) + WALL) * crownS(y) + out;
    return [sx * r, y, cz * r];
  }, 1);
  hat.add(new THREE.Mesh(band, ribbon));
  // fiocco piatto sul lato sinistro di chi lo indossa (+x)
  const t0 = Math.PI / 2, r0 = (bandR(t0) + WALL) * crownS(1.4) + BT;
  const bow = new THREE.Group(); bow.position.set(r0 + 0.05, 1.45, 0.3); bow.rotation.y = Math.PI / 2 + 0.08;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), ribbon); knot.scale.set(0.9, 1.25, 0.45); bow.add(knot);
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.2, 10, 28), ribbon);
    loop.scale.set(1.15, 0.62, 0.42); loop.position.set(s * 1.0, 0.05, -0.05); loop.rotation.z = s * 0.12; bow.add(loop);
  }
  hat.add(bow);
  g.updateMatrixWorld(true);
  return hatFit(THREE, h, g, hat, { rimY: 0, top: H, band: 1.2 });
}
