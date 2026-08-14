import * as THREE from 'three';

/** Smoothstep-interpolated piecewise curve through explicit [time, value] keyframes. */
export function kf(progress: number, points: ReadonlyArray<readonly [number, number]>): number {
  const p = THREE.MathUtils.clamp(progress, points[0][0], points[points.length - 1][0]);
  for (let i = 0; i < points.length - 1; i++) {
    const [t0, v0] = points[i];
    const [t1, v1] = points[i + 1];
    if (p <= t1) {
      const local = t1 > t0 ? (p - t0) / (t1 - t0) : 1;
      const eased = local * local * (3 - 2 * local);
      return THREE.MathUtils.lerp(v0, v1, eased);
    }
  }
  return points[points.length - 1][1];
}

/** All animatable joints of the unified cricketer rig, in local-rotation space. */
export interface Pose {
  hipsY: number; // vertical bob
  hipsX: number; // forward shift
  hipsZ: number;
  hipsRotY: number;
  chestRotX: number;
  chestRotY: number;
  headRotX: number;
  headRotY: number;
  shLRotX: number; shLRotZ: number;
  elLRotX: number;
  shRRotX: number; shRRotZ: number;
  elRRotX: number;
  hipLRotX: number; kneeLRotX: number;
  hipRRotX: number; kneeRRotX: number;
}

export const NEUTRAL_POSE: Pose = {
  hipsY: 0.9, hipsX: 0, hipsZ: 0, hipsRotY: 0,
  chestRotX: 0, chestRotY: 0,
  headRotX: 0, headRotY: 0,
  shLRotX: 0, shLRotZ: 0.12, elLRotX: -0.25,
  shRRotX: 0, shRRotZ: -0.12, elRRotX: -0.25,
  hipLRotX: 0, kneeLRotX: 0.06,
  hipRRotX: 0, kneeRRotX: 0.06,
};

export function copyPose(p: Pose): Pose {
  return { ...p };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = copyPose(a);
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    out[k] = a[k] + (b[k] - a[k]) * t;
  }
  return out;
}

export type PoseFn = (t: number, out: Pose) => void;

/** Running gait; phase 0..1 = one full stride cycle. intensity scales stride length. */
export function runPose(phase: number, intensity: number, out: Pose): void {
  const stride = Math.sin(phase * Math.PI * 2);
  const stride2 = Math.sin(phase * Math.PI * 2 + Math.PI);
  Object.assign(out, NEUTRAL_POSE);
  out.hipLRotX = stride * 0.75 * intensity;
  out.hipRRotX = stride2 * 0.75 * intensity;
  out.kneeLRotX = 0.25 + Math.max(0, -stride) * 1.15 * intensity;
  out.kneeRRotX = 0.25 + Math.max(0, -stride2) * 1.15 * intensity;
  out.shLRotX = stride2 * 0.6 * intensity;
  out.shRRotX = stride * 0.6 * intensity;
  out.elLRotX = -0.6 - Math.max(0, stride2) * 0.35;
  out.elRRotX = -0.6 - Math.max(0, stride) * 0.35;
  out.hipsY = 0.9 + Math.abs(Math.cos(phase * Math.PI * 2)) * 0.05 * intensity;
  out.chestRotX = 0.18 * intensity;
  out.hipsRotY = stride * 0.07;
}
