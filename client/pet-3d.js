import {
  AmbientLight, CatmullRomCurve3, Color, ConeGeometry, DirectionalLight,
  Group, Mesh, MeshStandardMaterial, OrthographicCamera, Scene,
  SphereGeometry, TorusGeometry, TubeGeometry, Vector3, WebGLRenderer
} from 'three';

export function mountPet(container) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(112, 112, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = 'srgb';
  renderer.domElement.className = 'pet-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.prepend(renderer.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 20);
  camera.position.set(0, 0.2, 7);
  camera.lookAt(0, 0.2, 0);
  scene.add(new AmbientLight(0xffffff, 2.2));
  const light = new DirectionalLight(0xffffff, 3.4);
  light.position.set(-3, 5, 5);
  scene.add(light);
  const fill = new DirectionalLight(0xd6dbe0, 1.3);
  fill.position.set(4, 1, -2);
  scene.add(fill);

  const fur = new MeshStandardMaterial({ color: new Color('#ddd8cf'), roughness: 0.78 });
  const inner = new MeshStandardMaterial({ color: new Color('#b7a5a1'), roughness: 0.9 });
  const dark = new MeshStandardMaterial({ color: new Color('#282524'), roughness: 0.65 });
  const cat = new Group();
  scene.add(cat);
  const sphere = (parent, material, size, pos) => {
    const mesh = new Mesh(new SphereGeometry(1, 24, 16), material);
    mesh.scale.set(...size);
    mesh.position.set(...pos);
    parent.add(mesh);
    return mesh;
  };
  sphere(cat, fur, [0.61, 0.62, 0.45], [0, -0.45, 0]);
  sphere(cat, fur, [0.26, 0.17, 0.27], [-0.35, -0.87, 0.24]);
  sphere(cat, fur, [0.26, 0.17, 0.27], [0.35, -0.87, 0.24]);
  const head = new Group();
  head.position.set(0, 0.4, 0.08);
  cat.add(head);
  sphere(head, fur, [0.72, 0.58, 0.48], [0, 0, 0]);
  for (const side of [-1, 1]) {
    const ear = new Mesh(new ConeGeometry(0.28, 0.52, 4), fur);
    ear.position.set(side * 0.45, 0.48, 0);
    ear.rotation.z = side * -0.23;
    ear.rotation.y = Math.PI / 4;
    head.add(ear);
    const earInner = new Mesh(new ConeGeometry(0.13, 0.25, 4), inner);
    earInner.position.set(side * 0.45, 0.46, 0.23);
    earInner.rotation.z = side * -0.23;
    earInner.rotation.y = Math.PI / 4;
    head.add(earInner);
  }
  const eyes = [-0.25, 0.25].map(x => sphere(head, dark, [0.052, 0.075, 0.045], [x, 0.03, 0.455]));
  sphere(head, dark, [0.045, 0.03, 0.025], [0, -0.13, 0.48]);
  const smileCurve = new CatmullRomCurve3([new Vector3(-0.11, -0.19, 0.47), new Vector3(0, -0.24, 0.49), new Vector3(0.11, -0.19, 0.47)]);
  const smile = new Mesh(new TubeGeometry(smileCurve, 12, 0.012, 6, false), dark);
  head.add(smile);
  const surprised = new Mesh(new TorusGeometry(0.055, 0.012, 8, 20), dark);
  surprised.position.set(0, -0.23, 0.49);
  surprised.visible = false;
  head.add(surprised);
  const tailCurve = new CatmullRomCurve3([new Vector3(0.43, -0.67, -0.08), new Vector3(0.83, -0.72, -0.04), new Vector3(1.02, -0.46, -0.03), new Vector3(0.91, -0.23, -0.02)]);
  const tail = new Mesh(new TubeGeometry(tailCurve, 24, 0.105, 10, false), fur);
  cat.add(tail);

  let mood = 'calm';
  let visible = true;
  let frame = 0;
  const render = time => {
    frame = 0;
    if (!visible) return;
    const seconds = time / 1000;
    const motion = !reducedMotion.matches;
    cat.position.y = motion ? Math.sin(seconds * 1.5) * 0.035 : 0;
    head.rotation.z = motion ? Math.sin(seconds * 0.8) * 0.04 : 0;
    tail.rotation.z = motion ? Math.sin(seconds * 1.3) * 0.07 : 0;
    const blinking = motion && seconds % 5 < 0.15;
    eyes.forEach(eye => { eye.scale.y = mood === 'happy' || blinking ? 0.014 : 0.075; });
    smile.visible = mood !== 'surprised';
    surprised.visible = mood === 'surprised';
    renderer.render(scene, camera);
    if (motion) frame = requestAnimationFrame(render);
  };
  const start = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render); };
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) start();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  });
  observer.observe(container);
  const onVisibility = () => {
    if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; }
    else start();
  };
  document.addEventListener('visibilitychange', onVisibility);
  reducedMotion.addEventListener('change', start);
  container.classList.add('pet-3d-ready');
  start();
  return {
    setMood(value) { mood = value; start(); },
    dispose() {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', start);
      if (frame) cancelAnimationFrame(frame);
      scene.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
      fur.dispose(); inner.dispose(); dark.dispose(); renderer.dispose();
    }
  };
}
