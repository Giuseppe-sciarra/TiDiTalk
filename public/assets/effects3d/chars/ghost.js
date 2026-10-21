// Fantasmino — lenzuolo con occhioni e bocca vera (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, PM, ell, surf, eye, leafGeo, spring } from './_kit.js';

export const meta = { label: 'Fantasmino', labelEn: 'Ghost', labelFr: 'Petit fantôme', labelDe: 'Gespenst', category: 'personaggi', icon: '👻' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const sheet = new THREE.MeshPhysicalMaterial({ color: 0xeef0fa, roughness: .5, sheen: .6, sheenColor: 0xc8d0ff, sheenRoughness: .5, emissive: 0x7080b0, emissiveIntensity: .1, side: THREE.DoubleSide });
  const dark = PM(THREE, 0x16161f, { roughness: .15, clearcoat: 1, clearcoatRoughness: .05 });
  const F = rig(THREE, h, g, {
    head: { r: [11.6, 13.8, 11.4], c: [0, .6, -2.7], boxy: 0, lift: 0, mat: sheet },
    mouth: { y: -4.6, w: 2.4, open: 5.0, curve: .25, smileK: 1.25, jawFade: 3.5, inside: 0x3a2448, lip: { color: 0x1c1c2a, r: .18 }, teeth: false, tongue: { color: 0xf08aa0 }, zRange: 3.5 },
    eyes: false,
    brows: { x: 3.7, y: 6.8, w: 2.3, th: .3, color: 0x2a2a3a, arch: .5, tilt: -.25 },
    cheeks: { x: 5.6, y: -2.2, r: 2.4, puff: 2.0, color: 0xf3a6c0, blush: 1.5, alpha: .55 },
  });
  // lenzuolo che scende con l'orlo ondulato (ondeggia)
  const C = [0, 0, -2.7];
  const Y0 = -5.6, drape = surf(THREE, 72, 16, (u, v) => { const a = u * 2 * PI, rx = 10.35 + v * 3.6, rz = 10.15 + v * 3.4, y = Y0 - v * 13.5, hem = Math.pow(v, 3) * 1.6 * Math.sin(a * 7); return [C[0] + rx * Math.sin(a), y + hem, C[2] + rz * Math.cos(a)]; });
  const body = new THREE.Mesh(drape, sheet); F.root.add(body);
  F.skin(body, 2, (a, r, t) => { for (let i = 0; i < a.length / 3; i++) { const v = Math.max(0, -(r[i * 3 + 1] - Y0) / 13.5); if (v < .35) continue; const x = r[i * 3], z = r[i * 3 + 2], an = Math.atan2(x, z - C[2]); a[i * 3 + 1] += Math.sin(an * 3 + t * 2.4) * .5 * v * v; } });
  // occhi ovali neri lucidi con riflesso, palpebra "di lenzuolo"
  for (const sd of [1, -1]) {
    const x = sd * 3.7, y = 2.8; const e = eye(THREE, h, F.P, { side: sd, r: 1.9, x, y, z: F.surf(x, y) - 1.0, ry: sd * .15, iris: null, sclera: 0x16161f, scleraEdge: 0x16161f, pupilR: 0, lidMat: sheet, open: 60, low: -60, liner: false, hlSize: .26, scale: [.85, 1.25, .7], look: [.25, .2] });
    F.root.add(e);
  }
  // braccine che salutano
  const armG = leafGeo(THREE, 1.8, 6.0, 1.6, { point: .6, base: .6, skew: .5 });
  for (const sd of [1, -1]) {
    const a = new THREE.Group(); a.position.set(sd * 11.6, -7.5, 1.0); a.add(new THREE.Mesh(armG, sheet)); a.rotation.z = sd * -.6; F.root.add(a);
    F.fx((s, t) => { a.rotation.z = sd * (-.6 - s.smile * .8 - s.browIn * .3) + Math.sin(t * 5 + sd) * .14 * (.3 + s.smile); });
  }
  F.fx((s, t) => {
    F.root.position.y = Math.sin(t * 1.1) * .5;
    sheet.emissiveIntensity = .1 + .06 * Math.sin(t * 2) + s.jaw * .12;
  });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
