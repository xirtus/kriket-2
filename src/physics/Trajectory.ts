import { Vector3 } from 'three';
import { BallState } from './BallState';
import { stepBall } from './Integrator';
import type { PitchProperties } from './PitchSurface';
import type { AeroEnv } from './Aerodynamics';

/** Clones the ball forward in time (no RNG: mean path), returning sampled positions.
 *  Used by fielders to pick intercept points and by LBW projection. */
export function predictTrajectory(
  state: BallState,
  pitch: PitchProperties,
  env: AeroEnv,
  horizonS = 3.0,
  dt = 1 / 60,
): Vector3[] {
  const clone = new BallState();
  clone.position.copy(state.position);
  clone.velocity.copy(state.velocity);
  clone.angularVelocity.copy(state.angularVelocity);
  clone.seamAxis.copy(state.seamAxis);
  clone.wear = state.wear;
  clone.hasBounced = state.hasBounced;
  clone.bounceCount = state.bounceCount;
  const pts: Vector3[] = [];
  const steps = Math.floor(horizonS / dt);
  for (let i = 0; i < steps; i++) {
    stepBall(clone, dt, pitch, undefined, env);
    pts.push(clone.position.clone());
    if (clone.velocity.length() < 0.4) break;
  }
  return pts;
}
