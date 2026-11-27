// 3D-сцена: світло, камера, керування, завантаження ялинки (models/tree.glb).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODELS, MODEL_SCALE, CAMERA, LIGHT_SCALE, TONE_MAPPING } from './scene-config.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BG = 0x1b1020;

function enableShadows(obj) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

/** Створює сцену. Повертає об'єкти, потрібні наступним модулям (декор, прикраси, клік по прикрасі). */
export function createTreeScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  if (TONE_MAPPING) renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 4, 11);

  // Тепле світло з коду (LIGHT_SCALE = 0 вимикає його)
  scene.add(new THREE.HemisphereLight(0xffe4c4, 0x3a2418, 1.0 * LIGHT_SCALE));
  const sun = new THREE.DirectionalLight(0xffd9a8, 1.8 * LIGHT_SCALE);
  sun.position.set(5, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
  scene.add(sun);
  const lamp = new THREE.PointLight(0xffb36b, 30 * LIGHT_SCALE, 0, 2);
  lamp.position.set(-4, 4, 4);
  scene.add(lamp);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.7, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = CAMERA.min;
  controls.maxDistance = CAMERA.max;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.update();

  const tree = new THREE.Group();            // ялинка
  const ornamentsGroup = new THREE.Group();  // сюди пізніше додаватимемо прикраси
  const slots = [];                          // місця для прикрас: [{ name, position }]
  scene.add(tree, ornamentsGroup);

  /** Завантажує models/tree.glb. Повертає true/false. Нічого не генерує автоматично. */
  async function loadModel() {
    try {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const { scene: obj } = await loader.loadAsync(MODELS.tree);
      obj.scale.setScalar(MODEL_SCALE);
      enableShadows(obj);
      tree.add(obj);
      tree.updateMatrixWorld(true);

      // Камера підлаштовується під висоту ялинки
      const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
      controls.target.set(0, size.y * 0.45, 0);
      camera.position.set(0, size.y * 0.7, size.y * 1.8);
      controls.update();

      // Порожні об'єкти slot_* з Blender → координати місць для прикрас
      obj.traverse(o => {
        if (/^slot/i.test(o.name)) slots.push({ name: o.name, position: o.getWorldPosition(new THREE.Vector3()) });
      });
      slots.sort((a, b) => a.name.localeCompare(b.name));
      console.log(`Ялинка: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} м, місць для прикрас: ${slots.length}`);
      return true;
    } catch (err) {
      console.warn('Не вдалося завантажити', MODELS.tree, err);
      return false;
    }
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // Анімація: модулі підписуються через onFrame((dt, t) => …)
  const updaters = [];
  const onFrame = fn => updaters.push(fn);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    for (const f of updaters) f(dt, t);
    controls.update();
    renderer.render(scene, camera);
  });

  return { scene, camera, controls, tree, ornamentsGroup, slots, loadModel, onFrame };
}
