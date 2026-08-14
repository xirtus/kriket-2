import type { PlayerSpec, PitchId, WeatherId } from '../cricket/Types';
import type { InningsState } from '../cricket/MatchState';
import type { DeliveryPlan } from '../gameplay/Delivery';
import type { DeliveryType } from '../physics/BallState';
import type { Rng } from '../core/Rng';
import { gaussian, range } from '../core/Rng';

/**
 * Bowling plans with real tactics: spells, phase-aware lengths, batter-specific
 * lines, and execution error scaled by the bowler's rating. Length is measured in
 * metres in front of the striker's stumps (0-1.5 yorker, 4-6 good length, 8+ short).
 */
export function planDelivery(
  bowler: PlayerSpec,
  batter: PlayerSpec,
  innings: InningsState,
  pitch: PitchId,
  weather: WeatherId,
  ballWear: number,
  overNumber: number,
  rng: Rng,
  extraErrScale = 1,
): DeliveryPlan {
  const skill = bowler.ratings.bowling / 100;
  const isSpinner = bowler.bowlStyle === 'offspin' || bowler.bowlStyle === 'legspin';
  const totalOvers = innings.oversLimit ?? 50;
  const deathPhase = innings.oversLimit !== null && overNumber >= totalOvers - 5;
  const powerplay = innings.oversLimit !== null && overNumber < (innings.oversLimit === 20 ? 6 : 10);
  const batterNew = innings.striker().balls < 8;
  const batterWeak = batter.ratings.batting < 60;

  let type: DeliveryType;
  let speedKmh: number;
  let spinRpm: number;
  let lengthM: number;
  let line: number;

  if (isSpinner) {
    const stock: DeliveryType = bowler.bowlStyle === 'offspin' ? 'offspin' : 'legspin';
    const r = rng();
    if (bowler.bowlStyle === 'legspin' && r < 0.18) type = 'googly';
    else if (r < 0.3) type = 'topspin';
    else type = stock;
    speedKmh = range(rng, 80, 92) + skill * 4;
    spinRpm = range(rng, 1500, 2300) * (0.8 + skill * 0.4);
    // Spinners attack the stumps on turning pitches, toss wider on flat ones.
    lengthM = pitch === 'dry_turner' ? range(rng, 4.2, 6.2) : range(rng, 3.6, 5.8);
    // Spinners attack off stump (line 0 = middle; negative = off side).
    line = batterWeak ? range(rng, -0.25, 0.0) : range(rng, -0.35, -0.1);
    if (deathPhase) {
      lengthM = range(rng, 2.2, 4.2);
      line = range(rng, -0.55, -0.35); // wide of off, make them reach
    }
  } else {
    const quick = bowler.bowlStyle === 'fast';
    const base = quick ? 126 + skill * 16 : 116 + skill * 12;
    const swingFriendly = weather !== 'clear' || ballWear < 0.25;
    const r = rng();
    if (deathPhase && r < 0.45) {
      // Yorkers at the base and hard length into the pitch.
      type = 'seam-up';
      lengthM = rng() < 0.6 ? range(rng, 0.2, 1.6) : range(rng, 7.5, 9.5);
      line = range(rng, -0.15, 0.1);
      speedKmh = base + range(rng, -3, 4);
    } else if (r < (swingFriendly ? 0.42 : 0.2)) {
      type = rng() < 0.55 ? 'outswing' : 'inswing';
      lengthM = range(rng, 3.4, 6.2);
      // Outswing starts at the stumps and leaves; inswing starts just outside
      // off and tails back toward the pads.
      line = type === 'outswing' ? range(rng, -0.15, 0.05) : range(rng, -0.12, 0.05);
      speedKmh = base + range(rng, -4, 2);
    } else if (r < 0.62 && !powerplay) {
      // Slower ball, into the pitch on off.
      type = 'seam-up';
      speedKmh = base - range(rng, 14, 22);
      lengthM = range(rng, 4.5, 7);
      line = range(rng, -0.3, -0.05);
    } else if (r < 0.72 && !batterNew) {
      // Bouncer at the body.
      type = 'seam-up';
      speedKmh = base + range(rng, 0, 5);
      lengthM = range(rng, 8.5, 11);
      line = range(rng, -0.1, 0.15);
    } else {
      // Stock: fourth-stump channel, fuller to new batters.
      type = 'seam-up';
      speedKmh = base + range(rng, -3, 3);
      lengthM = batterNew || batterWeak ? range(rng, 3.0, 4.8) : range(rng, 4.5, 6.8);
      line = range(rng, -0.38, -0.16);
    }
    spinRpm = range(rng, 140, 260);
    if (pitch === 'green_seamer' || pitch === 'damp_english') {
      // Seam bowlers hit the deck harder on helpful surfaces.
      if (rng() < 0.4) lengthM = range(rng, 5.5, 7.5);
    }
  }

  // Execution error: elite bowlers land it, club bowlers stray.
  const errScale = (1 - skill * 0.72) * extraErrScale;
  line += gaussian(rng) * 0.3 * errScale;
  lengthM += gaussian(rng) * 1.1 * errScale;
  speedKmh += gaussian(rng) * 1.2;

  return {
    type,
    speedKmh: Math.max(70, speedKmh),
    lengthFromStumps: Math.max(0.1, Math.min(12, lengthM)),
    lineOffset: line,
    spinRpm,
  };
}

/** Pick the next bowler: rotation with spells, phase-aware. */
export function chooseNextBowler(
  team: PlayerSpec[],
  innings: InningsState,
  lastBowlerId: string | null,
  overNumber: number,
  format: 'T20' | 'ODI' | 'TEST',
): PlayerSpec {
  const maxOvers = format === 'T20' ? 4 : format === 'ODI' ? 10 : 999;
  const eligible = team.filter((p) => p.bowlStyle !== 'none');
  const legal = eligible.filter((p) => {
    if (p.id === lastBowlerId) return false;
    const card = innings.bowlers.find((b) => b.spec.id === p.id);
    const bowled = card ? card.legalBalls / 6 : 0;
    return bowled < maxOvers;
  });
  const pool = legal.length > 0 ? legal : eligible.filter((p) => p.id !== lastBowlerId);
  if (pool.length === 0) return eligible[0];

  const total = format === 'T20' ? 20 : format === 'ODI' ? 50 : 50;
  const death = overNumber >= total - 5;
  const early = overNumber < (format === 'T20' ? 6 : 10);

  const score = (p: PlayerSpec): number => {
    let s = p.ratings.bowling;
    if (early && (p.bowlStyle === 'fast' || p.bowlStyle === 'medium')) s += 14;
    if (!early && !death && (p.bowlStyle === 'offspin' || p.bowlStyle === 'legspin')) s += 12;
    if (death && p.bowlStyle === 'fast') s += 10;
    const card = innings.bowlers.find((b) => b.spec.id === p.id);
    if (card && card.wickets > 0) s += card.wickets * 6; // keep a wicket-taker going
    if (card && card.legalBalls > 0 && card.runs / (card.legalBalls / 6) > 14) s -= 16; // getting milked
    return s;
  };
  pool.sort((a, b) => score(b) - score(a));
  // Small variance so the same bowler isn't automatic.
  const idx = Math.min(pool.length - 1, Math.floor(range(rngGlobal, 0, 1.6)));
  return pool[idx];
}

import { mulberry32 } from '../core/Rng';
const rngGlobal = mulberry32(1234567);
