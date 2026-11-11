import {
  AmbientLight, AnimationMixer, Box3, Clock, DirectionalLight, Group,
  LoopOnce, OrthographicCamera, Scene, Vector3, WebGLRenderer
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function mountPet(container) {
  const modelUrl = new URL('../assets/pet-cat.glb', import.meta.url);
  const gltf = await new GLTFLoader().loadAsync(modelUrl.href);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(144, 144, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = 'srgb';
  renderer.domElement.className = 'pet-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.prepend(renderer.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1.4, 1.4, 1.4, -1.4, 0.1, 20);
  camera.position.set(0, 0.45, 7);
  camera.lookAt(0, 0, 0);
  scene.add(new AmbientLight(0xffffff, 2));
  const light = new DirectionalLight(0xffffff, 2.4);
  light.position.set(-3, 5, 5);
  scene.add(light);
  const fill = new DirectionalLight(0xe3e8ef, 0.9);
  fill.position.set(3, 2, -4);
  scene.add(fill);

  const model = gltf.scene;
  model.traverse(object => {
    if (object.name === 'cat_LOD0') object.visible = false;
    if (object.name === 'cat_LOD1') object.visible = true;
  });
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const scale = 2.05 / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  const stage = new Group();
  stage.add(model);
  scene.add(stage);
  const mixer = new AnimationMixer(model);
  const idleClip = gltf.animations.find(clip => clip.name === 'idle');
  const reactionClip = gltf.animations.find(clip => clip.name === 'call');
  const idle = idleClip && mixer.clipAction(idleClip);
  if (idle) idle.play();
  const clock = new Clock();
  let visible = true;
  let frame = 0;
  let onReactionFinished = null;
  const render = () => {
    frame = 0;
    if (!visible || document.hidden) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    if (!reducedMotion.matches) mixer.update(delta);
    renderer.render(scene, camera);
    if (!reducedMotion.matches) frame = requestAnimationFrame(render);
  };
  const start = () => {
    if (!frame && visible && !document.hidden) { clock.getDelta(); frame = requestAnimationFrame(render); }
  };
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
    setMood() {
      if (reactionClip && !reducedMotion.matches) {
        const reaction = mixer.clipAction(reactionClip);
        if (onReactionFinished) mixer.removeEventListener('finished', onReactionFinished);
        reaction.reset().setLoop(LoopOnce, 1);
        reaction.clampWhenFinished = false;
        if (idle) idle.crossFadeTo(reaction, 0.2, false);
        reaction.play();
        onReactionFinished = event => {
          if (event.action !== reaction) return;
          mixer.removeEventListener('finished', onReactionFinished);
          onReactionFinished = null;
          if (idle) { idle.reset().play(); reaction.crossFadeTo(idle, 0.25, false); }
        };
        mixer.addEventListener('finished', onReactionFinished);
      }
      start();
    },
    dispose() {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', start);
      if (frame) cancelAnimationFrame(frame);
      mixer.stopAllAction();
      scene.traverse(object => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => { material.map?.dispose(); material.dispose(); });
      });
      renderer.dispose();
    }
  };
}
