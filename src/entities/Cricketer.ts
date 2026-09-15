import * as THREE from 'three';
import { BAT_LENGTH, BAT_WIDTH } from '../core/Constants';
import { kf, NEUTRAL_POSE, runPose, type Pose } from './Anim';

export type ShotKind = 'defend' | 'drive' | 'loft' | 'cut' | 'pull' | 'sweep';
export type CelebrateKind = 'arms' | 'jump' | 'fist';

export interface CricketerOptions {
  shirt: number;
  trousers: number;
  skin: number;
  cap?: number | null; // cap colour, null = none
  helmet?: number | null; // helmet colour, null = none
  pads?: boolean;
  withBat?: boolean;
  scale?: number;
}

const SKIN_TONES = [0xf0c8a0, 0xd9a066, 0xc68642, 0x8d5524, 0x6b4424, 0xeab892];
const FOOT_SOLE_CLEARANCE = 0.006;

export function skinToneFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SKIN_TONES[h % SKIN_TONES.length];
}

/**
 * Unified procedural cricketer: pelvis -> chest -> head + two arm chains,
 * two leg chains, optional bat/pads/helmet. Every animation is a pure function
 * of progress 0..1 writing joint rotations, so gameplay can scrub them
 * deterministically and QA can screenshot any pose exactly.
 */
export class Cricketer {
  readonly root = new THREE.Group();
  readonly hips = new THREE.Group();
  readonly chest = new THREE.Group();
  readonly headPivot = new THREE.Group();
  readonly shL = new THREE.Group();
  readonly shR = new THREE.Group();
  readonly elL = new THREE.Group();
  readonly elR = new THREE.Group();
  readonly hipL = new THREE.Group();
  readonly hipR = new THREE.Group();
  readonly kneeL = new THREE.Group();
  readonly kneeR = new THREE.Group();
  readonly batPivot = new THREE.Group();
  readonly bat: THREE.Mesh | null = null;
  readonly height: number;
  private readonly shoes: THREE.Mesh[] = [];
  private readonly footBox = new THREE.Box3();

  constructor(opts: CricketerOptions) {
    const scale = opts.scale ?? 1;
    this.height = 1.82 * scale;
    this.root.name = 'cricketer';

    const shirtMat = new THREE.MeshStandardMaterial({ color: opts.shirt, roughness: 0.85 });
    const trousersMat = new THREE.MeshStandardMaterial({ color: opts.trousers, roughness: 0.9 });
    const skinMat = new THREE.MeshStandardMaterial({ color: opts.skin, roughness: 0.65 });

    const cast = (m: THREE.Mesh): THREE.Mesh => {
      m.castShadow = true;
      return m;
    };

    this.hips.position.y = 0.9;
    this.root.add(this.hips);
    this.hips.add(this.chest);

    const torso = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.185, 0.5, 4, 10), shirtMat));
    torso.position.y = 0.34;
    this.chest.add(torso);

    this.headPivot.position.y = 0.72;
    this.chest.add(this.headPivot);
    const head = cast(new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 12), skinMat));
    head.position.y = 0.06;
    this.headPivot.add(head);

    if (opts.helmet != null) {
      const helmMat = new THREE.MeshStandardMaterial({ color: opts.helmet, roughness: 0.32 });
      // Full shell covering crown/sides/back, sitting naturally on the skull.
      const shell = cast(new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72), helmMat));
      shell.position.y = 0.055;
      shell.scale.set(1, 1.06, 1.04);
      this.headPivot.add(shell);
      // Peak over the eyes.
      const peak = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.018, 0.09), helmMat);
      peak.position.set(0, 0.045, 0.155);
      this.headPivot.add(peak);
      // Face grill.
      const grillMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.45, metalness: 0.55 });
      const grill = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.085, 0.015), grillMat);
      grill.position.set(0, -0.025, 0.135);
      this.headPivot.add(grill);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.02), grillMat);
      bar.position.set(0, 0.012, 0.138);
      this.headPivot.add(bar);
    } else if (opts.cap != null) {
      const capMat = new THREE.MeshStandardMaterial({ color: opts.cap, roughness: 0.7 });
      const capTop = cast(new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), capMat));
      capTop.position.y = 0.085;
      this.headPivot.add(capTop);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.014, 0.1), capMat);
      brim.position.set(0, 0.075, 0.13);
      this.headPivot.add(brim);
    }

    // Arms: shoulder pivot -> upper arm -> elbow pivot -> forearm + hand.
    const buildArm = (shoulder: THREE.Group, elbow: THREE.Group, side: 1 | -1): void => {
      shoulder.position.set(0.21 * side, 0.6, 0);
      this.chest.add(shoulder);
      const upper = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.24, 4, 8), shirtMat));
      upper.position.y = -0.15;
      shoulder.add(upper);
      elbow.position.y = -0.3;
      shoulder.add(elbow);
      const fore = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.24, 4, 8), skinMat));
      fore.position.y = -0.15;
      elbow.add(fore);
      const hand = cast(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), skinMat));
      hand.position.y = -0.31;
      elbow.add(hand);
    };
    buildArm(this.shL, this.elL, -1);
    buildArm(this.shR, this.elR, 1);

    // Legs: hip pivot -> thigh -> knee pivot -> shin (+ pads for batters/keepers).
    const buildLeg = (hip: THREE.Group, knee: THREE.Group, side: 1 | -1): void => {
      hip.position.set(0.1 * side, 0, 0);
      this.hips.add(hip);
      const thigh = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.3, 4, 8), trousersMat));
      thigh.position.y = -0.17;
      hip.add(thigh);
      knee.position.y = -0.36;
      hip.add(knee);
      const shin = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.066, 0.3, 4, 8), trousersMat));
      shin.position.y = -0.17;
      knee.add(shin);
      const shoe = cast(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 })));
      shoe.position.set(0, -0.36, 0.05);
      knee.add(shoe);
      this.shoes.push(shoe);
      if (opts.pads) {
        const pad = cast(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.34, 0.09), new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.7 })));
        pad.position.set(0, -0.16, 0.075);
        knee.add(pad);
      }
    };
    buildLeg(this.hipL, this.kneeL, -1);
    buildLeg(this.hipR, this.kneeR, 1);

    if (opts.withBat) {
      // Bat pivots from the front of the hips: held low, blade reaching the turf.
      this.batPivot.position.set(0.06, 0.05, 0.17);
      this.chest.add(this.batPivot);
      const batMat = new THREE.MeshStandardMaterial({ color: 0xd9b877, roughness: 0.35 });
      const gripMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
      this.bat = cast(new THREE.Mesh(new THREE.BoxGeometry(BAT_WIDTH, BAT_LENGTH * 0.72, 0.035), batMat));
      this.bat.position.y = -BAT_LENGTH * 0.5;
      this.batPivot.add(this.bat);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, BAT_LENGTH * 0.3, 8), gripMat);
      handle.position.y = -BAT_LENGTH * 0.15;
      this.batPivot.add(handle);
    }

    this.root.scale.setScalar(scale);
    this.applyPose(NEUTRAL_POSE);
  }

  applyPose(p: Pose): void {
    this.hips.position.set(p.hipsX, p.hipsY, p.hipsZ);
    this.hips.rotation.y = p.hipsRotY;
    this.chest.rotation.x = p.chestRotX;
    this.chest.rotation.y = p.chestRotY;
    this.headPivot.rotation.x = p.headRotX;
    this.headPivot.rotation.y = p.headRotY;
    this.shL.rotation.set(p.shLRotX, 0, p.shLRotZ);
    this.shR.rotation.set(p.shRRotX, 0, p.shRRotZ);
    this.elL.rotation.x = p.elLRotX;
    this.elR.rotation.x = p.elRRotX;
    this.hipL.rotation.x = p.hipLRotX;
    this.hipR.rotation.x = p.hipRRotX;
    this.kneeL.rotation.x = p.kneeLRotX;
    this.kneeR.rotation.x = p.kneeRRotX;
    this.plantFeet();
  }

  private plantFeet(): void {
    if (Math.abs(this.root.rotation.z) > 1e-4) return;
    this.root.updateMatrixWorld(true);
    this.footBox.makeEmpty();
    for (const shoe of this.shoes) this.footBox.expandByObject(shoe);
    if (!Number.isFinite(this.footBox.min.y)) return;
    this.hips.position.y += (FOOT_SOLE_CLEARANCE - this.footBox.min.y) / this.root.scale.y;
  }

  setPosition(x: number, z: number): void {
    this.root.position.x = x;
    this.root.position.z = z;
  }

  /** Locomotion gait; phase accumulates with distance, intensity 0..1. */
  applyRun(phase: number, intensity: number): void {
    const p: Pose = { ...NEUTRAL_POSE };
    runPose(phase, intensity, p);
    this.applyPose(p);
  }

  faceToward(x: number, z: number): void {
    this.root.rotation.y = Math.atan2(x - this.root.position.x, z - this.root.position.z);
  }

  // ─── Batting ────────────────────────────────────────────────────────────

  /** Side-on guard stance, facing -z (bowler). Slight bounce on the toes. */
  battingStance(t: number): void {
    const p: Pose = { ...NEUTRAL_POSE };
    p.hipsRotY = -0.12;
    p.chestRotY = -0.18;
    p.chestRotX = 0.06;
    p.hipsY = 0.88 + Math.sin(t * 2.2) * 0.008;
    p.hipLRotX = 0.08;
    p.hipRRotX = -0.06;
    p.kneeLRotX = 0.18;
    p.kneeRRotX = 0.15;
    this.applyPose(p);
    // Bat taps the ground beside the back foot; both hands on the handle.
    this.batPivot.rotation.set(0.34 + Math.sin(t * 2.2) * 0.025, 0, 0.12);
    this.aimArmsToBat();
  }

  /** Point both arm chains at the bat handle (call after applyPose). */
  private aimArmsToBat(): void {
    if (!this.bat) return;
    const gripTop = new THREE.Vector3(0, -0.2, 0).applyQuaternion(this.batPivot.quaternion).add(this.batPivot.position);
    const gripLow = new THREE.Vector3(0, -0.3, 0).applyQuaternion(this.batPivot.quaternion).add(this.batPivot.position);
    this.aimArm(this.shL, this.elL, gripLow);
    this.aimArm(this.shR, this.elR, gripTop);
  }

  private aimArm(shoulder: THREE.Group, elbow: THREE.Group, targetChestLocal: THREE.Vector3): void {
    const dir = targetChestLocal.clone().sub(shoulder.position);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    shoulder.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    elbow.quaternion.identity();
    elbow.rotation.x = -0.25; // natural soft bend
  }

  /**
   * Full shot. `aimYaw` rotates the whole upper body into the shot line so a
   * cover drive and an on-drive read as genuinely different strokes.
   */
  playShot(kind: ShotKind, progress: number, aimYaw = 0): void {
    const p = Math.min(1, progress);
    const p2: Pose = { ...NEUTRAL_POSE };

    // Bat arc keyframes per shot (rotation.x of bat pivot: negative = backlift).
    const arcs: Record<ShotKind, { from: number; to: number; contact: number }> = {
      defend: { from: -0.15, to: 0.5, contact: 0.45 },
      drive: { from: -0.62, to: 1.75, contact: 0.48 },
      loft: { from: -0.7, to: 2.2, contact: 0.5 },
      cut: { from: -0.5, to: 1.5, contact: 0.5 },
      pull: { from: -0.55, to: 1.6, contact: 0.5 },
      sweep: { from: -0.4, to: 1.3, contact: 0.5 },
    };
    const a = arcs[kind];
    const contactVal = THREE.MathUtils.lerp(a.from, a.to, 0.72);
    this.batPivot.rotation.x = kf(p, [
      [0, -0.28],
      [0.16, a.from],
      [a.contact, contactVal],
      [1, a.to],
    ]);
    this.batPivot.rotation.z = kind === 'cut' || kind === 'pull' ? kf(p, [[0, 0.1], [a.contact, 0.9], [1, 0.6]]) : 0.1;

    const openAmount = kind === 'defend' ? 0.25 : kind === 'sweep' ? 0.75 : 0.55;
    p2.chestRotY = kf(p, [[0, -0.18], [0.16, -0.3], [a.contact, openAmount * 0.6], [1, openAmount]]) + aimYaw * 0.55;
    p2.hipsRotY = kf(p, [[0, -0.12], [0.2, -0.16], [a.contact, openAmount * 0.3], [1, openAmount * 0.45]]) + aimYaw * 0.3;
    p2.chestRotX = kf(p, [[0, 0.06], [0.16, -0.04], [a.contact, 0.1], [1, kind === 'loft' ? -0.22 : 0.12]]);

    if (kind === 'sweep') {
      // Drop to one knee, swing low and across.
      p2.hipsY = kf(p, [[0, 0.88], [a.contact, 0.55], [1, 0.6]]);
      p2.kneeLRotX = kf(p, [[0, 0.18], [a.contact, 1.9], [1, 1.8]]);
      p2.kneeRRotX = kf(p, [[0, 0.15], [a.contact, 0.4], [1, 0.5]]);
      p2.hipLRotX = kf(p, [[0, 0.08], [a.contact, -1.4], [1, -1.3]]);
      p2.hipRRotX = kf(p, [[0, -0.06], [a.contact, 0.9], [1, 0.8]]);
    } else {
      // Weight transfers forward through contact; front leg bracing.
      p2.hipsZ = kf(p, [[0, 0], [a.contact, kind === 'defend' ? 0.06 : 0.12], [1, 0.04]]);
      p2.hipsY = 0.88 + kf(p, [[0, 0], [0.16, -0.035], [a.contact, 0.02], [1, kind === 'loft' ? 0.05 : 0]]);
      p2.hipLRotX = kf(p, [[0, 0.08], [0.2, 0.18], [a.contact, -0.24], [1, -0.12]]);
      p2.hipRRotX = kf(p, [[0, -0.06], [0.2, -0.14], [a.contact, 0.12], [1, 0.16]]);
      p2.kneeLRotX = kf(p, [[0, 0.18], [a.contact, 0.12], [1, 0.2]]);
      p2.kneeRRotX = kf(p, [[0, 0.15], [a.contact, 0.35], [1, 0.25]]);
    }

    this.applyPose(p2);
    this.aimArmsToBat();
  }

  // ─── Bowling ────────────────────────────────────────────────────────────

  playBowlAction(progress: number): void {
    const p = Math.min(1, progress);
    const pose: Pose = { ...NEUTRAL_POSE };

    this.shR.rotation.x = kf(p, [
      [0, -1.1], [0.28, -2.3], [0.55, -1.0], [0.8, 2.4], [1, 2.9],
    ]);
    this.elR.rotation.x = -kf(p, [
      [0, 0.5], [0.28, 0.75], [0.55, 0.35], [0.8, 0.04], [1, 0.2],
    ]);
    this.shL.rotation.x = kf(p, [
      [0, -0.3], [0.3, -1.7], [0.6, -1.9], [0.8, 0.55], [1, 0.8],
    ]);
    this.elL.rotation.x = -kf(p, [
      [0, 0.4], [0.3, 0.15], [0.6, 0.1], [0.8, 0.65], [1, 0.85],
    ]);

    pose.hipsRotY = kf(p, [[0, -0.5], [0.3, -0.62], [0.6, -0.2], [0.85, 0.3], [1, 0.45]]);
    pose.chestRotY = kf(p, [[0, 0], [0.3, -0.22], [0.6, 0.15], [0.85, 0.95], [1, 1.15]]);
    pose.chestRotX = kf(p, [[0, 0.1], [0.3, 0.02], [0.6, -0.15], [0.85, -0.5], [1, -0.6]]);

    pose.hipLRotX = kf(p, [[0, -0.25], [0.25, -0.55], [0.5, -0.62], [1, -0.5]]);
    pose.kneeLRotX = kf(p, [[0, 0.35], [0.5, 0.14], [1, 0.25]]);
    pose.hipRRotX = kf(p, [[0, 0.3], [0.3, 0.5], [0.6, 0.15], [0.85, -0.4], [1, -0.55]]);
    pose.kneeRRotX = kf(p, [[0, 0.5], [0.3, 0.8], [0.6, 1.0], [0.85, 0.5], [1, 0.3]]);
    pose.hipsY = 0.9 + kf(p, [[0, 0], [0.3, -0.07], [0.65, 0.02], [1, 0.06]]);
    this.applyPose(pose);
  }

  // ─── Fielding ───────────────────────────────────────────────────────────

  fieldingReady(t: number): void {
    const p: Pose = { ...NEUTRAL_POSE };
    p.chestRotX = 0.22;
    p.hipsY = 0.84 + Math.sin(t * 3 + this.root.position.x) * 0.006;
    p.kneeLRotX = 0.35;
    p.kneeRRotX = 0.35;
    p.hipLRotX = -0.15;
    p.hipRRotX = -0.15;
    p.shLRotX = -0.5;
    p.shRRotX = -0.5;
    p.elLRotX = -0.35;
    p.elRRotX = -0.35;
    this.applyPose(p);
  }

  keeperStance(t: number): void {
    const p: Pose = { ...NEUTRAL_POSE };
    p.chestRotX = 0.55;
    p.hipsY = 0.62 + Math.sin(t * 2.5) * 0.005;
    p.kneeLRotX = 1.25;
    p.kneeRRotX = 1.25;
    p.hipLRotX = -0.85;
    p.hipRRotX = -0.85;
    p.shLRotX = -0.9;
    p.shRRotX = -0.9;
    p.elLRotX = -0.2;
    p.elRRotX = -0.2;
    this.applyPose(p);
  }

  /** Overarm throw toward root -z? Call faceToward first so root faces target. */
  playThrow(progress: number): void {
    const p = Math.min(1, progress);
    const pose: Pose = { ...NEUTRAL_POSE };
    this.shR.rotation.x = kf(p, [[0, -0.4], [0.35, -2.5], [0.62, 1.6], [1, 1.9]]);
    this.elR.rotation.x = -kf(p, [[0, 0.6], [0.35, 1.15], [0.62, 0.12], [1, 0.3]]);
    this.shL.rotation.x = kf(p, [[0, -0.5], [0.35, 0.6], [0.62, -1.1], [1, -0.8]]);
    pose.chestRotY = kf(p, [[0, -0.5], [0.35, -0.65], [0.62, 0.5], [1, 0.65]]);
    pose.chestRotX = kf(p, [[0, 0.1], [0.62, -0.25], [1, -0.3]]);
    pose.hipsRotY = pose.chestRotY * 0.5;
    pose.hipsY = 0.88 + kf(p, [[0, 0], [0.35, -0.05], [0.62, 0.03], [1, 0]]);
    this.applyPose(pose);
  }

  /** Athletic full-length dive, side: -1 left, +1 right (root-relative). */
  playDive(progress: number, side: 1 | -1): void {
    const p = Math.min(1, progress);
    const pose: Pose = { ...NEUTRAL_POSE };
    pose.chestRotX = kf(p, [[0, 0.2], [0.4, 0.4], [1, 0.15]]);
    this.root.rotation.z = side * kf(p, [[0, 0], [0.45, 1.35], [1, 1.5]]);
    this.hips.position.y = kf(p, [[0, 0.84], [0.35, 0.55], [0.7, 0.25], [1, 0.22]]);
    this.shL.rotation.x = -2.4 * p;
    this.shR.rotation.x = -2.4 * p;
    this.elL.rotation.x = -0.15;
    this.elR.rotation.x = -0.15;
    pose.hipLRotX = 0.5 * p;
    pose.hipRRotX = 0.55 * p;
    pose.kneeLRotX = 0.7 * p;
    pose.kneeRRotX = 0.75 * p;
    this.applyPose(pose);
  }

  recoverFromDive(): void {
    this.root.rotation.z = 0;
  }

  // ─── Emotion ────────────────────────────────────────────────────────────

  playCelebrate(kind: CelebrateKind, t: number): void {
    const p = Math.min(1, t);
    const pose: Pose = { ...NEUTRAL_POSE };
    if (kind === 'arms') {
      this.shL.rotation.set(-2.9 * Math.min(1, p * 2), 0, 0.5);
      this.shR.rotation.set(-2.9 * Math.min(1, p * 2), 0, -0.5);
      this.elL.rotation.x = -0.2;
      this.elR.rotation.x = -0.2;
      pose.hipsY = 0.9 + Math.abs(Math.sin(t * 6)) * 0.05;
    } else if (kind === 'jump') {
      pose.hipsY = 0.9 + Math.sin(Math.min(1, p * 1.2) * Math.PI) * 0.4;
      this.shL.rotation.set(-2.6 * Math.min(1, p * 3), 0, 0.3);
      this.shR.rotation.set(-2.6 * Math.min(1, p * 3), 0, -0.3);
      pose.kneeLRotX = Math.sin(p * Math.PI) * 0.9;
      pose.kneeRRotX = Math.sin(p * Math.PI) * 0.9;
    } else {
      // fist pump
      this.shR.rotation.set(kf(p, [[0, 0], [0.3, -1.4], [0.5, -0.9], [0.7, -1.4], [1, -1.2]]), 0, -0.2);
      this.elR.rotation.x = -1.8;
      pose.hipsY = 0.9 - Math.abs(Math.sin(t * 7)) * 0.03;
    }
    this.applyPose(pose);
  }

  playAppeal(t: number): void {
    const p = Math.min(1, t);
    const pose: Pose = { ...NEUTRAL_POSE };
    this.shL.rotation.set(-2.7 * Math.min(1, p * 3), 0, 0.35);
    this.shR.rotation.set(-2.7 * Math.min(1, p * 3), 0, -0.35);
    this.elL.rotation.x = -0.3;
    this.elR.rotation.x = -0.3;
    pose.chestRotX = -0.1;
    pose.hipsY = 0.9 + Math.sin(p * Math.PI) * 0.06;
    this.applyPose(pose);
  }

  /** Umpire signals, t = seconds since decision. */
  umpireSignal(kind: 'out' | 'four' | 'six' | 'wide' | 'legbye' | 'dead', t: number): void {
    const pose: Pose = { ...NEUTRAL_POSE };
    const p = Math.min(1, t * 1.6);
    if (kind === 'out') {
      this.shR.rotation.set(-1.5 * p, 0, -0.15);
      this.elR.rotation.x = -1.9 * p; // bent elbow, raised finger reads at distance
    } else if (kind === 'four') {
      const sweep = Math.sin(t * 4.5) * 0.8;
      this.shR.rotation.set(0, 0, -1.5);
      this.shR.rotation.y = sweep;
      this.elR.rotation.x = -0.15;
    } else if (kind === 'six') {
      this.shL.rotation.set(-Math.PI * p, 0, 0.12);
      this.shR.rotation.set(-Math.PI * p, 0, -0.12);
    } else if (kind === 'wide') {
      this.shL.rotation.set(0, 0, 1.5 * p);
      this.shR.rotation.set(0, 0, -1.5 * p);
      this.elL.rotation.x = 0;
      this.elR.rotation.x = 0;
    } else if (kind === 'legbye') {
      this.shR.rotation.set(0.4 * p, 0, -0.2);
      this.elR.rotation.x = -1.2 * p;
      pose.hipRRotX = -0.5 * p;
      pose.kneeRRotX = 0.8 * p;
    }
    this.applyPose(pose);
  }
}
