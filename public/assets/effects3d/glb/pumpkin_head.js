// Pumpkin head — CC0-1.0, Kay Lousberg (www.kaylousberg.com)
// Modello: pumpkin_head.glb (KayKit Spooktober, CC0). 1.8.0: la bocca intagliata si spalanca con la tua (morph sul
// bordo del taglio), si allarga col sorriso e si stringe col bacio; dentro la luce si accende quando parli; gli occhi
// intagliati si chiudono quando sbatti/strizzi gli occhi e si aggrottano col broncio.
import { loadHead, toCanon } from './_glbhead.js';
export const meta = {"label": "Zucca intagliata", "labelEn": "Carved pumpkin", "category": "personaggi", "icon": "🎃"};
export const hideHead = true;
const P = {"c": [-1e-05, 1.31549, -0.01375], "s": 23.914, "p": [0.0, 4.2, -1.5], "r": [0, 0, 0]};
const O = {"env": 0.45, "matRough": {"Orange": 0.55, "BrownDark": 0.8}};
const PI = Math.PI;
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const B = (bs, k) => { const v = bs ? bs[k] : 0; return (typeof v === 'number' && v === v) ? c01(v) : 0; };
const sm = (s, k, v, a) => { const p = s[k]; return (s[k] = p === undefined ? v : p + (v - p) * a); };

// morph per vertice: fn(x,y,z) → [dx,dy,dz] in cm (canonico), oppure null
function morph(THREE, g, mesh, fn) {
  const geo = mesh.geometry, pos = geo.attributes.position, n = pos.count;
  const M = toCanon(THREE, g, mesh), Mi = new THREE.Matrix3().setFromMatrix4(M).invert();
  const v = new THREE.Vector3(), d = new THREE.Vector3(), out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(M);
    const r = fn(v.x, v.y, v.z); if (!r) continue;
    d.set(r[0], r[1], r[2]).applyMatrix3(Mi);
    out[i * 3] = d.x; out[i * 3 + 1] = d.y; out[i * 3 + 2] = d.z;
  }
  if (!geo.morphAttributes.position) geo.morphAttributes.position = [];
  geo.morphAttributes.position.push(new THREE.Float32BufferAttribute(out, 3));
  geo.morphTargetsRelative = true;
  return geo.morphAttributes.position.length - 1;
}

export default async function build(THREE, h) {
  const { g, model } = await loadHead(THREE, h, new URL('./pumpkin_head.glb', import.meta.url).href, P, O, 'pumpkin_head');
  const u = g.userData; u.m = [];
  const ss = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  // bocca intagliata: anello davanti a y≈-6.4 (x ±7.8, y -8.2..-4.1). Il bordo sotto scende, quello sopra sale un filo;
  // la buccia vicina segue in modo morbido. Occhi: anelli a (±7, -0.8) (y -3.8..5).
  model.traverse((o) => {
    if (!o.isMesh) return;
    const front = (z) => ss(3, 7, z);
    const mouthW = (x, y) => Math.max(0, 1 - Math.abs(x) / 9.5) * front;
    const iOpen = morph(THREE, g, o, (x, y, z) => { const f = ss(3, 7, z) * Math.max(0, 1 - (Math.abs(x) / 9.5) ** 2); if (f <= 0) return null; const lo = ss(-4.8, -7.2, y), up = ss(-6.4, -4.2, y) * (1 - ss(-3.0, -1.5, y)); return [0, -lo * 2.6 * f * (1 - Math.abs(x) / 12) + up * 0.6 * f, 0]; });
    const iWide = morph(THREE, g, o, (x, y, z) => { const f = ss(3, 7, z) * ss(-1.8, -4.6, y) * (1 - ss(-8.5, -10.5, y)); if (f <= 0) return null; return [x * 0.16 * f, Math.abs(x) / 8 * 1.1 * f * ss(1, 7, Math.abs(x)), 0]; });
    const iKiss = morph(THREE, g, o, (x, y, z) => { const f = ss(3, 7, z) * ss(-1.8, -4.6, y) * (1 - ss(-8.5, -10.5, y)); if (f <= 0) return null; return [-x * 0.42 * f, (-6.3 - y) * 0.25 * f, 0.6 * f]; });
    const eye = (sd) => morph(THREE, g, o, (x, y, z) => { if (Math.sign(x) !== sd) return null; const f = ss(4, 7.5, z) * Math.max(0, 1 - ((Math.abs(x) - 6.6) / 5.2) ** 2) * ss(-5.5, -3, y) * (1 - ss(6, 8, y)); if (f <= 0) return null; return [0, (0.6 - y) * 0.78 * f, 0]; });
    const iEyeR = eye(1), iEyeL = eye(-1);
    const brow = morph(THREE, g, o, (x, y, z) => { const f = ss(4, 7.5, z) * ss(1.5, 4.5, y) * (1 - ss(6.5, 9, y)) * ss(1, 3, Math.abs(x)) * (1 - ss(10, 12, Math.abs(x))); if (f <= 0) return null; return [0, -(1 - Math.abs(Math.abs(x) - 2) / 10) * 1.4 * f, 0]; });
    o.updateMorphTargets();
    u.m.push({ o, iOpen, iWide, iKiss, iEyeR, iEyeL, brow });
  });
  // luce dentro: sfera calda che si accende quando parli (dietro la bocca e gli occhi)
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.0, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), glowM); glow.scale.set(9.5, 7.5, 3); glow.position.set(0, -1.5, 4.2); g.add(glow);
  const light = new THREE.PointLight(0xffa040, 0, 30, 2); light.position.set(0, -2, 6); g.add(light);
  u.glow = glowM; u.light = light;
  return g;
}

export function update(g, bs, t) {
  const u = g.userData, s = u.s || (u.s = {}), k = 0.5;
  const jaw = sm(s, 'j', B(bs, 'jawOpen'), k), smile = sm(s, 's', (B(bs, 'mouthSmileLeft') + B(bs, 'mouthSmileRight')) / 2, k);
  const pk = sm(s, 'p', Math.max(B(bs, 'mouthPucker'), B(bs, 'mouthFunnel') * 0.85), k);
  const blL = sm(s, 'bl', c01(B(bs, 'eyeBlinkLeft') + B(bs, 'eyeSquintLeft') * 0.4), 0.7), blR = sm(s, 'br', c01(B(bs, 'eyeBlinkRight') + B(bs, 'eyeSquintRight') * 0.4), 0.7);
  const bd = sm(s, 'bd', (B(bs, 'browDownLeft') + B(bs, 'browDownRight')) / 2, k);
  for (const m of u.m) {
    const I = m.o.morphTargetInfluences;
    I[m.iOpen] = jaw * (1 - pk * 0.5); I[m.iWide] = smile * (1 - pk); I[m.iKiss] = pk;
    I[m.iEyeR] = blL; I[m.iEyeL] = blR; I[m.brow] = bd;
  }
  const flick = 0.85 + 0.15 * Math.sin(t * 13.0) * Math.sin(t * 7.3);
  u.glow.opacity = (0.25 + jaw * 0.6) * flick; u.light.intensity = (8 + jaw * 40) * flick;
}
