// Wolf — CC0-1.0, Quaternius (quaternius.com)
// Modello: animal_wolf.glb (Quaternius Ultimate Animated Animals, CC0). 1.8.0: la mandibola (parte sotto il muso) si apre
// con la tua bocca (morph sul modello, stile low poly), dentro c'è la bocca scura con lingua e zanne; palpebre del
// colore del pelo sopra gli occhi neri (sbattono, occhiolino, strizzano, broncio); le orecchie si muovono con le sopracciglia.
import { loadHead, jawMorph, toCanon } from './_glbhead.js';
import { buildFace, updateFace, mat } from './_face.js';
export const meta = {"label": "Lupo", "labelEn": "Wolf", "category": "personaggi", "icon": "🐺"};
export const hideHead = true;
const P = {"c": [-0.0, 2.09935, 1.995], "s": 33.781, "p": [0.0, 3.2, -1.0], "r": [0, 0, 0]};
const O = {"env": 0.35, "rough": 0.8, "tint": 0.82};
const PI = Math.PI;
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const B = (bs, k) => { const v = bs ? bs[k] : 0; return (typeof v === 'number' && v === v) ? c01(v) : 0; };
const sm = (s, k, v, a) => { const p = s[k]; return (s[k] = p === undefined ? v : p + (v - p) * a); };

export default async function build(THREE, h) {
  const { g, model } = await loadHead(THREE, h, new URL('./animal_wolf.glb', import.meta.url).href, P, O, 'animal_wolf');
  const u = g.userData; u.jaws = [];
  // mandibola: tutto ciò che sta sotto la linea della bocca (y < -5.5) davanti (z > 3) ruota attorno alla cerniera
  model.traverse((o) => { if (o.isMesh) { const j = jawMorph(THREE, g, o, { hinge: [0, -4.4, 2.5], angle: 0.36, y0: -4.0, y1: -5.2, z0: 1.5, zs: 3 }); if (j) u.jaws.push(j); } });
  let lightM = null, anyM = null;
  model.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) { anyM = anyM || m; if (m.name === 'Main_Light') lightM = m; } });
  lightM = lightM || anyM;
  const root = new THREE.Group(); g.add(root);
  u.face = buildFace(THREE, root, {
    eyes: { style: 'lids', x: 7.65, y: 7.7, z: 1.9, r: 1.3, sx: 1.35, sy: 0.95, sz: 0.55, ry: 0.98, rx: 0.05, tilt: -0.35, lidMat: lightM, lidR: 1.12, open: -0.35, low: 1.5, liner: 0x1a1a1a, linerW: 0.12, angry: 0.35 },
  });
  // bocca davanti al muso (fra muso e mento quando si apre): cavità scura, lingua, zanne
  const inner = mat(THREE, 0x2a1214, { roughness: 0.85, flatShading: true });
  const cav = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), inner); cav.position.set(0, -5.0, 12.4); cav.rotation.x = -0.55; root.add(cav);
  const tg = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat(THREE, 0xc85a68, { roughness: 0.5, flatShading: true })); tg.scale.set(1.3, 0.4, 1.6); tg.rotation.x = -0.55; root.add(tg);
  const fangM = mat(THREE, 0xeee6d4, { roughness: 0.4, flatShading: true });
  u.fangs = [];
  for (const sd of [1, -1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.3, 5), fangM); f.rotation.z = Math.PI; f.position.set(sd * 1.6, -4.9, 12.9); root.add(f); u.fangs.push(f); }
  u.cav = cav; u.tg = tg;
  // orecchie: si alzano/abbassano un poco con le sopracciglia (morph sulle punte)
  u.ears = [];
  model.traverse((o) => { if (o.isMesh) { const e = jawMorph(THREE, g, o, { hinge: [0, 13.5, -1], angle: 0.12, y0: 14.5, y1: 17.5, z0: -6, zs: 2 }); if (e) u.ears.push(e); } });
  return g;
}

export function update(g, bs, t) {
  const u = g.userData;
  const s = updateFace(u.face, bs);
  const jaw = c01(Math.max(s.jaw, s.tongue * 0.4));
  for (const j of u.jaws) j.set(jaw * (1 - s.pk * 0.4));
  u.cav.visible = u.tg.visible = jaw > 0.04;
  u.cav.scale.set(2.3 * (1 + s.smile * 0.15), 0.2 + jaw * 2.1, 0.9);
  u.cav.position.y = -5.0 - jaw * 1.6;
  u.tg.position.set(0, -5.4 - jaw * 2.6, 12.6 + s.tongue * 2.2);
  for (const f of u.fangs) f.visible = jaw > 0.12;
  for (const e of u.ears) e.set(c01(s.browUp * 1.2 - s.browDn * 0.6 + Math.sin(t * 1.3) * 0.08));
}
