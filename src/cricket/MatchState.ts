import type { BallResolution, Dismissal, Format, TeamSpec, PlayerSpec } from './Types';

export interface BatsmanCard {
  spec: PlayerSpec;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: Dismissal | null;
}

export interface BowlerCard {
  spec: PlayerSpec;
  legalBalls: number;
  runs: number;
  wickets: number;
}

export interface Extras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

export class InningsState {
  runs = 0;
  wickets = 0;
  legalBalls = 0;
  readonly extras: Extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
  readonly batsmen: BatsmanCard[] = [];
  readonly bowlers: BowlerCard[] = [];
  readonly history: BallResolution[] = [];
  strikerIdx = 0;
  nonStrikerIdx = 1;
  nextInIdx = 2;
  target: number | null = null;
  freeHitNext = false;
  declared = false;

  constructor(
    readonly batting: TeamSpec,
    readonly bowling: TeamSpec,
    readonly oversLimit: number | null,
  ) {
    for (const p of batting.players) {
      this.batsmen.push({ spec: p, runs: 0, balls: 0, fours: 0, sixes: 0, out: null });
    }
  }

  get oversFloat(): number {
    return Math.floor(this.legalBalls / 6) + (this.legalBalls % 6) / 10;
  }

  get oversText(): string {
    return `${Math.floor(this.legalBalls / 6)}.${this.legalBalls % 6}`;
  }

  get oversBowled(): number {
    return this.legalBalls / 6;
  }

  get runRate(): number {
    return this.legalBalls > 0 ? (this.runs / this.legalBalls) * 6 : 0;
  }

  get requiredRate(): number | null {
    if (this.target === null || this.oversLimit === null) return null;
    const ballsLeft = this.oversLimit * 6 - this.legalBalls;
    if (ballsLeft <= 0) return null;
    return ((this.target - this.runs) / ballsLeft) * 6;
  }

  striker(): BatsmanCard {
    return this.batsmen[this.strikerIdx];
  }

  nonStriker(): BatsmanCard {
    return this.batsmen[this.nonStrikerIdx];
  }

  bowlerCard(spec: PlayerSpec): BowlerCard {
    let c = this.bowlers.find((b) => b.spec.id === spec.id);
    if (!c) {
      c = { spec, legalBalls: 0, runs: 0, wickets: 0 };
      this.bowlers.push(c);
    }
    return c;
  }

  applyBall(res: BallResolution, bowler: PlayerSpec): void {
    const totalExtras = res.extras.wides + res.extras.noBalls + res.extras.byes + res.extras.legByes;
    this.runs += res.runsOffBat + totalExtras;
    this.extras.wides += res.extras.wides;
    this.extras.noBalls += res.extras.noBalls;
    this.extras.byes += res.extras.byes;
    this.extras.legByes += res.extras.legByes;
    if (res.legal) this.legalBalls += 1;

    const bat = this.striker();
    if (res.extras.wides === 0) {
      bat.balls += 1;
      bat.runs += res.runsOffBat;
      if (res.boundary === 4) bat.fours += 1;
      if (res.boundary === 6) bat.sixes += 1;
    }

    const bc = this.bowlerCard(bowler);
    if (res.legal) bc.legalBalls += 1;
    bc.runs += res.runsOffBat + res.extras.wides + res.extras.noBalls;

    if (res.dismissal) {
      this.wickets += 1;
      const dismissedIdx = res.dismissal.batsmanId === this.nonStriker().spec.id ? this.nonStrikerIdx : this.strikerIdx;
      this.batsmen[dismissedIdx].out = res.dismissal;
      if (res.dismissal.kind !== 'runout') bc.wickets += 1;
      // New batter comes to the end of the dismissed player.
      if (this.nextInIdx < this.batsmen.length) {
        if (dismissedIdx === this.strikerIdx) this.strikerIdx = this.nextInIdx;
        else this.nonStrikerIdx = this.nextInIdx;
        this.nextInIdx += 1;
      }
    } else {
      // Odd runs (incl. byes/leg-byes) swap strike; wide/no-ball runs don't of themselves.
      const swapRuns = res.runsOffBat + res.extras.byes + res.extras.legByes;
      if (swapRuns % 2 === 1) this.swapStrike();
    }
    this.history.push(res);
  }

  swapStrike(): void {
    const t = this.strikerIdx;
    this.strikerIdx = this.nonStrikerIdx;
    this.nonStrikerIdx = t;
  }

  isComplete(format: Format): boolean {
    if (this.target !== null && this.runs >= this.target) return true;
    if (this.wickets >= 10) return true;
    if (this.oversLimit !== null && this.legalBalls >= this.oversLimit * 6) return true;
    if (format === 'TEST' && this.declared) return true;
    return false;
  }
}

export type MatchResult =
  | { kind: 'win'; winner: TeamSpec; margin: string }
  | { kind: 'tie' }
  | { kind: 'draw' }
  | { kind: 'inprogress' };

export class MatchState {
  readonly innings: InningsState[] = [];
  currentIdx = 0;

  constructor(
    readonly format: Format,
    readonly teamA: TeamSpec, // bats first
    readonly teamB: TeamSpec,
  ) {
    const overs = format === 'T20' ? 20 : format === 'ODI' ? 50 : null;
    this.innings.push(new InningsState(teamA, teamB, overs));
  }

  current(): InningsState {
    return this.innings[this.currentIdx];
  }

  totalInningsCount(): number {
    return this.format === 'TEST' ? 4 : 2;
  }

  beginNextInnings(): void {
    const prev = this.current();
    const overs = this.format === 'T20' ? 20 : this.format === 'ODI' ? 50 : null;
    const next = new InningsState(prev.bowling, prev.batting, overs);
    if (this.format !== 'TEST' && this.currentIdx === 0) {
      next.target = prev.runs + 1;
    }
    if (this.format === 'TEST' && this.currentIdx === 2) {
      // 4th innings chase target = lead + 1
      const a = this.innings[0].runs + (this.innings[2]?.runs ?? 0);
      const b = this.innings[1].runs;
      const lead = a - b;
      if (lead >= 0) next.target = lead + 1;
    }
    this.innings.push(next);
    this.currentIdx += 1;
  }

  isMatchComplete(): boolean {
    const cur = this.current();
    if (this.format !== 'TEST') {
      if (this.currentIdx === 0) return false;
      return cur.isComplete(this.format);
    }
    // Test: complete after 4th innings, or an innings victory, or 4 innings done.
    const done = this.innings.filter((i) => i.isComplete('TEST')).length;
    if (this.currentIdx >= 3 && cur.isComplete('TEST')) return true;
    if (done >= 4) return true;
    // Innings victory check.
    if (this.currentIdx >= 2) {
      const xA = this.innings[0].runs + (this.innings[2]?.runs ?? 0);
      const xB = this.innings[1].runs + (this.innings[3]?.runs ?? 0);
      const curIsA = cur.batting.id === this.teamA.id;
      if (cur.isComplete('TEST')) {
        if (!curIsA && xB > xA) return true; // B wins (possibly by innings)
        if (curIsA && xA > xB) return true;
      }
    }
    return false;
  }

  result(): MatchResult {
    if (!this.isMatchComplete()) return { kind: 'inprogress' };
    if (this.format !== 'TEST') {
      const a = this.innings[0];
      const b = this.innings[1];
      if (b.runs >= a.runs + 1) {
        return { kind: 'win', winner: b.batting, margin: `${10 - b.wickets} wicket${10 - b.wickets === 1 ? '' : 's'}` };
      }
      if (a.runs === b.runs) return { kind: 'tie' };
      return { kind: 'win', winner: a.batting, margin: `${a.runs - b.runs} run${a.runs - b.runs === 1 ? '' : 's'}` };
    }
    const aTotal = this.innings[0].runs + (this.innings[2]?.runs ?? 0);
    const bTotal = this.innings[1].runs + (this.innings[3]?.runs ?? 0);
    if (aTotal === bTotal) return { kind: 'draw' };
    const winner = aTotal > bTotal ? this.teamA : this.teamB;
    const loserInns = winner.id === this.teamA.id ? bTotal : aTotal;
    const winInns = winner.id === this.teamA.id ? aTotal : bTotal;
    const margin = `${winInns - loserInns} runs`;
    return { kind: 'win', winner, margin };
  }
}

export function oversLimitFor(format: Format): number | null {
  return format === 'T20' ? 20 : format === 'ODI' ? 50 : null;
}
