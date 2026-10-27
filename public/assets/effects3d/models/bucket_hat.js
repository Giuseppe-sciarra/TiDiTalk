// Cappello alla pescatora (bucket hat): cupola morbida in tela, tesa corta inclinata in giù con cuciture concentriche e occhielli.
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
export const meta = { label: 'Cappello alla pescatora', labelEn: 'Bucket hat', category: 'accessori', icon: '👒' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  // tela: texture procedurale a trama fine
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#c9b48a'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 2) { x.fillStyle = i % 4 ? 'rgba(90,70,40,.10)' : 'rgba(255,245,220,.10)'; x.fillRect(0, i, 128, 1); x.fillRect(i, 0, 1, 128); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 3);
  const canvasMat = new THREE.MeshStandardMaterial({ map: tex, roughness: .95, color: 0xc6b08a });
  const seamMat = h.mat(0x8c7550, { roughness: .9 });
  const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // cupola: leggermente conica, cima piatta morbida
  g.add(new THREE.Mesh(lathe([[8.7, -0.4], [8.8, 2.5], [8.4, 5.5], [7.8, 7.0], [6.0, 7.7], [3.0, 7.95], [0, 8.0]]), canvasMat));
  // tesa: scende verso l'esterno (inclinata ~25°), spessore con bordo arrotondato
  const brim = lathe([[8.6, 0.3], [10.5, -0.5], [12.4, -1.5], [13.0, -1.85], [13.15, -1.55], [12.5, -1.15], [10.5, -0.05], [8.6, 0.75], [8.6, 0.3]], 96);
  g.add(new THREE.Mesh(brim, canvasMat));
  // cuciture concentriche sulla tesa e alla base della cupola
  for (const [r, y] of [[9.6, 0.42], [10.6, -0.02], [11.6, -0.55], [12.5, -1.05]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 5, 96), seamMat); t.rotation.x = Math.PI / 2; t.position.y = y + 0.07; g.add(t);
  }
  const base = new THREE.Mesh(new THREE.TorusGeometry(8.85, 0.12, 6, 96), h.mat(0x6f5a3c, { roughness: .8 })); base.rotation.x = Math.PI / 2; base.position.y = 0.6; g.add(base);
  // occhielli d'aerazione ai lati
  for (const s of [-1, 1]) for (const dz of [-1.2, 1.2]) {
    const e = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 14), h.mat(0xb8bcc2, { roughness: .3, metalness: .9 }));
    e.position.set(s * 8.55, 4.8, dz - 0.5); e.rotation.y = Math.PI / 2; g.add(e);
  }
  g.position.set(0, 8.9, -2.4);
  g.rotation.x = -0.12;
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.2, 5, 8.2); occ.position.set(0, -2.0, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(headOccluder(THREE, h, { scale: [8.1, 10.0, 9.3], center: [0, 2.6, -4.3] }));
  root.add(faceOccluder(THREE, h, 0.2));
  return afterFace(finish(THREE, root));
}
