
import type { BattingController, BattingView, ShotCommand } from '../gameplay/Delivery';
import type { RunningSim } from '../gameplay/Running';
import type { PlayerSpec, Format } from '../cricket/Types';
import type { FieldPlacement } from '../cricket/Field';
import type { ShotKind } from '../entities/Cricketer';
import * as THREE from 'three';
import type { Rng } from '../core/Rng';
import { gaussian, clamp01, range } from '../core/Rng';

/**
 * AI batsman: reads line/length from early flight, picks a shot from the situation
 * and its own rating, then executes with skill-scaled timing error. Also makes
 * running judgments. The same controller interface drives the human, so AI vs AI
 * matches play through the identical physical pipeline as human matches.
 */
export class BatterBrain implements BattingController {
  private decided = false;
  private command: ShotCommand | null = null;
  private swingAt: number = Infinity; // tSinceRelease when the swing fires
  private aggression: number;

  constructor(
    private readonly spec: PlayerSpec,
    private readonly rng: Rng,
    format: Format,
    private readonly getSituation: () => { runsNeeded: number | null; ballsLeft: number | null; wicketsDown: number },
    private readonly getField: () => FieldPlacement,
    private readonly getBowlerSkill: () => number = () => 75,
  ) {
    const base = spec.ratings.batting / 100;
    this.isTest = format === 'TEST';
    this.isOdi = format === 'ODI';
    this.aggression = clamp01(0.35 + base * 0.4 + (format === 'T20' ? 0.2 : format === 'TEST' ? -0.3 : -0.12));
  }

  private formatIsTest(): boolean {
    return this.isTest;
  }
  private formatIsOdi(): boolean {
    return this.isOdi;
  }
  private isTest = false;
  private isOdi = false;

  /** Fresh ball. */
  reset(): void {
    this.decided = false;
    this.command = null;
    this.swingAt = Infinity;
  }

  onFlight(view: BattingView, _dt: number): ShotCommand | null {
    const skill = this.spec.ratings.batting / 100;

    // Decide early in flight, once a length read is available.
    if (!this.decided && view.tSinceRelease > 0.06) {
      this.decided = true;
      this.planShot(view, skill);
    }

    if (this.command && view.tSinceRelease >= this.swingAt) {
      const out = this.command;
      this.command = null;
      return out;
    }
    return null;
  }

  private planShot(view: BattingView, skill: number): void {
    const sit = this.getSituation();
    const rng = this.rng;

    // Length estimate: where will it pitch / how high at the plane.
    const predictedY = view.predictedY;
    const line = view.predictedX - 0.42; // vs guard
    const isShort = predictedY > 1.1;
    const isFull = predictedY < 0.45;
    const tooHigh = predictedY > 1.55; // genuinely rising over the shoulder — duck it
    const wideOff = line < -0.95; // genuinely wide of the off-side channel
    const onLegs = line > 0.3;

    // Situation aggression.
    let aggro = this.aggression;
    if (sit.runsNeeded !== null && sit.ballsLeft !== null && sit.ballsLeft > 0) {
      const rrr = (sit.runsNeeded / sit.ballsLeft) * 6;
      if (rrr > 9) aggro = clamp01(aggro + 0.3);
      else if (rrr > 7) aggro = clamp01(aggro + 0.15);
      else if (rrr < 4.5) aggro = clamp01(aggro - 0.15);
    }
    const wkGate = this.isTest ? 99 : this.formatIsOdi() ? 5 : 7;
    if (sit.wicketsDown >= wkGate + 2) aggro = clamp01(aggro - 0.35);
    else if (sit.wicketsDown >= wkGate) aggro = clamp01(aggro - 0.18);
    if (view.noBall) aggro = 1; // free swing

    // Leave wide junk alone unless chasing hard (Tests: leaves are a virtue).
    if (wideOff && rng() > (this.formatIsTest() ? aggro * 0.3 : aggro * 0.75)) {
      return;
    }
    if (this.formatIsTest() && rng() < 0.14 && view.predictedY > 0.35) {
      return; // shouldering arms
    }
    // Sway/duck the ball that's too high to control — survival instinct.
    if (tooHigh && rng() > (aggro - 0.35) * 0.5) {
      return;
    }

    // Shot sector follows the ball's line: you hit it where it deserves to go.
    const linePos = line; // >0 leg side, <0 off side (vs guard 0.42)
    let sector: [number, number];
    if (linePos > 0.35) sector = [-58, -8];
    else if (linePos > 0.12) sector = [-38, 8];
    else if (linePos < -0.5) sector = [20, 78];
    else if (linePos < -0.15) sector = [-2, 48];
    else sector = [-24, 28];

    let kind: ShotKind;
    let aimDeg: number;
    const r = rng();

    if (isShort) {
      if (r < 0.28 + aggro * 0.5) {
        kind = line > 0.05 || rng() < 0.5 ? 'pull' : 'cut';
        aimDeg = kind === 'pull' ? range(rng, -75, -35) : range(rng, 45, 80);
      } else {
        kind = 'defend';
        aimDeg = range(rng, -15, 15);
      }
    } else if (isFull) {
      if (r < 0.2 + aggro * 0.55) {
        kind = rng() < aggro * 0.33 ? 'loft' : 'drive';
        aimDeg = this.pickGap(rng, false, sector[0] + 8, sector[1] + 10);
      } else if (onLegs && r > 0.85) {
        kind = 'sweep';
        aimDeg = range(rng, -70, -40);
      } else {
        kind = 'drive';
        aimDeg = range(rng, Math.max(-25, sector[0]), Math.min(25, sector[1]));
      }
    } else {
      // Good length: respect it unless the game demands otherwise.
      if (r < 0.18 + aggro * 0.4) {
        kind = rng() < 0.78 ? 'drive' : 'loft';
        aimDeg = this.pickGap(rng, rng() < 0.5, sector[0], sector[1] + 8);
      } else if (onLegs && r > 0.9) {
        kind = 'sweep';
        aimDeg = range(rng, -65, -40);
      } else {
        kind = 'defend';
        aimDeg = range(rng, Math.max(-20, sector[0]), Math.min(20, sector[1]));
      }
    }

    // Charging down the track: spin-hitters in limited overs.
    const charge = !isShort && aggro > 0.62 && rng() < 0.09 && sit.wicketsDown < 8;

    // Bat follows the LINE READ: aim tracks the judged line exactly, biased a
    // little toward gaps. Misreads (and late swing) are what beat the bat.
    // Deception gap: elite bowling vs weak batting genuinely beats the bat.
    const deception = 1 + Math.max(-0.15, (this.getBowlerSkill() - this.spec.ratings.batting) / 70);
    const lineErr = gaussian(rng) * (1 - skill * 0.82) * 9 * deception;
    const readLine = line + THREE.MathUtils.degToRad(lineErr) * 1.2;
    const aimIdeal = -Math.atan2(readLine, 1.35) * (180 / Math.PI);
    let readAim = aimIdeal;
    if (kind === 'drive' || kind === 'defend' || kind === 'loft') {
      const gapBias = THREE.MathUtils.clamp(aimDeg - aimIdeal, -14, 14);
      aimDeg = aimIdeal + gapBias * (0.3 + (1 - skill) * 0.5);
    } else {
      readAim = THREE.MathUtils.clamp(aimDeg, -36, 36);
    }

    // Timing: when to trigger relative to ball reaching the plane. Skill shrinks error.
    const baseTime = view.tSinceRelease + Math.max(0, view.timeToPlane);
    const err = gaussian(rng) * (0.165 - skill * 0.115) * deception;
    this.swingAt = Math.max(view.tSinceRelease + 0.02, baseTime + err - 0.14); // trigger slightly early: anim has windup
    this.command = { kind, aimDeg, readAimDeg: readAim, charge };
  }

  /** Aim toward the emptiest region of the field, within the shot's sector. */
  private pickGap(rng: Rng, legSideBias: boolean, lo = -42, hi = 42): number {
    const field = this.getField();
    // Sample candidate angles, score by distance to nearest fielder.
    let bestA = 0;
    let bestScore = -Infinity;
    for (let a = Math.ceil(lo); a <= hi; a += 8) {
      let nearest = Infinity;
      for (const s of field.slots) {
        const d = Math.abs(s.angle - a) * 1.4 + Math.abs(s.dist - 32) * 0.35;
        nearest = Math.min(nearest, d);
      }
      const noise = rng() * 7;
      const score = nearest + noise - Math.abs(a) * 0.05 + (legSideBias && a < 0 ? 6 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestA = a;
      }
    }
    return bestA + (rng() - 0.5) * 8;
  }

  onInPlay(_running: RunningSim, _ballPos: THREE.Vector3): void {
    // Run judgment is centralized in the Delivery (return-time estimates); the
    // batter brain only watches for genuine suicide missions.
  }
}
