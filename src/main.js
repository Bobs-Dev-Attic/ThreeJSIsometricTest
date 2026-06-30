import * as THREE from 'three';
import { Character } from './character.js';
import { createForest } from './forest.js';
import { createStream } from './stream.js';
import { createWildlife } from './wildlife.js';
import { Fisherman } from './npc.js';
import { Chest } from './chest.js';
import { Knight } from './knight.js';
import { createDialogue } from './dialogue.js';
import { createInventory } from './inventory.js';
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
const HALF = 40;

// Stream with a bridge crossing the middle of the forest.
const stream = createStream({ halfSize: HALF, zCenter: -6, halfWidth: 3, bridgeXCenter: 0, bridgeHalfWidth: 2.5 });
scene.add(stream.group);
const streamCfg = stream.config;

// Forest, kept clear of the stream and the bridge approaches.
const { group: forest, halfSize, obstacles } = createForest({
  halfSize: HALF,
  stream: {
    zCenter: streamCfg.zCenter,
    halfWidth: streamCfg.halfWidth,
    bridgeXCenter: streamCfg.bridgeXCenter,
    bridgeHalfWidth: streamCfg.bridgeHalfWidth,
  },
});
scene.add(forest);

// Fisherman NPC, standing on the bridge near the railing. Register him as an
// obstacle so the player routes around him (and can still cross the bridge).
const FISHERMAN_POS = { x: 1.6, z: -6 };
obstacles.push({ x: FISHERMAN_POS.x, z: FISHERMAN_POS.z, radius: 0.45 });

// Treasure chest in the clearing near the spawn (kept clear of trees), also an
// obstacle so the player walks up to it rather than through it.
const CHEST_POS = { x: -5, z: 2.5 };
obstacles.push({ x: CHEST_POS.x, z: CHEST_POS.z, radius: 0.8 });

// Navigation grid the character uses to route around trees and rocks, and to
// keep off the water (the bridge is the only way across the stream).
const navGrid = new NavGrid(obstacles, {
  halfSize,
  cellSize: 0.5,
  agentRadius: 0.5,
  gridMargin: 0.2,
  water: streamCfg.water,
});

// Wildlife: wandering deer & squirrels (sharing the navigation grid) and birds.
const wildlife = createWildlife(navGrid, { halfSize, water: streamCfg.water });
scene.add(wildlife.group);

const fisherman = new Fisherman({ deckSurface: streamCfg.deckSurface });
fisherman.setPosition(FISHERMAN_POS.x, FISHERMAN_POS.z, Math.PI / 2);
scene.add(fisherman.group);

const chest = new Chest();
chest.setPosition(CHEST_POS.x, CHEST_POS.z, 0.6);
scene.add(chest.group);

const inventory = createInventory();

// Contents of the chest (taken items are removed from this array).
const chestContents = [
  { id: 'coins', name: 'Gold Coins', type: 'coin', icon: '🪙', qty: 25 },
  { id: 'sword', name: 'Iron Sword', type: 'weapon', icon: '⚔️', qty: 1 },
  { id: 'bow', name: 'Short Bow', type: 'weapon', icon: '🏹', qty: 1 },
  { id: 'apple', name: 'Red Apple', type: 'food', icon: '🍎', qty: 3 },
  { id: 'bread', name: 'Loaf of Bread', type: 'food', icon: '🍞', qty: 2 },
  { id: 'cloak', name: 'Wool Cloak', type: 'clothing', icon: '🧥', qty: 1 },
  { id: 'boots', name: 'Leather Boots', type: 'clothing', icon: '🥾', qty: 1 },
  { id: 'hat', name: 'Feathered Hat', type: 'clothing', icon: '🎩', qty: 1 },
];

// Toggle the inventory with the "I" key.
window.addEventListener('keydown', (e) => {
  if (e.key === 'i' || e.key === 'I') inventory.toggleInventory();
});

const dialogue = createDialogue();
// Branching conversation: the player chooses answers / questions.
const FISHERMAN_TREE = {
  start: {
    text: "Ah, a traveler! Don't see many out here. What brings you to my bridge?",
    options: [
      { label: 'Catching anything good?', next: 'fish' },
      { label: 'What is this place?', next: 'place' },
      { label: 'Got any advice for me?', next: 'advice' },
      { label: 'Just passing through. Farewell.', next: null },
    ],
  },
  fish: {
    text: "Trout, mostly — when they're biting. This stream's fed me for thirty years.",
    options: [
      { label: 'Thirty years out here?', next: 'place' },
      { label: 'Any advice, then?', next: 'advice' },
      { label: "I'll leave you to it. Farewell.", next: null },
    ],
  },
  place: {
    text: 'Greenhollow Forest. Peaceful, if you respect it. This bridge is the only dry crossing for miles.',
    options: [
      { label: 'Good to know. Any advice?', next: 'advice' },
      { label: '(Back)', next: 'start' },
      { label: 'Thank you. Farewell.', next: null },
    ],
  },
  advice: {
    text: "Aye — there's an old chest in the clearing back yonder. Finders keepers, I always say. Go help yourself.",
    options: [
      { label: 'A chest? My thanks!', next: null },
      { label: 'Tell me about this place first.', next: 'place' },
      { label: '(Back)', next: 'start' },
    ],
  },
};
let talking = false;
let npcDismissed = false;

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
// Scripted encounter: once the player crosses to the far bank, a mounted
// knight rides up, blocks the way and warns "Halt or I'll attack!". Continue
// toward him and he charges, lances the player and it's game over.
// ---------------------------------------------------------------------------
const knight = new Knight();
scene.add(knight.group);

const banner = document.createElement('div');
banner.id = 'knight-banner';
document.getElementById('app').appendChild(banner);

const deathOverlay = document.createElement('div');
deathOverlay.id = 'death';
deathOverlay.innerHTML = `
  <h1>You Have Been Slain</h1>
  <p>"Halt or I'll attack," the knight had warned. You rode on regardless.</p>
  <button id="respawn">Try Again</button>
`;
document.getElementById('app').appendChild(deathOverlay);
deathOverlay.addEventListener('pointerdown', (e) => e.stopPropagation());
deathOverlay.querySelector('#respawn').addEventListener('click', () => location.reload());

const KNIGHT_NAME = 'Sir Aldric';
const encounter = { state: 'dormant', timer: 0, stop: { x: 0, z: 0 }, exit: { x: 0, z: 0 } };
let playerDead = false;
let deathTimer = 0;

function showBanner(text) {
  banner.textContent = `⚔  ${KNIGHT_NAME}: "${text}"`;
  banner.classList.add('show');
}
function hideBanner() {
  banner.classList.remove('show');
}

// Move the knight toward a target; returns true while still travelling.
function rideToward(tx, tz, speed, delta) {
  const dx = tx - knight.x;
  const dz = tz - knight.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.25) return false;
  const step = Math.min(speed * delta, d);
  knight.x += (dx / d) * step;
  knight.z += (dz / d) * step;
  knight.group.position.x = knight.x;
  knight.group.position.z = knight.z;
  knight.group.rotation.y = Math.atan2(dx, dz);
  return true;
}

function triggerAttack() {
  encounter.state = 'attack';
  hideBanner();
  moving = false;
  path = null;
  marker.visible = false;
}

function standDown(line) {
  encounter.state = 'leave';
  encounter.exit = { x: knight.x, z: -halfSize + 3 };
  showBanner(line);
}

function killPlayer() {
  if (playerDead) return;
  playerDead = true;
  moving = false;
  path = null;
  marker.visible = false;
  deathTimer = 0;
}

function updateEncounter(delta, t) {
  switch (encounter.state) {
    case 'dormant': {
      // Trigger once the player is across the stream onto the north bank.
      if (!playerDead && pos.z < streamCfg.water.zmin - 2) {
        // Halt the player so the knight can ride up and stop in front of them.
        moving = false;
        path = null;
        marker.visible = false;
        encounter.stop = {
          x: THREE.MathUtils.clamp(pos.x, -halfSize + 6, halfSize - 6),
          z: Math.max(-halfSize + 6, pos.z - 4.5),
        };
        const spawnZ = Math.max(-halfSize + 2, encounter.stop.z - 14);
        knight.setPosition(encounter.stop.x, spawnZ, 0); // facing +Z (south)
        knight.group.visible = true;
        encounter.state = 'approach';
      }
      knight.update(delta, t, {});
      break;
    }
    case 'approach': {
      const riding = rideToward(encounter.stop.x, encounter.stop.z, 12, delta);
      knight.update(delta, t, { moving: true });
      if (!riding) {
        encounter.state = 'warn';
        encounter.timer = 0;
        // Halt the player to face the confrontation.
        moving = false;
        path = null;
        marker.visible = false;
        showBanner('Halt or I’ll attack!');
      }
      break;
    }
    case 'warn': {
      // Face the player.
      knight.group.rotation.y = Math.atan2(pos.x - knight.x, pos.z - knight.z);
      knight.update(delta, t, {});
      encounter.timer += delta;
      // If the player complies (stays put) for a while, the knight relents.
      if (encounter.timer > 9) standDown('Hmph. On your way, then.');
      break;
    }
    case 'attack': {
      const dist = Math.hypot(pos.x - knight.x, pos.z - knight.z);
      if (dist < 1.7) {
        knight.update(delta, t, { moving: false, charging: true });
        killPlayer();
        encounter.state = 'done';
      } else {
        rideToward(pos.x, pos.z, 16, delta);
        knight.update(delta, t, { moving: true, charging: true });
      }
      break;
    }
    case 'leave': {
      const riding = rideToward(encounter.exit.x, encounter.exit.z, 12, delta);
      knight.update(delta, t, { moving: true });
      if (!riding) {
        knight.group.visible = false;
        hideBanner();
        encounter.state = 'done';
      }
      break;
    }
    default:
      knight.update(delta, t, {});
  }
}

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
  if (playerDead) return; // no control once slain
  if (encounter.state === 'approach') return; // brief beat while the knight rides up
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;

  // Clamp inside the world bounds.
  const lim = halfSize - 1;
  hit.x = THREE.MathUtils.clamp(hit.x, -lim, lim);
  hit.z = THREE.MathUtils.clamp(hit.z, -lim, lim);

  // During the knight's warning: pressing on toward him (northward) provokes
  // the attack; retreating (or stepping aside) makes him stand down.
  if (encounter.state === 'warn') {
    if (hit.z < pos.z - 0.4) {
      triggerAttack();
      return;
    }
    standDown('A wise retreat, traveler.');
  }

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
let baseY = 0; // ground height under the character (rises on the bridge)

// Height of the walkable surface at (x,z): the bridge deck while crossing the
// stream, otherwise the ground.
function surfaceHeight(x, z) {
  const onDeckX = Math.abs(x - streamCfg.bridgeXCenter) <= streamCfg.bridgeHalfWidth;
  const overSpan =
    z > streamCfg.zCenter - streamCfg.halfWidth - 1 && z < streamCfg.zCenter + streamCfg.halfWidth + 1;
  return onDeckX && overSpan ? streamCfg.deckSurface : 0;
}

function tick() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (!playerDead && moving && path) {
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

  if (!playerDead) {
    character.update(delta, moving); // sets pos.y to the bob offset
    // Ease the character onto/off the bridge deck.
    baseY += (surfaceHeight(pos.x, pos.z) - baseY) * Math.min(1, delta * 7);
    pos.y += baseY;
  } else {
    // Slain: topple over and, after a beat, reveal the death screen.
    deathTimer += delta;
    character.group.rotation.z += (Math.PI / 2 - character.group.rotation.z) * Math.min(1, delta * 4);
    pos.y = baseY + 0.1;
    if (deathTimer > 1.1) deathOverlay.classList.add('show');
  }

  // Animate the water and bring the forest to life.
  stream.animate(elapsed);
  for (const critter of wildlife.critters) critter.update(delta, elapsed, pos);
  fisherman.update(delta, elapsed);
  chest.update(delta);
  updateEncounter(delta, elapsed);

  if (!playerDead) {
    // Conversation with the fisherman. Approaching opens the branching dialogue;
    // ending it (via "Farewell") sets a dismiss flag so it doesn't immediately
    // reopen — that flag clears once the player walks away.
    const distToNpc = Math.hypot(pos.x - fisherman.x, pos.z - fisherman.z);
    if (talking && !dialogue.active) {
      // Player closed the dialogue by choosing an end option.
      talking = false;
      npcDismissed = true;
    }
    if (distToNpc < 3.4) {
      if (!talking && !npcDismissed) {
        talking = true;
        dialogue.open('Old Angler', FISHERMAN_TREE);
      }
    } else {
      npcDismissed = false;
      if (talking) {
        talking = false;
        dialogue.close();
      }
    }

    // Chest: open (and show the loot interface) on approach, close on leaving.
    const distToChest = Math.hypot(pos.x - chest.x, pos.z - chest.z);
    if (distToChest < 2.8) {
      if (!inventory.chestVisible) {
        chest.open();
        inventory.openChest(chestContents);
      }
    } else if (inventory.chestVisible) {
      chest.close();
      inventory.closeChest();
    }
  }

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
