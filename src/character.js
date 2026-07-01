import * as THREE from 'three';
import { RARITIES } from './items.js';

/**
 * A low-poly humanoid built from primitives, grouped so the limbs can be
 * animated procedurally (no external model / skeleton needed). The character
 * exposes a walk cycle and a gentle idle bob via `update()`, and can wear
 * equipment (helmet, chestplate, gloves, belt, boots, weapon, shield) via
 * `setEquipment()`.
 */
export class Character {
  constructor() {
    this.group = new THREE.Group();
    this.clock = 0;

    const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac79, roughness: 0.8 });
    const tunic = new THREE.MeshStandardMaterial({ color: 0x3f7d4e, roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), tunic);
    torso.position.y = 1.15;
    torso.castShadow = true;
    this.group.add(torso);

    // Head + hair
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
    head.position.y = 1.74;
    head.castShadow = true;
    this.group.add(head);

    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.46), hair);
    hairTop.position.y = 1.93;
    hairTop.castShadow = true;
    this.group.add(hairTop);

    // Arms — pivot at the shoulder so rotation swings the whole arm.
    this.leftArm = this._makeLimb(0.16, 0.62, tunic, skin);
    this.leftArm.position.set(-0.4, 1.45, 0);
    this.group.add(this.leftArm);

    this.rightArm = this._makeLimb(0.16, 0.62, tunic, skin);
    this.rightArm.position.set(0.4, 1.45, 0);
    this.group.add(this.rightArm);

    // Legs
    this.leftLeg = this._makeLimb(0.2, 0.7, cloth, cloth);
    this.leftLeg.position.set(-0.16, 0.78, 0);
    this.group.add(this.leftLeg);

    this.rightLeg = this._makeLimb(0.2, 0.7, cloth, cloth);
    this.rightLeg.position.set(0.16, 0.78, 0);
    this.group.add(this.rightLeg);

    // Equipment attachment points. Static pieces hang off the body; hand/foot
    // pieces hang off the limb pivots so they swing while walking.
    this.headSlot = new THREE.Group();
    this.chestSlot = new THREE.Group();
    this.waistSlot = new THREE.Group();
    this.group.add(this.headSlot, this.chestSlot, this.waistSlot);
    this.rHand = new THREE.Group();
    this.rHand.position.set(0, -0.62, 0);
    this.rightArm.add(this.rHand);
    this.lHand = new THREE.Group();
    this.lHand.position.set(0, -0.62, 0);
    this.leftArm.add(this.lHand);
    this.rFoot = new THREE.Group();
    this.rFoot.position.set(0, -0.7, 0);
    this.rightLeg.add(this.rFoot);
    this.lFoot = new THREE.Group();
    this.lFoot.position.set(0, -0.7, 0);
    this.leftLeg.add(this.lFoot);

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
  }

  // Metal/leather base tinted with a subtle rarity-coloured glow.
  _mat(baseHex, tint) {
    return new THREE.MeshStandardMaterial({
      color: baseHex,
      roughness: 0.5,
      metalness: 0.35,
      emissive: tint,
      emissiveIntensity: 0.28,
    });
  }

  /**
   * Show equipped gear on the model. `equipment` maps slot -> item|null
   * (head, chest, hands, waist, feet, mainHand, offHand).
   */
  setEquipment(equipment) {
    const clear = (g) => {
      while (g.children.length) g.remove(g.children[0]);
    };
    [this.headSlot, this.chestSlot, this.waistSlot, this.rHand, this.lHand, this.rFoot, this.lFoot].forEach(clear);

    const tint = (item) => new THREE.Color(RARITIES[item.rarity]?.color || '#c9c9c9');
    const steel = 0x9aa0aa;
    const leather = 0x6b4a2b;

    if (equipment.head) {
      const t = tint(equipment.head);
      const dome = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), this._mat(steel, t));
      dome.position.y = 1.9;
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.42), this._mat(0xb0453a, t));
      crest.position.y = 2.08;
      this.headSlot.add(dome, crest);
    }
    if (equipment.chest) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.54, 0.42), this._mat(steel, tint(equipment.chest)));
      plate.position.y = 1.2;
      this.chestSlot.add(plate);
    }
    if (equipment.waist) {
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.14, 0.4), this._mat(leather, tint(equipment.waist)));
      belt.position.y = 0.85;
      this.waistSlot.add(belt);
    }
    if (equipment.hands) {
      const t = tint(equipment.hands);
      for (const slot of [this.rHand, this.lHand]) {
        slot.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), this._mat(leather, t)));
      }
    }
    if (equipment.feet) {
      const t = tint(equipment.feet);
      for (const slot of [this.rFoot, this.lFoot]) {
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.36), this._mat(leather, t));
        boot.position.set(0, -0.02, 0.06);
        slot.add(boot);
      }
    }
    if (equipment.mainHand) {
      this.rHand.add(this._weapon(equipment.mainHand, tint(equipment.mainHand)));
    }
    if (equipment.offHand) {
      const t = tint(equipment.offHand);
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 0.42), this._mat(0x8c8f98, t));
      face.position.set(-0.14, -0.05, 0.12);
      face.rotation.y = 0.2;
      const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.14), this._mat(0xd9a441, t));
      emblem.position.set(-0.2, -0.03, 0.12);
      emblem.rotation.y = 0.2;
      this.lHand.add(face, emblem);
    }

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
  }

  _weapon(item, tint) {
    const g = new THREE.Group();
    if (item.baseId === 'shortbow') {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 14, Math.PI * 1.25), this._mat(0x7a5230, tint));
      bow.rotation.z = Math.PI / 2;
      bow.position.set(0.02, -0.12, 0.14);
      g.add(bow);
    } else {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.12), this._mat(0xc2c7d0, tint));
      blade.position.y = -0.34;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.08), this._mat(0xd9a441, tint));
      guard.position.y = -0.05;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), this._mat(0x4f3620, tint));
      grip.position.y = 0.06;
      g.add(blade, guard, grip);
    }
    return g;
  }

  // A limb is a pivot group with the geometry hung below the pivot point,
  // plus a small "hand/foot" cap at the end.
  _makeLimb(width, length, mainMat, capMat) {
    const pivot = new THREE.Group();
    const limb = new THREE.Mesh(new THREE.BoxGeometry(width, length, width), mainMat);
    limb.position.y = -length / 2;
    pivot.add(limb);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 1.1, width * 1.1, width * 1.1), capMat);
    cap.position.y = -length;
    pivot.add(cap);
    return pivot;
  }

  /**
   * @param {number} delta seconds since last frame
   * @param {boolean} moving whether the character is currently walking
   */
  update(delta, moving) {
    this.clock += delta;

    if (moving) {
      const swing = Math.sin(this.clock * 11) * 0.8;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.7;
      this.rightArm.rotation.x = swing * 0.7;
      // Slight vertical bounce in step with the stride.
      this.group.position.y = Math.abs(Math.sin(this.clock * 11)) * 0.08;
    } else {
      // Ease limbs back to rest and add a calm breathing bob.
      const ease = Math.min(1, delta * 8);
      this.leftLeg.rotation.x += (0 - this.leftLeg.rotation.x) * ease;
      this.rightLeg.rotation.x += (0 - this.rightLeg.rotation.x) * ease;
      this.leftArm.rotation.x += (0 - this.leftArm.rotation.x) * ease;
      this.rightArm.rotation.x += (0 - this.rightArm.rotation.x) * ease;
      this.group.position.y = Math.sin(this.clock * 2) * 0.03;
    }
  }
}
