// Astronaut red panda — CC0-1.0, Quaternius (quaternius.com)
// Modello: space_rae_redpanda.glb (Quaternius Ultimate Space Kit, CC0). 1.8.0: il mento si apre con la tua bocca
// (morph sul muso, si vede la bocca scura con la lingua), la boccuccia stampata sorride e fa il bacio; palpebre
// del colore del pelo sopra gli occhi (sbattono, occhiolino, strizzano); le pupille guardano dove guardi.
import { loadHead, jawMorph, eraseTris } from './_glbhead.js';
import { buildFace, updateFace, mat } from './_face.js';
export const meta = {"label": "Panda rosso astronauta", "labelEn": "Astronaut red panda", "category": "personaggi", "icon": "🦊"};
export const hideHead = true;
const P = {"c": [0.0, 2.32652, -0.05756], "s": 24.288, "p": [0.0, 2.7, -1.5], "r": [0, 0, 0]};
const O = {"env": 0.5};
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export default async function build(THREE, h) {
  const { g, model } = await loadHead(THREE, h, new URL('./space_rae_redpanda.glb', import.meta.url).href, P, O, 'space_rae_redpanda');
  const u = g.userData; let body = null; model.traverse((o) => { if (o.isMesh) body = body || o; });
  // mento (sotto la bocca, muso chiaro) che si apre
  u.jaw = jawMorph(THREE, g, body, { hinge: [0, 0.2, 5.0], angle: 0.42, y0: 0.6, y1: -0.6, z0: 5.0, zs: 2.5, xMax: 3.8, xs: 1.5 });
  // via la boccuccia stampata (scura, y 1.1..2.7 al centro): la rifà il kit (sorride, bacio)
  eraseTris(THREE, g, body, (x, y, z) => Math.abs(x) < 2.9 && y > 1.0 && y < 2.75 && z > 11.8);
  const root = new THREE.Group(); g.add(root);
  u.face = buildFace(THREE, root, {
    eyes: { style: 'lids', x: 5.23, y: 5.38, z: 4.71, r: 3.33, sx: 1.0, sy: 1.0, sz: 1.0, ry: 0.55, lidMat: mat(THREE, 0xc96a35, { roughness: 0.85, flatShading: true }), lidR: 1.04, open: -1.0, low: 1.65, liner: 0x202125, linerW: 0.16, angry: 0.35 },
    mouth: { y: 1.45, z: 12.3, w: 1.6, h: 2.0, d: 0.9, rx: -0.3, inner: 0x3a1418, tongue: 0xe06a7c, line: 0x202125, lineTh: 0.2, curve: 0.25, smileK: 0.7, frownK: 0.8, lip: null },
  });
  return g;
}

export function update(g, bs) {
  const u = g.userData;
  const s = updateFace(u.face, bs);
  if (u.jaw) u.jaw.set(c01(Math.max(s.jaw, s.tongue * 0.4)) * (1 - s.pk * 0.5));
}
