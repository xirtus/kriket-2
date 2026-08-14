import { POPPING_CREASE_FROM_STUMPS } from '../core/Constants';
import { BOWLER_STUMPS_Z, STRIKER_STUMPS_Z } from '../world/Pitch';

export const STRIKER_CREASE_Z = STRIKER_STUMPS_Z - POPPING_CREASE_FROM_STUMPS;
export const BOWLER_CREASE_Z = BOWLER_STUMPS_Z + POPPING_CREASE_FROM_STUMPS;

export type RunEnd = 'striker' | 'bowler';

interface Runner {
  z: number;
  dir: 0 | 1 | -1; // +1 = toward the bowler's end (z DECREASES in world space)
  speed: number;
  groundedEnd: RunEnd; // where they were last safely home
}

/**
 * Both batsmen as 1-D runners along the pitch. A run only counts when a runner
 * grounds at the OPPOSITE end from where they were last grounded — send-backs
 * therefore correctly score nothing, and every genuine crossing scores exactly one.
 */
export class RunningSim {
  private striker: Runner = { z: STRIKER_CREASE_Z, dir: 0, speed: 0, groundedEnd: 'striker' };
  private nonStriker: Runner = { z: BOWLER_CREASE_Z, dir: 0, speed: 0, groundedEnd: 'bowler' };
  runsCompleted = 0;

  private static readonly TOP_SPEED = 7.8;
  private static readonly ACCEL = 15;

  get strikerZ(): number {
    return this.striker.z;
  }
  get nonStrikerZ(): number {
    return this.nonStriker.z;
  }
  get strikerDir(): number {
    return this.striker.dir;
  }
  get nonStrikerDirV(): number {
    return this.nonStriker.dir;
  }
  get strikerRunning(): boolean {
    return this.striker.dir !== 0;
  }
  get nonStrikerRunning(): boolean {
    return this.nonStriker.dir !== 0;
  }

  startRun(): void {
    if (this.striker.dir === 0 && this.striker.groundedEnd === 'striker') this.striker.dir = 1;
    if (this.nonStriker.dir === 0 && this.nonStriker.groundedEnd === 'bowler') this.nonStriker.dir = -1;
  }

  sendBack(): void {
    if (this.striker.dir === 1) this.striker.dir = -1;
    else if (this.striker.dir === 0 && this.striker.groundedEnd === 'bowler') this.striker.dir = -1; // stay
    if (this.nonStriker.dir === -1) this.nonStriker.dir = 1;
    else if (this.nonStriker.dir === 0 && this.nonStriker.groundedEnd === 'striker') this.nonStriker.dir = 1;
  }

  /** Turn for another run after grounding. */
  continueRunning(): void {
    if (this.striker.dir === 0) {
      this.striker.dir = this.striker.groundedEnd === 'bowler' ? -1 : 1;
    }
    if (this.nonStriker.dir === 0) {
      this.nonStriker.dir = this.nonStriker.groundedEnd === 'striker' ? 1 : -1;
    }
  }

  private stepRunner(r: Runner, dt: number): void {
    if (r.dir === 0) return;
    r.speed = Math.min(RunningSim.TOP_SPEED, r.speed + RunningSim.ACCEL * dt);
    // The desperate stretch for the crease: a final lunge over the last 2.5m.
    const target = r.dir === 1 ? BOWLER_CREASE_Z : STRIKER_CREASE_Z;
    const remaining = Math.abs(r.z - target);
    const lunge = remaining < 2.5 ? 1.16 : 1;
    r.z -= r.speed * lunge * r.dir * dt;
    if (r.dir === 1 && r.z <= BOWLER_CREASE_Z) {
      r.z = BOWLER_CREASE_Z;
      this.arrive(r, 'bowler');
    } else if (r.dir === -1 && r.z >= STRIKER_CREASE_Z) {
      r.z = STRIKER_CREASE_Z;
      this.arrive(r, 'striker');
    }
  }

  private arrive(r: Runner, end: RunEnd): void {
    r.dir = 0;
    r.speed = 0;
    if (r.groundedEnd !== end) {
      if (r === this.striker) this.runsCompleted += 1; // score off the striker's crossings
      r.groundedEnd = end;
    }
  }

  update(dt: number): void {
    this.stepRunner(this.striker, dt);
    this.stepRunner(this.nonStriker, dt);
  }

  /** Nearest end by current position — where a batsman would actually dive. */
  private nearestEnd(r: Runner): RunEnd {
    return Math.abs(r.z - STRIKER_CREASE_Z) < Math.abs(r.z - BOWLER_CREASE_Z) ? 'striker' : 'bowler';
  }

  /** Snap a runner into their nearest crease (ball taken = they ground instantly). */
  private reground(r: Runner): void {
    const end = this.nearestEnd(r);
    r.z = end === 'striker' ? STRIKER_CREASE_Z : BOWLER_CREASE_Z;
    r.groundedEnd = end;
    r.dir = 0;
    r.speed = 0;
  }

  /** Ball has been taken at an end: everyone not out scrambles to safety. */
  regroundNearest(): void {
    this.reground(this.striker);
    this.reground(this.nonStriker);
  }

  /**
   * Is anyone out when the stumps are broken at `end`? A runner is only at risk
   * at the end they are CLOSEST to — anyone nearer the other end grounds there.
   */
  isShortOf(end: RunEnd): { short: boolean; who: 'striker' | 'nonStriker' | null; margin: number } {
    const candidates: { r: Runner; who: 'striker' | 'nonStriker' }[] = [
      { r: this.striker, who: 'striker' },
      { r: this.nonStriker, who: 'nonStriker' },
    ];
    for (const { r, who } of candidates) {
      if (r.groundedEnd === end && r.dir === 0) continue;
      if (this.nearestEnd(r) !== end) continue; // safely diving into the other end
      const margin = end === 'bowler' ? r.z - BOWLER_CREASE_Z : STRIKER_CREASE_Z - r.z;
      if (margin > 1.8) return { short: true, who, margin }; // dive reach covers anything tighter
    }
    return { short: false, who: null, margin: 0 };
  }

  stopAll(): void {
    this.striker.dir = 0;
    this.nonStriker.dir = 0;
    this.striker.speed = 0;
    this.nonStriker.speed = 0;
  }

  /** Reset for a new ball (grounded ends follow the CURRENT striker/non-striker). */
  reset(strikerAtBowlerEnd = false): void {
    this.striker = { z: strikerAtBowlerEnd ? BOWLER_CREASE_Z : STRIKER_CREASE_Z, dir: 0, speed: 0, groundedEnd: strikerAtBowlerEnd ? 'bowler' : 'striker' };
    this.nonStriker = { z: strikerAtBowlerEnd ? STRIKER_CREASE_Z : BOWLER_CREASE_Z, dir: 0, speed: 0, groundedEnd: strikerAtBowlerEnd ? 'striker' : 'bowler' };
    this.runsCompleted = 0;
  }
}
