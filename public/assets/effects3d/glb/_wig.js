// Parrucche dai modelli gratuiti (glb/) — parte comune. I file che iniziano per "_" non vanno nel catalogo.
// Il .glb è già in centimetri nello spazio del viso canonico (calotta adattata al cranio, frangia sopra le
// sopracciglia: lo fa tools di fxglb), qui si costruiscono solo i materiali e l'ordine di disegno.
//
// Ciocche su piani con alpha, in DUE passate che condividono la geometria:
//   1) nucleo: alphaTest alto, scrive la profondità → niente errori di ordinamento fra gli strati;
//   2) bordi morbidi: tutto l'alpha, sfumato, senza scrivere la profondità e solo dove sta davanti al nucleo.
// Entrambe "transparent": nell'app l'occlusore del viso viene disegnato nella passata trasparente, quindi le
// ciocche dietro guance e mascella restano nascoste (vedi README). La faccia interna delle ciocche è più scura
// (ombra sotto gli strati), i colori per vertice del glb danno radici scure e ombra degli strati interni.
// Calotta (mesh "cap"): superficie sul cranio sotto le ciocche, con il bordo sfumato sulla fronte.

export async function buildWig(THREE, h, url, o) {
  o = o || {};
  const gltf = await new h.GLTFLoader().loadAsync(url);
  const g = new THREE.Group();
  g.name = o.name || 'wig';
  const wrap = new THREE.Group();
  if (o.offset) wrap.position.set(o.offset[0], o.offset[1], o.offset[2]);
  if (o.scale) wrap.scale.setScalar(o.scale);
  g.add(wrap);
  const tint = new THREE.Color(o.tint == null ? 0xffffff : o.tint);
  const spec = new THREE.Color(o.specColor == null ? 0xffffff : o.specColor);
  const sheen = new THREE.Color(o.sheenColor == null ? 0xffffff : o.sheenColor);
  const inner = (o.inner == null ? 0.42 : o.inner).toFixed(3);
  const darkBack = (m, key) => {
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n\tif (!gl_FrontFacing) diffuseColor.rgb *= ' + inner + ';');
    };
    m.customProgramCacheKey = () => key + inner;
  };
  const hairMat = (src, pass) => {
    const m = new THREE.MeshPhysicalMaterial({
      name: 'hair' + pass, color: tint, map: src.map || null, normalMap: src.normalMap || null,
      vertexColors: true, roughness: o.rough == null ? 0.6 : o.rough, metalness: 0,
      specularIntensity: o.spec == null ? 0.35 : o.spec, specularColor: spec,
      sheen: o.sheen == null ? 0.25 : o.sheen, sheenColor: sheen, sheenRoughness: 0.55,
      envMapIntensity: o.env == null ? 0.2 : o.env,
      side: THREE.DoubleSide, transparent: true, forceSinglePass: true,
    });
    if (src.normalMap) m.normalScale = src.normalScale ? src.normalScale.clone() : new THREE.Vector2(0.6, 0.6);
    if (pass === 1) { m.alphaTest = o.coreAlpha || 0.55; m.depthWrite = true; m.opacity = 1; }
    else { m.alphaTest = 0.04; m.depthWrite = false; m.opacity = o.edgeOpacity == null ? 1 : o.edgeOpacity; }
    if (m.map) { m.map.anisotropy = 4; m.map.colorSpace = THREE.SRGBColorSpace; }
    darkBack(m, 'tdWig' + pass);
    return m;
  };
  const meshes = [];
  gltf.scene.traverse((x) => { if (x.isMesh) meshes.push(x); });
  for (const x of meshes) {
    x.updateMatrixWorld(true);
    const src = Array.isArray(x.material) ? x.material[0] : x.material;
    if ((src.name || '').startsWith('cap')) {
      const m = new THREE.MeshStandardMaterial({ name: 'cap', color: tint, map: src.map || null, vertexColors: true,
        roughness: 0.8, metalness: 0, envMapIntensity: o.env == null ? 0.2 : o.env, transparent: true, depthWrite: true });
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      const cap = new THREE.Mesh(x.geometry, m);
      cap.name = 'cap'; cap.renderOrder = 1; cap.frustumCulled = false;
      wrap.add(cap);
    } else {
      const a = new THREE.Mesh(x.geometry, hairMat(src, 1));
      const b = new THREE.Mesh(x.geometry, hairMat(src, 2));
      const nm = x.name || 'hair', front = nm === 'fringe' || nm === 'locks';
      a.name = nm + 'Core'; b.name = nm + 'Edge';
      // la frangia sta sopra le altre ciocche: si disegna dopo (le due passate)
      a.renderOrder = front ? 4 : 2; b.renderOrder = front ? 5 : 3; a.frustumCulled = b.frustumCulled = false;
      wrap.add(a, b);
    }
  }
  return g;
}
