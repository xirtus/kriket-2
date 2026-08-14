import { Vector3 } from 'three';
import { BALL_MASS } from '../core/Constants';
import { BallState } from './BallState';

const EFFECTIVE_BAT_MASS = 0.58; // kg, effective swinging mass at the impact point (hands damp the rest)
const SPIN_GAIN = 18; // rad/s per m/s of tangential steer, tuned for visually readable post-shot spin

export interface BatSwing {
  velocity: Vector3; // bat head velocity at moment of contact
  faceNormal: Vector3; // unit vector: direction the bat face is aimed (intended shot direction)
  sweetSpotOffset: number; // meters off the true sweet spot (0 = perfect)
  timingError: number; // seconds, +late / -early
}

export type ContactOutcome = 'middled' | 'mistimed' | 'edge' | 'missed';

export interface ContactResult {
  outcome: ContactOutcome;
  quality: number; // 0..1
  exitSpeed: number;
}

const MAX_OFFSET_FOR_CONTACT = 0.24; // m, beyond this it's a total miss
const MAX_TIMING_FOR_CONTACT = 0.11; // s, +/-110ms - human reaction-time-scale swing-and-miss window

// Quality falloff scales: a merely-good (not frame-perfect) swing against a straight, good-length
// ball should still comfortably middle it, while only near-perfect timing/line lands the highest
// quality. ~40ms of timing error alone still clears the 'middled' bar; ~45ms+ or ~0.1m+ of line
// error starts dragging a shot into 'mistimed' territory without yet being an outright miss.
const OFFSET_QUALITY_SCALE = 0.17; // m
const TIMING_QUALITY_SCALE = 0.065; // s

export function resolveBatContact(state: BallState, swing: BatSwing): ContactResult {
  const offsetPenalty = Math.abs(swing.sweetSpotOffset) / OFFSET_QUALITY_SCALE;
  const timingPenalty = Math.abs(swing.timingError) / TIMING_QUALITY_SCALE;
  const quality = clamp01(1 - 0.6 * offsetPenalty - 0.6 * timingPenalty);

  if (Math.abs(swing.sweetSpotOffset) > MAX_OFFSET_FOR_CONTACT || Math.abs(swing.timingError) > MAX_TIMING_FOR_CONTACT) {
    return { outcome: 'missed', quality: 0, exitSpeed: state.velocity.length() };
  }

  const faceNormal = swing.faceNormal.clone().normalize();
  const isEdge = Math.abs(swing.sweetSpotOffset) > 0.09;

  const cor = 0.42 + 0.33 * quality; // realistic trampoline: middled ~0.75, mistimed much deader

  const vBallN = state.velocity.dot(faceNormal);
  const vBatN = swing.velocity.dot(faceNormal);
  const m1 = BALL_MASS;
  const m2 = EFFECTIVE_BAT_MASS;
  const vBallNAfter = ((m1 - cor * m2) * vBallN + (1 + cor) * m2 * vBatN) / (m1 + m2);

  const ballTangential = state.velocity.clone().addScaledVector(faceNormal, -vBallN);
  const batTangential = swing.velocity.clone().addScaledVector(faceNormal, -vBatN);
  const steerBlend = isEdge ? 0.15 : clamp01(0.15 + quality * 0.75);
  const newTangential = ballTangential.multiplyScalar(1 - steerBlend).addScaledVector(batTangential, steerBlend);

  const newVelocity = faceNormal.clone().multiplyScalar(vBallNAfter).add(newTangential);
  state.velocity.copy(newVelocity);

  const spinAxis = new Vector3().crossVectors(faceNormal, newTangential.clone().normalize());
  if (spinAxis.lengthSq() > 1e-6) {
    spinAxis.normalize();
    state.angularVelocity.copy(spinAxis).multiplyScalar(SPIN_GAIN * (1 - quality * 0.5) * (isEdge ? 0.4 : 1));
  } else {
    state.angularVelocity.set(0, 0, 0);
  }

  const outcome: ContactOutcome = isEdge ? 'edge' : quality > 0.55 ? 'middled' : 'mistimed';
  return { outcome, quality, exitSpeed: state.velocity.length() };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
