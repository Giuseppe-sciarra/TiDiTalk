// Cube monkey — CC0-1.0, Kenney (www.kenney.nl)
// Modello: cube_monkey.glb (Kenney Cube Pets, CC0). 1.8.0: occhi e bocca stampati tolti e rifatti con parti che si muovono
// (stesso stile piatto del modello): le palpebre sbattono e si strizzano, le pupille guardano dove guardi, la bocca
// si apre con la tua (jawOpen), sorride, fa il bacio e tira fuori la lingua.
import { loadHead, eraseTris } from './_glbhead.js';
import { buildFace, updateFace } from './_face.js';
export const meta = {"label": "Scimmietta cubica", "labelEn": "Cube monkey", "category": "personaggi", "icon": "🐵"};
export const hideHead = true;
const P = {"c": [0.0, 0.805, -0.1894], "s": 19.542, "p": [0.0, 3.7, -1.5], "r": [0, 0, 0]};
const O = {"env": 0.3, "tint": 0.9, "rough": 0.7};
const F = {"uv": [0.344, 0.896], "z": 14.61, "eye": [5.29, 5.43, 3.75, 3.91], "pup": 2.35, "skin": 0xe6b48f, "line": 5913130, "my": -1.4, "mw": 2.0, "inner": 4857626, "mz": 14.65, "lineZ": 14.61, "lineBox": [2.2, -0.5, 1.6]};

export default async function build(THREE, h) {
  const { g, model } = await loadHead(THREE, h, new URL('./cube_monkey.glb', import.meta.url).href, P, O, 'cube_monkey');
  // via i disegni stampati sul piano della faccia (occhi e bocca)
  const body = model.getObjectByName('body');
  const E = F.eye, z = F.z;
  eraseTris(THREE, g, body, (x, y, zz) => Math.abs(zz - z) < 0.06 && (((Math.abs(x) - E[0]) / E[2]) ** 2 + ((y - E[1]) / E[3]) ** 2 < 1.15));
  if (F.lineZ) eraseTris(THREE, g, body, (x, y, zz) => Math.abs(zz - F.lineZ) < 0.04 && Math.abs(x) < F.lineBox[0] && y > F.lineBox[1] && y < F.lineBox[2]);
  const root = new THREE.Group(); root.name = 'face'; g.add(root);
  const skin = body.material;      // stesso materiale del modello: palpebre dello stesso colore e della stessa luce
  const P2 = buildFace(THREE, root, {
    eyes: { style: 'flat', x: E[0], y: E[1], z: z + 0.02, r: 1, sx: E[2] * 0.98, sy: E[3] * 0.98, sz: 0.05, white: 0xf0f0f6, lidUV: F.uv,
      pupil: 0x4b4e5d, pupilR: F.pup * 0.96, iris: null, liner: F.line, linerW: 0.3, lidMat: skin, open: -1.25, low: 1.2, rest: F.rest || [0.9, -0.3], hlR: 0.3, flat: true, angry: 0.25 },
    mouth: { y: F.my, z: (F.mz || z) + 0.04, w: F.mw, h: 3.0, d: 0.6, flat: true, inner: F.inner, tongue: 0xe8798e, line: F.line, lineTh: 0.3, lineBack: 0,
      curve: F.curve == null ? 0.45 : F.curve, smileK: 1.1, frownK: 1.2, kiss: 0xd86f80, lip: null },
  });
  g.userData.face = P2;
  return g;
}

export function update(g, bs, t) {
  const u = g.userData;
  if (u.mixer) { const dt = u.t0 == null ? 0 : Math.min(0.1, Math.max(0, t - u.t0)); u.t0 = t; u.mixer.update(dt); }
  if (u.face) updateFace(u.face, bs);
}
