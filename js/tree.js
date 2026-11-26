// 3D-сцена: ялинка, світло, камера, керування.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_URL, TREE_HEIGHT } from './config.js';

const BG = 0x1b1020; // теплий темний фон за межами кімнати

function buildFallbackTree() {
  const g = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: 0x2e8b57, flatShading: true });
  const brown = new THREE.MeshStandardMaterial({ color: 0x6b4423, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1, 12), brown);
  trunk.position.y = 0.5;
  g.add(trunk);
  for (const [r, h, y] of [[2.2, 2.2, 1.0], [1.8, 2.0, 2.2], [1.4, 1.8, 3.3], [1.0, 1.6, 4.3]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), green);
    cone.position.y = y + h / 2 - 0.2;
    g.add(cone);
  }
  return g;
}

function fitToScene(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  obj.scale.multiplyScalar(TREE_HEIGHT / box.getSize(new THREE.Vector3()).y);
  box.setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= box.min.y;
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

/** Створює сцену. Повертає об'єкти, потрібні наступним модулям (декор, прикраси, клік по прикрасі). */
export function createTreeScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 30, 70);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, TREE_HEIGHT * 0.7, TREE_HEIGHT * 1.8);

  // Тепле світло: загальне, «з вікна» з тінями та м'яка лампа збоку
  scene.add(new THREE.HemisphereLight(0xffe4c4, 0x3a2418, 1.0));
  const sun = new THREE.DirectionalLight(0xffd9a8, 1.8);
  sun.position.set(5, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  scene.add(sun);
  const lamp = new THREE.PointLight(0xffb36b, 30, 0, 2);
  lamp.position.set(-4, 4, 4);
  scene.add(lamp);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, TREE_HEIGHT * 0.45, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 14;               // камера завжди всередині кімнати
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.update();

  const tree = new THREE.Group();            // ялинка
  const ornamentsGroup = new THREE.Group();  // сюди пізніше додаватимемо прикраси
  scene.add(tree, ornamentsGroup);

  /** Завантажує модель. Повертає true, якщо завантажилась вона, а не запасна ялинка. */
  function loadModel() {
    return new Promise(resolve => {
      new GLTFLoader().load(MODEL_URL,
        gltf => { fitToScene(gltf.scene); tree.add(gltf.scene); resolve(true); },
        undefined,
        err => {
          console.warn('Модель не завантажилась, запасна ялинка:', err);
          const fb = buildFallbackTree();
          fitToScene(fb);
          tree.add(fb);
          resolve(false);
        });
    });
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

  return { scene, camera, controls, tree, ornamentsGroup, loadModel, onFrame };
}
