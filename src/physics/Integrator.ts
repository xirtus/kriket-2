import { Quaternion, Vector3 } from 'three';
import { GRAVITY, BALL_MASS, BALL_RADIUS } from '../core/Constants';
import { BallState } from './BallState';
import { computeAeroForces, type AeroEnv } from './Aerodynamics';
import { resolvePitchBounce } from './PitchSurface';
import type { PitchProperties, BounceEvent } from './PitchSurface';

const GROUND_Y = BALL_RADIUS;
const _spinQuat = new Quaternion();
const _spinAxis = new Vector3();

export interface StepResult {
  bounce: BounceEvent | null;
}

export function stepBall(state: BallState, dt: number, pitch: PitchProperties, rng?: () => number, env?: AeroEnv): StepResult {
  if (state.isDead) return { bounce: null };

  const aero = computeAeroForces(state, env);
  const accel = aero.total.divideScalar(BALL_MASS);
  accel.y -= GRAVITY;

  state.velocity.addScaledVector(accel, dt);
  state.position.addScaledVector(state.velocity, dt);

  // Integrate visual spin orientation
  const omegaMag = state.angularVelocity.length();
  if (omegaMag > 1e-4) {
    _spinAxis.copy(state.angularVelocity).normalize();
    _spinQuat.setFromAxisAngle(_spinAxis, omegaMag * dt);
    state.orientation.premultiply(_spinQuat);
  }

  let bounce: BounceEvent | null = null;
  if (state.position.y <= GROUND_Y && state.velocity.y < 0) {
    bounce = resolvePitchBounce(state, pitch, rng);
  }

  // Rolling resistance once the ball is on the turf: linear + proportional
  // deceleration, so balls lose pace naturally and actually stop.
  if (state.position.y <= GROUND_Y + 0.005 && Math.abs(state.velocity.y) < 1.2) {
    const lin = pitch.rollLin ?? 0;
    const prop = pitch.rollDrag ?? 0;
    if (lin > 0 || prop > 0) {
      const hSpeed = Math.hypot(state.velocity.x, state.velocity.z);
      if (hSpeed > 1e-4) {
        const dec = lin + prop * hSpeed;
        const newSpeed = Math.max(0, hSpeed - dec * dt);
        const k = newSpeed / hSpeed;
        state.velocity.x *= k;
        state.velocity.z *= k;
      }
      state.velocity.y = Math.max(state.velocity.y, 0);
    }
  }

  return { bounce };
}
