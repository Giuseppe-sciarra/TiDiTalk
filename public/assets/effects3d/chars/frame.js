// frame — scena col viso vero (fxchars 1.8.0: kit comune in _kit.js, valori calibrati 0..1)
import { PI, c01, M, PM, gradMat, glossMat, skinMat, furMat, ell, cap, surf, crom, lathe, horn, strand, leafGeo, mixHex, HEAD_FIT, mkRoot, reg, eye, rigidBrow, spring, kitUpdate, ovalRim, faceRing, rimCurve, rimTube, regRingJaw, ringJawMesh, RING_JAW, sceneFinish, ringColors, rimTeeth, chestPlate, rimDome } from './_kit.js';


export const meta = { label: 'Quadro', labelEn: 'Picture frame', category: 'divertenti', icon: '🖼️' };
export const hideHead = false;

export default function build(THREE, h) {
  const g = new THREE.Group(); const P = reg(g);
  const root = mkRoot(THREE, g, hideHead ? HEAD_FIT : null);
  const gold = M(h, 0xd4a537, { roughness: .35, metalness: .8 });
  const goldD = M(h, 0x9c7420, { roughness: .4, metalness: .8 });
  // cornice: anello rettangolare estruso con smusso (modanatura)
  const W = 19.0, H = 24.0, T = 3.4, CY = -0.3;
  const outer = new THREE.Shape(); outer.moveTo(-W / 2 - T, -H / 2 - T); outer.lineTo(W / 2 + T, -H / 2 - T); outer.lineTo(W / 2 + T, H / 2 + T); outer.lineTo(-W / 2 - T, H / 2 + T); outer.closePath();
  const hole = new THREE.Path(); hole.moveTo(-W / 2, -H / 2); hole.lineTo(-W / 2, H / 2); hole.lineTo(W / 2, H / 2); hole.lineTo(W / 2, -H / 2); hole.closePath();
  outer.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(outer, { depth: 1.6, bevelEnabled: true, bevelThickness: 1.0, bevelSize: 1.0, bevelSegments: 4 });
  const frame = new THREE.Mesh(geo, gold); frame.position.set(0, CY, 2.6); root.add(frame);
  // modanatura interna scura + profilo esterno
  const innerRim = new THREE.Shape(); innerRim.moveTo(-W / 2 - .8, -H / 2 - .8); innerRim.lineTo(W / 2 + .8, -H / 2 - .8); innerRim.lineTo(W / 2 + .8, H / 2 + .8); innerRim.lineTo(-W / 2 - .8, H / 2 + .8); innerRim.closePath();
  const hole2 = new THREE.Path(); hole2.moveTo(-W / 2, -H / 2); hole2.lineTo(-W / 2, H / 2); hole2.lineTo(W / 2, H / 2); hole2.lineTo(W / 2, -H / 2); hole2.closePath(); innerRim.holes.push(hole2);
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(innerRim, { depth: 2.2, bevelEnabled: true, bevelThickness: .3, bevelSize: .3, bevelSegments: 2 }), goldD); rim.position.set(0, CY, 2.8); root.add(rim);
  // ornamenti agli angoli e al centro dei lati
  const orn = (x, y, s) => { const o = new THREE.Group(); o.position.set(x, y, 5.4); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.9 - i * .2, 14, 10), gold); b.position.set((i - 1) * 1.3 * s, Math.abs(i - 1) * -.5, 0); o.add(b); } const c = new THREE.Mesh(new THREE.TorusGeometry(1.5, .35, 8, 24), gold); c.position.z = -.3; o.add(c); root.add(o); return o; };
  for (const sx of [1, -1]) for (const sy of [1, -1]) orn(sx * (W / 2 + T / 2), CY + sy * (H / 2 + T / 2), 1);
  orn(0, CY + H / 2 + T / 2, 1); orn(0, CY - H / 2 - T / 2, 1);
  // tela dietro la testa (sfondo dipinto) + targhetta
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#2b3a67'); gr.addColorStop(1, '#0f172a'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, Math.random() * 1.6, 0, 7); x.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(W + T, H + T), h.mat(0xffffff, { map: tex, roughness: .9 })); canvas.position.set(0, CY, -9); root.add(canvas);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, .4), goldD); plate.position.set(0, CY - H / 2 - T / 2, 4.7); root.add(plate);
  // gancio e filo sopra
  const wire = new THREE.Mesh(new THREE.TorusGeometry(2.2, .12, 6, 24, PI), goldD); wire.position.set(0, CY + H / 2 + T + 1.0, 2.6); root.add(wire);
  P.fx.push((s, t) => {
    root.rotation.z = Math.sin(t * .9) * .012 + (s.browOutL - s.browOutR) * .06;
    root.rotation.y = Math.sin(t * .6) * .01;
    
  });
  sceneFinish(root);
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
