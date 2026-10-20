// Lampadina dell'idea sopra la testa: bulbo di vetro caldo con filamento acceso, attacco a vite, raggi che pulsano;
// si accende di più quando si alzano le sopracciglia o si spalancano gli occhi.
export const meta = { label: 'Idea luminosa', labelEn: 'Bright idea', category: 'divertenti', icon: '💡' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const bulb = new THREE.Group();
  // vetro: profilo a pera (lathe)
  const prof = [[0.01, 6.6], [1.4, 6.45], [2.6, 5.9], [3.4, 4.9], [3.6, 3.7], [3.2, 2.5], [2.3, 1.5], [1.75, 0.8], [1.6, 0.2]];
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 48),
    new THREE.MeshPhysicalMaterial({ color: 0xfff4c8, emissive: 0xffd36b, emissiveIntensity: .45, roughness: .08, transparent: true, opacity: .55, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }));
  bulb.add(glass);
  // alone interno (sfera additiva)
  const glow = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = 3.9; bulb.add(glow);
  // filamento: zig-zag su due supporti
  const fil = [];
  for (let i = 0; i <= 12; i++) fil.push(new THREE.Vector3(-1.1 + i * 0.183, 4.0 + (i % 2 ? 0.35 : -0.35), 0));
  const filMat = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff9a00, emissiveIntensity: 2.2 });
  bulb.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fil, false, 'catmullrom', 0.1), 60, 0.07, 6), filMat));
  for (const s of [-1, 1]) bulb.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(s * 1.1, 4.0, 0), new THREE.Vector3(s * 0.5, 2.0, 0), new THREE.Vector3(s * 0.3, 0.6, 0)]), 12, 0.05, 5), h.mat(0x8a8f96, { metalness: .8, roughness: .3 })));
  // attacco a vite: anelli metallici + punta
  const metal = h.mat(0xb9bdc4, { roughness: .3, metalness: .95 });
  const screwProf = [[1.62, 0.25]];
  for (let i = 0; i < 5; i++) { screwProf.push([1.72, -0.15 - i * 0.55], [1.5, -0.42 - i * 0.55]); }
  screwProf.push([1.45, -2.9], [1.0, -3.2], [0.45, -3.55], [0.01, -3.6]);
  bulb.add(new THREE.Mesh(new THREE.LatheGeometry(screwProf.map(p => new THREE.Vector2(p[0], p[1])), 40), metal));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), h.mat(0x3a3d42, { roughness: .5 })); tip.position.y = -3.5; bulb.add(tip);
  // raggi attorno
  const rays = [];
  const rayMat = new THREE.MeshStandardMaterial({ color: 0xffe07a, emissive: 0xffc400, emissiveIntensity: 1.0, transparent: true, opacity: .9 });
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.05 + i / 8 * 0.9);
    const r = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.4, 4, 8), rayMat);
    const pivot = new THREE.Group(); pivot.position.y = 4.0; pivot.rotation.z = a - Math.PI / 2; r.position.y = 5.6; pivot.add(r);
    bulb.add(pivot); rays.push(r);
  }
  bulb.position.set(0, 17.6, -1.0); bulb.rotation.z = 0.12;
  g.add(bulb);
  g.userData = { bulb, glass, glow, filMat, rays, rayMat };
  update(g, {}, 0.5);
  return g;
}

export function update(g, bs, t) {
  const u = g.userData;
  const idea = Math.max(bs.browInnerUp || 0, ((bs.eyeWideLeft || 0) + (bs.eyeWideRight || 0)) / 2, bs.jawOpen || 0);
  const k = 0.6 + 0.25 * (0.5 + 0.5 * Math.sin(t * 3.2)) + 0.6 * idea;
  u.filMat.emissiveIntensity = 1.4 + 1.6 * k;
  u.glass.material.emissiveIntensity = 0.25 + 0.45 * k;
  u.glow.material.opacity = 0.18 + 0.3 * k;
  u.rayMat.opacity = Math.min(1, 0.35 + 0.7 * k);
  u.rays.forEach((r, i) => { r.position.y = 5.6 + 0.35 * Math.sin(t * 4 + i) + 0.6 * idea; });
  u.bulb.position.y = 17.6 + Math.sin(t * 1.5) * 0.4;
  u.bulb.rotation.z = 0.12 + Math.sin(t * 1.1) * 0.06;
}
