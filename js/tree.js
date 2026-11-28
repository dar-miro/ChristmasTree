// 3D-сцена: світло, камера, керування, завантаження ялинки (models/tree.glb).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MODELS, MODEL_SCALE, CAMERA } from './scene-config.js';
import { LIGHTS } from './light-config.js';

const TONE = {
  None: THREE.NoToneMapping,
  Linear: THREE.LinearToneMapping,
  Reinhard: THREE.ReinhardToneMapping,
  Cineon: THREE.CineonToneMapping,
  ACES: THREE.ACESFilmicToneMapping,
  AgX: THREE.AgXToneMapping,
};

function enableShadows(obj) {
  obj.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

/** Створює сцену. Повертає об'єкти, потрібні наступним модулям (декор, прикраси, клік по прикрасі). */
export function createTreeScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LIGHTS.background);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 4, 11);

  // ---------- Світло ----------
  const lightCfg = structuredClone(LIGHTS);   // «жива» копія, її змінює панель ?light

  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0005;      // прибирає смужки (shadow acne)
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 2;
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  const fill = new THREE.DirectionalLight();
  const rim = new THREE.DirectionalLight();
  const lamp = new THREE.PointLight(0xffffff, 1, 0, 2);
  const lights = { hemi, sun, fill, rim, lamp };
  scene.add(hemi, sun, fill, rim, lamp);

  let lastTone = null;
  function applyLights() {
    const c = lightCfg;
    renderer.toneMapping = TONE[c.toneMapping] ?? THREE.NoToneMapping;
    renderer.toneMappingExposure = c.exposure;
    scene.background.set(c.background);

    const set = (light, o) => {
      light.visible = o.on;
      light.intensity = o.intensity;
      light.color.set(o.color);
      if (o.x !== undefined) light.position.set(o.x, o.y, o.z);
    };
    set(hemi, c.hemi);
    hemi.groundColor.set(c.hemi.ground);
    set(sun, c.sun);
    sun.castShadow = c.sun.shadows;
    set(fill, c.fill);
    set(rim, c.rim);
    set(lamp, c.lamp);

    // Зміна тон-мапінгу вимагає перекомпіляції матеріалів
    if (lastTone !== c.toneMapping) {
      lastTone = c.toneMapping;
      scene.traverse(o => {
        if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; });
      });
    }
  }
  applyLights();

  // ---------- Камера ----------
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

  return { scene, camera, controls, tree, ornamentsGroup, slots, loadModel, onFrame,
           lights, lightCfg, applyLights };
}