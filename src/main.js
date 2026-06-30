import * as THREE from 'three';
import { Character } from './character.js';
import { createForest } from './forest.js';
import { NavGrid } from './navigation.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------------------------------------------------------------------------
// Scene + atmosphere
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc4e0);
scene.fog = new THREE.Fog(0x9fc4e0, 35, 75);

// ---------------------------------------------------------------------------
// Isometric camera. An OrthographicCamera at a fixed angle gives the classic
// isometric RPG look; we keep a constant offset from the character and follow.
// ---------------------------------------------------------------------------
const FRUSTUM = 22;
let aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  (-FRUSTUM * aspect) / 2,
  (FRUSTUM * aspect) / 2,
  FRUSTUM / 2,
  -FRUSTUM / 2,
  0.1,
  200
);
const camOffset = new THREE.Vector3(20, 24, 20);
camera.position.copy(camOffset);
camera.lookAt(0, 0, 0);

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x3a5a32, 0.85));

const sun = new THREE.DirectionalLight(0xfff3d6, 1.5);
sun.position.set(18, 34, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
const s = 45;
sun.shadow.camera.left = -s;
sun.shadow.camera.right = s;
sun.shadow.camera.top = s;
sun.shadow.camera.bottom = -s;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);

// ---------------------------------------------------------------------------
// World + character
// ---------------------------------------------------------------------------
const { group: forest, halfSize, obstacles } = createForest();
scene.add(forest);

// Navigation grid the character uses to route around trees, rocks and shrubs.
const navGrid = new NavGrid(obstacles, { halfSize, cellSize: 0.5, agentRadius: 0.5, gridMargin: 0.2 });

const character = new Character();
scene.add(character.group);

// Ground reticle that marks the current move target.
const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.45, 0.6, 24),
  new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 })
);
marker.rotation.x = -Math.PI / 2;
marker.position.y = 0.05;
marker.visible = false;
scene.add(marker);

// ---------------------------------------------------------------------------
// Click-to-move
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const SPEED = 6; // world units per second

let path = null; // array of {x,z} waypoints from the navigation grid
let pathIndex = 0;
let moving = false;

function moveTo(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;

  // Clamp inside the world bounds.
  const lim = halfSize - 1;
  hit.x = THREE.MathUtils.clamp(hit.x, -lim, lim);
  hit.z = THREE.MathUtils.clamp(hit.z, -lim, lim);

  // Route around obstacles instead of walking straight through them.
  const route = navGrid.findPath({ x: pos.x, z: pos.z }, { x: hit.x, z: hit.z });
  if (!route || route.length === 0) return;

  path = route;
  pathIndex = 0;
  moving = true;

  const end = route[route.length - 1];
  marker.position.set(end.x, 0.05, end.z);
  marker.visible = true;
}

canvas.addEventListener('pointerdown', (e) => moveTo(e.clientX, e.clientY));

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function onResize() {
  aspect = window.innerWidth / window.innerHeight;
  camera.left = (-FRUSTUM * aspect) / 2;
  camera.right = (FRUSTUM * aspect) / 2;
  camera.top = FRUSTUM / 2;
  camera.bottom = -FRUSTUM / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const pos = character.group.position; // y is driven by the bob in Character

function tick() {
  const delta = Math.min(clock.getDelta(), 0.05);

  if (moving && path) {
    // Advance past any waypoints we've already reached (the first one is the
    // start point, so this also drops it on the first frame).
    let wp = path[pathIndex];
    let dx = wp.x - pos.x;
    let dz = wp.z - pos.z;
    let dist = Math.hypot(dx, dz);
    while (dist < 0.15 && pathIndex < path.length - 1) {
      pathIndex++;
      wp = path[pathIndex];
      dx = wp.x - pos.x;
      dz = wp.z - pos.z;
      dist = Math.hypot(dx, dz);
    }

    if (dist < 0.15 && pathIndex >= path.length - 1) {
      moving = false;
      path = null;
      marker.visible = false;
    } else {
      const step = Math.min(SPEED * delta, dist);
      pos.x += (dx / dist) * step;
      pos.z += (dz / dist) * step;
      // Face the direction of travel (smoothly).
      const targetAngle = Math.atan2(dx, dz);
      character.group.rotation.y = lerpAngle(character.group.rotation.y, targetAngle, 0.2);
    }
  }

  character.update(delta, moving);

  // Camera follows the character, preserving the isometric offset.
  camera.position.set(pos.x + camOffset.x, camOffset.y, pos.z + camOffset.z);
  camera.lookAt(pos.x, 1, pos.z);

  // Keep the sun shadow frustum centred on the action.
  sun.position.set(pos.x + 18, 34, pos.z + 12);
  sun.target.position.set(pos.x, 0, pos.z);

  // Pulse the target marker.
  if (marker.visible) {
    marker.material.opacity = 0.55 + Math.sin(clock.elapsedTime * 6) * 0.35;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// Kick things off.
tick();
loading.classList.add('hidden');
