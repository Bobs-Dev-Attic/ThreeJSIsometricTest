import * as THREE from 'three';

/**
 * A low-poly humanoid built from primitives, grouped so the limbs can be
 * animated procedurally (no external model / skeleton needed). The character
 * exposes a walk cycle and a gentle idle bob via `update()`.
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

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
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
