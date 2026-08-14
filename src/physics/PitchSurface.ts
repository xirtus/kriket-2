import { Vector3 } from 'three';
import { BALL_RADIUS, BALL_MASS, BALL_MOMENT_OF_INERTIA } from '../core/Constants';
import { BallState } from './BallState';

export interface PitchProperties {
  restitution: number; // 0..1, vertical bounce energy retention
  friction: number; // Coulomb friction coefficient at the surface
  seamCatchiness: number; // 0..1, how much a proud seam grips/deviates the ball on pitching
  hardness: number; // 0..1, affects bounce consistency
  /** 0..1: how uneven the bounce is — shooters that stay low create LBWs/bowleds. */
  variableBounce?: number;
  rollDrag?: number; // 1/s, speed-proportional rolling resistance
  rollLin?: number; // m/s^2, constant rolling deceleration (balls fully stop)
  label: string;
}

export const PITCH_PRESETS: Record<string, PitchProperties> = {
  green_seamer: { restitution: 0.72, friction: 0.42, seamCatchiness: 0.85, hardness: 0.8, variableBounce: 0.3, rollDrag: 0.2, rollLin: 1.3, label: 'Green Seamer' },
  dry_turner: { restitution: 0.6, friction: 0.62, seamCatchiness: 0.35, hardness: 0.55, variableBounce: 0.55, rollDrag: 0.22, rollLin: 1.5, label: 'Dry Turner' },
  flat_batting: { restitution: 0.68, friction: 0.38, seamCatchiness: 0.25, hardness: 0.9, variableBounce: 0.1, rollDrag: 0.18, rollLin: 1.2, label: 'Flat Batting Deck' },
  damp_english: { restitution: 0.58, friction: 0.48, seamCatchiness: 0.7, hardness: 0.5, variableBounce: 0.4, rollDrag: 0.26, rollLin: 1.6, label: 'Damp Overcast' },
};

export interface BounceEvent {
  point: Vector3;
  speedBefore: number;
  lateralDeviation: number; // signed magnitude of the seam/turn kick applied, m/s
}

export function resolvePitchBounce(
  state: BallState,
  pitch: PitchProperties,
  rng?: () => number,
): BounceEvent {
  // Callers without a seeded rng (trajectory prediction) get the mean bounce so
  // predictions stay stable; live deliveries pass the match rng and get the noise.
  const roll = rng ?? Math.random;
  const speedBefore = state.velocity.length();
  state.position.y = BALL_RADIUS;

  // Uneven surfaces: the occasional shooter keeps low (LBW/bowled territory) or
  // a ball rears off a length. Energy never increases beyond a hard cap.
  let e = pitch.restitution;
  const vb = rng ? (pitch.variableBounce ?? 0) : 0;
  if (vb > 0) {
    const r = roll();
    if (r < vb * 0.22) e *= 0.5 + roll() * 0.3; // keeps low — skids through
    else if (r > 1 - vb * 0.07) e = Math.min(0.85, e * 1.15); // rears up
  }
  const mu = pitch.friction;

  const vyBefore = state.velocity.y;
  const normalImpulse = BALL_MASS * (1 + e) * Math.abs(vyBefore);
  state.velocity.y = -vyBefore * e;

  // Contact-point velocity for a sphere touching ground at r = (0, -R, 0): v + omega x r
  const r = new Vector3(0, -BALL_RADIUS, 0);
  const contactVel = state.velocity.clone().add(new Vector3().crossVectors(state.angularVelocity, r));
  contactVel.y = 0;

  if (contactVel.lengthSq() > 1e-6) {
    const tangentDir = contactVel.clone().normalize();
    const maxFrictionImpulse = mu * normalImpulse;
    const effectiveMass = 1 / (1 / BALL_MASS + (BALL_RADIUS * BALL_RADIUS) / BALL_MOMENT_OF_INERTIA);
    const idealImpulseMag = contactVel.length() * effectiveMass;
    const frictionImpulseMag = Math.min(maxFrictionImpulse, idealImpulseMag);
    const frictionImpulse = tangentDir.multiplyScalar(-frictionImpulseMag);

    state.velocity.addScaledVector(frictionImpulse, 1 / BALL_MASS);
    const angularImpulse = new Vector3().crossVectors(r, frictionImpulse);
    state.angularVelocity.addScaledVector(angularImpulse, 1 / BALL_MOMENT_OF_INERTIA);
  }

  // Seam catching the turf: an extra, semi-unpredictable lateral kick independent of spin/swing.
  let lateralDeviation = 0;
  const vDirFlat = state.velocity.clone().setY(0);
  if (vDirFlat.lengthSq() > 1e-6) {
    vDirFlat.normalize();
    const seamAngle = state.seamAxis.angleTo(vDirFlat);
    const seamPresentation = Math.sin(seamAngle * 2);
    const speed = state.velocity.length();
    let seamKickMag = pitch.seamCatchiness * Math.abs(seamPresentation) * (0.06 + 0.05 * (roll() - 0.5)) * speed;
    const lateral = new Vector3(-vDirFlat.z, 0, vDirFlat.x);
    if (roll() < 0.5) {
      lateral.negate();
      seamKickMag = -seamKickMag;
    }
    state.velocity.addScaledVector(lateral, Math.abs(seamKickMag));
    lateralDeviation = seamKickMag;
  }

  state.hasBounced = true;
  state.bounceCount += 1;

  return { point: state.position.clone(), speedBefore, lateralDeviation };
}
