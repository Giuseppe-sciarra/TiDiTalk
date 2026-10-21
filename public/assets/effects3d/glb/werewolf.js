// Werewolf — Apache-2.0, Jeeliz (jeelizFaceFilter demos)
// Modello: werewolf.glb (Jeeliz FaceFilter, Apache-2.0). 1.8.0: la mandibola (mento, denti di sotto e barba) si apre
// con la tua bocca e il ringhio si allarga col sorriso; occhi gialli con palpebre di pelle scura che sbattono, si
// strizzano e guardano dove guardi; le arcate si aggrottano col broncio.
import { loadHead, toCanon } from './_glbhead.js';
import { buildFace, updateFace, mat } from './_face.js';
export const meta = {"label": "Lupo mannaro", "labelEn": "Werewolf", "category": "personaggi", "icon": "🐺"};
export const hideHead = true;
const P = {"c": [-0.02555, 0.14925, -0.3306], "s": 12.705, "p": [0.0, 2.7, -1.5], "r": [0, 0, 0]};
const O = {"env": 0.35, "cards": true, "alphaTest": 0.3, "matColor": {"head": [0.62, 0.5, 0.42], "fur": [0.8, 0.68, 0.55]}, "rough": 0.85};
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ss = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// morph per vertice: fn(x,y,z) → [dx,dy,dz] in cm (canonico), oppure null
function morph(THREE, g, mesh, fn) {
  const geo = mesh.geometry, pos = geo.attributes.position, n = pos.count;
  const M = toCanon(THREE, g, mesh), Mi = new THREE.Matrix3().setFromMatrix4(M).invert();
  const v = new THREE.Vector3(), d = new THREE.Vector3(), out = new Float32Array(n * 3);
  let any = false;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(M);
    const r = fn(v.x, v.y, v.z); if (!r) continue;
    d.set(r[0], r[1], r[2]).applyMatrix3(Mi); any = true;
    out[i * 3] = d.x; out[i * 3 + 1] = d.y; out[i * 3 + 2] = d.z;
  }
  if (!geo.morphAttributes.position) geo.morphAttributes.position = [];
  geo.morphAttributes.position.push(new THREE.Float32BufferAttribute(out, 3));
  geo.morphTargetsRelative = true;
  return geo.morphAttributes.position.length - 1;
}


export default async function build(THREE, h) {
  const { g, model } = await loadHead(THREE, h, new URL('./werewolf.glb', import.meta.url).href, P, O, 'werewolf');
  const u = g.userData; u.m = [];
  const ca = Math.cos(0.36), sa = Math.sin(0.36), hy = -1.7, hz = 2.0;
  model.traverse((o) => {
    if (!o.isMesh) return;
    // mandibola: sotto la linea dei denti (y < -2.1) davanti; ruota attorno alla cerniera (y -1.7, z 2) — barba compresa
    const iJaw = morph(THREE, g, o, (x, y, z) => {
      const f = ss(-1.6, -2.6, y) * ss(-4, 2, z) * (1 - ss(7, 10, Math.abs(x)));
      if (f <= 0) return null;
      const Y = y - hy, Z = z - hz;
      return [0, (hy + Y * ca - Z * sa - y) * f, (hz + Y * sa + Z * ca - z) * f];
    });
    // ringhio: gli angoli della bocca si tirano indietro e su col sorriso
    const iSm = morph(THREE, g, o, (x, y, z) => { const f = ss(4, 8, z) * ss(-4.5, -2.5, y) * (1 - ss(0.5, 2, y)) * ss(1, 3.5, Math.abs(x)) * (1 - ss(6, 8, Math.abs(x))); if (f <= 0) return null; return [Math.sign(x) * 0.4 * f, 0.6 * f, -0.4 * f]; });
    const iBrow = morph(THREE, g, o, (x, y, z) => { const f = ss(4, 7, z) * ss(4.5, 6, y) * (1 - ss(8, 10, y)) * ss(0.5, 2, Math.abs(x)) * (1 - ss(6, 8, Math.abs(x))); if (f <= 0) return null; return [0, -0.9 * f * (1 - (Math.abs(x) - 1) / 8), 0.2 * f]; });
    o.updateMorphTargets();
    u.m.push({ o, iJaw, iSm, iBrow });
  });
  // occhi: piccoli bulbi gialli nelle orbite del modello (prima erano solo incavi), palpebre di pelle scura
  const root = new THREE.Group(); g.add(root);
  u.face = buildFace(THREE, root, {
    eyes: { style: 'ball', x: 3.3, y: 4.6, z: 6.6, r: 0.9, sx: 1.3, sy: 0.8, sz: 0.75, ry: 0.4, iris: 0xb07812, irisR: 0.85, pupil: 0x0c0805, pupilR: 0.3,
      white: 0x6a5420, lidMat: mat(THREE, 0x3a3330, { roughness: 0.85 }), lidR: 1.22, open: -0.45, low: 1.3, liner: 0x0d0a09, linerW: 0.07, angry: 0.45, hlR: 0.45, rest: [0, 0] },
  });
  return g;
}

export function update(g, bs) {
  const u = g.userData;
  const s = updateFace(u.face, bs);
  const jaw = c01(Math.max(s.jaw, s.tongue * 0.4)) * (1 - s.pk * 0.4);
  for (const m of u.m) { const I = m.o.morphTargetInfluences; I[m.iJaw] = jaw; I[m.iSm] = s.smile; I[m.iBrow] = s.browDn; }
}
